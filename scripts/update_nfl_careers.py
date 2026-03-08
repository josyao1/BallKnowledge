#!/usr/bin/env python3
"""
update_nfl_careers.py — Append a new NFL season to nfl_careers.json and nfl_lineup_pool.json.

Much faster than full regeneration — only fetches data for the target year:
  - 2025 stats: direct parquet from nflverse-data (~2 seconds)
  - 2025 rosters: nfl_data_py import_seasonal_rosters (works even when stats 404)
  - Existing players just get the new season row appended
  - New players are added to nfl_lineup_pool.json if they hit single-season thresholds
  - nfl_careers.json is only updated for already-existing players (5-season bar is too
    high for rookies — they go in the pool instead)

Usage:
    cd scripts
    python update_nfl_careers.py --year 2025

After running, copy to public/:
    cp data/nfl_careers.json ../public/data/nfl_careers.json
    cp data/nfl_lineup_pool.json ../public/data/nfl_lineup_pool.json
"""

import argparse
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

CAREERS_PATH = os.path.join(os.path.dirname(__file__), "data", "nfl_careers.json")
POOL_PATH    = os.path.join(os.path.dirname(__file__), "data", "nfl_lineup_pool.json")

NFLVERSE_STATS_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "stats_player/stats_player_reg_{year}.parquet"
)

CAREER_POSITIONS = {"QB", "RB", "WR", "TE"}

# Minimum production in a single season to add a new player to the pool
MIN_SINGLE_SEASON = {
    "QB": {"passing_yards": 1500},
    "RB": {"rushing_yards": 400},
    "WR": {"receiving_yards": 400},
    "TE": {"receiving_yards": 300},
}

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


def build_season_row(row: dict, position: str) -> dict:
    """Build a season entry from a stats row dict."""
    # New nflverse format uses 'passing_interceptions'; old nfl_data_py used 'interceptions'
    interceptions = safe_int(row.get("interceptions") or row.get("passing_interceptions"))

    base = {
        "season": str(safe_int(row.get("season"))),
        "team":   safe_str(row.get("recent_team"), "???"),
        "gp":     safe_int(row.get("games")),
    }

    if position == "QB":
        base.update({
            "completions":   safe_int(row.get("completions")),
            "attempts":      safe_int(row.get("attempts")),
            "passing_yards": safe_int(row.get("passing_yards")),
            "passing_tds":   safe_int(row.get("passing_tds")),
            "interceptions": interceptions,
            "rushing_yards": safe_int(row.get("rushing_yards")),
            "rushing_tds":   safe_int(row.get("rushing_tds")),
        })
    elif position == "RB":
        base.update({
            "carries":         safe_int(row.get("carries")),
            "rushing_yards":   safe_int(row.get("rushing_yards")),
            "rushing_tds":     safe_int(row.get("rushing_tds")),
            "receptions":      safe_int(row.get("receptions")),
            "receiving_yards": safe_int(row.get("receiving_yards")),
            "receiving_tds":   safe_int(row.get("receiving_tds")),
        })
    else:  # WR / TE
        base.update({
            "targets":         safe_int(row.get("targets")),
            "receptions":      safe_int(row.get("receptions")),
            "receiving_yards": safe_int(row.get("receiving_yards")),
            "receiving_tds":   safe_int(row.get("receiving_tds")),
            "rushing_yards":   safe_int(row.get("rushing_yards")),
            "rushing_tds":     safe_int(row.get("rushing_tds")),
        })

    return base


