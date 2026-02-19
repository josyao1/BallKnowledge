#!/usr/bin/env python3
"""
NBA Roster Data Extraction Script

*** ARCHIVED — SUPERSEDED BY generate_nba_rosters.py ***
This script wrote a monolithic rosters.json into src/data/ (bundled with the app).
It has been replaced by generate_nba_rosters.py which writes individual per-team
per-season JSON files into public/data/rosters/ for static CDN serving.
Safe to delete.

Original description:
Extracts team rosters and player stats from nba_api for the Ball Knowledge trivia game.
Outputs JSON files for use in the React frontend.

Usage:
    python extract_rosters.py [--start-year 1985] [--end-year 2024] [--teams LAL,GSW]
"""

import json
import time
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional

from nba_api.stats.static import teams as nba_teams
from nba_api.stats.endpoints import (
    CommonTeamRoster,
    PlayerCareerStats,
    LeagueDashPlayerStats,
)
from tqdm import tqdm

# Rate limiting - nba_api can be rate limited
REQUEST_DELAY = 0.6  # seconds between requests

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "src" / "data"

# All 30 current NBA teams
NBA_TEAMS = {
    "ATL": 1610612737,
    "BOS": 1610612738,
    "BKN": 1610612751,
    "CHA": 1610612766,
    "CHI": 1610612741,
    "CLE": 1610612739,
    "DAL": 1610612742,
    "DEN": 1610612743,
    "DET": 1610612765,
    "GSW": 1610612744,
    "HOU": 1610612745,
    "IND": 1610612754,
    "LAC": 1610612746,
    "LAL": 1610612747,
    "MEM": 1610612763,
    "MIA": 1610612748,
    "MIL": 1610612749,
    "MIN": 1610612750,
    "NOP": 1610612740,
    "NYK": 1610612752,
    "OKC": 1610612760,
    "ORL": 1610612753,
    "PHI": 1610612755,
    "PHX": 1610612756,
    "POR": 1610612757,
    "SAC": 1610612758,
    "SAS": 1610612759,
    "TOR": 1610612761,
    "UTA": 1610612762,
    "WAS": 1610612764,
}

# Historical team mappings (team relocations/renames)
HISTORICAL_TEAMS = {
    # Seattle SuperSonics -> Oklahoma City Thunder (2008)
    "SEA": {"id": 1610612760, "end_year": 2008, "successor": "OKC"},
    # New Jersey Nets -> Brooklyn Nets (2012)
    "NJN": {"id": 1610612751, "end_year": 2012, "successor": "BKN"},
    # Charlotte Bobcats -> Charlotte Hornets (2014)
    "CHA_OLD": {"id": 1610612766, "years": range(2005, 2014)},
    # Vancouver Grizzlies -> Memphis Grizzlies (2001)
    "VAN": {"id": 1610612763, "end_year": 2001, "successor": "MEM"},
    # Washington Bullets -> Washington Wizards (1997)
    "WSB": {"id": 1610612764, "end_year": 1997, "successor": "WAS"},
}


def format_season(year: int) -> str:
    """Convert year to NBA season format (e.g., 2023 -> '2023-24')"""
    next_year = str(year + 1)[-2:]
    return f"{year}-{next_year}"


def get_team_roster(team_id: int, season: str) -> list[dict]:
    """Fetch roster for a team in a given season."""
    try:
        roster = CommonTeamRoster(team_id=team_id, season=season)
        time.sleep(REQUEST_DELAY)
        df = roster.get_data_frames()[0]

        players = []
        for _, row in df.iterrows():
            players.append({
                "id": int(row["PLAYER_ID"]),
                "name": row["PLAYER"],
                "position": row.get("POSITION", ""),
                "number": str(row.get("NUM", "")),
            })
        return players
    except Exception as e:
        print(f"Error fetching roster: {e}")
        return []


def get_season_player_stats(season: str) -> dict[int, float]:
    """Get PPG for all players in a season using league dashboard."""
    try:
        stats = LeagueDashPlayerStats(
            season=season,
            per_mode_detailed="PerGame",
            season_type_all_star="Regular Season"
        )
        time.sleep(REQUEST_DELAY)
        df = stats.get_data_frames()[0]

        return {
            int(row["PLAYER_ID"]): round(row["PTS"], 1)
            for _, row in df.iterrows()
        }
    except Exception as e:
        print(f"Error fetching season stats for {season}: {e}")
        return {}


