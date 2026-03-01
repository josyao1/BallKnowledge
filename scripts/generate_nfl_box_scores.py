#!/usr/bin/env python3
"""
generate_nfl_box_scores.py — Build static NFL box score data for the Box Score game mode.

For each qualifying game (both teams ≥ 17 pts, 2015–2024):
  - Passing stats:   players with ≥ 1 attempt
  - Rushing stats:   players with ≥ 1 carry
  - Receiving stats: players with ≥ 1 target

Output:
  scripts/data/nfl_box_scores/{year}.json   per-season array of game objects
  scripts/data/nfl_box_scores/index.json    { "2015": 142, ..., "2024": 151 }

Run:
    cd scripts && python generate_nfl_box_scores.py
    cp -r data/nfl_box_scores ../public/data/nfl/box_scores
"""

import json
import os
import sys
from collections import defaultdict

try:
    import nfl_data_py as nfl
except ImportError:
    print("ERROR: nfl_data_py not installed. Run: pip install nfl-data-py")
    sys.exit(1)

# ─── Config ───────────────────────────────────────────────────────────────────

YEARS     = list(range(2015, 2025))
MIN_SCORE = 17   # both teams must reach this to qualify

OUT_DIR = os.path.join(os.path.dirname(__file__), "data", "nfl_box_scores")

