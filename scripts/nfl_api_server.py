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

# All known abbreviations for each franchise.
# nfl_data_py uses different abbreviations depending on the season
# (e.g. "BLT" for Ravens in older data, "BAL" in newer data).
# We try to match any of these when looking up a team in the data.
TEAM_ALIASES: dict[str, list[str]] = {
    "LAR": ["LA", "LAR", "SL", "STL"],       # Rams
    "LV":  ["LV", "OAK"],                     # Raiders
    "LAC": ["LAC", "SD"],                      # Chargers
    "ARI": ["ARI", "ARZ"],                     # Cardinals
    "BAL": ["BAL", "BLT"],                     # Ravens
    "CLE": ["CLE", "CLV"],                     # Browns
    "HOU": ["HOU", "HST"],                     # Texans
}


def find_team_in_data(team: str, available_teams: list[str]) -> Optional[str]:
    """Find the matching abbreviation in the actual data.

    First checks if our abbreviation is already in the data.
    Then checks all known aliases for the franchise.
    """
    if team in available_teams:
        return team

    aliases = TEAM_ALIASES.get(team, [])
    for alias in aliases:
        if alias in available_teams:
            return alias

    return None

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
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        # Production domains
        "https://ball-knowledge-delta.vercel.app",
    ],
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

class TeamRecordResponse(BaseModel):
    team: str
    season: int
    wins: int
    losses: int
    ties: int
    record: str  # e.g., "12-5" or "12-4-1"
    winPct: float
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

def get_record_cache_path(team: str, season: int) -> Path:
    """Get the cache file path for a team record."""
    CACHE_DIR.mkdir(exist_ok=True)
    return CACHE_DIR / f"nfl_record_{team}_{season}.json"

def get_cached_record(team: str, season: int) -> Optional[dict]:
    """Get cached team record if it exists."""
    cache_path = get_record_cache_path(team, season)

    if not cache_path.exists():
        return None

    try:
        with open(cache_path, "r") as f:
            return json.load(f)
    except Exception:
        return None

