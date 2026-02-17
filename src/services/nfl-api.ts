/**
 * nfl-api.ts — NFL API client for the Python backend.
 *
 * Mirrors the NBA api.ts pattern: roster fetching, random team selection,
 * season player lists (autocomplete), and team record lookups.
 * API availability is cached in a module-level singleton (`_nflApiAvailable`)
 * to avoid repeated health checks; call `resetNFLApiAvailability()` to force a recheck.
 */

import type { NFLPlayer } from '../types/nfl';

const NFL_API_BASE_URL = import.meta.env.VITE_NFL_API_URL || 'http://localhost:8001';

interface NFLApiRosterResponse {
  team: string;
  season: number;
  players: NFLPlayer[];
  cached: boolean;
}

interface NFLApiRandomResponse {
  team: string;
  season: number;
  team_name: string;
}

interface NFLApiHealthResponse {
  status: string;
  timestamp: string;
  nfl_data_available: boolean;
}

interface NFLSeasonPlayer {
  id: string;
  name: string;
}

interface NFLApiSeasonPlayersResponse {
  season: number;
  players: NFLSeasonPlayer[];
  cached: boolean;
}

export interface NFLTeamRecord {
  team: string;
  season: number;
  wins: number;
  losses: number;
  ties: number;
  record: string;  // e.g., "12-5" or "12-4-1"
  winPct: number;
}

interface NFLApiTeamRecordResponse extends NFLTeamRecord {
  cached: boolean;
}

/**
 * Check if the NFL API server is available
 */
export async function checkNFLApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${NFL_API_BASE_URL}/nfl/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    const data: NFLApiHealthResponse = await response.json();
    return data.status === 'ok' && data.nfl_data_available;
  } catch {
    return false;
  }
}

/**
 * Fetch NFL roster from the API
 */
export async function fetchNFLRosterFromApi(
  teamAbbreviation: string,
  season: number
): Promise<{ players: NFLPlayer[]; cached: boolean } | null> {
  try {
    const response = await fetch(
      `${NFL_API_BASE_URL}/nfl/roster/${teamAbbreviation}/${season}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`NFL API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: NFLApiRosterResponse = await response.json();
    return {
      players: data.players,
      cached: data.cached,
    };
  } catch (error) {
    console.error('Failed to fetch NFL roster from API:', error);
    return null;
  }
}

/**
 * Get a random NFL team and season from the API
 */
export async function fetchNFLRandomTeamSeason(
  minYear: number = 2000,
  maxYear: number = 2024
): Promise<NFLApiRandomResponse | null> {
  try {
    const response = await fetch(
      `${NFL_API_BASE_URL}/nfl/random?min_year=${minYear}&max_year=${maxYear}`,
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
    console.error('Failed to fetch random NFL team/season:', error);
    return null;
  }
}

/**
 * Fetch all NFL players for a season (for autocomplete)
 */
export async function fetchNFLSeasonPlayers(
  season: number
): Promise<{ players: NFLSeasonPlayer[]; cached: boolean } | null> {
  try {
    const response = await fetch(`${NFL_API_BASE_URL}/nfl/players/${season}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`NFL API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: NFLApiSeasonPlayersResponse = await response.json();
    return {
      players: data.players,
      cached: data.cached,
    };
  } catch (error) {
    console.error('Failed to fetch NFL season players from API:', error);
    return null;
  }
}

/**
 * Career Mode: Fetch a random NFL player with 5+ seasons
 */
export async function fetchNFLRandomCareerPlayer(position?: string): Promise<{
  player_id: string;
  player_name: string;
  position: string;
} | null> {
  try {
    const url = position
      ? `${NFL_API_BASE_URL}/nfl/career/random?position=${position}`
      : `${NFL_API_BASE_URL}/nfl/career/random`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch random NFL career player:', error);
    return null;
  }
}

/**
 * Career Mode: Fetch full career stats for an NFL player
 */
export async function fetchNFLCareerStats(playerId: string): Promise<{
  player_id: string;
  player_name: string;
  position: string;
  seasons: Array<Record<string, any>>;
  bio: {
    height: string;
    weight: number;
    college: string;
    years_exp: number;
    draft_club: string;
    draft_number: number;
  };
} | null> {
  try {
    const response = await fetch(`${NFL_API_BASE_URL}/nfl/career/${playerId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch NFL career stats:', error);
    return null;
  }
}

/**
 * Singleton availability cache — avoids hitting /nfl/health on every roster fetch.
 * Set to null initially; once checked, the result is memoized for the session.
 */
let _nflApiAvailable: boolean | null = null;

export async function isNFLApiAvailable(): Promise<boolean> {
  if (_nflApiAvailable !== null) {
    return _nflApiAvailable;
  }

  _nflApiAvailable = await checkNFLApiHealth();
  return _nflApiAvailable;
}

/**
 * Reset NFL API availability check (useful for retry logic)
 */
export function resetNFLApiAvailability(): void {
  _nflApiAvailable = null;
}

/**
 * Fetch NFL team record for a season (for hints)
 */
export async function fetchNFLTeamRecord(
  teamAbbreviation: string,
  season: number
): Promise<NFLTeamRecord | null> {
  try {
    const response = await fetch(
      `${NFL_API_BASE_URL}/nfl/record/${teamAbbreviation}/${season}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`NFL API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: NFLApiTeamRecordResponse = await response.json();
    return {
      team: data.team,
      season: data.season,
      wins: data.wins,
      losses: data.losses,
      ties: data.ties,
      record: data.record,
      winPct: data.winPct,
    };
  } catch (error) {
    console.error('Failed to fetch NFL team record from API:', error);
    return null;
  }
}
