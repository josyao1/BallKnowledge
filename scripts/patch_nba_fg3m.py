#!/usr/bin/env python3
"""
patch_nba_fg3m.py — Patch nba_lineup_pool.json and nba_careers.json with:

  Pre-computed totals (no API call — derived from existing per-game × gp):
    total_pts  = round(pts  * gp)
    total_reb  = round(reb  * gp)
    total_ast  = round(ast  * gp)
    total_blk  = round(blk  * gp)
    total_stl  = round(stl  * gp)

  New per-game fields requiring one API call per player:
    fg3m       = 3-pointers made per game
    ftm        = free throws made per game
    pf         = personal fouls per game

  Derived from new fields:
    total_3pm  = round(fg3m * gp)
    total_ftm  = round(ftm  * gp)
    total_pf   = round(pf   * gp)

Fully resumable: players already containing fg3m/ftm/pf in every season are skipped.

Run:
    cd scripts
    python patch_nba_fg3m.py [--skip-api]   # --skip-api skips API fetch (totals only)

Then copy outputs:
    cp data/nba_lineup_pool.json ../public/data/nba_lineup_pool.json
    cp data/nba_careers.json ../public/data/nba_careers.json
"""

import json
import math
import os
import sys
import time

SKIP_API = "--skip-api" in sys.argv

if not SKIP_API:
    try:
        from nba_api.stats.endpoints import PlayerCareerStats
    except ImportError:
        print("ERROR: nba_api not installed. Run: pip install nba_api")
        sys.exit(1)

REQUEST_DELAY = 1.5

SCRIPT_DIR   = os.path.dirname(__file__)
LINEUP_PATH  = os.path.join(SCRIPT_DIR, "data", "nba_lineup_pool.json")
CAREERS_PATH = os.path.join(SCRIPT_DIR, "data", "nba_careers.json")

# Fall back to public/data if scripts/data copies don't exist
if not os.path.exists(LINEUP_PATH):
    LINEUP_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "nba_lineup_pool.json")
if not os.path.exists(CAREERS_PATH):
    CAREERS_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "nba_careers.json")


def safe_float(val, decimals=1):
    try:
        if val is None:
            return 0.0
        f = float(val)
        return 0.0 if (math.isnan(f) or math.isinf(f)) else round(f, decimals)
    except (ValueError, TypeError):
        return 0.0


def compute_totals(season: dict) -> None:
    """Fill total_* fields derived from per-game × gp."""
    gp = season.get("gp", 0) or 0
    season["total_pts"] = round((season.get("pts")  or 0) * gp)
    season["total_reb"] = round((season.get("reb")  or 0) * gp)
    season["total_ast"] = round((season.get("ast")  or 0) * gp)
    season["total_blk"] = round((season.get("blk")  or 0) * gp)
    season["total_stl"] = round((season.get("stl")  or 0) * gp)
    if "fg3m" in season:
        season["total_3pm"] = round((season.get("fg3m") or 0) * gp)
    if "ftm" in season:
        season["total_ftm"] = round((season.get("ftm")  or 0) * gp)
    if "pf" in season:
        season["total_pf"]  = round((season.get("pf")   or 0) * gp)


def fetch_extra_stats_by_season(player_id: int) -> dict:
    """
    Returns {season_id: {fg3m, ftm, pf}} per game for all seasons.
    Uses TOT row for traded players. Returns empty dict on total failure.
    """
    result = {}
    retry_delays = [5, 15, 30]
    for attempt in range(4):
        if attempt > 0:
            wait = retry_delays[attempt - 1]
            print(f"      Retry {attempt}/3 (waiting {wait}s)...")
            time.sleep(wait)
        try:
            career = PlayerCareerStats(player_id=player_id, per_mode36="PerGame")
            time.sleep(REQUEST_DELAY)
            df = career.get_data_frames()[0]
            if df.empty:
                return result
            for season_id, group in df.groupby("SEASON_ID", sort=False):
                tot = group[group["TEAM_ABBREVIATION"] == "TOT"]
                src = tot.iloc[0] if not tot.empty else group.iloc[0]
                result[str(season_id)] = {
                    "fg3m": safe_float(src.get("FG3M"), 1),
                    "ftm":  safe_float(src.get("FTM"),  1),
                    "pf":   safe_float(src.get("PF"),   1),
                }
            return result
        except Exception as e:
            err_str = str(e)
            print(f"      API error: {e}")
            if "resultSet" in err_str or "resultSets" in err_str:
                return result
            if attempt == 3:
                return result
    return result


