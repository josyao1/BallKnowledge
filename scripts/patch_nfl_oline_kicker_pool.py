#!/usr/bin/env python3
"""
patch_nfl_oline_kicker_pool.py — Patch nfl_lineup_pool.json without full regeneration.

Adds/upgrades two groups of players:
  1. Offensive linemen (C, G, T, OT, OL, OG) — gp-only from snap counts (total_gp mode)
  2. Kickers (K) — upgraded with fg/pat stat columns (fpts mode)

Existing skill/defensive players are untouched.

Run:
    cd scripts
    python patch_nfl_oline_kicker_pool.py

Then:
    cp data/nfl_lineup_pool.json ../public/data/nfl_lineup_pool.json
"""

import json
import os
import sys

try:
    import nfl_data_py as nfl
except ImportError:
    print("ERROR: nfl_data_py not installed. Run: pip install nfl-data-py")
    sys.exit(1)

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Run: pip install pandas pyarrow")
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────

POOL_PATH  = os.path.join(os.path.dirname(__file__), "data", "nfl_lineup_pool.json")
YEARS      = list(range(2010, 2026))
SNAP_YEARS = [y for y in YEARS if y >= 2013]  # snap count data starts 2013

OL_POSITIONS   = {"C", "G", "T", "OT", "OL", "OG"}
MIN_SEASONS_OL = 4  # must have appeared on a roster for at least this many seasons

# New kickers added to the pool must have fg_made >= 10 in at least this many seasons
MIN_K_QUALIFYING_SEASONS = 2

NFLVERSE_STATS_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "stats_player/stats_player_reg_{year}.parquet"
)

# ─── Helpers ─────────────────────────────────────────────────────────────────

def safe_int(val, default=0):
    try:
        if val is None:
            return default
        f = float(val)
        return default if f != f else int(f)
    except (ValueError, TypeError):
        return default


def safe_str(val, default=""):
    if val is None:
        return default
    s = str(val)
    return default if s in ("nan", "None", "") else s


def load_kicking_stats(years):
    """Load kicker seasonal stats from nflverse parquet files.
    The nflverse stats_player_reg parquet includes all positions (including K)
    and exists for all years. We filter to position=='K' after loading.
    """
    frames = []
    for year in years:
        url = NFLVERSE_STATS_URL.format(year=year)
        try:
            df = pd.read_parquet(url)
            if "passing_interceptions" in df.columns and "interceptions" not in df.columns:
                df = df.rename(columns={"passing_interceptions": "interceptions"})
            # Keep only kicker rows
            if "position" in df.columns:
                df = df[df["position"] == "K"]
            elif "fg_made" in df.columns:
                df = df[df["fg_made"].notna() & (df["fg_made"] > 0)]
            if not df.empty:
                frames.append(df)
        except Exception as e:
            print(f"  WARNING: Could not fetch {year}: {e}")
    if frames:
        combined = pd.concat(frames, ignore_index=True)
        print(f"  Loaded {len(combined)} kicker-season rows across {len(years)} years")
        return combined
    return None


