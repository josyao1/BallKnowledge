#!/usr/bin/env python3
"""
patch_nba_pool_pre2010.py — Add pre-2010 NBA legends to nba_lineup_pool.json.

Scans 1979-80 through 2009-10. A player qualifies if in ANY single season they hit
at least one of:
  - 10+ PPG and 40+ GP   (scorers: Alex English, Reggie Miller, Dominique)
  - 7+ RPG  and 40+ GP   (bigs/rebounders: Oakley, Rodman, Ewing, Barkley)
  - 7+ APG  and 40+ GP   (playmakers: Stockton, Isiah Thomas, early Nash)

Plus a career GP floor of 300 to filter out short careers and injury cases.

Skips anyone already in nba_lineup_pool.json or nba_careers.json.

Run:
    cd scripts
    python patch_nba_pool_pre2010.py

To resume after an interruption:
    python patch_nba_pool_pre2010.py --resume

After running:
    cp data/nba_lineup_pool.json ../public/data/nba_lineup_pool.json
"""

import json
import math
import os
import sys
import time
from typing import Optional

try:
    from nba_api.stats.endpoints import LeagueDashPlayerStats, PlayerCareerStats
    from nba_api.stats.endpoints import commonplayerinfo as CommonPlayerInfoModule
except ImportError:
    print("ERROR: nba_api not installed. Run: pip install nba_api")
    sys.exit(1)

REQUEST_DELAY = 1.5

# Any season meeting at least one bar qualifies the player
MIN_PPG     = 10.0;  MIN_PPG_GP  = 40
MIN_RPG     = 7.0;   MIN_RPG_GP  = 40
MIN_APG     = 7.0;   MIN_APG_GP  = 40

# Must have played this many total regular-season games across their career
MIN_CAREER_GP = 300

SCAN_YEARS = list(range(1979, 2010))  # 1979-80 through 2009-10

DATA_DIR     = os.path.join(os.path.dirname(__file__), "data")
LINEUP_PATH  = os.path.join(DATA_DIR, "nba_lineup_pool.json")
CAREERS_PATH = os.path.join(DATA_DIR, "nba_careers.json")
PARTIAL_PATH = LINEUP_PATH + ".pre2010_partial"


def safe_float(val, decimals=1):
    try:
        if val is None: return 0.0
        f = float(val)
        if math.isnan(f) or math.isinf(f): return 0.0
        return round(f, decimals)
    except (ValueError, TypeError):
        return 0.0


def safe_int(val):
    try:
        if val is None: return 0
        f = float(val)
        if math.isnan(f) or math.isinf(f): return 0
        return int(f)
    except (ValueError, TypeError):
        return 0


def scan_seasons() -> dict[int, str]:
    """
    Scan 1979-2009 seasons. Return {player_id: name} for anyone who qualifies
    in at least one season as a scorer, rebounder, or playmaker, AND has 300+
    career GP across all seasons seen.
    """
    qualified: dict[int, str] = {}
    career_gp: dict[int, int] = {}

    seasons = [f"{y}-{str(y + 1)[-2:]}" for y in SCAN_YEARS]
    print(f"Scanning {len(seasons)} seasons (1979-80 → 2009-10)")
    print(f"  Scorer:    {MIN_PPG}+ PPG / {MIN_PPG_GP}+ GP")
    print(f"  Rebounder: {MIN_RPG}+ RPG / {MIN_RPG_GP}+ GP")
    print(f"  Playmaker: {MIN_APG}+ APG / {MIN_APG_GP}+ GP")
    print(f"  Career floor: {MIN_CAREER_GP}+ total GP\n")

    for i, season in enumerate(seasons):
        try:
            stats = LeagueDashPlayerStats(
                season=season,
                per_mode_detailed="PerGame",
                season_type_all_star="Regular Season",
            )
            time.sleep(REQUEST_DELAY)
            sdf = stats.get_data_frames()[0]
            name_col = "PLAYER_NAME" if "PLAYER_NAME" in sdf.columns else "PLAYER"
            new_qualifiers = 0
            for _, row in sdf.iterrows():
                try:
                    pid  = int(row["PLAYER_ID"])
                    name = str(row.get(name_col, ""))
                    gp   = safe_int(row.get("GP", 0))
                    pts  = safe_float(row.get("PTS", 0))
                    reb  = safe_float(row.get("REB", 0))
                    ast  = safe_float(row.get("AST", 0))

                    career_gp[pid] = career_gp.get(pid, 0) + gp

                    if (pts >= MIN_PPG and gp >= MIN_PPG_GP) or \
                       (reb >= MIN_RPG and gp >= MIN_RPG_GP) or \
                       (ast >= MIN_APG and gp >= MIN_APG_GP):
                        if pid not in qualified:
                            new_qualifiers += 1
                        qualified[pid] = name
                except (ValueError, TypeError):
                    continue
            print(f"  [{i+1}/{len(seasons)}] {season}: +{new_qualifiers} new qualifiers  ({len(qualified)} total so far)")
        except Exception as e:
            print(f"  [{i+1}/{len(seasons)}] {season}: skipped ({e})")
            time.sleep(REQUEST_DELAY)

    before = len(qualified)
    qualified = {pid: name for pid, name in qualified.items()
                 if career_gp.get(pid, 0) >= MIN_CAREER_GP}
    print(f"\nAfter {MIN_CAREER_GP}+ career GP filter: {before} → {len(qualified)} players")
    return qualified


