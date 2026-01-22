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
from nba_api.stats.endpoints import CommonTeamRoster, LeagueDashPlayerStats

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

# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    print("Starting Ball Knowledge API Server...")
    print("API docs available at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