def meets_pool_threshold(row: dict, position: str, season_year: int) -> bool:
    """Return True if this player hit the single-season bar for the pool.
    Recent seasons use lower thresholds:
      RB 2023–2025: 200 rush yds (down from 400)
      WR/TE 2024–2025: 250 rec yds (down from 400/300)
    """
    for col, min_val in MIN_SINGLE_SEASON.get(position, {}).items():
        effective_min = min_val
        if position == "RB" and col == "rushing_yards" and season_year in (2023, 2024, 2025):
            effective_min = 200
        elif position in ("WR", "TE") and col == "receiving_yards" and season_year in (2024, 2025):
            effective_min = 250
        if safe_int(row.get(col)) >= effective_min:
            return True
    return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--year", type=int, required=True,
                        help="Season year to add, e.g. 2025")
    args = parser.parse_args()
    year     = args.year
    year_str = str(year)

    # ── Load existing files ────────────────────────────────────────────────────
    if not os.path.exists(CAREERS_PATH):
        print(f"ERROR: {CAREERS_PATH} not found. Run generate_nfl_careers.py first.")
        sys.exit(1)

    with open(CAREERS_PATH) as f:
        careers = json.load(f)
    careers_by_id: dict[str, dict] = {str(c["player_id"]): c for c in careers}
    print(f"Loaded {len(careers)} players from nfl_careers.json")

    pool_exists = os.path.exists(POOL_PATH)
    if pool_exists:
        with open(POOL_PATH) as f:
            pool = json.load(f)
        pool_by_id: dict[str, dict] = {str(p["player_id"]): p for p in pool}
        print(f"Loaded {len(pool)} players from nfl_lineup_pool.json")
    else:
        pool_by_id = {}
        print("nfl_lineup_pool.json not found — new entries will be created")

    # ── Fetch target year stats ────────────────────────────────────────────────
    url = NFLVERSE_STATS_URL.format(year=year)
    print(f"\nFetching {year} stats: {url}")
    try:
        stats_df = pd.read_parquet(url)
        print(f"  {len(stats_df)} rows loaded")
    except Exception as e:
        print(f"ERROR: Could not fetch {year} stats: {e}")
        sys.exit(1)

    # ── Fetch target year rosters (for full player name + accurate team) ────────
    print(f"Fetching {year} rosters from nfl_data_py...")
    team_by_pid: dict[str, str] = {}
    name_by_pid: dict[str, str] = {}
    try:
        roster_df = nfl.import_seasonal_rosters([year])
        roster_df = roster_df.drop_duplicates(subset=["player_id", "season"], keep="first")
        for _, rrow in roster_df.iterrows():
            pid  = safe_str(rrow.get("player_id"))
            team = safe_str(rrow.get("team"))
            name = safe_str(rrow.get("player_name"))
            if pid and team:
                team_by_pid[pid] = team
            if pid and name:
                name_by_pid[pid] = name
        print(f"  {len(team_by_pid)} players found in {year} rosters")
    except Exception as e:
        print(f"  WARNING: Could not fetch rosters ({e}) — falling back to stats names/teams")

    # ── Process each player row ────────────────────────────────────────────────
    careers_updated = 0
    careers_already = 0
    pool_updated    = 0
    pool_added      = 0

    for _, series in stats_df.iterrows():
        row      = series.to_dict()
        pid      = safe_str(row.get("player_id"))
        position = safe_str(row.get("position"))

        # Use full name from roster; stats parquet has abbreviated "J.McCarthy" format
        name = name_by_pid.get(pid) or safe_str(row.get("player_display_name")) or safe_str(row.get("player_name"))

        if not pid or not name or position not in CAREER_POSITIONS:
            continue

        # Prefer roster team over stats recent_team
        if pid in team_by_pid:
            row["recent_team"] = team_by_pid[pid]

        # Update nfl_careers.json — existing players only
        # Use the stored career position so utility players like Taysom Hill
        # (listed as TE/WR in stats) get the right stat fields for their actual role.
        if pid in careers_by_id:
            career_position = careers_by_id[pid]["position"]
            season_row = build_season_row(row, career_position)
            existing = {s["season"] for s in careers_by_id[pid]["seasons"]}
            if year_str not in existing:
                careers_by_id[pid]["seasons"].append(season_row)
                careers_by_id[pid]["seasons"].sort(key=lambda s: s["season"])
                careers_updated += 1
            else:
                careers_already += 1

        # Update nfl_lineup_pool.json — existing players + new players who hit threshold
        # Use stored pool position for existing players, stats position for new ones.
        if pid in pool_by_id:
            pool_position = pool_by_id[pid]["position"]
            season_row = build_season_row(row, pool_position)
            existing = {s["season"] for s in pool_by_id[pid]["seasons"]}
            if year_str not in existing:
                pool_by_id[pid]["seasons"].append(season_row)
                pool_by_id[pid]["seasons"].sort(key=lambda s: s["season"])
                pool_updated += 1
        elif pid not in careers_by_id and meets_pool_threshold(row, position, year):
            season_row = build_season_row(row, position)
            # New player not in either file — add to pool
            pool_by_id[pid] = {
                "player_id":   pid,
                "player_name": name,
                "position":    position,
                "seasons":     [season_row],
                "bio":         {},
            }
            pool_added += 1

    # ── Write updated files ────────────────────────────────────────────────────
    careers_out = list(careers_by_id.values())
    with open(CAREERS_PATH, "w") as f:
        json.dump(careers_out, f, separators=(",", ":"))
    size_kb = os.path.getsize(CAREERS_PATH) / 1024
    print(f"\nnfl_careers.json:")
    print(f"  {careers_updated} players updated with {year}  |  {careers_already} already had {year}  |  {len(careers_out)} total  ({size_kb:.1f} KB)")

    if pool_exists or pool_added > 0:
        pool_out = list(pool_by_id.values())
        with open(POOL_PATH, "w") as f:
            json.dump(pool_out, f, separators=(",", ":"))
        size_kb = os.path.getsize(POOL_PATH) / 1024
        print(f"nfl_lineup_pool.json:")
        print(f"  {pool_updated} players updated  |  {pool_added} new players added  |  {len(pool_out)} total  ({size_kb:.1f} KB)")

    print(f"\nNext steps:")
    print(f"  cp data/nfl_careers.json ../public/data/nfl_careers.json")
    if pool_exists or pool_added > 0:
        print(f"  cp data/nfl_lineup_pool.json ../public/data/nfl_lineup_pool.json")


if __name__ == "__main__":
    main()