def fetch_career(player_id: int, player_name: str) -> Optional[dict]:
    """Fetch full career stats + bio. Retries up to 3 times on transient errors."""
    retry_delays = [5, 15, 30]
    for attempt in range(4):
        if attempt > 0:
            wait = retry_delays[attempt - 1]
            print(f"    Retry {attempt}/3 for {player_name} (waiting {wait}s)...")
            time.sleep(wait)
        try:
            career = PlayerCareerStats(player_id=player_id, per_mode36="PerGame")
            time.sleep(REQUEST_DELAY)
            season_df = career.get_data_frames()[0]
            if season_df.empty:
                return None

            seasons = []
            for season_id, group in season_df.groupby("SEASON_ID", sort=False):
                tot_rows  = group[group["TEAM_ABBREVIATION"] == "TOT"]
                team_rows = group[group["TEAM_ABBREVIATION"] != "TOT"]
                if len(team_rows) <= 1 and tot_rows.empty:
                    row = group.iloc[0]
                    seasons.append({
                        "season":  str(row.get("SEASON_ID", "")),
                        "team":    str(row.get("TEAM_ABBREVIATION", "???")),
                        "gp":      safe_int(row.get("GP")),
                        "min":     safe_float(row.get("MIN")),
                        "pts":     safe_float(row.get("PTS")),
                        "reb":     safe_float(row.get("REB")),
                        "ast":     safe_float(row.get("AST")),
                        "stl":     safe_float(row.get("STL")),
                        "blk":     safe_float(row.get("BLK")),
                        "fg_pct":  safe_float(row.get("FG_PCT"), 3),
                        "fg3_pct": safe_float(row.get("FG3_PCT"), 3),
                    })
                else:
                    team_names = "/".join(team_rows["TEAM_ABBREVIATION"].tolist()) if not team_rows.empty else "???"
                    src = tot_rows.iloc[0] if not tot_rows.empty else team_rows.iloc[0]
                    seasons.append({
                        "season":  str(season_id),
                        "team":    team_names,
                        "gp":      safe_int(src.get("GP")),
                        "min":     safe_float(src.get("MIN")),
                        "pts":     safe_float(src.get("PTS")),
                        "reb":     safe_float(src.get("REB")),
                        "ast":     safe_float(src.get("AST")),
                        "stl":     safe_float(src.get("STL")),
                        "blk":     safe_float(src.get("BLK")),
                        "fg_pct":  safe_float(src.get("FG_PCT"), 3),
                        "fg3_pct": safe_float(src.get("FG3_PCT"), 3),
                    })

            if not seasons:
                return None

            bio = {"height": "", "weight": 0, "school": "", "exp": 0, "draft_year": 0}
            try:
                info = CommonPlayerInfoModule.CommonPlayerInfo(player_id=player_id)
                time.sleep(REQUEST_DELAY)
                info_df = info.get_data_frames()[0]
                if not info_df.empty:
                    irow = info_df.iloc[0]
                    bio["height"]     = str(irow.get("HEIGHT", "") or "")
                    bio["weight"]     = safe_int(irow.get("WEIGHT"))
                    bio["school"]     = str(irow.get("SCHOOL", "") or "")
                    bio["exp"]        = safe_int(irow.get("SEASON_EXP"))
                    dy = irow.get("DRAFT_YEAR")
                    bio["draft_year"] = int(dy) if dy and str(dy).isdigit() else 0
            except Exception as e:
                print(f"    [warn] bio fetch failed for {player_name}: {e}")

            return {"player_id": player_id, "player_name": player_name, "seasons": seasons, "bio": bio}

        except Exception as e:
            err_str = str(e)
            print(f"    ERROR fetching {player_name} ({player_id}): {e}")
            if "resultSet" in err_str or "resultSets" in err_str:
                return None
            if attempt == 3:
                return None


