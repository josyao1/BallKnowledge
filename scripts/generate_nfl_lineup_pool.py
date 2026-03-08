#!/usr/bin/env python3
"""
generate_nfl_lineup_pool.py — Build the expanded NFL player pool for Lineup Is Right.

Unlike the main nfl_careers.json (which requires 5+ seasons and high career totals),
this pool uses lower thresholds so it includes current players who are still early
in their careers but have had at least one notable season (e.g. Bijan Robinson,
Drake London, Puka Nacua).

Also includes defensive players (DE, DT, LB, CB, S) and kickers/punters (K, P)
with gp-only data so they can be picked in total_gp mode.

The frontend merges this file with nfl_careers.json and deduplicates by player_id,
so it's safe to have the same player in both files — the lineup pool version wins
(it may include more recent seasons).

Run:
    cd scripts
    python generate_nfl_lineup_pool.py

Output:
    scripts/data/nfl_lineup_pool.json  →  copy to public/data/nfl_lineup_pool.json

Then deploy to Vercel so the frontend can fetch /data/nfl_lineup_pool.json.
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

YEARS = list(range(1999, 2025))   # 1999–2024; covers full career histories including LT, Rice, etc.
CAREER_POSITIONS = {"QB", "RB", "WR", "TE"}

# Positions that get gp-only data (no stat columns).
# These are useful for total_gp mode; they'll return 0 for any stat-based mode.
# Broad position groups as they appear in nfl_data_py roster data:
DEFENSIVE_POSITIONS = {"DE", "DT", "LB", "ILB", "OLB", "MLB", "CB", "S", "SS", "FS", "DB", "DL", "NT", "EDGE"}
KICKER_POSITIONS    = {"K", "P", "LS"}

# Minimum production in at LEAST ONE season (not career totals).
# These are intentionally low so emerging stars are included.
MIN_SINGLE_SEASON = {
    "QB": {"passing_yards": 1500},   # e.g. backup QB who had one starting run
    "RB": {"rushing_yards": 400},    # e.g. RB1 rookie season
    "WR": {"receiving_yards": 400},  # e.g. WR1/2 with a breakout year
    "TE": {"receiving_yards": 300},  # TEs develop slower, slightly lower bar
}

# Minimum seasons active for non-skill players (defensive + kickers).
# Lower bar than skill positions — just need to have been a real roster player.
MIN_SEASONS_NON_SKILL = 4

OUT_PATH = os.path.join(os.path.dirname(__file__), "data", "nfl_lineup_pool.json")

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


def col_sum(df, col):
    if col not in df.columns:
        return 0
    total = df[col].fillna(0).sum()
    return int(total) if total == total else 0


# ─── Stats loader (handles 2025 via nflverse-data direct parquet) ─────────────

NFLVERSE_STATS_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "stats_player/stats_player_reg_{year}.parquet"
)

def load_seasonal_stats(years):
    """Load seasonal stats for all years.
    - Years ≤ 2024: via nfl_data_py
    - Years ≥ 2025: direct parquet from nflverse-data releases
    Normalises 'passing_interceptions' → 'interceptions' for consistency.
    """
    legacy_years = [y for y in years if y <= 2024]
    new_years    = [y for y in years if y >= 2025]

    frames = []

    if legacy_years:
        df = nfl.import_seasonal_data(legacy_years)
        if df is not None and not df.empty:
            frames.append(df)

    for year in new_years:
        url = NFLVERSE_STATS_URL.format(year=year)
        print(f"  Fetching {year} stats from nflverse-data ({url})...")
        try:
            df = pd.read_parquet(url)
            if "passing_interceptions" in df.columns and "interceptions" not in df.columns:
                df = df.rename(columns={"passing_interceptions": "interceptions"})
            frames.append(df)
            print(f"    → {len(df)} rows loaded for {year}")
        except Exception as e:
            print(f"  WARNING: Could not fetch {year} stats: {e}")

    if not frames:
        return None

    return pd.concat(frames, ignore_index=True)


def meets_single_season_threshold(player_stats, position):
    """Return True if the player hit the per-season minimum in any one season.
    RBs in 2023/2024 get a lower threshold (200 rush yds) to capture depth backs."""
    thresholds = MIN_SINGLE_SEASON.get(position, {})
    if not thresholds:
        return False

    for _, row in player_stats.iterrows():
        season_year = safe_int(row.get("season", 0))
        for col, min_val in thresholds.items():
            if col in player_stats.columns:
                # Lower RB rush yard bar for 2023/2024 only
                effective_min = min_val
                if position == "RB" and col == "rushing_yards" and season_year in (2023, 2024):
                    effective_min = 200
                val = safe_int(row.get(col, 0))
                if val >= effective_min:
                    return True
    return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    print(f"Loading roster data ({YEARS[0]}–{YEARS[-1]})...")
    roster_df = nfl.import_seasonal_rosters(YEARS)
    if roster_df is None or roster_df.empty:
        print("ERROR: Failed to load roster data")
        sys.exit(1)
    roster_df = roster_df.drop_duplicates(subset=["player_id", "season"], keep="first")
    print(f"  Roster rows: {len(roster_df)}")

    print(f"Loading seasonal stats ({YEARS[0]}–{YEARS[-1]})...")
    stats_df = load_seasonal_stats(YEARS)
    if stats_df is None or stats_df.empty:
        print("ERROR: Failed to load stats data")
        sys.exit(1)
    print(f"  Stats rows: {len(stats_df)}")

    # Snap counts cover 2013–2024 and include all positions (DEF, K, P, LS).
    # We use them to get accurate games-played counts for non-skill players
    # by counting distinct weeks per (pfr_player_id, season, team).
    SNAP_YEARS = [y for y in YEARS if y >= 2013]
    print(f"Loading snap counts ({SNAP_YEARS[0]}–{SNAP_YEARS[-1]}) for defensive/kicker GP...")
    snaps_df = nfl.import_snap_counts(SNAP_YEARS)
    # Build two lookups from snap counts:
    #   snap_gp_pfr:  pfr_player_id → {(season, team): games_played}
    #   snap_gp_name: normalized_name → {(season, team): games_played}
    # The name lookup is a fallback for players whose pfr_id is missing in rosters.
    snap_gp_pfr:  dict = {}
    snap_gp_name: dict = {}
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

            # Also index by normalised name (strip accents, lowercase) for fallback
            raw_name = safe_str(row.get("player"))
            if raw_name:
                norm = raw_name.lower().encode("ascii", "ignore").decode()
                if norm not in snap_gp_name:
                    snap_gp_name[norm] = {}
                snap_gp_name[norm][key] = snap_gp_name[norm].get(key, 0) + 1

    print(f"  Snap GP lookup built for {len(snap_gp_pfr)} players (pfr), {len(snap_gp_name)} (name)")

    # ── Pass 1: Skill positions (QB/RB/WR/TE) ────────────────────────────────
    careers = []
    skill_pids = set()
    skipped_position = 0
    skipped_production = 0
    skipped_name = 0

    all_pids = roster_df["player_id"].unique()
    print(f"\nPass 1 — skill positions ({len(all_pids)} player IDs)...")

    for pid in all_pids:
        roster_group = roster_df[roster_df["player_id"] == pid].sort_values("season")

        # Determine position (first match in priority order)
        positions = roster_group["position"].dropna().unique()
        player_pos = None
        for p in positions:
            if p in CAREER_POSITIONS:
                player_pos = p
                break
        if not player_pos:
            skipped_position += 1
            continue

        # Must have at least one notable season (no career minimum required)
        player_stats = stats_df[stats_df["player_id"] == pid].sort_values("season")
        if player_stats.empty or not meets_single_season_threshold(player_stats, player_pos):
            skipped_production += 1
            continue

        latest_roster = roster_group.iloc[-1]
        name = safe_str(latest_roster.get("player_name"))
        if not name:
            skipped_name += 1
            continue

        # Build roster lookup by season
        roster_by_season = {}
        for _, rrow in roster_group.iterrows():
            s = rrow.get("season")
            try:
                roster_by_season[int(float(s))] = rrow
            except (ValueError, TypeError):
                pass

        # Build seasons array — same shape as nfl_careers.json
        seasons = []
        for _, row in player_stats.iterrows():
            season_year = safe_int(row.get("season"))
            rrow = roster_by_season.get(season_year)
            team = safe_str(rrow.get("team"), "???") if rrow is not None else safe_str(row.get("recent_team"), "???")

            base = {
                "season": str(season_year),
                "team": team,
                "gp": safe_int(row.get("games")),
            }

            if player_pos == "QB":
                base.update({
                    "completions":   safe_int(row.get("completions")),
                    "attempts":      safe_int(row.get("attempts")),
                    "passing_yards": safe_int(row.get("passing_yards")),
                    "passing_tds":   safe_int(row.get("passing_tds")),
                    "interceptions": safe_int(row.get("interceptions")),
                    "rushing_yards": safe_int(row.get("rushing_yards")),
                    "rushing_tds":   safe_int(row.get("rushing_tds")),
                })
            elif player_pos == "RB":
                base.update({
                    "carries":         safe_int(row.get("carries")),
                    "rushing_yards":   safe_int(row.get("rushing_yards")),
                    "rushing_tds":     safe_int(row.get("rushing_tds")),
                    "receptions":      safe_int(row.get("receptions")),
                    "receiving_yards": safe_int(row.get("receiving_yards")),
                    "receiving_tds":   safe_int(row.get("receiving_tds")),
                    "passing_yards":   safe_int(row.get("passing_yards")),
                    "passing_tds":     safe_int(row.get("passing_tds")),
                })
            else:  # WR / TE
                base.update({
                    "targets":         safe_int(row.get("targets")),
                    "receptions":      safe_int(row.get("receptions")),
                    "receiving_yards": safe_int(row.get("receiving_yards")),
                    "receiving_tds":   safe_int(row.get("receiving_tds")),
                    "rushing_yards":   safe_int(row.get("rushing_yards")),
                    "rushing_tds":     safe_int(row.get("rushing_tds")),
                    "passing_yards":   safe_int(row.get("passing_yards")),
                    "passing_tds":     safe_int(row.get("passing_tds")),
                })

            seasons.append(base)

        if not seasons:
            skipped_production += 1
            continue

        # Bio
        height_str = ""
        height_val = latest_roster.get("height")
        if height_val and safe_str(height_val):
            try:
                inches = int(float(height_val))
                height_str = f"{inches // 12}-{inches % 12}"
            except (ValueError, TypeError):
                height_str = safe_str(height_val)

        bio = {
            "height":       height_str,
            "weight":       safe_int(latest_roster.get("weight")),
            "college":      safe_str(latest_roster.get("college")),
            "years_exp":    safe_int(latest_roster.get("years_exp")),
            "draft_club":   safe_str(latest_roster.get("draft_club")),
            "draft_number": safe_int(latest_roster.get("draft_number")),
        }

        careers.append({
            "player_id":   str(pid),
            "player_name": name,
            "position":    player_pos,
            "seasons":     seasons,
            "bio":         bio,
        })
        skill_pids.add(str(pid))

    print(f"  Skill players added:  {len(careers)}")
    print(f"  Skipped (position):   {skipped_position}")
    print(f"  Skipped (production): {skipped_production}")
    print(f"  Skipped (no name):    {skipped_name}")

    # ── Pass 2: Defensive players + kickers (gp-only seasons) ────────────────
    NON_SKILL_POSITIONS = DEFENSIVE_POSITIONS | KICKER_POSITIONS
    def_skipped_position = 0
    def_skipped_seasons  = 0
    def_skipped_name     = 0
    def_added            = 0

    print(f"\nPass 2 — defensive/kicker positions ({len(all_pids)} player IDs)...")

    for pid in all_pids:
        # Skip any player already captured as a skill position
        if str(pid) in skill_pids:
            continue

        roster_group = roster_df[roster_df["player_id"] == pid].sort_values("season")

        # Must have a recognised non-skill position
        positions = roster_group["position"].dropna().unique()
        player_pos = None
        for p in positions:
            if p in NON_SKILL_POSITIONS:
                player_pos = p
                break
        if not player_pos:
            def_skipped_position += 1
            continue

        # Need at least MIN_SEASONS_NON_SKILL seasons on any roster
        # (we check snap coverage later; this just filters truly short careers)
        unique_seasons = roster_group["season"].dropna().nunique()
        if unique_seasons < MIN_SEASONS_NON_SKILL:
            def_skipped_seasons += 1
            continue

        latest_roster = roster_group.iloc[-1]
        name = safe_str(latest_roster.get("player_name"))
        if not name:
            def_skipped_name += 1
            continue

        pfr_id    = safe_str(latest_roster.get("pfr_id"))
        norm_name = name.lower().encode("ascii", "ignore").decode()

        # Build per-player GP lookup: pfr_id is primary, name is fallback
        # (some players — e.g. recent kickers — have pfr_id=None in roster data).
        player_snap_gp_pfr  = snap_gp_pfr.get(pfr_id, {}) if pfr_id else {}
        player_snap_gp_name = snap_gp_name.get(norm_name, {})

        # Must have at least 1 season with real snap-count GP data; otherwise
        # the player would show up in searches but always give 0 total_gp.
        if not player_snap_gp_pfr and not player_snap_gp_name:
            def_skipped_seasons += 1
            continue

        # Merge: pfr beats name for the same (season, team) key
        player_snap_gp = {**player_snap_gp_name, **player_snap_gp_pfr}

        # Build gp-only seasons from the roster data.
        roster_by_season = {}
        for _, rrow in roster_group.iterrows():
            s = rrow.get("season")
            try:
                roster_by_season[int(float(s))] = rrow
            except (ValueError, TypeError):
                pass

        # Snap counts cover 2013–2024; seasons before that are skipped (gp=0).

        seasons = []
        for season_year, rrow in sorted(roster_by_season.items()):
            team = safe_str(rrow.get("team"), "???")
            gp = player_snap_gp.get((season_year, team), 0)
            # Only include seasons where we have a real GP count (skip 0s —
            # they're either pre-2013 or truly inactive that year)
            if gp > 0:
                seasons.append({
                    "season": str(season_year),
                    "team":   team,
                    "gp":     gp,
                })

        if not seasons:
            def_skipped_seasons += 1
            continue

        # Bio
        height_str = ""
        height_val = latest_roster.get("height")
        if height_val and safe_str(height_val):
            try:
                inches = int(float(height_val))
                height_str = f"{inches // 12}-{inches % 12}"
            except (ValueError, TypeError):
                height_str = safe_str(height_val)

        bio = {
            "height":       height_str,
            "weight":       safe_int(latest_roster.get("weight")),
            "college":      safe_str(latest_roster.get("college")),
            "years_exp":    safe_int(latest_roster.get("years_exp")),
            "draft_club":   safe_str(latest_roster.get("draft_club")),
            "draft_number": safe_int(latest_roster.get("draft_number")),
        }

        careers.append({
            "player_id":   str(pid),
            "player_name": name,
            "position":    player_pos,
            "seasons":     seasons,
            "bio":         bio,
        })
        def_added += 1

    print(f"  Defensive/kicker players added: {def_added}")
    print(f"  Skipped (position):   {def_skipped_position}")
    print(f"  Skipped (seasons):    {def_skipped_seasons}")
    print(f"  Skipped (no name):    {def_skipped_name}")

    print(f"\nTotal players in pool: {len(careers)}")

    with open(OUT_PATH, "w") as f:
        json.dump(careers, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"\nWritten: {OUT_PATH}  ({size_kb:.1f} KB)")
    print(f"\nNext step:")
    print(f"  cp data/nfl_lineup_pool.json ../public/data/nfl_lineup_pool.json")


if __name__ == "__main__":
    main()
