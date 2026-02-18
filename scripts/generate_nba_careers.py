#!/usr/bin/env python3
"""
generate_nba_careers.py — Build the static NBA career data pool.

Run this once per season (or whenever you want fresh data):
    python scripts/generate_nba_careers.py

This makes ~20 API calls to build the eligible player list, then 2 API calls
per player for career stats + bio. Expect 20–40 minutes for ~500–800 players.

Progress is saved incrementally so you can Ctrl-C and resume safely:
    python scripts/generate_nba_careers.py --resume

Output: scripts/data/nba_careers.json
"""

import json
import math
import os
import sys
import time
from typing import Optional

try:
    from nba_api.stats.endpoints import (
        LeagueDashPlayerStats,
        CommonAllPlayers,
        PlayerCareerStats,
    )
    from nba_api.stats.endpoints import commonplayerinfo as CommonPlayerInfoModule
except ImportError:
    print("ERROR: nba_api not installed. Run: pip install nba_api")
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────

REQUEST_DELAY = 0.7          # seconds between nba_api calls (be conservative)
MIN_PPG       = 10.0         # at least one season averaging 10+ PPG
MIN_SEASONS   = 5            # career must span 5+ years
MIN_FROM_YEAR = 1980         # modern era only

# Sample every 2 years — keeps API calls to ~20 instead of ~40
SAMPLE_YEARS  = list(range(1985, 2026, 2))

OUT_PATH      = os.path.join(os.path.dirname(__file__), "data", "nba_careers.json")
PARTIAL_PATH  = OUT_PATH + ".partial"

# ─── Helpers ─────────────────────────────────────────────────────────────────

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


# ─── Step 1: Build eligible player list ──────────────────────────────────────

def build_eligible() -> list[dict]:
    """Mirror of _build_nba_eligible() in api_server.py."""
    productive_ids: dict[int, str] = {}

    sample_seasons = [f"{y}-{str(y + 1)[-2:]}" for y in SAMPLE_YEARS]
    print(f"Step 1: scanning {len(sample_seasons)} seasons for players averaging {MIN_PPG}+ PPG...")

    for i, season in enumerate(sample_seasons):
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
                    pts = float(row.get("PTS", 0) or 0)
                    if pts >= MIN_PPG:
                        pid = int(row["PLAYER_ID"])
                        productive_ids[pid] = row.get(name_col, "")
                        count += 1
                except (ValueError, TypeError):
                    continue
            print(f"  [{i+1}/{len(sample_seasons)}] {season}: {count} productive players")
        except Exception as e:
            print(f"  [{i+1}/{len(sample_seasons)}] {season}: skipped ({e})")
            time.sleep(REQUEST_DELAY)

    print(f"  Total productive player IDs: {len(productive_ids)}")

    # Cross-reference with CommonAllPlayers for career-length filter
    print("Step 1b: fetching complete player directory...")
    all_players = CommonAllPlayers(is_only_current_season=0)
    time.sleep(REQUEST_DELAY)
    df = all_players.get_data_frames()[0]

    eligible = []
    for _, row in df.iterrows():
        try:
            from_year = int(row.get("FROM_YEAR", 0))
            to_year   = int(row.get("TO_YEAR", 0))
            if to_year - from_year < MIN_SEASONS - 1:
                continue
            if to_year < MIN_FROM_YEAR:
                continue
            player_id = int(row.get("PERSON_ID", 0))
            if player_id not in productive_ids:
                continue
            player_name = row.get("DISPLAY_FIRST_LAST", "") or productive_ids.get(player_id, "")
            if player_id and player_name:
                eligible.append({"player_id": player_id, "player_name": player_name})
        except (ValueError, TypeError):
            continue

    print(f"  Eligible players: {len(eligible)}")
    return eligible


# ─── Step 2: Fetch full career data for each player ──────────────────────────

