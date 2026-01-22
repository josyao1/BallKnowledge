import { rosters, getAllPlayers, getAvailableSeasons as getSeasons, getTeamsWithSeason } from '../data/rosters';
import { fetchRosterFromApi, isApiAvailable } from './api';
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
