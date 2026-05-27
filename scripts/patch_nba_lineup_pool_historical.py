#!/usr/bin/env python3
"""
patch_nba_lineup_pool_historical.py — Add pre-2019 players to nba_lineup_pool.json.

Scans 2010-11 through 2018-19 for players who averaged 3+ PPG in at least one
season and are not already in nba_lineup_pool.json or nba_careers.json.
Appends new players only — existing entries are untouched.

Run:
    cd scripts
    python patch_nba_lineup_pool_historical.py

To resume after an interruption:
    python patch_nba_lineup_pool_historical.py --resume

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
MIN_PPG       = 3.0
MIN_GP        = 20
SCAN_YEARS    = list(range(2010, 2019))  # 2010-11 through 2018-19

DATA_DIR     = os.path.join(os.path.dirname(__file__), "data")
LINEUP_PATH  = os.path.join(DATA_DIR, "nba_lineup_pool.json")
CAREERS_PATH = os.path.join(DATA_DIR, "nba_careers.json")
PARTIAL_PATH = LINEUP_PATH + ".historical_partial"


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
    """Scan 2010-18 seasons; return {player_id: player_name} for anyone with 3+ PPG."""
    found: dict[int, str] = {}
    seasons = [f"{y}-{str(y + 1)[-2:]}" for y in SCAN_YEARS]
    print(f"Scanning {len(seasons)} seasons (2010-11 → 2018-19) for {MIN_PPG}+ PPG / {MIN_GP}+ GP...\n")

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
            count = 0
            for _, row in sdf.iterrows():
                try:
                    pts = safe_float(row.get("PTS", 0))
                    gp  = safe_int(row.get("GP", 0))
                    if pts >= MIN_PPG and gp >= MIN_GP:
                        pid = int(row["PLAYER_ID"])
                        found[pid] = str(row.get(name_col, ""))
                        count += 1
                except (ValueError, TypeError):
                    continue
            print(f"  [{i+1}/{len(seasons)}] {season}: {count} qualifying players  ({len(found)} unique so far)")
        except Exception as e:
            print(f"  [{i+1}/{len(seasons)}] {season}: skipped ({e})")
            time.sleep(REQUEST_DELAY)

    print(f"\nTotal unique qualifying player IDs: {len(found)}")
    return found


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

    # Load existing pools to build skip sets
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

    # Load partial checkpoint if resuming
    done_ids: set[int] = set()
    new_players: list[dict] = []
    if resume and os.path.exists(PARTIAL_PATH):
        with open(PARTIAL_PATH) as f:
            new_players = json.load(f)
        done_ids = {p["player_id"] for p in new_players}
        print(f"Resuming: {len(new_players)} players already fetched\n")

    # Scan historical seasons
    candidates = scan_seasons()

    # Filter: skip already known, skip already done in this run
    to_fetch = [
        (pid, pname) for pid, pname in candidates.items()
        if pid not in skip_ids and pid not in done_ids
    ]
    skipped_known = sum(1 for pid in candidates if pid in skip_ids)
    print(f"\n{len(candidates)} qualifying players found")
    print(f"  {skipped_known} already in lineup pool or careers file — skipping")
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

        # Checkpoint every 50 players
        if (i + 1) % 50 == 0:
            with open(PARTIAL_PATH, "w") as f:
                json.dump(new_players, f, separators=(",", ":"))
            print(f"  [checkpoint: {len(new_players)} new players saved]\n")

    if not new_players:
        print("No new players to add.")
        return

    # Append new players to the existing pool and write
    updated_pool = existing_pool + new_players
    with open(LINEUP_PATH, "w") as f:
        json.dump(updated_pool, f, separators=(",", ":"))

    # Clean up partial file
    if os.path.exists(PARTIAL_PATH):
        os.remove(PARTIAL_PATH)

    size_kb = os.path.getsize(LINEUP_PATH) / 1024
    print(f"\nDone! Added {len(new_players)} new players  |  {len(updated_pool)} total  |  {size_kb:.1f} KB")
    print(f"Next: cp data/nba_lineup_pool.json ../public/data/nba_lineup_pool.json")


if __name__ == "__main__":
    main()