def build_lineup_pool_index(lineup_path: str) -> dict:
    """Build a {player_id: {season_id: {fg3m, ftm, pf}}} index from the already-patched lineup pool."""
    if not os.path.exists(lineup_path):
        return {}
    with open(lineup_path) as f:
        players = json.load(f)
    index = {}
    for p in players:
        pid = p["player_id"]
        season_map = {}
        for s in p.get("seasons", []):
            if "fg3m" in s and "ftm" in s and "pf" in s:
                season_map[s["season"]] = {"fg3m": s["fg3m"], "ftm": s["ftm"], "pf": s["pf"]}
        if season_map:
            index[pid] = season_map
    return index


def patch_file(path: str, label: str, lineup_index: dict = None) -> None:
    if not os.path.exists(path):
        print(f"File not found, skipping: {path}")
        return

    print(f"\n{'='*60}")
    print(f"Patching {label}")
    print(f"{'='*60}")

    with open(path) as f:
        players = json.load(f)

    total = len(players)
    print(f"Loaded {total} players.\n")

    n_api_ok   = 0
    n_api_fail = 0
    n_skipped  = 0
    n_from_pool = 0
    failed_names = []

    for i, player in enumerate(players):
        pid     = player["player_id"]
        name    = player.get("player_name", str(pid))
        seasons = player.get("seasons", [])
        prefix  = f"[{i+1}/{total}] {name}"

        # Already fully patched in this file — skip API
        already_patched = not SKIP_API and all(
            "fg3m" in s and "ftm" in s and "pf" in s
            for s in seasons
        )

        # Check if this player was already patched in the lineup pool
        pool_data = (lineup_index or {}).get(pid)
        can_use_pool = pool_data and not already_patched and not SKIP_API

        if already_patched:
            n_skipped += 1
            print(f"  {prefix}: already patched, skipping")

        elif can_use_pool:
            for s in seasons:
                sid = s.get("season", "")
                extra = pool_data.get(sid, {})
                s["fg3m"] = extra.get("fg3m", 0.0)
                s["ftm"]  = extra.get("ftm",  0.0)
                s["pf"]   = extra.get("pf",   0.0)
            n_from_pool += 1
            print(f"  {prefix}: copied from lineup pool (no API call)")

        elif not SKIP_API:
            print(f"  {prefix}: fetching fg3m/ftm/pf from API...")
            extra_map = fetch_extra_stats_by_season(pid)

            if extra_map:
                for s in seasons:
                    sid   = s.get("season", "")
                    extra = extra_map.get(sid, {})
                    s["fg3m"] = extra.get("fg3m", 0.0)
                    s["ftm"]  = extra.get("ftm",  0.0)
                    s["pf"]   = extra.get("pf",   0.0)
                n_api_ok += 1
                print(f"  {prefix}: OK — {len(extra_map)} season(s) patched")
            else:
                n_api_fail += 1
                failed_names.append(name)
                print(f"  {prefix}: FAILED — API returned nothing, will be 0s")

        else:
            n_skipped += 1
            print(f"  {prefix}: skip-api mode, computing totals only")

        for s in seasons:
            compute_totals(s)

    # Save after every file (not just at the very end)
    with open(path, "w") as f:
        json.dump(players, f, separators=(",", ":"))

    size_kb = os.path.getsize(path) / 1024
    print(f"\nSaved {path} ({size_kb:.1f} KB)")
    print(f"  OK: {n_api_ok}  From pool: {n_from_pool}  Skipped: {n_skipped}  Failed: {n_api_fail}")
    if failed_names:
        print(f"  Failed players (will need re-run):")
        for nm in failed_names:
            print(f"    - {nm}")


CAREERS_ONLY = "--careers-only" in sys.argv

def main():
    if SKIP_API:
        print("--skip-api: computing totals from existing data only (no fg3m/ftm/pf fetch)")

    if not CAREERS_ONLY:
        patch_file(LINEUP_PATH, "nba_lineup_pool.json")

    # Build index from already-patched lineup pool so careers.json can copy instead of re-fetch
    lineup_index = build_lineup_pool_index(LINEUP_PATH)
    print(f"\nLineup pool index: {len(lineup_index)} players with fg3m/ftm/pf data")
    patch_file(CAREERS_PATH, "nba_careers.json", lineup_index=lineup_index)

    print("\nDone. Next steps:")
    print("  cp scripts/data/nba_lineup_pool.json public/data/nba_lineup_pool.json")
    print("  cp scripts/data/nba_careers.json public/data/nba_careers.json")


if __name__ == "__main__":
    main()
