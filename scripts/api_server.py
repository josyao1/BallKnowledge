#!/usr/bin/env python3
"""
Ball Knowledge - NBA Roster API Server

FastAPI server that fetches NBA roster data on-demand using nba_api.
Includes caching to avoid rate limits and improve performance.

Usage:
    uvicorn api_server:app --reload --port 8000

Or:
    python api_server.py
"""

import time
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from nba_api.stats.static import teams as nba_teams
from nba_api.stats.endpoints import CommonTeamRoster, LeagueDashPlayerStats, CommonAllPlayers

# ============================================================================
# Configuration
# ============================================================================

CACHE_DIR = Path(__file__).parent / ".cache"
CACHE_EXPIRY_HOURS = 24  # Cache roster data for 24 hours
REQUEST_DELAY = 0.6  # Delay between nba_api requests to avoid rate limiting

# All 30 current NBA teams
NBA_TEAMS = {
    "ATL": 1610612737, "BOS": 1610612738, "BKN": 1610612751, "CHA": 1610612766,
    "CHI": 1610612741, "CLE": 1610612739, "DAL": 1610612742, "DEN": 1610612743,
    "DET": 1610612765, "GSW": 1610612744, "HOU": 1610612745, "IND": 1610612754,
    "LAC": 1610612746, "LAL": 1610612747, "MEM": 1610612763, "MIA": 1610612748,
    "MIL": 1610612749, "MIN": 1610612750, "NOP": 1610612740, "NYK": 1610612752,
    "OKC": 1610612760, "ORL": 1610612753, "PHI": 1610612755, "PHX": 1610612756,
    "POR": 1610612757, "SAC": 1610612758, "SAS": 1610612759, "TOR": 1610612761,
    "UTA": 1610612762, "WAS": 1610612764,
}

# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(
    title="Ball Knowledge API",
    description="NBA Roster Data API for Ball Knowledge trivia game",
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
    id: int
    name: str
    position: str
    number: str
    ppg: float
    isLowScorer: bool

class RosterResponse(BaseModel):
    team: str
    season: str
    players: list[Player]
    cached: bool = False

class HealthResponse(BaseModel):
    status: str
    timestamp: str

class SeasonPlayer(BaseModel):
    id: int
    name: str

class SeasonPlayersResponse(BaseModel):
    season: str
    players: list[SeasonPlayer]
    cached: bool = False

# ============================================================================
# Caching
# ============================================================================

def get_cache_path(team: str, season: str) -> Path:
    """Get the cache file path for a team/season."""
    CACHE_DIR.mkdir(exist_ok=True)
    return CACHE_DIR / f"{team}_{season}.json"

def get_cached_roster(team: str, season: str) -> Optional[list[dict]]:
    """Get cached roster data if it exists and is not expired."""
    cache_path = get_cache_path(team, season)

    if not cache_path.exists():
        return None

    try:
        with open(cache_path, "r") as f:
            data = json.load(f)

        # Check if cache is expired
        cached_time = datetime.fromisoformat(data.get("cached_at", "2000-01-01"))
        if datetime.now() - cached_time > timedelta(hours=CACHE_EXPIRY_HOURS):
            return None

        return data.get("players", [])
    except Exception:
        return None

def save_to_cache(team: str, season: str, players: list[dict]) -> None:
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


def get_season_players_cache_path(season: str) -> Path:
    """Get the cache file path for season players."""
    CACHE_DIR.mkdir(exist_ok=True)
    return CACHE_DIR / f"season_players_{season}.json"


def get_cached_season_players(season: str) -> Optional[list[dict]]:
    """Get cached season players if they exist and are not expired."""
    cache_path = get_season_players_cache_path(season)

    if not cache_path.exists():
        return None

    try:
        with open(cache_path, "r") as f:
            data = json.load(f)

        # Check if cache is expired
        cached_time = datetime.fromisoformat(data.get("cached_at", "2000-01-01"))
        if datetime.now() - cached_time > timedelta(hours=CACHE_EXPIRY_HOURS):
            return None

        return data.get("players", [])
    except Exception:
        return None


