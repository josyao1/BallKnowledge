/**
 * roster.ts — Roster data layer with API-first + static fallback.
 *
 * Attempts to fetch rosters from the live Python API for the freshest data.
 * Falls back to bundled static roster JSON when the API is unavailable.
 * Also exposes helper functions for season/team lookups and autocomplete.
 */

import { rosters, getAllPlayers, getAvailableSeasons as getSeasons, getTeamsWithSeason } from '../data/rosters';
import { fetchRosterFromApi, isApiAvailable } from './api';
import { fetchNFLRosterFromApi } from './nfl-api';
import type { Player } from '../types';

/**
 * Get roster for a team/season - tries API first, falls back to static data
 */
export async function fetchTeamRoster(
  teamAbbreviation: string,
  season: string
): Promise<{ players: Player[]; fromApi: boolean; cached: boolean }> {
  // Try API first
  const apiAvailable = await isApiAvailable();

  if (apiAvailable) {
    const apiResult = await fetchRosterFromApi(teamAbbreviation, season);
    if (apiResult && apiResult.players.length > 0) {
      return {
        players: apiResult.players,
        fromApi: true,
        cached: apiResult.cached,
      };
    }
  }

  // Fall back to static data
  const staticRoster = getTeamRosterSync(teamAbbreviation, season);
  return {
    players: staticRoster,
    fromApi: false,
    cached: false,
  };
}

/**
 * Synchronous roster fetch - only uses static data (for backwards compatibility)
 */
export function getTeamRosterSync(teamAbbreviation: string, season: string): Player[] {
  const teamRosters = rosters[teamAbbreviation];
  if (!teamRosters) return [];
  return teamRosters[season] || [];
}

/**
 * Alias for backwards compatibility
 */
export function getTeamRoster(teamAbbreviation: string, season: string): Player[] {
  return getTeamRosterSync(teamAbbreviation, season);
}

export function getAvailableSeasons(teamAbbreviation?: string): string[] {
  if (teamAbbreviation) {
    const teamRosters = rosters[teamAbbreviation];
    if (!teamRosters) return [];
    return Object.keys(teamRosters).sort().reverse();
  }
  // Return all available seasons across all teams
  return getSeasons();
}

export function getAllPlayersForAutocomplete(): { id: number; name: string }[] {
  return getAllPlayers();
}

export function hasRosterData(teamAbbreviation: string, season: string): boolean {
  const teamRosters = rosters[teamAbbreviation];
  if (!teamRosters) return false;

  return !!teamRosters[season];
}

export function getTeamsForSeason(season: string): string[] {
  return getTeamsWithSeason(season);
}

export function getAllTeamsWithData(): string[] {
  return Object.keys(rosters);
}

/**
 * Check if static data exists for a team/season (for UI hints)
 */
export function hasStaticData(teamAbbreviation: string, season: string): boolean {
  return hasRosterData(teamAbbreviation, season);
}

interface GenericPlayer {
  id: number | string;
  name: string;
  position?: string;
  number?: string;
  ppg?: number;
  isLowScorer?: boolean;
  unit?: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch rosters for all teams in a division (4 teams).
 * Fetches sequentially with 300ms delay between each to avoid rate limiting.
 * On failure, retries once after 500ms.
 */
export async function fetchDivisionRosters(
  sport: string,
  teamAbbreviations: string[],
  season: string
): Promise<{ combined: GenericPlayer[]; byTeam: Record<string, GenericPlayer[]> }> {
  const byTeam: Record<string, GenericPlayer[]> = {};
  const combined: GenericPlayer[] = [];

  for (let i = 0; i < teamAbbreviations.length; i++) {
    const abbr = teamAbbreviations[i];
    if (i > 0) await delay(300);

    let players: GenericPlayer[] = [];
    try {
      players = await fetchSingleTeamRoster(sport, abbr, season);
    } catch {
      // Retry once after 500ms
      await delay(500);
      try {
        players = await fetchSingleTeamRoster(sport, abbr, season);
      } catch (retryErr) {
        console.error(`Failed to fetch roster for ${abbr} after retry:`, retryErr);
      }
    }

    byTeam[abbr] = players;
    combined.push(...players);
  }

  return { combined, byTeam };
}

async function fetchSingleTeamRoster(sport: string, abbr: string, season: string): Promise<GenericPlayer[]> {
  if (sport === 'nba') {
    const result = await fetchTeamRoster(abbr, season);
    return result.players;
  } else {
    const year = parseInt(season);
    const result = await fetchNFLRosterFromApi(abbr, year);
    return result?.players || [];
  }
}