def build_bio(roster_row) -> dict:
    height_str = ""
    hv = roster_row.get("height")
    if hv and safe_str(hv):
        try:
            inches = int(float(hv))
            height_str = f"{inches // 12}-{inches % 12}"
        except (ValueError, TypeError):
            pass
    return {
        "height":       height_str,
        "weight":       safe_int(roster_row.get("weight")),
        "college":      safe_str(roster_row.get("college")),
        "years_exp":    safe_int(roster_row.get("years_exp")),
        "draft_club":   safe_str(roster_row.get("draft_club")),
        "draft_number": safe_int(roster_row.get("draft_number")),
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not os.path.exists(POOL_PATH):
        print(f"ERROR: {POOL_PATH} not found. Run generate_nfl_lineup_pool.py first.")
        sys.exit(1)

    with open(POOL_PATH) as f:
        pool = json.load(f)
    pool_by_id: dict[str, dict] = {str(p["player_id"]): p for p in pool}
    print(f"Loaded {len(pool)} existing players from nfl_lineup_pool.json")

    # ── Rosters ───────────────────────────────────────────────────────────────
    print(f"\nLoading rosters ({YEARS[0]}–{YEARS[-1]})...")
    roster_df = nfl.import_seasonal_rosters(YEARS)
    roster_df = roster_df.drop_duplicates(subset=["player_id", "season"], keep="first")
    print(f"  {len(roster_df)} roster rows")

    # ── Snap counts (OL GP) ───────────────────────────────────────────────────
    print(f"Loading snap counts ({SNAP_YEARS[0]}–{SNAP_YEARS[-1]})...")
    snaps_df = nfl.import_snap_counts(SNAP_YEARS)
    snap_gp_pfr:  dict[str, dict] = {}
    snap_gp_name: dict[str, dict] = {}
    if snaps_df is not None and not snaps_df.empty:
        for _, row in snaps_df.iterrows():
            season = safe_int(row.get("season"))
            team   = safe_str(row.get("team"), "???")
            if not season or team == "???":
                continue
            key = (season, team)
            pfr_id = safe_str(row.get("pfr_player_id"))
            if pfr_id:
                if pfr_id not in snap_gp_pfr:
                    snap_gp_pfr[pfr_id] = {}
                snap_gp_pfr[pfr_id][key] = snap_gp_pfr[pfr_id].get(key, 0) + 1
            raw_name = safe_str(row.get("player"))
            if raw_name:
                norm = raw_name.lower().encode("ascii", "ignore").decode()
                if norm not in snap_gp_name:
                    snap_gp_name[norm] = {}
                snap_gp_name[norm][key] = snap_gp_name[norm].get(key, 0) + 1
    print(f"  Snap GP built: {len(snap_gp_pfr)} pfr IDs, {len(snap_gp_name)} name keys")

    # ── Kicking stats (kicker upgrade) ────────────────────────────────────────
    print(f"Loading kicking stats ({YEARS[0]}–{YEARS[-1]})...")
    stats_df = load_kicking_stats(YEARS)

    # Extract kicker rows and build per-(player_id, season) lookup
    kicker_stats_by_pid_yr: dict[tuple, dict] = {}
    if stats_df is not None:
        print(f"  {len(stats_df)} kicker rows total")
        # kicking stat_type returns only kickers, but filter anyway for safety
        if "position" in stats_df.columns:
            kicker_rows = stats_df[stats_df["position"] == "K"]
        elif "fg_made" in stats_df.columns:
            kicker_rows = stats_df[stats_df["fg_made"].notna() & (stats_df["fg_made"] > 0)]
        else:
            kicker_rows = stats_df

        for _, row in kicker_rows.iterrows():
            pid = safe_str(row.get("player_id"))
            yr  = safe_int(row.get("season"))
            if not pid or not yr:
                continue
            fg_made_50p = safe_int(row.get("fg_made_50_59")) + safe_int(row.get("fg_made_60_"))
            kicker_stats_by_pid_yr[(pid, yr)] = {
                "gp":            safe_int(row.get("games")),
                "team":          safe_str(row.get("recent_team"), "???"),
                "fg_made":       safe_int(row.get("fg_made")),
                "fg_att":        safe_int(row.get("fg_att")),
                "fg_made_40_49": safe_int(row.get("fg_made_40_49")),
                "fg_made_50p":   fg_made_50p,
                "pat_made":      safe_int(row.get("pat_made")),
            }

    print(f"  Kicker season rows found: {len(kicker_stats_by_pid_yr)}")

    # ── Pass A: Offensive linemen (gp-only) ───────────────────────────────────
    ol_added = 0
    ol_skipped_already_in_pool = 0
    ol_skipped_position = 0
    ol_skipped_seasons = 0
    ol_skipped_no_snaps = 0
    ol_skipped_name = 0

    all_pids = roster_df["player_id"].unique()
    print(f"\nPass A — offensive linemen ({len(all_pids)} player IDs to check)...")

    for pid in all_pids:
        pid_str = str(pid)
        if pid_str in pool_by_id:
            ol_skipped_already_in_pool += 1
            continue

        roster_group = roster_df[roster_df["player_id"] == pid].sort_values("season")
        positions = roster_group["position"].dropna().unique()
        player_pos = next((p for p in positions if p in OL_POSITIONS), None)
        if not player_pos:
            ol_skipped_position += 1
            continue

        unique_seasons = roster_group["season"].dropna().nunique()
        if unique_seasons < MIN_SEASONS_OL:
            ol_skipped_seasons += 1
            continue

        latest_roster = roster_group.iloc[-1]
        name = safe_str(latest_roster.get("player_name"))
        if not name:
            ol_skipped_name += 1
            continue

        pfr_id    = safe_str(latest_roster.get("pfr_id"))
        norm_name = name.lower().encode("ascii", "ignore").decode()

        # pfr_id beats name for same key
        player_snap_gp = {**snap_gp_name.get(norm_name, {}), **snap_gp_pfr.get(pfr_id, {})}
        if not player_snap_gp:
            ol_skipped_no_snaps += 1
            continue

        roster_by_season: dict[int, object] = {}
        for _, rrow in roster_group.iterrows():
            s = rrow.get("season")
            try:
                roster_by_season[int(float(s))] = rrow
            except (ValueError, TypeError):
                pass

        seasons = []
        for season_year, rrow in sorted(roster_by_season.items()):
            team = safe_str(rrow.get("team"), "???")
            gp = player_snap_gp.get((season_year, team), 0)
            if gp > 0:
                seasons.append({"season": str(season_year), "team": team, "gp": gp})

        if not seasons:
            ol_skipped_no_snaps += 1
            continue

        pool_by_id[pid_str] = {
            "player_id":   pid_str,
            "player_name": name,
            "position":    player_pos,
            "seasons":     seasons,
            "bio":         build_bio(latest_roster),
        }
        ol_added += 1

    print(f"  Added:                  {ol_added}")
    print(f"  Skipped (in pool):      {ol_skipped_already_in_pool}")
    print(f"  Skipped (wrong pos):    {ol_skipped_position}")
    print(f"  Skipped (< {MIN_SEASONS_OL} seasons): {ol_skipped_seasons}")
    print(f"  Skipped (no snap data): {ol_skipped_no_snaps}")
    print(f"  Skipped (no name):      {ol_skipped_name}")

    # ── Pass B: Kicker stat upgrade ───────────────────────────────────────────
    k_upgraded = 0
    k_added = 0

    # Group kicker stats by player_id
    k_seasons_by_pid: dict[str, list] = {}
    for (pid, yr), stats in kicker_stats_by_pid_yr.items():
        k_seasons_by_pid.setdefault(pid, []).append((yr, stats))

    print(f"\nPass B — kicker stat upgrade ({len(k_seasons_by_pid)} kicker player IDs in stats)...")

    for pid, year_stats in k_seasons_by_pid.items():
        year_stats.sort(key=lambda x: x[0])

        if pid in pool_by_id:
            # Existing kicker: add fg/pat columns to each season entry
            existing = pool_by_id[pid]
            seasons_by_yr = {s["season"]: s for s in existing["seasons"]}

            for yr, st in year_stats:
                yr_str = str(yr)
                if yr_str in seasons_by_yr:
                    # Update existing season — preserve gp/team but add stat fields
                    seasons_by_yr[yr_str].update({
                        "fg_made":       st["fg_made"],
                        "fg_att":        st["fg_att"],
                        "fg_made_40_49": st["fg_made_40_49"],
                        "fg_made_50p":   st["fg_made_50p"],
                        "pat_made":      st["pat_made"],
                    })
                else:
                    # Season not yet in pool — add it with full stats
                    if st["gp"] > 0:
                        seasons_by_yr[yr_str] = {"season": yr_str, **st}

            existing["seasons"] = sorted(seasons_by_yr.values(), key=lambda s: s["season"])
            k_upgraded += 1
        else:
            # New kicker: only add if they have meaningful production
            qualifying = [(yr, st) for yr, st in year_stats if st["fg_made"] >= 10]
            if len(qualifying) < MIN_K_QUALIFYING_SEASONS:
                continue

            # Look up name from roster data
            roster_group = roster_df[roster_df["player_id"] == pid].sort_values("season")
            if roster_group.empty:
                continue
            latest_roster = roster_group.iloc[-1]
            name = safe_str(latest_roster.get("player_name"))
            if not name:
                # Fall back to stats display name
                for _, st in year_stats:
                    break  # just need to check if name is fetchable from stats_df
                continue  # skip if no roster name

            seasons = [
                {"season": str(yr), **st}
                for yr, st in year_stats
                if st["gp"] > 0
            ]
            if not seasons:
                continue

            pool_by_id[pid] = {
                "player_id":   pid,
                "player_name": name,
                "position":    "K",
                "seasons":     seasons,
                "bio":         build_bio(latest_roster),
            }
            k_added += 1

    print(f"  Kicker entries upgraded: {k_upgraded}")
    print(f"  New kickers added:       {k_added}")

    # ── Write ─────────────────────────────────────────────────────────────────
    out = sorted(pool_by_id.values(), key=lambda p: p.get("player_name", ""))
    with open(POOL_PATH, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    size_kb = os.path.getsize(POOL_PATH) / 1024
    print(f"\nTotal players in pool: {len(out)}")
    print(f"Written: {POOL_PATH}  ({size_kb:.1f} KB)")
    print(f"\nNext step:")
    print(f"  cp data/nfl_lineup_pool.json ../public/data/nfl_lineup_pool.json")


if __name__ == "__main__":
    main()
