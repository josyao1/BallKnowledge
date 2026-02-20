/**
 * lineupIsRight.ts — Game logic and utilities for "Lineup Is Right".
 *
 * Handles stat selection, target cap generation, team assignment,
 * eligible player lookup, stat aggregation, and bust detection.
 */

import { loadNBACareers, loadNFLCareers } from './careerData';
import type {
  StatCategory,
  LineupIsRightGameState,
  PlayerLineup,
  PlayerSeason,
  SelectedPlayer,
} from '../types/lineupIsRight';
import type { Sport } from '../types';

// ─── Position Templates ──────────────────────────────────────────────────────

// No longer used - players are selected freely without position restrictions

const NBA_STAT_CATEGORIES: StatCategory[] = ['pts', 'ast', 'reb', 'min'];
const NFL_STAT_CATEGORIES: StatCategory[] = [
  'passing_yards',
  'passing_tds',
  'rushing_yards',
  'rushing_tds',
  'receiving_yards',
  'receiving_tds',
];

const STAT_LABELS: Record<StatCategory, string> = {
  pts: 'Points',
  ast: 'Assists',
  reb: 'Rebounds',
  min: 'Minutes Played',
  passing_yards: 'Passing Yards',
  passing_tds: 'Passing Touchdowns',
  rushing_yards: 'Rushing Yards',
  rushing_tds: 'Rushing Touchdowns',
  receiving_yards: 'Receiving Yards',
  receiving_tds: 'Receiving Touchdowns',
};

// ─── Target Cap Calculation ──────────────────────────────────────────────────

/**
 * Generate a reasonable target cap based on the stat category and sport.
 */
export function generateTargetCap(sport: Sport, statCategory: StatCategory): number {
  if (sport === 'nba') {
    switch (statCategory) {
      case 'pts': return 50 + Math.floor(Math.random() * 51); // 50-100
      case 'ast': return 30 + Math.floor(Math.random() * 21); // 30-50
      case 'reb': return 30 + Math.floor(Math.random() * 21); // 30-50
      case 'min': return 800 + Math.floor(Math.random() * 401); // 800-1200
      default: return 500;
    }
  } else {
    // NFL - keep existing ranges
    switch (statCategory) {
      case 'passing_yards': return 1200;
      case 'passing_tds': return 9;
      case 'rushing_yards': return 300;
      case 'rushing_tds': return 3;
      case 'receiving_yards': return 320;
      case 'receiving_tds': return 4;
      default: return 500;
    }
  }
}

/**
 * Select a random stat category for the given sport.
 */
export function selectRandomStatCategory(sport: Sport): StatCategory {
  const categories = sport === 'nba' ? NBA_STAT_CATEGORIES : NFL_STAT_CATEGORIES;
  return categories[Math.floor(Math.random() * categories.length)];
}

/**
 * Get the label for a stat category.
 */
export function getStatLabel(statCategory: StatCategory): string {
  return STAT_LABELS[statCategory];
}

// ─── Lineup Creation ────────────────────────────────────────────────────────

/**
 * Create initial lineup with empty 5-player slots.
 */
export function createPlayerLineup(
  playerId: string,
  playerName: string
): PlayerLineup {
  return {
    playerId,
    playerName,
    selectedPlayers: [],
    totalStat: 0,
    isBusted: false,
    isFinished: false,
  };
}

// ─── Team Assignment ────────────────────────────────────────────────────────

/**
 * All NBA teams for random assignment.
 */
