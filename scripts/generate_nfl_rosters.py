#!/usr/bin/env python3
"""
NFL Roster Preload Script

Generates static JSON files for all NFL team rosters (2000-present) for use
as Vercel static assets, eliminating the need for the Render backend in
roster guessing mode.

Unlike the NBA script, nfl_data_py is a local library (downloads from GitHub
releases) — no API rate limiting. All seasons are fetched in one bulk call.

Strategy:
  1. Check existing nfl_api_server .nfl_cache/ files first — instant reads.
  2. For cache misses: bulk-fetch all remaining seasons via nfl_data_py at once.

Output:
  public/data/nfl/rosters/{TEAM}_{YEAR}.json   per team-season roster
  public/data/nfl/players/{YEAR}.json          all players per season (autocomplete)

Usage:
    python generate_nfl_rosters.py                  full run 2000-2024
    python generate_nfl_rosters.py --teams KC,SF    test two teams
    python generate_nfl_rosters.py --force          overwrite existing output files
"""

import json
import argparse
from pathlib import Path

import nfl_data_py as nfl

PROJECT_ROOT = Path(__file__).parent.parent
NFL_CACHE_DIR = Path(__file__).parent / ".nfl_cache"
ROSTERS_DIR  = PROJECT_ROOT / "public" / "data" / "nfl" / "rosters"
PLAYERS_DIR  = PROJECT_ROOT / "public" / "data" / "nfl" / "players"

# All 32 current NFL teams (current abbreviations)
NFL_TEAMS = [
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
    "DAL", "DEN", "DET", "GB",  "HOU", "IND", "JAX", "KC",
    "LAC", "LAR", "LV",  "MIA", "MIN", "NE",  "NO",  "NYG",
    "NYJ", "PHI", "PIT", "SEA", "SF",  "TB",  "TEN", "WAS",
]

# nfl_data_py uses different abbreviations in older data — map to current ones
ALIAS_TO_CURRENT = {
    "LA":  "LAR", "SL": "LAR", "STL": "LAR",   # Rams
    "OAK": "LV",                                  # Raiders
    "SD":  "LAC",                                 # Chargers
    "ARZ": "ARI",                                 # Cardinals
    "BLT": "BAL",                                 # Ravens
    "CLV": "CLE",                                 # Browns
    "HST": "HOU",                                 # Texans
}


def get_position_unit(position: str) -> str:
    offense = {"QB","RB","FB","WR","TE","T","G","C","OL","OT","OG","LT","LG","RT","RG"}
    defense = {"DE","DT","NT","DL","LB","ILB","OLB","MLB","CB","S","SS","FS","DB","EDGE"}
    special = {"K","P","LS","KR","PR"}
    pos = (position or "").upper()
    if pos in offense: return "Offense"
    if pos in defense: return "Defense"
    if pos in special: return "Special Teams"
    return "Offense"


def save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))


def read_nfl_cache(team: str, year: int):
    """Read from nfl_api_server's existing .nfl_cache/ files."""
    path = NFL_CACHE_DIR / f"nfl_{team}_{year}.json"
    if path.exists():
        try:
            data = json.loads(path.read_text())
            players = data.get("players", [])
            if players:
                return players
        except Exception:
            pass
    return None


