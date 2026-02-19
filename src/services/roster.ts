/**
 * roster.ts — Roster data layer backed by preloaded static JSON files.
 *
 * Fetches from /public/data/rosters/ and /public/data/players/ — static assets
 * served by Vercel CDN with no backend required. Falls back to the legacy bundled
 * rosters.ts data if a static file is not found (e.g. pre-2000 seasons).
 *
 * File names use historical abbreviations (NJN_2004-05, SEA_2006-07) matching
 * the output of getApiAbbreviation() in utils/teamHistory.ts.
 */

import { rosters, getAllPlayers, getAvailableSeasons as getSeasons, getTeamsWithSeason } from '../data/rosters';
import { getApiAbbreviation } from '../utils/teamHistory';
import { fetchNFLRosterFromApi } from './nfl-api';
import type { Player } from '../types';
import type { NFLPlayer } from '../types/nfl';

function parseSeasonYear(season: string): number {
  return parseInt(season.split('-')[0]);
}

/**
 * Fetch roster from preloaded static JSON in /public/data/rosters/.
 * Returns null if the file doesn't exist (team/season not preloaded).
 */
async function fetchStaticRoster(
  teamAbbreviation: string,
  season: string
): Promise<Player[] | null> {
  const hist = getApiAbbreviation(teamAbbreviation, parseSeasonYear(season), 'nba');
  try {
    const res = await fetch(`/data/rosters/${hist}_${season}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.players ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch all players for a season from preloaded static JSON (for autocomplete).
 * Returns null if the file doesn't exist.
 */
export async function fetchStaticSeasonPlayers(
  season: string
): Promise<{ id: number; name: string }[] | null> {
  try {
    const res = await fetch(`/data/players/${season}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch NFL roster from preloaded static JSON in /public/data/nfl/rosters/.
 * NFL uses plain year integers (2023), no historical abbreviation translation.
 */
export async function fetchStaticNFLRoster(
  teamAbbreviation: string,
  year: number
): Promise<NFLPlayer[] | null> {
  try {
    const res = await fetch(`/data/nfl/rosters/${teamAbbreviation}_${year}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.players ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch all NFL players for a season from preloaded static JSON (for autocomplete).
 */
export async function fetchStaticNFLSeasonPlayers(
  year: number
): Promise<{ id: string; name: string }[] | null> {
  try {
    const res = await fetch(`/data/nfl/players/${year}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Get roster for a team/season.
 * Tries preloaded static JSON first, then falls back to bundled static data.
 */
export async function fetchTeamRoster(
  teamAbbreviation: string,
  season: string
): Promise<{ players: Player[]; fromApi: boolean; cached: boolean }> {
  const staticPlayers = await fetchStaticRoster(teamAbbreviation, season);
  if (staticPlayers && staticPlayers.length > 0) {
    return { players: staticPlayers, fromApi: false, cached: true };
  }

  // Fall back to bundled legacy data (pre-2000 or missing seasons)
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
    const staticPlayers = await fetchStaticNFLRoster(abbr, year);
    if (staticPlayers && staticPlayers.length > 0) return staticPlayers;
    const result = await fetchNFLRosterFromApi(abbr, year);
    return result?.players || [];
  }
}