def save_season_players_to_cache(season: str, players: list[dict]) -> None:
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
# NBA API Functions
# ============================================================================

def fetch_team_roster(team_id: int, season: str) -> list[dict]:
    """Fetch roster for a team in a given season from nba_api."""
    try:
        roster = CommonTeamRoster(team_id=team_id, season=season)
        time.sleep(REQUEST_DELAY)
        df = roster.get_data_frames()[0]

        players = []
        for _, row in df.iterrows():
            players.append({
                "id": int(row["PLAYER_ID"]),
                "name": row["PLAYER"],
                "position": row.get("POSITION", "") or "",
                "number": str(row.get("NUM", "") or ""),
            })
        return players
    except Exception as e:
        print(f"Error fetching roster: {e}")
        return []

def fetch_season_stats(season: str) -> dict[int, float]:
    """Get PPG for all players in a season."""
    try:
        stats = LeagueDashPlayerStats(
            season=season,
            per_mode_detailed="PerGame",
            season_type_all_star="Regular Season"
        )
        time.sleep(REQUEST_DELAY)
        df = stats.get_data_frames()[0]

        return {
            int(row["PLAYER_ID"]): round(float(row["PTS"]), 1)
            for _, row in df.iterrows()
        }
    except Exception as e:
        print(f"Error fetching season stats: {e}")
        return {}

# In-memory cache for season stats to avoid redundant API calls
_season_stats_cache: dict[str, dict[int, float]] = {}

def get_season_stats(season: str) -> dict[int, float]:
    """Get season stats with in-memory caching."""
    if season not in _season_stats_cache:
        _season_stats_cache[season] = fetch_season_stats(season)
    return _season_stats_cache[season]


# In-memory cache for season players
_season_players_cache: dict[str, list[dict]] = {}


def fetch_all_season_players(season: str) -> list[dict]:
    """Fetch all players who played in a given season.

    Uses LeagueDashPlayerStats for recent seasons (1996+),
    falls back to CommonAllPlayers for older seasons or if stats endpoint fails.
    """
    players = []

    # Try LeagueDashPlayerStats first (better for recent seasons, has stats)
    try:
        print(f"Trying LeagueDashPlayerStats for {season}...")
        stats = LeagueDashPlayerStats(
            season=season,
            per_mode_detailed="PerGame",
            season_type_all_star="Regular Season"
        )
        time.sleep(REQUEST_DELAY)
        df = stats.get_data_frames()[0]

        if not df.empty:
            # Handle different column names (API might vary by season)
            name_col = "PLAYER_NAME" if "PLAYER_NAME" in df.columns else "PLAYER"
            id_col = "PLAYER_ID"

            if name_col in df.columns and id_col in df.columns:
                for _, row in df.iterrows():
                    players.append({
                        "id": int(row[id_col]),
                        "name": row[name_col]
                    })
                print(f"LeagueDashPlayerStats returned {len(players)} players for {season}")
    except Exception as e:
        print(f"LeagueDashPlayerStats failed for {season}: {e}")

    # If no players found, try CommonAllPlayers (better for historical data)
    if len(players) == 0:
        try:
            print(f"Trying CommonAllPlayers for {season}...")
            # CommonAllPlayers returns all players filtered by season
            all_players = CommonAllPlayers(
                is_only_current_season=0,
                season=season
            )
            time.sleep(REQUEST_DELAY)
            df = all_players.get_data_frames()[0]

            if not df.empty:
                # Filter for players who actually played that season
                # TO_YEAR column shows the last season they played
                # FROM_YEAR shows when they started
                # We want players where the season falls within their career
                season_year = int(season[:4])

                for _, row in df.iterrows():
                    try:
                        from_year = int(row.get("FROM_YEAR", 0))
                        to_year = int(row.get("TO_YEAR", 9999))

                        # Check if player was active during this season
                        if from_year <= season_year <= to_year:
                            player_name = row.get("DISPLAY_FIRST_LAST") or row.get("PLAYERCODE", "Unknown")
                            player_id = int(row.get("PERSON_ID", 0))

                            if player_name and player_id:
                                players.append({
                                    "id": player_id,
                                    "name": player_name
                                })
                    except (ValueError, TypeError):
                        continue

                print(f"CommonAllPlayers returned {len(players)} players for {season}")
        except Exception as e:
            print(f"CommonAllPlayers failed for {season}: {e}")

    if len(players) == 0:
        print(f"No player data found for season {season} from any source")
        return []

    # Remove duplicates by player ID
    seen_ids = set()
    unique_players = []
    for p in players:
        if p["id"] not in seen_ids:
            seen_ids.add(p["id"])
            unique_players.append(p)

    # Sort alphabetically by name
    unique_players.sort(key=lambda p: p["name"])
    print(f"Final player count for {season}: {len(unique_players)}")
    return unique_players


