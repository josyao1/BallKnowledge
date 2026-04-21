#!/usr/bin/env python3
"""
update_nba_lineup_pool.py — Append a new season's stats to nba_lineup_pool.json.

Much faster than a full regeneration: one API call fetches all player stats for
the season, then existing players get the new season row appended. New players
who averaged 5+ PPG are added with a full career fetch.

Usage:
    cd scripts
    python update_nba_lineup_pool.py --year 2025   # adds 2025-26

Year is the START year of the season: 2025 → 2025-26.

After running, copy to public:
    cp data/nba_lineup_pool.json ../public/data/nba_lineup_pool.json
"""

import argparse
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
MIN_PPG       = 5.0   # threshold for new players to be added
MIN_GP        = 20

OUT_PATH = os.path.join(os.path.dirname(__file__), "data", "nba_lineup_pool.json")

def format_season(year: int) -> str:
    return f"{year}-{str(year + 1)[-2:]}"

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

def build_season_row(row: dict, season: str) -> dict:
    return {
        "season":  season,
        "team":    row.get("TEAM_ABBREVIATION", "???"),
        "gp":      safe_int(row.get("GP")),
        "min":     safe_float(row.get("MIN")),
        "pts":     safe_float(row.get("PTS")),
        "reb":     safe_float(row.get("REB")),
        "ast":     safe_float(row.get("AST")),
        "stl":     safe_float(row.get("STL")),
        "blk":     safe_float(row.get("BLK")),
        "fg_pct":  safe_float(row.get("FG_PCT"), 3),
        "fg3_pct": safe_float(row.get("FG3_PCT"), 3),
    }

def fetch_full_career(player_id: int, player_name: str) -> Optional[dict]:
    """Fetch full career stats + bio for a brand-new player."""
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
                    "season":  row.get("SEASON_ID", ""),
                    "team":    row.get("TEAM_ABBREVIATION", "???"),
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
                bio["height"]     = irow.get("HEIGHT", "") or ""
                bio["weight"]     = safe_int(irow.get("WEIGHT"))
                bio["school"]     = irow.get("SCHOOL", "") or ""
                bio["exp"]        = safe_int(irow.get("SEASON_EXP"))
                dy = irow.get("DRAFT_YEAR")
                bio["draft_year"] = int(dy) if dy and str(dy).isdigit() else 0
        except Exception as e:
            print(f"    [warn] bio fetch failed for {player_name}: {e}")

        return {"player_id": player_id, "player_name": player_name, "seasons": seasons, "bio": bio}

    except Exception as e:
        print(f"    ERROR fetching {player_name} ({player_id}): {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--year", type=int, required=True,
                        help="Start year of the season to add, e.g. 2025 for 2025-26")
    args = parser.parse_args()

    if not os.path.exists(OUT_PATH):
        print(f"ERROR: {OUT_PATH} not found. Run generate_nba_lineup_pool.py first.")
        sys.exit(1)

    with open(OUT_PATH) as f:
        pool = json.load(f)

    pool_by_id: dict[int, dict] = {p["player_id"]: p for p in pool}
    print(f"Loaded {len(pool)} existing players from nba_lineup_pool.json\n")

    season = format_season(args.year)
    print(f"Fetching {season} stats from NBA API...")
    try:
        stats = LeagueDashPlayerStats(
            season=season,
            per_mode_detailed="PerGame",
            season_type_all_star="Regular Season",
        )
        time.sleep(REQUEST_DELAY)
        sdf = stats.get_data_frames()[0]
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    print(f"{len(sdf)} players in {season}\n")

    updated = 0
    new_candidates = []

    for _, row in sdf.iterrows():
        try:
            pid  = int(row["PLAYER_ID"])
            name = str(row.get("PLAYER_NAME", row.get("PLAYER", "")))
            gp   = safe_int(row.get("GP"))
            pts  = safe_float(row.get("PTS"))
        except (ValueError, TypeError):
            continue

        row_dict = row.to_dict()

        if pid in pool_by_id:
            # Replace any existing row for this season (may be a stale mid-season snapshot)
            pool_by_id[pid]["seasons"] = [
                s for s in pool_by_id[pid]["seasons"] if s["season"] != season
            ]
            pool_by_id[pid]["seasons"].append(build_season_row(row_dict, season))
            pool_by_id[pid]["seasons"].sort(key=lambda s: s["season"])
            updated += 1
        else:
            if gp >= MIN_GP and pts >= MIN_PPG:
                new_candidates.append({"player_id": pid, "player_name": name})

    print(f"Updated {updated} existing players (overwrites any stale mid-season data)")
    print(f"{len(new_candidates)} new players to add\n")

    total_added = 0
    for i, player in enumerate(new_candidates):
        pid, pname = player["player_id"], player["player_name"]
        print(f"[{i+1}/{len(new_candidates)}] {pname}...")
        result = fetch_full_career(pid, pname)
        if result:
            pool_by_id[pid] = result
            total_added += 1
            print(f"  added ({len(result['seasons'])} seasons)")
        else:
            print(f"  skipped")

    updated_list = list(pool_by_id.values())
    with open(OUT_PATH, "w") as f:
        json.dump(updated_list, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"\nDone! {updated} updated, {total_added} new  |  {len(updated_list)} total  |  {size_kb:.1f} KB")
    print(f"Next: cp data/nba_lineup_pool.json ../public/data/nba_lineup_pool.json")


if __name__ == "__main__":
    main()