def build_players_from_row(row, year: int) -> dict:
    player_id = str(row.get("player_id") or row.get("espn_id") or f"{row.get('player_name','unknown')}_{year}")
    name      = row.get("player_name") or row.get("full_name") or ""
    position  = str(row.get("position") or row.get("depth_chart_position") or "")
    jersey    = row.get("jersey_number")
    number    = str(int(jersey)) if jersey and str(jersey) != "nan" else ""
    return {
        "id":       player_id,
        "name":     name,
        "position": position,
        "number":   number,
        "unit":     get_position_unit(position),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-year", type=int, default=2000)
    parser.add_argument("--end-year",   type=int, default=2024)
    parser.add_argument("--teams",      type=str, default=None)
    parser.add_argument("--force",      action="store_true")
    args = parser.parse_args()

    teams = [t for t in NFL_TEAMS if t in args.teams.upper().split(",")] if args.teams else NFL_TEAMS
    years = list(range(args.start_year, args.end_year + 1))

    print("=" * 60)
    print("NFL Roster Preload Script")
    print("=" * 60)
    print(f"  Years   : {years[0]}–{years[-1]}  ({len(years)} seasons)")
    print(f"  Teams   : {len(teams)}")
    print(f"  Output  : {PROJECT_ROOT / 'public' / 'data' / 'nfl'}")
    print(f"  Mode    : {'overwrite' if args.force else 'resume (skip existing output)'}")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # Pass 1: fill from existing .nfl_cache/ (instant)
    # -----------------------------------------------------------------------
    missing_years = set()   # years we need to bulk-fetch

    from_cache = 0
    skipped    = 0

    for year in years:
        for team in teams:
            out_path = ROSTERS_DIR / f"{team}_{year}.json"
            if not args.force and out_path.exists():
                skipped += 1
                continue

            cached = read_nfl_cache(team, year)
            if cached:
                save_json(out_path, {"team": team, "season": year, "players": cached})
                from_cache += 1
            else:
                missing_years.add(year)

    print(f"\nPass 1 complete — {from_cache} from cache, {skipped} already existed.")

    # -----------------------------------------------------------------------
    # Pass 2: bulk-fetch missing years via nfl_data_py (all at once)
    # -----------------------------------------------------------------------
    from_api = 0
    api_failed_years = []

    if missing_years:
        fetch_years = sorted(missing_years)
        print(f"\nFetching {len(fetch_years)} season(s) via nfl_data_py: {fetch_years}")
        print("(This downloads from GitHub releases — may take a minute on first run...)\n")

        try:
            df = nfl.import_seasonal_rosters(fetch_years)
        except Exception as e:
            print(f"  seasonal_rosters failed ({e}), trying weekly_rosters...")
            try:
                df = nfl.import_weekly_rosters(fetch_years)
                if df is not None and not df.empty:
                    df = df.drop_duplicates(subset=["player_id"], keep="first")
            except Exception as e2:
                print(f"  weekly_rosters also failed: {e2}")
                df = None

        if df is None or df.empty:
            print("  ERROR: nfl_data_py returned no data.")
            api_failed_years = fetch_years
        else:
            # Normalise team abbreviations to current ones
            df["team_current"] = df["team"].map(lambda t: ALIAS_TO_CURRENT.get(str(t), str(t)))

            for year in fetch_years:
                year_df = df[df["season"] == year] if "season" in df.columns else df
                if year_df.empty:
                    print(f"  {year}: no data found")
                    api_failed_years.append(year)
                    continue

                # Build season-wide player list for autocomplete
                season_players: dict[str, str] = {}  # id -> name

                for team in teams:
                    out_path = ROSTERS_DIR / f"{team}_{year}.json"
                    if not args.force and out_path.exists():
                        continue

                    team_df = year_df[year_df["team_current"] == team]
                    # Exclude cut players if status column present
                    if "status" in team_df.columns:
                        active = team_df[team_df["status"] != "CUT"]
                        team_df = active if not active.empty else team_df

                    if team_df.empty:
                        continue

                    players = []
                    seen = set()
                    for _, row in team_df.iterrows():
                        p = build_players_from_row(row, year)
                        if not p["name"] or p["id"] in seen:
                            continue
                        seen.add(p["id"])
                        players.append(p)
                        season_players[p["id"]] = p["name"]

                    if not players:
                        continue

                    unit_order = {"Offense": 0, "Defense": 1, "Special Teams": 2}
                    players.sort(key=lambda p: (unit_order.get(p["unit"], 3), p["position"], p["name"]))

                    save_json(out_path, {"team": team, "season": year, "players": players})
                    from_api += 1

                # Write season players autocomplete file
                players_path = PLAYERS_DIR / f"{year}.json"
                if args.force or not players_path.exists():
                    # Collect all players from this year across all teams
                    all_year_players = year_df.copy()
                    all_year_players["team_current"] = all_year_players["team"].map(
                        lambda t: ALIAS_TO_CURRENT.get(str(t), str(t))
                    )
                    all_seen: dict[str, str] = {}
                    for _, row in all_year_players.iterrows():
                        pid  = str(row.get("player_id") or f"unk_{row.get('player_name','')}_{year}")
                        name = str(row.get("player_name") or row.get("full_name") or "")
                        if name and pid not in all_seen:
                            all_seen[pid] = name
                    player_list = sorted([{"id": k, "name": v} for k, v in all_seen.items()], key=lambda p: p["name"])
                    save_json(players_path, player_list)
                    print(f"  {year}: {from_api} rosters written, {len(player_list)} players in autocomplete")

    # -----------------------------------------------------------------------
    # Pass 3: write autocomplete files for cache-sourced years
    # -----------------------------------------------------------------------
    print("\nBuilding autocomplete files for cache-sourced years...")
    players_written = 0
    for year in years:
        players_path = PLAYERS_DIR / f"{year}.json"
        if not args.force and players_path.exists():
            continue
        # Read from already-written roster files
        all_players: dict[str, str] = {}
        for team in teams:
            roster_path = ROSTERS_DIR / f"{team}_{year}.json"
            if roster_path.exists():
                try:
                    data = json.loads(roster_path.read_text())
                    for p in data.get("players", []):
                        if p.get("name"):
                            all_players[p["id"]] = p["name"]
                except Exception:
                    pass
        if all_players:
            player_list = sorted([{"id": k, "name": v} for k, v in all_players.items()], key=lambda p: p["name"])
            save_json(players_path, player_list)
            players_written += 1

    print("\n" + "=" * 60)
    print("Done!")
    print(f"  Roster files — from cache : {from_cache}")
    print(f"  Roster files — from API   : {from_api}")
    print(f"  Roster files — skipped    : {skipped}")
    print(f"  Season player files       : {players_written}")
    if api_failed_years:
        print(f"  Failed years              : {api_failed_years}  (re-run to retry)")
    print("=" * 60)


if __name__ == "__main__":
    main()