def get_all_season_players(season: str) -> list[dict]:
    """Get all season players with in-memory caching."""
    if season not in _season_players_cache:
        _season_players_cache[season] = fetch_all_season_players(season)
    return _season_players_cache[season]

# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now().isoformat()
    )

@app.get("/teams")
async def get_teams():
    """Get list of all NBA teams."""
    return {
        "teams": [
            {"abbreviation": abbr, "id": team_id}
            for abbr, team_id in NBA_TEAMS.items()
        ]
    }

@app.get("/roster/{team}/{season}", response_model=RosterResponse)
async def get_roster(team: str, season: str):
    """
    Get roster for a specific team and season.

    Args:
        team: Team abbreviation (e.g., "LAL", "GSW")
        season: Season in format "YYYY-YY" (e.g., "2023-24")

    Returns:
        RosterResponse with list of players including PPG stats
    """
    team = team.upper()

    # Validate team
    if team not in NBA_TEAMS:
        raise HTTPException(status_code=404, detail=f"Unknown team: {team}")

    # Validate season format
    if not (len(season) == 7 and season[4] == "-"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid season format. Expected 'YYYY-YY', got '{season}'"
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

    print(f"Fetching from NBA API: {team} {season}")

    # Fetch roster
    team_id = NBA_TEAMS[team]
    roster_players = fetch_team_roster(team_id, season)

    if not roster_players:
        raise HTTPException(
            status_code=404,
            detail=f"No roster data found for {team} in {season}"
        )

    # Fetch season stats for PPG
    ppg_data = get_season_stats(season)

    # Enrich players with PPG
    enriched_players = []
    for player in roster_players:
        ppg = ppg_data.get(player["id"], 0.0)
        enriched_players.append({
            **player,
            "ppg": ppg,
            "isLowScorer": ppg < 10.0
        })

    # Sort by PPG descending
    enriched_players.sort(key=lambda p: p["ppg"], reverse=True)

    # Save to cache
    save_to_cache(team, season, enriched_players)

    return RosterResponse(
        team=team,
        season=season,
        players=[Player(**p) for p in enriched_players],
        cached=False
    )

@app.get("/random")
async def get_random_team_season(
    min_year: int = 2015,
    max_year: int = 2024
):
    """
    Get a random team and season combination.

    Returns team abbreviation and season string.
    """
    import random

    team = random.choice(list(NBA_TEAMS.keys()))
    year = random.randint(min_year, max_year)
    season = f"{year}-{str(year + 1)[-2:]}"

    return {
        "team": team,
        "season": season,
        "team_id": NBA_TEAMS[team]
    }


@app.get("/players/{season}", response_model=SeasonPlayersResponse)
async def get_season_players(season: str):
    """
    Get all NBA players who played in a given season.

    Args:
        season: Season in format "YYYY-YY" (e.g., "2023-24")

    Returns:
        SeasonPlayersResponse with list of all players (id, name)
    """
    # Validate season format
    if not (len(season) == 7 and season[4] == "-"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid season format. Expected 'YYYY-YY', got '{season}'"
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

    print(f"Fetching all players for season {season} from NBA API...")

    # Fetch from API
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
    print("Starting Ball Knowledge API Server...")
    print("API docs available at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
