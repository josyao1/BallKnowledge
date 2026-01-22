import { rosters, getAllPlayers } from '../data/rosters';
import type { Player } from '../types';

export function getTeamRoster(teamAbbreviation: string, season: string): Player[] {
  const teamRosters = rosters[teamAbbreviation];
  if (!teamRosters) return [];

  return teamRosters[season] || [];
}

export function getAvailableSeasons(teamAbbreviation: string): string[] {
  const teamRosters = rosters[teamAbbreviation];
  if (!teamRosters) return [];

  return Object.keys(teamRosters).sort().reverse();
}

export function getAllPlayersForAutocomplete(): { id: number; name: string }[] {
  return getAllPlayers();
}

export function hasRosterData(teamAbbreviation: string, season: string): boolean {
  const teamRosters = rosters[teamAbbreviation];
  if (!teamRosters) return false;

  return !!teamRosters[season];
}