# nfl_data_py sometimes returns older abbreviations — normalise to current
ALIAS_TO_CURRENT = {
    "LA":  "LAR", "SL": "LAR", "STL": "LAR",
    "OAK": "LV",
    "SD":  "LAC",
    "ARZ": "ARI",
    "BLT": "BAL",
    "CLV": "CLE",
    "HST": "HOU",
    "JAC": "JAX",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def normalize_team(t) -> str:
    if t is None:
        return ""
    s = str(t).strip().upper()
    if s in ("NAN", "NONE", ""):
        return ""
    return ALIAS_TO_CURRENT.get(s, s)


def safe_int(val, default: int = 0) -> int:
    try:
        if val is None:
            return default
        f = float(val)
        return default if f != f else int(f)      # NaN guard
    except (ValueError, TypeError):
        return default


def safe_float(val):
    try:
        if val is None:
            return None
        f = float(val)
        return None if f != f else round(f, 1)
    except (ValueError, TypeError):
        return None


def safe_str(val, default: str = "") -> str:
    if val is None:
        return default
    s = str(val).strip()
    return default if s.lower() in ("nan", "none", "") else s


def safe_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    try:
        f = float(val)
        return bool(int(f))
    except (ValueError, TypeError):
        return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # ── 1. Schedules ──────────────────────────────────────────────────────────
    print(f"Loading schedules ({YEARS[0]}–{YEARS[-1]})...")
    sched_df = nfl.import_schedules(YEARS)
    print(f"  Total rows: {len(sched_df)}")

    sched_df = sched_df.dropna(subset=["home_score", "away_score"])
    sched_df = sched_df[
        (sched_df["home_score"] >= MIN_SCORE) &
        (sched_df["away_score"] >= MIN_SCORE)
    ].copy()
    print(f"  Qualifying games (both ≥ {MIN_SCORE} pts): {len(sched_df)}")

    qualifying_ids = set(sched_df["game_id"].astype(str))

    # Index by game_id for O(1) lookups later
    sched_by_gid: dict = {}
    # Also build (season, week, team) → game_id so we can join weekly_data
    # (import_weekly_data has no game_id column — join via team+week+season)
    team_week_to_gid: dict[tuple, str] = {}
    for _, row in sched_df.iterrows():
        gid  = safe_str(row.get("game_id"))
        if not gid:
            continue
        sched_by_gid[gid] = row
        season = safe_int(row.get("season"))
        week   = safe_int(row.get("week"))
        home   = normalize_team(row.get("home_team"))
        away   = normalize_team(row.get("away_team"))
        if home:
            team_week_to_gid[(season, week, home)] = gid
        if away:
            team_week_to_gid[(season, week, away)] = gid

    # ── 2. Weekly player stats ─────────────────────────────────────────────────
    print(f"\nLoading weekly player stats ({YEARS[0]}–{YEARS[-1]})...")
    weekly_df = nfl.import_weekly_data(YEARS)
    print(f"  Total player-week rows: {len(weekly_df)}")

    # ── 3. Jersey numbers ─────────────────────────────────────────────────────
    # Try weekly rosters first (more precise), fall back to seasonal rosters.
    # jersey_map_precise: (player_id, season, week) → "15"
    # jersey_map_season:  (player_id, season)       → "15"   (any week)
    jersey_map_precise: dict[tuple, str] = {}
    jersey_map_season:  dict[tuple, str] = {}

    def ingest_roster_df(df):
        for _, row in df.iterrows():
            pid     = safe_str(row.get("player_id") or row.get("gsis_id"))
            season  = safe_int(row.get("season"))
            jersey  = safe_str(row.get("jersey_number"))
            if not pid or not season or not jersey:
                continue
            week = safe_int(row.get("week"), default=0)
            if week:
                jersey_map_precise[(pid, season, week)] = jersey
            # Always populate the seasonal fallback
            if (pid, season) not in jersey_map_season:
                jersey_map_season[(pid, season)] = jersey

    print(f"\nLoading roster / jersey data ({YEARS[0]}–{YEARS[-1]})...")
    try:
        roster_df = nfl.import_weekly_rosters(YEARS)
        print(f"  Weekly rosters loaded: {len(roster_df)} rows")
        ingest_roster_df(roster_df)
    except Exception as e:
        print(f"  import_weekly_rosters failed ({e}), trying import_seasonal_rosters...")
        try:
            roster_df = nfl.import_seasonal_rosters(YEARS)
            print(f"  Seasonal rosters loaded: {len(roster_df)} rows")
            ingest_roster_df(roster_df)
        except Exception as e2:
            print(f"  WARNING: Could not load roster data ({e2}). Jersey numbers will be blank.")

    print(f"  Jersey entries (precise): {len(jersey_map_precise)}")
    print(f"  Jersey entries (season):  {len(jersey_map_season)}")

    def get_jersey(pid: str, season: int, week: int) -> str:
        return (
            jersey_map_precise.get((pid, season, week)) or
            jersey_map_season.get((pid, season)) or
            ""
        )

    # ── 4. Group player rows by (season, game_id) ─────────────────────────────
    # weekly_data has no game_id — resolve via (season, week, recent_team)
    games_by_season: dict[int, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    skipped_no_game = 0
    for _, row in weekly_df.iterrows():
        season = safe_int(row.get("season"))
        week   = safe_int(row.get("week"))
        team   = normalize_team(row.get("recent_team"))
        gid    = team_week_to_gid.get((season, week, team))
        if not gid:
            skipped_no_game += 1
            continue
        games_by_season[season][gid].append(row)
    print(f"  Player rows matched to qualifying games: "
          f"{sum(len(v) for s in games_by_season.values() for v in s.values())}"
          f"  (skipped {skipped_no_game} — no qualifying game match)")

    # ── 5. Build JSON per season ───────────────────────────────────────────────
    print("\nBuilding box score files...")
    index: dict[str, int] = {}

    for year in YEARS:
        season_games = games_by_season.get(year, {})
        if not season_games:
            print(f"  {year}: no data — skipping")
            continue

        output_games = []

        for gid, player_rows in season_games.items():
            sched_row = sched_by_gid.get(gid)
            if sched_row is None:
                continue

            home_team = normalize_team(sched_row.get("home_team"))
            away_team = normalize_team(sched_row.get("away_team"))
            week      = safe_int(sched_row.get("week"))

            # Initialise empty box score
            box: dict = {
                "home": {"passing": [], "rushing": [], "receiving": []},
                "away": {"passing": [], "rushing": [], "receiving": []},
            }

            for row in player_rows:
                pid  = safe_str(row.get("player_id"))
                name = safe_str(
                    row.get("player_display_name") or row.get("player_name")
                )
                if not pid or not name:
                    continue

                player_team = normalize_team(row.get("recent_team"))
                if player_team == home_team:
                    side = "home"
                elif player_team == away_team:
                    side = "away"
                else:
                    # Traded / released player with stale team — skip
                    continue

                jersey = get_jersey(pid, year, week)

                # Passing — ≥ 1 attempt
                attempts = safe_int(row.get("attempts"))
                if attempts >= 1:
                    box[side]["passing"].append({
                        "id":          pid,
                        "name":        name,
                        "number":      jersey,
                        "completions": safe_int(row.get("completions")),
                        "attempts":    attempts,
                        "yards":       safe_int(row.get("passing_yards")),
                        "tds":         safe_int(row.get("passing_tds")),
                        "ints":        safe_int(row.get("interceptions")),
                    })

                # Rushing — ≥ 1 carry
                carries = safe_int(row.get("carries"))
                if carries >= 1:
                    box[side]["rushing"].append({
                        "id":     pid,
                        "name":   name,
                        "number": jersey,
                        "carries": carries,
                        "yards":  safe_int(row.get("rushing_yards")),
                        "tds":    safe_int(row.get("rushing_tds")),
                    })

                # Receiving — ≥ 1 target
                targets = safe_int(row.get("targets"))
                if targets >= 1:
                    box[side]["receiving"].append({
                        "id":         pid,
                        "name":       name,
                        "number":     jersey,
                        "targets":    targets,
                        "receptions": safe_int(row.get("receptions")),
                        "yards":      safe_int(row.get("receiving_yards")),
                        "tds":        safe_int(row.get("receiving_tds")),
                    })

            # Sort each section by yards descending
            for side in ("home", "away"):
                box[side]["passing"].sort(key=lambda p: p["yards"], reverse=True)
                box[side]["rushing"].sort(key=lambda p: p["yards"], reverse=True)
                box[side]["receiving"].sort(key=lambda p: p["yards"], reverse=True)

            # Skip games where we got zero player rows (data gap)
            total_players = sum(
                len(box[s][cat])
                for s in ("home", "away")
                for cat in ("passing", "rushing", "receiving")
            )
            if total_players == 0:
                continue

            game_obj = {
                "game_id":    gid,
                "season":     year,
                "week":       week,
                "game_type":  safe_str(sched_row.get("game_type"), "REG"),
                "gameday":    safe_str(sched_row.get("gameday")),
                "home_team":  home_team,
                "away_team":  away_team,
                "home_score": safe_int(sched_row.get("home_score")),
                "away_score": safe_int(sched_row.get("away_score")),
                "stadium":    safe_str(sched_row.get("stadium")),
                "roof":       safe_str(sched_row.get("roof")),
                "surface":    safe_str(sched_row.get("surface")),
                "temp":       safe_int(sched_row.get("temp")) if safe_str(sched_row.get("temp")) else None,
                "wind":       safe_int(sched_row.get("wind")) if safe_str(sched_row.get("wind")) else None,
                "overtime":   safe_bool(sched_row.get("overtime")),
                "spread_line": safe_float(sched_row.get("spread_line")),
                "home_coach": safe_str(sched_row.get("home_coach")),
                "away_coach": safe_str(sched_row.get("away_coach")),
                "referee":    safe_str(sched_row.get("referee")),
                "box_score":  box,
            }
            output_games.append(game_obj)

        # Sort by week, then gameday
        output_games.sort(key=lambda g: (g["week"], g["gameday"]))

        out_path = os.path.join(OUT_DIR, f"{year}.json")
        with open(out_path, "w") as f:
            json.dump(output_games, f, separators=(",", ":"))

        size_kb = os.path.getsize(out_path) / 1024
        print(f"  {year}: {len(output_games)} games → {size_kb:.0f} KB")
        index[str(year)] = len(output_games)

    # ── 6. Index file ─────────────────────────────────────────────────────────
    index_path = os.path.join(OUT_DIR, "index.json")
    with open(index_path, "w") as f:
        json.dump(index, f, separators=(",", ":"))

    total = sum(index.values())
    print(f"\nIndex → {index_path}")
    print(f"Seasons generated: {len(index)}  |  Total qualifying games: {total}")
    print(f"\nCopy to public/:\n  cp -r data/nfl_box_scores ../public/data/nfl/box_scores")


if __name__ == "__main__":
    main()
