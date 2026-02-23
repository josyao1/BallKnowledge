#!/usr/bin/env python3
"""
generate_nba_lineup_pool.py — Build the expanded NBA player pool for Lineup Is Right.

Unlike nba_careers.json (which requires 5+ seasons and 10+ PPG career average),
this pool uses much lower thresholds so it includes current players who are still
early in their careers but have had at least one notable season (e.g. Chet Holmgren,
Victor Wembanyama, Brandin Podziemski, Jalen Williams, Evan Mobley, etc.)

The frontend merges this file with nba_careers.json and deduplicates by player_id,
so it's safe to have the same player in both files — the pool version wins
(it may include more recent seasons not yet in the main file).

Run:
    cd scripts
    python generate_nba_lineup_pool.py

Output:
    scripts/data/nba_lineup_pool.json  →  copy to public/data/nba_lineup_pool.json

Then deploy to Vercel so the frontend can fetch /data/nba_lineup_pool.json.
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

# ─── Config ───────────────────────────────────────────────────────────────────

REQUEST_DELAY = 1.5     # seconds between API calls — stats.nba.com rate-limits aggressively
MIN_PPG       = 5.0     # 5+ PPG average in at least one recent season
# Scan recent seasons to catch players who don't have long careers yet
RECENT_YEARS  = list(range(2019, 2026))  # 2019-20 through 2024-25

OUT_PATH = os.path.join(os.path.dirname(__file__), "data", "nba_lineup_pool.json")

# ─── Helpers ──────────────────────────────────────────────────────────────────

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


# ─── Step 1: Find eligible recent players ─────────────────────────────────────

def build_eligible() -> dict:
    """Scan recent seasons for players averaging 5+ PPG in any season."""
    productive_ids: dict = {}

    seasons = [f"{y}-{str(y + 1)[-2:]}" for y in RECENT_YEARS]
    print(f"Scanning {len(seasons)} seasons for players averaging {MIN_PPG}+ PPG...")

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
                    pts = float(row.get("PTS", 0) or 0)
                    if pts >= MIN_PPG:
                        pid = int(row["PLAYER_ID"])
                        productive_ids[pid] = row.get(name_col, "")
                        count += 1
                except (ValueError, TypeError):
                    continue
            print(f"  [{i+1}/{len(seasons)}] {season}: {count} qualifying players")
        except Exception as e:
            print(f"  [{i+1}/{len(seasons)}] {season}: skipped ({e})")
            time.sleep(REQUEST_DELAY)

    print(f"  Total unique player IDs: {len(productive_ids)}")
    return productive_ids


# ─── Step 2: Fetch full career data ───────────────────────────────────────────

def fetch_career(player_id: int, player_name: str) -> Optional[dict]:
    """Fetch full career stats for one player. Same format as nba_careers.json.
    Retries up to 3 times with increasing delays on timeout/connection errors."""
    retry_delays = [5, 15, 30]
    for attempt in range(4):  # 1 initial attempt + 3 retries
        if attempt > 0:
            wait = retry_delays[attempt - 1]
            print(f"    Retry {attempt}/3 for {player_name} (waiting {wait}s)...")
            time.sleep(wait)
        try:
            career = PlayerCareerStats(player_id=player_id, per_mode36="PerGame")
            time.sleep(REQUEST_DELAY)
            dfs = career.get_data_frames()
            season_df = dfs[0]

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
                print(f"    Warning: bio fetch failed for {player_name}: {e}")

            return {
                "player_id":   player_id,
                "player_name": player_name,
                "seasons":     seasons,
                "bio":         bio,
            }

        except Exception as e:
            err_str = str(e)
            print(f"    ERROR fetching {player_name} ({player_id}): {e}")
            # Bad/missing data — no point retrying
            if 'resultSet' in err_str or 'resultSets' in err_str:
                return None
            if attempt == 3:
                return None  # all retries exhausted


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    resume = "--resume" in sys.argv
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    partial_path = OUT_PATH + ".partial"

    # Load partial progress if resuming
    done_ids: set = set()
    careers: list = []
    if resume and os.path.exists(partial_path):
        with open(partial_path) as f:
            careers = json.load(f)
        done_ids = {c["player_id"] for c in careers}
        print(f"Resuming from checkpoint: {len(careers)} players already done")

    productive_ids = build_eligible()

    # Skip players already in nba_careers.json — we already have their full data
    careers_path = os.path.join(os.path.dirname(OUT_PATH), "nba_careers.json")
    already_have: set = set()
    if os.path.exists(careers_path):
        with open(careers_path) as f:
            existing = json.load(f)
        already_have = {p["player_id"] for p in existing}
        print(f"Skipping {len(already_have)} players already in nba_careers.json")

    players = list(productive_ids.items())
    remaining = [(pid, pname) for pid, pname in players
                 if pid not in done_ids and pid not in already_have]
    total = len(players)
    print(f"\nFetching career data for {len(remaining)} players "
          f"({len(done_ids)} resumed, {len(already_have)} in main file, {total} total)...")
    print("Ctrl-C is safe — run with --resume to continue.\n")

    for i, (pid, pname) in enumerate(remaining):
        result = fetch_career(pid, pname)
        if result:
            careers.append(result)
            status = "OK"
        else:
            status = "SKIP"
        done = len(done_ids) + i + 1
        print(f"  [{done}/{total}] {pname}: {status}")

        # Checkpoint every 50 players
        if (i + 1) % 50 == 0:
            with open(partial_path, "w") as f:
                json.dump(careers, f, separators=(",", ":"))
            print(f"  (checkpoint saved — {len(careers)} players)")

    with open(OUT_PATH, "w") as f:
        json.dump(careers, f, separators=(",", ":"))

    if os.path.exists(partial_path):
        os.remove(partial_path)

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"\nWritten: {OUT_PATH}  ({size_kb:.1f} KB, {len(careers)} players)")
    print(f"\nNext step:")
    print(f"  cp data/nba_lineup_pool.json ../public/data/nba_lineup_pool.json")


if __name__ == "__main__":
    main()