export const NBA_TEAMS = [
  'ATL', 'BOS', 'BRK', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 'OKC',
  'ORL', 'PHI', 'PHO', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

/**
 * All NFL teams for random assignment.
 */
export const NFL_TEAMS = [
  'KC', 'LV', 'LAC', 'DEN', 'BUF', 'MIA', 'NE', 'NYJ',
  'BAL', 'PIT', 'CLE', 'CIN',
  'PHI', 'DAL', 'NYG', 'WAS',
  'GB', 'MIN', 'DET', 'CHI',
  'KC', 'LAR', 'SF', 'SEA',
  'NO', 'CAR', 'TB', 'ATL',
  'TEN', 'IND', 'HOU', 'JAX',
];

/**
 * Select a random team for the given sport.
 */
export function assignRandomTeam(sport: Sport): string {
  const teams = sport === 'nba' ? NBA_TEAMS : NFL_TEAMS;
  return teams[Math.floor(Math.random() * teams.length)];
}

/**
 * Search for players by name and year for a given sport.
 */
export async function searchPlayersByNameAndYear(
  sport: Sport,
  playerName: string,
  year: number
): Promise<PlayerSeason[]> {
  try {
    const searchLower = playerName.toLowerCase();
    
    if (sport === 'nba') {
      const players = await loadNBACareers();
      const seasonStr = `${year}-${String(year + 1).slice(-2)}`;
      
      const results = players
        .filter(p => p.player_name.toLowerCase().includes(searchLower))
        .flatMap(p =>
          p.seasons
            .filter(s => s.season === seasonStr)
            .map(s => ({
              playerId: p.player_id,
              playerName: p.player_name,
              season: s.season,
              team: s.team,
              position: '',
              stats: {
                pts: s.pts ?? 0,
                ast: s.ast ?? 0,
                reb: s.reb ?? 0,
                min: s.min ?? 0,
              },
            }))
        );
      
      return results;
    } else {
      // NFL
      const players = await loadNFLCareers();
      const seasonStr = `${year}`;
      
      const results = players
        .filter(p => p.player_name.toLowerCase().includes(searchLower))
        .flatMap(p =>
          p.seasons
            .filter(s => s.season === seasonStr)
            .map(s => ({
              playerId: p.player_id,
              playerName: p.player_name,
              season: s.season,
              team: s.team,
              position: '',
              stats: {
                passing_yards: s.passing_yards ?? 0,
                passing_tds: s.passing_tds ?? 0,
                rushing_yards: s.rushing_yards ?? 0,
                rushing_tds: s.rushing_tds ?? 0,
                receiving_yards: s.receiving_yards ?? 0,
                receiving_tds: s.receiving_tds ?? 0,
              },
            }))
        );
      
      return results;
    }
  } catch (error) {
    console.error('Error searching players:', error);
    return [];
  }
}

/**
 * Search for players by name only (any year, shows all their seasons).
 */
export async function searchPlayersByName(
  sport: Sport,
  playerName: string
): Promise<PlayerSeason[]> {
  try {
    const searchLower = playerName.toLowerCase();
    
    if (sport === 'nba') {
      const players = await loadNBACareers();
      
      const results = players
        .filter(p => p.player_name.toLowerCase().includes(searchLower))
        .flatMap(p =>
          p.seasons.map(s => ({
            playerId: p.player_id,
            playerName: p.player_name,
            season: s.season,
            team: s.team,
            position: '',
            stats: {
              pts: s.pts ?? 0,
              ast: s.ast ?? 0,
              reb: s.reb ?? 0,
              min: s.min ?? 0,
            },
          }))
        );
      
      return results;
    } else {
      // NFL
      const players = await loadNFLCareers();
      
      const results = players
        .filter(p => p.player_name.toLowerCase().includes(searchLower))
        .flatMap(p =>
          p.seasons.map(s => ({
            playerId: p.player_id,
            playerName: p.player_name,
            season: s.season,
            team: s.team,
            position: p.position || '',
            stats: {
              passing_yards: s.passing_yards ?? 0,
              passing_tds: s.passing_tds ?? 0,
              rushing_yards: s.rushing_yards ?? 0,
              rushing_tds: s.rushing_tds ?? 0,
              receiving_yards: s.receiving_yards ?? 0,
              receiving_tds: s.receiving_tds ?? 0,
            },
          }))
        );
      
      return results;
    }
  } catch (error) {
    console.error('Error searching players:', error);
    return [];
  }
}

/**
 * Search for players by name only (unique players, no seasons returned).
 * Returns minimal objects containing playerId and playerName.
 */
export async function searchPlayersByNameOnly(
  sport: Sport,
  playerName: string
): Promise<Array<{ playerId: string | number; playerName: string }>> {
  try {
    const searchLower = playerName.toLowerCase();
    if (sport === 'nba') {
      const players = await loadNBACareers();
      const results = players
        .filter(p => p.player_name.toLowerCase().includes(searchLower))
        .map(p => ({ playerId: p.player_id, playerName: p.player_name }));
      // Deduplicate by playerId
      const map = new Map<number | string, string>();
      results.forEach(r => map.set(r.playerId, r.playerName));
      return Array.from(map.entries()).map(([playerId, playerName]) => ({ playerId, playerName }));
    } else {
      const players = await loadNFLCareers();
      const results = players
        .filter(p => p.player_name.toLowerCase().includes(searchLower))
        .map(p => ({ playerId: p.player_id, playerName: p.player_name }));
      const map = new Map<number | string, string>();
      results.forEach(r => map.set(r.playerId, r.playerName));
      return Array.from(map.entries()).map(([playerId, playerName]) => ({ playerId, playerName }));
    }
  } catch (error) {
    console.error('Error searching players by name only:', error);
    return [];
  }
}

/**
 * Get all years a specific player played in (not restricted to team).
 * This allows selecting any year for any player - if they weren't on the
 * random team that year, they get 0 points.
 */
export async function getPlayerYearsOnTeam(
  sport: Sport,
  playerName: string,
  _team: string
): Promise<string[]> {
  try {
    if (sport === 'nba') {
      const players = await loadNBACareers();
      const player = players.find(p => p.player_name.toLowerCase() === playerName.toLowerCase());
      
      if (!player) return [];
      
      const years = player.seasons
        .map(s => {
          // Convert season format "2023-24" to year "2023"
          const parts = s.season.split('-');
          return parts[0];
        });
      
      return [...new Set(years)].sort();
    } else {
      // NFL
      const players = await loadNFLCareers();
      const player = players.find(p => p.player_name.toLowerCase() === playerName.toLowerCase());
      
      if (!player) return [];
      
      const years = player.seasons
        .map(s => s.season);
      
      return [...new Set(years)].sort();
    }
  } catch (error) {
    console.error('Error getting player years:', error);
    return [];
  }
}

/**
 * Get a player's stat value for a specific year on a specific team.
 * Returns 0 if the player was not on that team in that year.
 */
export async function getPlayerStatForYearAndTeam(
  sport: Sport,
  playerName: string,
  team: string,
  year: string,
  statCategory: string
): Promise<number> {
  try {
    if (sport === 'nba') {
      const players = await loadNBACareers();
      const player = players.find(p => p.player_name.toLowerCase() === playerName.toLowerCase());
      
      if (!player) return 0;
      
      // Convert year to season format (e.g., "2023" -> "2023-24")
      const numYear = parseInt(year);
      const seasonStr = `${numYear}-${String(numYear + 1).slice(-2)}`;
      
      const season = player.seasons.find(
        s => s.season === seasonStr && s.team === team
      );
      
      if (!season) return 0;
      
      const statKey = statCategory as keyof typeof season;
      return (season[statKey] as number) ?? 0;
    } else {
      // NFL
      const players = await loadNFLCareers();
      const player = players.find(p => p.player_name.toLowerCase() === playerName.toLowerCase());
      
      if (!player) return 0;
      
      const season = player.seasons.find(
        s => s.season === year && s.team === team
      );
      
      if (!season) return 0;
      
      const statKey = statCategory as keyof typeof season;
      return (season[statKey] as number) ?? 0;
    }
  } catch (error) {
    console.error('Error getting player stat:', error);
    return 0;
  }
}

/**
 * Get all eligible players from a team for filling a specific position.
 * DEPRECATED - Use searchPlayersByNameAndYear instead.
 */
export async function getEligiblePlayersForTeamAndPosition(
  _sport: 'nba' | 'nfl',
  _teamAbbr: string,
  _position: any
): Promise<PlayerSeason[]> {
  // This function is deprecated and no longer used
  return [];
}

// ─── Stat Calculation ────────────────────────────────────────────────────────

/**
 * Get the stat value from a player season for a given category.
 */
export function getStatValue(
  playerSeason: PlayerSeason,
  statCategory: StatCategory
): number {
  return playerSeason.stats[statCategory] ?? 0;
}

/**
 * Calculate total stat for a lineup and check if it's busted.
 */
export function calculateLineupStat(
  lineup: PlayerLineup,
  _statCategory: StatCategory,
  targetCap: number
): { total: number; isBusted: boolean } {
  const sum = lineup.selectedPlayers.reduce((acc, player) => {
    return acc + player.statValue;
  }, 0);

  // Round to nearest tenths place (0.1)
  const total = Math.round(sum * 10) / 10;

  return {
    total,
    isBusted: total > targetCap,
  };
}

/**
 * Add a selected player to a lineup.
 */
export function addPlayerToLineup(
  lineup: PlayerLineup,
  selectedPlayer: SelectedPlayer
): PlayerLineup {
  return {
    ...lineup,
    selectedPlayers: [...lineup.selectedPlayers, selectedPlayer],
  };
}

/**
 * Check if the game is finished (all players either busted or lineups full - 5 players each).
 */
export function isGameFinished(state: LineupIsRightGameState): boolean {
  return state.lineups.every(
    lineup =>
      lineup.isBusted ||
      (lineup.selectedPlayers.length === 5 && lineup.isFinished)
  );
}

/**
 * Determine winners and return sorted players by score and bust status.
 */
export function calculateWinners(
  lineups: PlayerLineup[]
): PlayerLineup[] {
  // Filter non-busted lineups, sort by total descending
  const nonBusted = lineups.filter(l => !l.isBusted);
  const busted = lineups.filter(l => l.isBusted);

  nonBusted.sort((a, b) => b.totalStat - a.totalStat);

  // Among non-busted, highest total <= targetCap wins
  return [...nonBusted, ...busted];
}