def fetch_career(player_id: int, player_name: str) -> Optional[dict]:
    """Fetch career stats + bio for one player. Returns None on hard failure."""
    try:
        career = PlayerCareerStats(player_id=player_id, per_mode36="PerGame")
        time.sleep(REQUEST_DELAY)
        dfs = career.get_data_frames()
        season_df = dfs[0]

        if season_df.empty:
            return None

        # Build seasons (mirrors api_server.py get_career_stats logic)
        seasons = []
        for season_id, group in season_df.groupby("SEASON_ID", sort=False):
            tot_rows  = group[group["TEAM_ABBREVIATION"] == "TOT"]
            team_rows = group[group["TEAM_ABBREVIATION"] != "TOT"]

            if len(team_rows) <= 1 and tot_rows.empty:
                row = group.iloc[0]
                seasons.append({
                    "season":   row.get("SEASON_ID", ""),
                    "team":     row.get("TEAM_ABBREVIATION", "???"),
                    "gp":       safe_int(row.get("GP")),
                    "min":      safe_float(row.get("MIN")),
                    "pts":      safe_float(row.get("PTS")),
                    "reb":      safe_float(row.get("REB")),
                    "ast":      safe_float(row.get("AST")),
                    "stl":      safe_float(row.get("STL")),
                    "blk":      safe_float(row.get("BLK")),
                    "fg_pct":   safe_float(row.get("FG_PCT"), 3),
                    "fg3_pct":  safe_float(row.get("FG3_PCT"), 3),
                })
            else:
                team_names = "/".join(team_rows["TEAM_ABBREVIATION"].tolist()) if not team_rows.empty else "???"
                src = tot_rows.iloc[0] if not tot_rows.empty else team_rows.iloc[0]
                seasons.append({
                    "season":   str(season_id),
                    "team":     team_names,
                    "gp":       safe_int(src.get("GP")),
                    "min":      safe_float(src.get("MIN")),
                    "pts":      safe_float(src.get("PTS")),
                    "reb":      safe_float(src.get("REB")),
                    "ast":      safe_float(src.get("AST")),
                    "stl":      safe_float(src.get("STL")),
                    "blk":      safe_float(src.get("BLK")),
                    "fg_pct":   safe_float(src.get("FG_PCT"), 3),
                    "fg3_pct":  safe_float(src.get("FG3_PCT"), 3),
                })

        if len(seasons) < 2:
            return None

        # Bio
        bio = {"height": "", "weight": 0, "school": "", "exp": 0, "draft_year": 0}
        try:
            player_info = CommonPlayerInfoModule.CommonPlayerInfo(player_id=player_id)
            time.sleep(REQUEST_DELAY)
            info_df = player_info.get_data_frames()[0]
            if not info_df.empty:
                irow = info_df.iloc[0]
                bio["height"]     = irow.get("HEIGHT", "") or ""
                bio["weight"]     = safe_int(irow.get("WEIGHT"))
                bio["school"]     = irow.get("SCHOOL", "") or ""
                bio["exp"]        = safe_int(irow.get("SEASON_EXP"))
                dy = irow.get("DRAFT_YEAR")
                bio["draft_year"] = int(dy) if dy and str(dy).isdigit() else 0
        except Exception as e:
            print(f"    Warning: bio fetch failed for {player_name}: {e}")

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
    resume = "--resume" in sys.argv
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    # Load partial progress if resuming
    done_ids: set[int] = set()
    careers: list[dict] = []

    if resume and os.path.exists(PARTIAL_PATH):
        with open(PARTIAL_PATH) as f:
            careers = json.load(f)
        done_ids = {c["player_id"] for c in careers}
        print(f"Resuming from partial save: {len(careers)} players already done")

    # Step 1 — eligible list (always rebuild; it's fast enough)
    eligible = build_eligible()

    # Step 2 — fetch career data for each player
    remaining = [p for p in eligible if p["player_id"] not in done_ids]
    total = len(eligible)
    print(f"\nStep 2: fetching career data for {len(remaining)} players "
          f"({len(done_ids)} already done, {total} total)...")
    print("This will take a while. Ctrl-C is safe — run with --resume to continue.\n")

    for i, player in enumerate(remaining):
        pid   = player["player_id"]
        pname = player["player_name"]
        result = fetch_career(pid, pname)

        if result:
            careers.append(result)
            status = "OK"
        else:
            status = "SKIP (no data)"

        done = len(done_ids) + i + 1
        print(f"  [{done}/{total}] {pname}: {status}")

        # Save partial progress every 25 players
        if (i + 1) % 25 == 0:
            with open(PARTIAL_PATH, "w") as f:
                json.dump(careers, f, separators=(",", ":"))
            print(f"  (checkpoint saved — {len(careers)} players)")

    # Final write
    with open(OUT_PATH, "w") as f:
        json.dump(careers, f, separators=(",", ":"))

    # Clean up partial file
    if os.path.exists(PARTIAL_PATH):
        os.remove(PARTIAL_PATH)

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"\nDone! {len(careers)} players written to {OUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
