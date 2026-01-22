#!/usr/bin/env python3
"""
Roster Knowledge - NFL Roster API Server

FastAPI server that fetches NFL roster data using nfl_data_py.
Includes caching to improve performance.

Usage:
    uvicorn nfl_api_server:app --reload --port 8001

Or:
    python nfl_api_server.py
"""

import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
import random

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import nfl_data_py as nfl
    NFL_DATA_AVAILABLE = True
except ImportError:
    NFL_DATA_AVAILABLE = False
    print("Warning: nfl_data_py not installed. Run: pip install nfl-data-py")

# ============================================================================
# Configuration
# ============================================================================

CACHE_DIR = Path(__file__).parent / ".nfl_cache"
CACHE_EXPIRY_HOURS = 168  # Cache for 1 week (NFL rosters don't change often)

# All 32 NFL teams
NFL_TEAMS = {
    # AFC East
    "BUF": {"name": "Buffalo Bills", "conference": "AFC", "division": "East"},
    "MIA": {"name": "Miami Dolphins", "conference": "AFC", "division": "East"},
    "NE": {"name": "New England Patriots", "conference": "AFC", "division": "East"},
    "NYJ": {"name": "New York Jets", "conference": "AFC", "division": "East"},
    # AFC North
    "BAL": {"name": "Baltimore Ravens", "conference": "AFC", "division": "North"},
    "CIN": {"name": "Cincinnati Bengals", "conference": "AFC", "division": "North"},
    "CLE": {"name": "Cleveland Browns", "conference": "AFC", "division": "North"},
    "PIT": {"name": "Pittsburgh Steelers", "conference": "AFC", "division": "North"},
    # AFC South
    "HOU": {"name": "Houston Texans", "conference": "AFC", "division": "South"},
    "IND": {"name": "Indianapolis Colts", "conference": "AFC", "division": "South"},
    "JAX": {"name": "Jacksonville Jaguars", "conference": "AFC", "division": "South"},
    "TEN": {"name": "Tennessee Titans", "conference": "AFC", "division": "South"},
    # AFC West
    "DEN": {"name": "Denver Broncos", "conference": "AFC", "division": "West"},
    "KC": {"name": "Kansas City Chiefs", "conference": "AFC", "division": "West"},
    "LV": {"name": "Las Vegas Raiders", "conference": "AFC", "division": "West"},
    "LAC": {"name": "Los Angeles Chargers", "conference": "AFC", "division": "West"},
    # NFC East
    "DAL": {"name": "Dallas Cowboys", "conference": "NFC", "division": "East"},
    "NYG": {"name": "New York Giants", "conference": "NFC", "division": "East"},
    "PHI": {"name": "Philadelphia Eagles", "conference": "NFC", "division": "East"},
    "WAS": {"name": "Washington Commanders", "conference": "NFC", "division": "East"},
    # NFC North
    "CHI": {"name": "Chicago Bears", "conference": "NFC", "division": "North"},
    "DET": {"name": "Detroit Lions", "conference": "NFC", "division": "North"},
    "GB": {"name": "Green Bay Packers", "conference": "NFC", "division": "North"},
    "MIN": {"name": "Minnesota Vikings", "conference": "NFC", "division": "North"},
    # NFC South
    "ATL": {"name": "Atlanta Falcons", "conference": "NFC", "division": "South"},
    "CAR": {"name": "Carolina Panthers", "conference": "NFC", "division": "South"},
    "NO": {"name": "New Orleans Saints", "conference": "NFC", "division": "South"},
    "TB": {"name": "Tampa Bay Buccaneers", "conference": "NFC", "division": "South"},
    # NFC West
    "ARI": {"name": "Arizona Cardinals", "conference": "NFC", "division": "West"},
    "LAR": {"name": "Los Angeles Rams", "conference": "NFC", "division": "West"},
    "SF": {"name": "San Francisco 49ers", "conference": "NFC", "division": "West"},
    "SEA": {"name": "Seattle Seahawks", "conference": "NFC", "division": "West"},
}

# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(
    title="Roster Knowledge - NFL API",
    description="NFL Roster Data API for Roster Knowledge trivia game",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Models
# ============================================================================

class Player(BaseModel):
    id: str
    name: str
    position: str
    number: str
    unit: str  # Offense, Defense, Special Teams

class RosterResponse(BaseModel):
    team: str
    season: int
    players: list[Player]
    cached: bool = False

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    nfl_data_available: bool

class SeasonPlayer(BaseModel):
    id: str
    name: str

class SeasonPlayersResponse(BaseModel):
    season: int
    players: list[SeasonPlayer]
    cached: bool = False

# ============================================================================
# Caching
# ============================================================================

def get_cache_path(team: str, season: int) -> Path:
    """Get the cache file path for a team/season."""
    CACHE_DIR.mkdir(exist_ok=True)
    return CACHE_DIR / f"nfl_{team}_{season}.json"