def extract_rosters(
    start_year: int = 1985,
    end_year: int = 2024,
    team_filter: Optional[list[str]] = None
) -> dict:
    """
    Extract all team rosters for the specified year range.

    Returns:
        dict: {team_abbr: {season: [players]}}
    """
    rosters = {}
    all_players = {}  # For autocomplete: {player_id: {id, name}}

    teams_to_process = team_filter or list(NBA_TEAMS.keys())
    seasons = [format_season(year) for year in range(start_year, end_year + 1)]

    total_iterations = len(teams_to_process) * len(seasons)

    print(f"Extracting rosters for {len(teams_to_process)} teams across {len(seasons)} seasons...")
    print(f"Total team-seasons to process: {total_iterations}")

    # Cache season stats to avoid redundant API calls
    season_stats_cache = {}

    with tqdm(total=total_iterations, desc="Extracting") as pbar:
        for team_abbr in teams_to_process:
            team_id = NBA_TEAMS.get(team_abbr)
            if not team_id:
                print(f"Unknown team: {team_abbr}")
                continue

            rosters[team_abbr] = {}

            for season in seasons:
                pbar.set_description(f"{team_abbr} {season}")

                # Get roster
                roster_players = get_team_roster(team_id, season)

                if not roster_players:
                    pbar.update(1)
                    continue

                # Get season stats (cached)
                if season not in season_stats_cache:
                    season_stats_cache[season] = get_season_player_stats(season)

                ppg_data = season_stats_cache[season]

                # Enrich players with PPG
                enriched_players = []
                for player in roster_players:
                    ppg = ppg_data.get(player["id"], 0.0)
                    enriched_player = {
                        **player,
                        "ppg": ppg,
                        "isLowScorer": ppg < 10.0
                    }
                    enriched_players.append(enriched_player)

                    # Add to all_players for autocomplete
                    if player["id"] not in all_players:
                        all_players[player["id"]] = {
                            "id": player["id"],
                            "name": player["name"]
                        }

                # Sort by PPG descending
                enriched_players.sort(key=lambda p: p["ppg"], reverse=True)

                rosters[team_abbr][season] = enriched_players
                pbar.update(1)

    return rosters, all_players


def save_json(data: dict, filename: str) -> None:
    """Save data to JSON file."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OUTPUT_DIR / filename

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Saved: {filepath}")


def main():
    parser = argparse.ArgumentParser(description="Extract NBA roster data")
    parser.add_argument(
        "--start-year",
        type=int,
        default=1985,
        help="Start year (default: 1985)"
    )
    parser.add_argument(
        "--end-year",
        type=int,
        default=2024,
        help="End year (default: 2024)"
    )
    parser.add_argument(
        "--teams",
        type=str,
        default=None,
        help="Comma-separated team abbreviations (default: all teams)"
    )
    parser.add_argument(
        "--output-ts",
        action="store_true",
        help="Also output TypeScript file format"
    )

    args = parser.parse_args()

    team_filter = args.teams.split(",") if args.teams else None

    print("=" * 60)
    print("NBA Roster Data Extraction")
    print("=" * 60)
    print(f"Years: {args.start_year} - {args.end_year}")
    print(f"Teams: {team_filter or 'All 30 teams'}")
    print("=" * 60)

    # Extract data
    rosters, all_players = extract_rosters(
        start_year=args.start_year,
        end_year=args.end_year,
        team_filter=team_filter
    )

    # Save JSON files
    save_json(rosters, "rosters.json")
    save_json(list(all_players.values()), "players.json")

    # Summary
    total_rosters = sum(len(seasons) for seasons in rosters.values())
    total_players = len(all_players)

    print("\n" + "=" * 60)
    print("Extraction Complete!")
    print("=" * 60)
    print(f"Teams processed: {len(rosters)}")
    print(f"Team-seasons extracted: {total_rosters}")
    print(f"Unique players: {total_players}")
    print("=" * 60)


if __name__ == "__main__":
    main()