def main():
    resume = "--resume" in sys.argv

    if not os.path.exists(LINEUP_PATH):
        print(f"ERROR: {LINEUP_PATH} not found. Run generate_nba_lineup_pool.py first.")
        sys.exit(1)

    with open(LINEUP_PATH) as f:
        existing_pool = json.load(f)
    pool_ids = {p["player_id"] for p in existing_pool}
    print(f"Loaded {len(existing_pool)} players from nba_lineup_pool.json")

    career_ids: set = set()
    if os.path.exists(CAREERS_PATH):
        with open(CAREERS_PATH) as f:
            careers = json.load(f)
        career_ids = {p["player_id"] for p in careers}
        print(f"Loaded {len(career_ids)} players from nba_careers.json")

    skip_ids = pool_ids | career_ids
    print(f"Will skip {len(skip_ids)} already-known player IDs\n")

    done_ids: set[int] = set()
    new_players: list[dict] = []
    if resume and os.path.exists(PARTIAL_PATH):
        with open(PARTIAL_PATH) as f:
            new_players = json.load(f)
        done_ids = {p["player_id"] for p in new_players}
        print(f"Resuming: {len(new_players)} players already fetched\n")

    candidates = scan_seasons()

    to_fetch = [
        (pid, pname) for pid, pname in candidates.items()
        if pid not in skip_ids and pid not in done_ids
    ]
    skipped_known = sum(1 for pid in candidates if pid in skip_ids)
    print(f"\n{len(candidates)} qualifying players found")
    print(f"  {skipped_known} already in pool or careers — skipping")
    print(f"  {len(done_ids)} already fetched this run (resumed)")
    print(f"  {len(to_fetch)} new players to fetch\n")
    print("Ctrl-C is safe — run with --resume to continue.\n")

    for i, (pid, pname) in enumerate(to_fetch):
        print(f"[{i+1}/{len(to_fetch)}] {pname}...", end=" ", flush=True)
        result = fetch_career(pid, pname)
        if result:
            new_players.append(result)
            print(f"OK ({len(result['seasons'])} seasons)")
        else:
            print("skipped")

        if (i + 1) % 50 == 0:
            with open(PARTIAL_PATH, "w") as f:
                json.dump(new_players, f, separators=(",", ":"))
            print(f"  [checkpoint: {len(new_players)} new players saved]\n")

    if not new_players:
        print("No new players to add.")
        return

    updated_pool = existing_pool + new_players
    with open(LINEUP_PATH, "w") as f:
        json.dump(updated_pool, f, separators=(",", ":"))

    if os.path.exists(PARTIAL_PATH):
        os.remove(PARTIAL_PATH)

    size_kb = os.path.getsize(LINEUP_PATH) / 1024
    print(f"\nDone! Added {len(new_players)} new players  |  {len(updated_pool)} total  |  {size_kb:.1f} KB")
    print(f"Next: cp data/nba_lineup_pool.json ../public/data/nba_lineup_pool.json")


if __name__ == "__main__":
    main()
