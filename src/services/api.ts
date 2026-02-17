/**
 * api.ts — NBA API client for the Python backend.
 *
 * Provides roster fetching, random team selection, season player lists (autocomplete),
 * and team record lookups. Uses `getApiAbbreviation` to translate current team
 * abbreviations to historical ones for relocated franchises (e.g. NJN for BKN pre-2012).
 * API availability is cached in a module-level singleton (`_apiAvailable`) to avoid
 * repeated health checks; call `resetApiAvailability()` to force a recheck.
 */

import type { Player } from '../types';
import { getApiAbbreviation } from '../utils/teamHistory';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Extract the starting year from an NBA season string like "2023-24" → 2023 */
function parseSeasonYear(season: string): number {
  return parseInt(season.split('-')[0]);
}

interface ApiRosterResponse {
  team: string;
  season: string;
  players: Player[];
  cached: boolean;
}

interface ApiRandomResponse {
  team: string;
  season: string;
  team_id: number;
}

interface ApiHealthResponse {
  status: string;
  timestamp: string;
}

interface SeasonPlayer {
  id: number;
  name: string;
}

interface ApiSeasonPlayersResponse {
  season: string;
  players: SeasonPlayer[];
  cached: boolean;
}

export interface TeamRecord {
  team: string;
  season: string;
  wins: number;
  losses: number;
  record: string;  // e.g., "52-30"
  winPct: number;
  playoffResult?: string | null;
}

interface ApiTeamRecordResponse extends TeamRecord {
  cached: boolean;
}

/**
 * Check if the API server is available
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    const data: ApiHealthResponse = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Fetch roster from the API
 */
export async function fetchRosterFromApi(
  teamAbbreviation: string,
  season: string
): Promise<{ players: Player[]; cached: boolean } | null> {
  const apiAbbr = getApiAbbreviation(teamAbbreviation, parseSeasonYear(season), 'nba');
  try {
    const response = await fetch(
      `${API_BASE_URL}/roster/${apiAbbr}/${season}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: ApiRosterResponse = await response.json();
    return {
      players: data.players,
      cached: data.cached,
    };
  } catch (error) {
    console.error('Failed to fetch roster from API:', error);
    return null;
  }
}

/**
 * Get a random team and season from the API
 */
export async function fetchRandomTeamSeason(
  minYear: number = 2015,
  maxYear: number = 2024
): Promise<ApiRandomResponse | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/random?min_year=${minYear}&max_year=${maxYear}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch random team/season:', error);
    return null;
  }
}

/**
 * Fetch all players for a season (for autocomplete)
 */
export async function fetchSeasonPlayers(
  season: string
): Promise<{ players: SeasonPlayer[]; cached: boolean } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/players/${season}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: ApiSeasonPlayersResponse = await response.json();
    return {
      players: data.players,
      cached: data.cached,
    };
  } catch (error) {
    console.error('Failed to fetch season players from API:', error);
    return null;
  }
}

/**
 * Singleton availability cache — avoids hitting /health on every roster fetch.
 * Set to null initially; once checked, the result is memoized for the session.
 */
let _apiAvailable: boolean | null = null;

export async function isApiAvailable(): Promise<boolean> {
  if (_apiAvailable !== null) {
    return _apiAvailable;
  }

  _apiAvailable = await checkApiHealth();
  return _apiAvailable;
}

/**
 * Reset API availability check (useful for retry logic)
 */
export function resetApiAvailability(): void {
  _apiAvailable = null;
}

/**
 * Career Mode: Fetch a random player with 5+ NBA seasons
 */
export async function fetchRandomCareerPlayer(): Promise<{ player_id: number; player_name: string } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/career/random`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch random career player:', error);
    return null;
  }
}

/**
 * Career Mode: Fetch full career stats for a player
 */
export async function fetchCareerStats(playerId: number): Promise<{
  player_id: number;
  seasons: Array<{
    season: string;
    team: string;
    gp: number;
    min: number;
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    fg_pct: number;
    fg3_pct: number;
  }>;
  bio: {
    height: string;
    weight: number;
    school: string;
    exp: number;
    draft_year: number;
  };
} | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/career/${playerId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch career stats:', error);
    return null;
  }
}

/**
 * Fetch team record for a season (for hints)
 */
export async function fetchTeamRecord(
  teamAbbreviation: string,
  season: string
): Promise<TeamRecord | null> {
  const apiAbbr = getApiAbbreviation(teamAbbreviation, parseSeasonYear(season), 'nba');
  try {
    const response = await fetch(
      `${API_BASE_URL}/record/${apiAbbr}/${season}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: ApiTeamRecordResponse = await response.json();
    return {
      team: data.team,
      season: data.season,
      wins: data.wins,
      losses: data.losses,
      record: data.record,
      winPct: data.winPct,
      playoffResult: data.playoffResult,
    };
  } catch (error) {
    console.error('Failed to fetch team record from API:', error);
    return null;
  }
}
