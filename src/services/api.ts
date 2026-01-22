/**
 * NBA Roster API Service
 *
 * Fetches roster data from the Python backend API.
 * Falls back to static data if API is unavailable.
 */

import type { Player } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  try {
    const response = await fetch(
      `${API_BASE_URL}/roster/${teamAbbreviation}/${season}`,
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
 * Check if API is configured and available
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