def get_cached_roster(team: str, season: int) -> Optional[list[dict]]:
    """Get cached roster data if it exists and is not expired."""
    cache_path = get_cache_path(team, season)

    if not cache_path.exists():
        return None

    try:
        with open(cache_path, "r") as f:
            data = json.load(f)

        cached_time = datetime.fromisoformat(data.get("cached_at", "2000-01-01"))
        if datetime.now() - cached_time > timedelta(hours=CACHE_EXPIRY_HOURS):
            return None

        return data.get("players", [])
    except Exception:
        return None

def save_to_cache(team: str, season: int, players: list[dict]) -> None:
    """Save roster data to cache."""
    cache_path = get_cache_path(team, season)

    try:
        with open(cache_path, "w") as f:
            json.dump({
                "team": team,
                "season": season,
                "cached_at": datetime.now().isoformat(),
                "players": players
            }, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save cache: {e}")

def get_season_players_cache_path(season: int) -> Path:
    """Get the cache file path for season players."""
    CACHE_DIR.mkdir(exist_ok=True)
    return CACHE_DIR / f"nfl_season_players_{season}.json"

def get_cached_season_players(season: int) -> Optional[list[dict]]:
    """Get cached season players if they exist and are not expired."""
    cache_path = get_season_players_cache_path(season)

    if not cache_path.exists():
        return None

    try:
        with open(cache_path, "r") as f:
            data = json.load(f)

        cached_time = datetime.fromisoformat(data.get("cached_at", "2000-01-01"))
        if datetime.now() - cached_time > timedelta(hours=CACHE_EXPIRY_HOURS):
            return None

        return data.get("players", [])
    except Exception:
        return None

def save_season_players_to_cache(season: int, players: list[dict]) -> None:
    """Save season players to cache."""
    cache_path = get_season_players_cache_path(season)

    try:
        with open(cache_path, "w") as f:
            json.dump({
                "season": season,
                "cached_at": datetime.now().isoformat(),
                "players": players
            }, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save season players cache: {e}")

# ============================================================================
# NFL Data Functions
# ============================================================================

def get_position_unit(position: str) -> str:
    """Determine if a position is Offense, Defense, or Special Teams."""
    offense = ["QB", "RB", "FB", "WR", "TE", "T", "G", "C", "OL", "OT", "OG", "LT", "LG", "RT", "RG"]
    defense = ["DE", "DT", "NT", "DL", "LB", "ILB", "OLB", "MLB", "CB", "S", "SS", "FS", "DB", "EDGE"]
    special = ["K", "P", "LS", "KR", "PR"]

    pos_upper = position.upper() if position else ""

    if pos_upper in offense:
        return "Offense"
    elif pos_upper in defense:
        return "Defense"
    elif pos_upper in special:
        return "Special Teams"
    else:
        return "Offense"  # Default to offense for unknown positions

def fetch_team_roster(team: str, season: int) -> list[dict]:
    """Fetch roster for a team in a given season from nfl_data_py."""
    if not NFL_DATA_AVAILABLE:
        return []

    try:
        # Import roster data for the season
        df = nfl.import_rosters([season])

        if df is None or df.empty:
            print(f"No roster data returned for season {season}")
            return []

        # Filter for the specific team
        # nfl_data_py uses team abbreviations like 'BUF', 'KC', etc.
        team_df = df[df['team'] == team]

        if team_df.empty:
            # Try alternate team name formats
            team_df = df[df['team'].str.upper() == team.upper()]

        if team_df.empty:
            print(f"No players found for team {team} in {season}")
            print(f"Available teams: {df['team'].unique().tolist()}")
            return []

        players = []
        seen_ids = set()

        for _, row in team_df.iterrows():
            # Get player ID (use gsis_id or player_id)
            player_id = str(row.get('gsis_id') or row.get('player_id') or row.get('espn_id') or f"{row.get('player_name', 'unknown')}_{season}")

            if player_id in seen_ids:
                continue
            seen_ids.add(player_id)

            # Get player name
            name = row.get('player_name') or row.get('full_name') or "Unknown"

            # Get position
            position = row.get('position') or row.get('depth_chart_position') or ""

            # Get jersey number
            number = str(row.get('jersey_number') or row.get('number') or "")

            # Determine unit
            unit = get_position_unit(position)

            players.append({
                "id": player_id,
                "name": name,
                "position": position,
                "number": number,
                "unit": unit
            })

        # Sort by unit then by position
        unit_order = {"Offense": 0, "Defense": 1, "Special Teams": 2}
        players.sort(key=lambda p: (unit_order.get(p["unit"], 3), p["position"], p["name"]))

        print(f"Fetched {len(players)} players for {team} {season}")
        return players

    except Exception as e:
        print(f"Error fetching NFL roster: {e}")
        import traceback
        traceback.print_exc()
        return []

def fetch_all_season_players(season: int) -> list[dict]:
    """Fetch all players who played in a given season."""
    if not NFL_DATA_AVAILABLE:
        return []

    try:
        df = nfl.import_rosters([season])

        if df is None or df.empty:
            print(f"No player data returned for season {season}")
            return []

        players = []
        seen_names = set()

        for _, row in df.iterrows():
            name = row.get('player_name') or row.get('full_name') or "Unknown"

            if name.lower() in seen_names or name == "Unknown":
                continue
            seen_names.add(name.lower())

            player_id = str(row.get('gsis_id') or row.get('player_id') or f"{name}_{season}")

            players.append({
                "id": player_id,
                "name": name
            })

        players.sort(key=lambda p: p["name"])
        print(f"Fetched {len(players)} unique players for season {season}")
        return players

    except Exception as e:
        print(f"Error fetching all season players: {e}")
        return []

# In-memory cache for season players
_season_players_cache: dict[int, list[dict]] = {}

def get_all_season_players(season: int) -> list[dict]:
    """Get all season players with in-memory caching."""
    if season not in _season_players_cache:
        _season_players_cache[season] = fetch_all_season_players(season)
    return _season_players_cache[season]

# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/nfl/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now().isoformat(),
        nfl_data_available=NFL_DATA_AVAILABLE
    )

@app.get("/nfl/teams")
async def get_teams():
    """Get list of all NFL teams."""
    return {
        "teams": [
            {
                "abbreviation": abbr,
                "name": info["name"],
                "conference": info["conference"],
                "division": info["division"]
            }
            for abbr, info in NFL_TEAMS.items()
        ]
    }

@app.get("/nfl/roster/{team}/{season}", response_model=RosterResponse)
async def get_roster(team: str, season: int):
    """
    Get roster for a specific team and season.

    Args:
        team: Team abbreviation (e.g., "KC", "SF")
        season: Season year (e.g., 2023)

    Returns:
        RosterResponse with list of players
    """
    team = team.upper()

    # Validate team
    if team not in NFL_TEAMS:
        raise HTTPException(status_code=404, detail=f"Unknown team: {team}")

    # Validate season (NFL data available from 2000+)
    if season < 2000 or season > 2025:
        raise HTTPException(
            status_code=400,
            detail=f"Season must be between 2000 and 2025, got {season}"
        )

    # Check cache first
    cached_players = get_cached_roster(team, season)
    if cached_players:
        print(f"Cache hit: {team} {season}")
        return RosterResponse(
            team=team,
            season=season,
            players=[Player(**p) for p in cached_players],
            cached=True
        )

    print(f"Fetching from nfl_data_py: {team} {season}")

    # Fetch roster
    roster_players = fetch_team_roster(team, season)

    if not roster_players:
        raise HTTPException(
            status_code=404,
            detail=f"No roster data found for {team} in {season}"
        )

    # Save to cache
    save_to_cache(team, season, roster_players)

    return RosterResponse(
        team=team,
        season=season,
        players=[Player(**p) for p in roster_players],
        cached=False
    )

@app.get("/nfl/random")
async def get_random_team_season(
    min_year: int = 2015,
    max_year: int = 2024
):
    """
    Get a random team and season combination.
    """
    team = random.choice(list(NFL_TEAMS.keys()))
    year = random.randint(max(min_year, 2000), min(max_year, 2024))

    return {
        "team": team,
        "season": year,
        "team_name": NFL_TEAMS[team]["name"]
    }

@app.get("/nfl/players/{season}", response_model=SeasonPlayersResponse)
async def get_season_players(season: int):
    """
    Get all NFL players who played in a given season.
    """
    if season < 2000 or season > 2025:
        raise HTTPException(
            status_code=400,
            detail=f"Season must be between 2000 and 2025, got {season}"
        )

    # Check file cache first
    cached_players = get_cached_season_players(season)
    if cached_players:
        print(f"Season players cache hit: {season}")
        return SeasonPlayersResponse(
            season=season,
            players=[SeasonPlayer(**p) for p in cached_players],
            cached=True
        )

    print(f"Fetching all players for season {season}...")

    players = get_all_season_players(season)

    if not players:
        raise HTTPException(
            status_code=404,
            detail=f"No player data found for season {season}"
        )

    # Save to file cache
    save_season_players_to_cache(season, players)

    return SeasonPlayersResponse(
        season=season,
        players=[SeasonPlayer(**p) for p in players],
        cached=False
    )

# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    print("Starting NFL Roster API Server...")
    print("API docs available at: http://localhost:8001/docs")
    if not NFL_DATA_AVAILABLE:
        print("WARNING: nfl_data_py not installed! Run: pip install nfl-data-py")
    uvicorn.run(app, host="0.0.0.0", port=8001)