def save_record_to_cache(team: str, season: int, record_data: dict) -> None:
    """Save team record to cache."""
    cache_path = get_record_cache_path(team, season)

    try:
        with open(cache_path, "w") as f:
            json.dump(record_data, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save record cache: {e}")

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
        # Try seasonal rosters first, fall back to weekly rosters for older seasons
        df = nfl.import_seasonal_rosters([season])

        if df is None or df.empty:
            print(f"Seasonal rosters empty for {season}, trying weekly rosters...")
            df = nfl.import_weekly_rosters([season])
            if df is not None and not df.empty:
                # Weekly rosters have multiple entries per player, deduplicate
                df = df.drop_duplicates(subset=['player_id'], keep='first')

        if df is None or df.empty:
            print(f"No roster data returned for season {season}")
            return []

        # Find the correct abbreviation in the actual data (handles nfl_data_py quirks)
        available = df['team'].unique().tolist()
        data_team = find_team_in_data(team, available)

        if data_team and data_team != team:
            print(f"Abbreviation matched: {team} → {data_team} for season {season}")

        if not data_team:
            print(f"No alias found for team {team} in {season}")
            print(f"Available teams: {sorted(available)}")
            return []

        team_df = df[df['team'] == data_team]

        if team_df.empty:
            print(f"No players found for team {data_team} (requested as {team}) in {season}")
            print(f"Available teams: {sorted(available)}")
            return []

        # Filter out cut players - keep only active roster
        # Status values: ACT (active), RES (reserve), PUP, IR, etc.
        # Exclude CUT players
        active_df = team_df[team_df['status'] != 'CUT']
        if active_df.empty:
            # If no active players, just use all players
            active_df = team_df

        players = []
        seen_ids = set()

        for _, row in active_df.iterrows():
            # Get player ID (use player_id first, then other IDs)
            player_id = str(row.get('player_id') or row.get('espn_id') or f"{row.get('player_name', 'unknown')}_{season}")

            if player_id in seen_ids:
                continue
            seen_ids.add(player_id)

            # Get player name
            name = row.get('player_name') or row.get('full_name') or "Unknown"
            if name == "Unknown":
                continue

            # Get position
            position = row.get('position') or row.get('depth_chart_position') or ""

            # Get jersey number - handle NaN
            jersey = row.get('jersey_number')
            number = str(int(jersey)) if jersey and not (isinstance(jersey, float) and jersey != jersey) else ""

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
        df = nfl.import_seasonal_rosters([season])

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

            player_id = str(row.get('player_id') or f"{name}_{season}")

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

# In-memory cache for season schedules
_schedules_cache: dict[int, dict] = {}

def fetch_team_record(team: str, season: int) -> Optional[dict]:
    """Fetch win-loss record for a team in a given season."""
    if not NFL_DATA_AVAILABLE:
        return None

    try:
        # Get schedule/game results for the season
        if season not in _schedules_cache:
            schedules = nfl.import_schedules([season])
            if schedules is None or schedules.empty:
                return None

            # Calculate records for all teams
            records = {}
            for _, game in schedules.iterrows():
                # Only count regular season games that have been played
                game_type = game.get('game_type', '')
                if game_type != 'REG':
                    continue

                home_team = game.get('home_team', '')
                away_team = game.get('away_team', '')
                home_score = game.get('home_score')
                away_score = game.get('away_score')

                # Skip games that haven't been played
                if home_score is None or away_score is None:
                    continue
                if str(home_score) == 'nan' or str(away_score) == 'nan':
                    continue

                home_score = int(home_score)
                away_score = int(away_score)

                # Initialize team records if needed
                for t in [home_team, away_team]:
                    if t and t not in records:
                        records[t] = {'wins': 0, 'losses': 0, 'ties': 0}

                if home_team and away_team:
                    if home_score > away_score:
                        records[home_team]['wins'] += 1
                        records[away_team]['losses'] += 1
                    elif away_score > home_score:
                        records[away_team]['wins'] += 1
                        records[home_team]['losses'] += 1
                    else:
                        records[home_team]['ties'] += 1
                        records[away_team]['ties'] += 1

            _schedules_cache[season] = records

        records = _schedules_cache[season]

        # Find the correct abbreviation in the schedule data
        data_team = find_team_in_data(team, list(records.keys()))
        if not data_team:
            return None

        team_record = records[data_team]
        wins = team_record['wins']
        losses = team_record['losses']
        ties = team_record['ties']

        # Format record string
        if ties > 0:
            record_str = f"{wins}-{losses}-{ties}"
        else:
            record_str = f"{wins}-{losses}"

        total_games = wins + losses + ties
        win_pct = wins / total_games if total_games > 0 else 0.0

        return {
            "team": team,
            "season": season,
            "wins": wins,
            "losses": losses,
            "ties": ties,
            "record": record_str,
            "winPct": round(win_pct, 3)
        }

    except Exception as e:
        print(f"Error fetching NFL team record: {e}")
        import traceback
        traceback.print_exc()
        return None

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

@app.get("/nfl/record/{team}/{season}", response_model=TeamRecordResponse)
async def get_team_record(team: str, season: int):
    """
    Get win-loss record for a specific team and season.

    Args:
        team: Team abbreviation (e.g., "KC", "SF")
        season: Season year (e.g., 2023)

    Returns:
        TeamRecordResponse with wins, losses, ties, record string
    """
    team = team.upper()

    # Validate team
    if team not in NFL_TEAMS:
        raise HTTPException(status_code=404, detail=f"Unknown team: {team}")

    # Validate season
    if season < 2000 or season > 2025:
        raise HTTPException(
            status_code=400,
            detail=f"Season must be between 2000 and 2025, got {season}"
        )

    # Check cache first
    cached_record = get_cached_record(team, season)
    if cached_record:
        return TeamRecordResponse(**cached_record, cached=True)

    print(f"Fetching record: {team} {season}")

    # Fetch record
    record_data = fetch_team_record(team, season)

    if not record_data:
        raise HTTPException(
            status_code=404,
            detail=f"No record data found for {team} in {season}"
        )

    # Save to cache
    save_record_to_cache(team, season, record_data)

    return TeamRecordResponse(**record_data, cached=False)

# ============================================================================
# Career Mode Endpoints
# ============================================================================

CAREER_POSITIONS = ["QB", "RB", "WR", "TE"]

# Lightweight cache: just the eligible player list for /career/random
_career_eligible_cache: Optional[list[dict]] = None

# Per-player career cache: player_id -> full response dict
_career_player_cache: dict[str, dict] = {}

# Lazy-loaded DataFrames (only loaded once, on first use)
_career_stats_df = None   # seasonal stats (heavy)
_career_roster_df = None  # seasonal rosters (medium)


def _safe_int(val, default=0):
    try:
        if val is None or (isinstance(val, float) and val != val):
            return default
        return int(val)
    except (ValueError, TypeError):
        return default


def _safe_str(val, default=""):
    if val is None or (isinstance(val, float) and val != val):
        return default
    s = str(val)
    return s if s and s != "nan" and s != "None" else default


def _get_roster_df():
    """Lazy-load roster data (lightweight — just names, positions, teams, bio)."""
    global _career_roster_df
    if _career_roster_df is not None:
        return _career_roster_df

    if not NFL_DATA_AVAILABLE:
        return None

    try:
        years = list(range(2010, 2025))
        print("Career mode: loading roster data...")
        df = nfl.import_seasonal_rosters(years)
        if df is not None and not df.empty:
            # One row per (player_id, season)
            _career_roster_df = df.drop_duplicates(subset=["player_id", "season"], keep="first")
            print(f"Career mode: roster loaded — {len(_career_roster_df)} rows")
        return _career_roster_df
    except Exception as e:
        print(f"Error loading career roster data: {e}")
        return None


def _get_stats_df():
    """Lazy-load seasonal stats (heavier — only called when building a specific player's career)."""
    global _career_stats_df
    if _career_stats_df is not None:
        return _career_stats_df

    if not NFL_DATA_AVAILABLE:
        return None

    try:
        years = list(range(2010, 2025))
        print("Career mode: loading seasonal stats...")
        _career_stats_df = nfl.import_seasonal_data(years)
        print(f"Career mode: stats loaded — {len(_career_stats_df)} rows")
        return _career_stats_df
    except Exception as e:
        print(f"Error loading career stats data: {e}")
        return None


def _career_yard_totals(player_stats) -> tuple:
    """Return (total_rushing_yards, total_receiving_yards, total_passing_yards) for a player."""
    def col_sum(col):
        if col not in player_stats.columns:
            return 0
        total = player_stats[col].fillna(0).sum()
        return int(total) if total == total else 0  # guard against NaN

    return (
        col_sum("rushing_yards"),
        col_sum("receiving_yards"),
        col_sum("passing_yards"),
    )


def _build_eligible_players() -> list[dict]:
    """Build eligible players list using roster (position/name) + stats (production filter).

    Eligibility requires 5+ seasons AND career production:
      - 1000+ career rushing yards, OR
      - 1000+ career receiving yards, OR
      - 3000+ career passing yards
    """
    global _career_eligible_cache
    if _career_eligible_cache is not None:
        return _career_eligible_cache

    roster = _get_roster_df()
    stats = _get_stats_df()
    if roster is None or roster.empty:
        return []
    if stats is None or stats.empty:
        print("Career mode: stats data unavailable, cannot filter by production")
        return []

    eligible = []
    for pid, group in roster.groupby("player_id"):
        if len(group) < 5:
            continue

        # Check position
        positions = group["position"].dropna().unique()
        player_pos = None
        for p in positions:
            if p in CAREER_POSITIONS:
                player_pos = p
                break
        if not player_pos:
            continue

        # Career production filter: 1000+ rush yds, 1000+ rec yds, or 3000+ pass yds
        player_stats = stats[stats["player_id"] == pid]
        if player_stats.empty:
            continue
        rush_yds, rec_yds, pass_yds = _career_yard_totals(player_stats)
        if rush_yds < 1000 and rec_yds < 1000 and pass_yds < 3000:
            continue

        # Get name from most recent season
        latest = group.sort_values("season", ascending=False).iloc[0]
        name = _safe_str(latest.get("player_name"))
        if not name:
            continue

        eligible.append({
            "player_id": str(pid),
            "player_name": name,
            "position": player_pos,
        })

    _career_eligible_cache = eligible
    print(f"Career mode: {len(eligible)} eligible players")
    return eligible


@app.get("/nfl/career/random")
async def get_random_career_player(position: Optional[str] = None):
    """Pick a random NFL player with 5+ seasons for Career Mode.

    Only loads roster data (lightweight) — stats are deferred to /career/{id}.
    """
    if not NFL_DATA_AVAILABLE:
        raise HTTPException(status_code=503, detail="NFL data not available")

    try:
        eligible = _build_eligible_players()
        if not eligible:
            raise HTTPException(status_code=404, detail="No eligible players found")

        # Filter by position if requested
        if position and position.upper() in CAREER_POSITIONS:
            pos = position.upper()
            filtered = [p for p in eligible if p["position"] == pos]
            if not filtered:
                raise HTTPException(status_code=404, detail=f"No eligible {pos} players found")
            return random.choice(filtered)

        return random.choice(eligible)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error finding random NFL career player: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/nfl/career/{player_id}")
async def get_nfl_career_stats(player_id: str):
    """Get full career stats for an NFL player (Career Mode).

    Loads stats data lazily on first call, then caches per-player results.
    """
    if not NFL_DATA_AVAILABLE:
        raise HTTPException(status_code=503, detail="NFL data not available")

    # Check per-player cache
    if player_id in _career_player_cache:
        return _career_player_cache[player_id]

    try:
        stats = _get_stats_df()
        roster = _get_roster_df()
        if stats is None or roster is None:
            raise HTTPException(status_code=500, detail="Could not load career data")

        # Get this player's stats
        player_stats = stats[stats["player_id"] == player_id].sort_values("season")
        if player_stats.empty:
            raise HTTPException(status_code=404, detail=f"No career data for player {player_id}")

        # Get this player's roster info (for position, team, name, bio)
        player_roster = roster[roster["player_id"] == player_id].sort_values("season")

        # Determine position from roster
        position = "QB"
        if not player_roster.empty:
            positions = player_roster["position"].dropna()
            if not positions.empty:
                mode = positions.mode()
                position = mode.iloc[0] if not mode.empty else "QB"

        # Build a lookup: season -> roster row (for team, name)
        roster_by_season = {}
        for _, rrow in player_roster.iterrows():
            roster_by_season[_safe_int(rrow.get("season"))] = rrow

        # Build seasons array
        seasons = []
        for _, row in player_stats.iterrows():
            season_year = _safe_int(row.get("season"))
            rrow = roster_by_season.get(season_year)
            team = _safe_str(rrow.get("team"), "???") if rrow is not None else "???"

            base = {
                "season": str(season_year),
                "team": team,
                "gp": _safe_int(row.get("games")),
            }

            if position == "QB":
                base.update({
                    "completions": _safe_int(row.get("completions")),
                    "attempts": _safe_int(row.get("attempts")),
                    "passing_yards": _safe_int(row.get("passing_yards")),
                    "passing_tds": _safe_int(row.get("passing_tds")),
                    "interceptions": _safe_int(row.get("interceptions")),
                    "rushing_yards": _safe_int(row.get("rushing_yards")),
                })
            elif position == "RB":
                base.update({
                    "carries": _safe_int(row.get("carries")),
                    "rushing_yards": _safe_int(row.get("rushing_yards")),
                    "rushing_tds": _safe_int(row.get("rushing_tds")),
                    "receptions": _safe_int(row.get("receptions")),
                    "receiving_yards": _safe_int(row.get("receiving_yards")),
                })
            else:  # WR/TE
                base.update({
                    "targets": _safe_int(row.get("targets")),
                    "receptions": _safe_int(row.get("receptions")),
                    "receiving_yards": _safe_int(row.get("receiving_yards")),
                    "receiving_tds": _safe_int(row.get("receiving_tds")),
                })

            seasons.append(base)

        # Bio from the most recent roster row
        latest_roster = player_roster.iloc[-1] if not player_roster.empty else None
        height_str = ""
        if latest_roster is not None:
            height_val = latest_roster.get("height")
            if height_val and not (isinstance(height_val, float) and height_val != height_val):
                try:
                    inches = int(float(height_val))
                    height_str = f"{inches // 12}-{inches % 12}"
                except (ValueError, TypeError):
                    height_str = str(height_val)

        bio = {
            "height": height_str,
            "weight": _safe_int(latest_roster.get("weight")) if latest_roster is not None else 0,
            "college": _safe_str(latest_roster.get("college")) if latest_roster is not None else "",
            "years_exp": _safe_int(latest_roster.get("years_exp")) if latest_roster is not None else 0,
            "draft_club": _safe_str(latest_roster.get("draft_club")) if latest_roster is not None else "",
            "draft_number": _safe_int(latest_roster.get("draft_number")) if latest_roster is not None else 0,
        }

        player_name = _safe_str(latest_roster.get("player_name")) if latest_roster is not None else ""

        result = {
            "player_id": player_id,
            "player_name": player_name,
            "position": position,
            "seasons": seasons,
            "bio": bio,
        }

        # Cache for future requests
        _career_player_cache[player_id] = result
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching NFL career stats for {player_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
