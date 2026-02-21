#!/usr/bin/env python3
"""
generate_nfl_lineup_pool.py — Build the expanded NFL player pool for Lineup Is Right.

Unlike the main nfl_careers.json (which requires 5+ seasons and high career totals),
this pool uses lower thresholds so it includes current players who are still early
in their careers but have had at least one notable season (e.g. Bijan Robinson,
Drake London, Puka Nacua).

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

# ─── Config ──────────────────────────────────────────────────────────────────

YEARS = list(range(2010, 2025))   # 2010–2024; add 2025 once data is available
CAREER_POSITIONS = {"QB", "RB", "WR", "TE"}

# Minimum production in at LEAST ONE season (not career totals).
# These are intentionally low so emerging stars are included.
MIN_SINGLE_SEASON = {
    "QB": {"passing_yards": 1500},   # e.g. backup QB who had one starting run
    "RB": {"rushing_yards": 400},    # e.g. RB1 rookie season
    "WR": {"receiving_yards": 400},  # e.g. WR1/2 with a breakout year
    "TE": {"receiving_yards": 300},  # TEs develop slower, slightly lower bar
}

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
    stats_df = nfl.import_seasonal_data(YEARS)
    if stats_df is None or stats_df.empty:
        print("ERROR: Failed to load stats data")
        sys.exit(1)
    print(f"  Stats rows: {len(stats_df)}")

    careers = []
    skipped_position = 0
    skipped_production = 0
    skipped_name = 0

    all_pids = roster_df["player_id"].unique()
    print(f"\nScanning {len(all_pids)} unique player IDs...")

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
                })
            elif player_pos == "RB":
                base.update({
                    "carries":         safe_int(row.get("carries")),
                    "rushing_yards":   safe_int(row.get("rushing_yards")),
                    "rushing_tds":     safe_int(row.get("rushing_tds")),
                    "receptions":      safe_int(row.get("receptions")),
                    "receiving_yards": safe_int(row.get("receiving_yards")),
                })
            else:  # WR / TE
                base.update({
                    "targets":         safe_int(row.get("targets")),
                    "receptions":      safe_int(row.get("receptions")),
                    "receiving_yards": safe_int(row.get("receiving_yards")),
                    "receiving_tds":   safe_int(row.get("receiving_tds")),
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

    print(f"\nResults:")
    print(f"  Eligible players:     {len(careers)}")
    print(f"  Skipped (position):   {skipped_position}")
    print(f"  Skipped (production): {skipped_production}")
    print(f"  Skipped (no name):    {skipped_name}")

    with open(OUT_PATH, "w") as f:
        json.dump(careers, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"\nWritten: {OUT_PATH}  ({size_kb:.1f} KB)")
    print(f"\nNext step:")
    print(f"  cp data/nfl_lineup_pool.json ../public/data/nfl_lineup_pool.json")


if __name__ == "__main__":
    main()
