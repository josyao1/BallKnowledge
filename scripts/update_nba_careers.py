#!/usr/bin/env python3
"""
update_nba_careers.py — Incrementally append new season(s) to nba_careers.json.

Much faster than a full regeneration:
  - 1 API call per season fetches all player stats
  - Existing players just get the new season row appended (no extra API calls)
  - Only brand-new qualifying players trigger a full career fetch (2 calls each)

Usage:
    python update_nba_careers.py --years 2025          # adds 2024-25
    python update_nba_careers.py --years 2024 2025     # adds 2023-24 and 2024-25

Year is the START year of the season: 2025 → 2024-25.

After running, copy to public:
    cp data/nba_careers.json ../public/data/nba_careers.json
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

# ─── Config ──────────────────────────────────────────────────────────────────

REQUEST_DELAY = 0.7   # seconds between API calls
MIN_PPG       = 10.0  # new players must avg 10+ PPG to be added
MIN_GP        = 20    # and played at least 20 games

OUT_PATH = os.path.join(os.path.dirname(__file__), "data", "nba_careers.json")

# ─── Helpers ─────────────────────────────────────────────────────────────────

def format_season(year: int) -> str:
    return f"{year}-{str(year + 1)[-2:]}"

def safe_float(val, decimals=1):
    try:
        if val is None:
            return 0.0
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return 0.0
        return round(f, decimals)
    except (ValueError, TypeError):
        return 0.0

def safe_int(val):
    try:
        if val is None:
            return 0
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return 0
        return int(f)
    except (ValueError, TypeError):
        return 0

def build_season_row(row: dict, season: str) -> dict:
    """Build a season entry from a LeagueDashPlayerStats row."""
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

        if len(seasons) < 2:
            return None

        # Bio
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

        return {
            "player_id":   player_id,
            "player_name": player_name,
            "seasons":     seasons,
            "bio":         bio,
        }

    except Exception as e:
        print(f"    ERROR fetching {player_name} ({player_id}): {e}")
        return None

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", type=int, nargs="+", required=True,
                        help="Start year(s) of season(s) to add, e.g. 2025 for 2024-25")
    args = parser.parse_args()

    if not os.path.exists(OUT_PATH):
        print(f"ERROR: {OUT_PATH} not found. Run generate_nba_careers.py first.")
        sys.exit(1)

    with open(OUT_PATH) as f:
        careers = json.load(f)

    careers_by_id: dict[int, dict] = {c["player_id"]: c for c in careers}
    print(f"Loaded {len(careers)} existing players from nba_careers.json\n")

    total_updated = 0
    total_added   = 0

    for year in sorted(args.years):
        season = format_season(year)
        print(f"── {season} ──────────────────────────────────────")

        # One API call gets all player stats for this season
        print(f"  Fetching player stats for {season}...")
        try:
            stats = LeagueDashPlayerStats(
                season=season,
                per_mode_detailed="PerGame",
                season_type_all_star="Regular Season",
            )
            time.sleep(REQUEST_DELAY)
            sdf = stats.get_data_frames()[0]
        except Exception as e:
            print(f"  ERROR fetching {season}: {e}")
            continue

        print(f"  {len(sdf)} players found in {season}")

        updated         = 0
        already_present = 0
        new_candidates  = []

        for _, row in sdf.iterrows():
            try:
                pid  = int(row["PLAYER_ID"])
                name = str(row.get("PLAYER_NAME", row.get("PLAYER", "")))
                gp   = safe_int(row.get("GP"))
                pts  = safe_float(row.get("PTS"))
            except (ValueError, TypeError):
                continue

            row_dict = row.to_dict()

            if pid in careers_by_id:
                existing = {s["season"] for s in careers_by_id[pid]["seasons"]}
                if season not in existing:
                    careers_by_id[pid]["seasons"].append(build_season_row(row_dict, season))
                    careers_by_id[pid]["seasons"].sort(key=lambda s: s["season"])
                    updated += 1
                else:
                    already_present += 1
            else:
                # Only add new players who meet the minimum bar
                if gp >= MIN_GP and pts >= MIN_PPG:
                    new_candidates.append({"player_id": pid, "player_name": name})

        print(f"  Updated {updated} existing players  |  {already_present} already had {season}  |  {len(new_candidates)} new players to add")
        total_updated += updated

        for i, player in enumerate(new_candidates):
            pid   = player["player_id"]
            pname = player["player_name"]
            print(f"  [{i+1}/{len(new_candidates)}] New player: {pname}...")
            result = fetch_full_career(pid, pname)
            if result:
                careers_by_id[pid] = result
                print(f"    ✓ Added ({len(result['seasons'])} seasons)")
                total_added += 1
            else:
                print(f"    – Skipped (insufficient career data)")

        print()

    # Save
    updated_list = list(careers_by_id.values())
    with open(OUT_PATH, "w") as f:
        json.dump(updated_list, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print("─────────────────────────────────────────────────────")
    print(f"Done!  {total_updated} existing players updated  |  {total_added} new players added")
    print(f"{len(updated_list)} total players  |  {size_kb:.1f} KB  →  {OUT_PATH}")
    print(f"\nNext: cp data/nba_careers.json ../public/data/nba_careers.json")


if __name__ == "__main__":
    main()
