/**
 * lineupIsRight.ts — Game logic and utilities for "Lineup Is Right".
 *
 * Handles stat selection, target cap generation, team assignment,
 * eligible player lookup, stat aggregation, and bust detection.
 */

import { loadNBACareers, loadNFLLineupPool } from './careerData';
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

// ─── NFL franchise alias map ─────────────────────────────────────────────────
// Teams that relocated get a new abbreviation but share the same franchise history.
// Maps every known abbreviation → the full set of abbreviations for that franchise
// so historical data (OAK) matches current team picks (LV), etc.
const NFL_FRANCHISE_ALIASES: Record<string, string[]> = {
  LV:  ['LV',  'OAK'],   // Raiders  (moved to Las Vegas 2020)
  OAK: ['LV',  'OAK'],
  LAC: ['LAC', 'SD'],    // Chargers (moved to Los Angeles 2017)
  SD:  ['LAC', 'SD'],
  LA:  ['LA',  'STL'],   // Rams     (moved to Los Angeles 2016)
  STL: ['LA',  'STL'],
};

function nflTeamMatches(dataTeam: string, targetTeam: string): boolean {
  const aliases = NFL_FRANCHISE_ALIASES[targetTeam];
  return aliases ? aliases.includes(dataTeam) : dataTeam === targetTeam;
}

const NBA_STAT_CATEGORIES: StatCategory[] = ['pts', 'ast', 'reb', 'min'];

// ── Test flag — set to a StatCategory to force that category every round ──────
// Set to null in production.
const FORCE_NFL_STAT: StatCategory | null = null;

// Weighted NFL stat pool: rushing/receiving appear 2× as often as QB passing stats
// total_gp gets 2× weight as well (broad player pool, fun variation)
const NFL_STAT_WEIGHTS: Array<{ category: StatCategory; weight: number }> = [
  { category: 'passing_yards',   weight: 1 },
  { category: 'passing_tds',     weight: 1 },
  { category: 'rushing_yards',   weight: 2 },
  { category: 'rushing_tds',     weight: 2 },
  { category: 'receiving_yards', weight: 2 },
  { category: 'receiving_tds',   weight: 2 },
  { category: 'total_gp',        weight: 2 },
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
  total_gp: 'Total Games Played',
};

// ─── Target Cap Calculation ──────────────────────────────────────────────────

/**
 * Generate a reasonable target cap based on the stat category and sport.
 */
export function generateTargetCap(sport: Sport, statCategory: StatCategory): number {
  const r = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

  if (sport === 'nba') {
    // NBA stats are per-game averages (e.g. LeBron: 22 pts, 7 ast, 6 reb, 33 min).
    // With 5 player-season picks, the following ranges create meaningful tension:
    //   3 good picks (avg starter) puts you near the middle of the range,
    //   5 elite picks risks a bust.
    switch (statCategory) {
      case 'pts': return r(75, 120);  // 5× avg starter ~20 PPG = 100
      case 'ast': return r(22, 40);   // 5× avg starter ~6 APG = 30
      case 'reb': return r(30, 50);   // 5× avg starter ~8 RPG = 40
      case 'min': return r(130, 175); // 5× avg starter ~34 MPG = 170
      default: return 100;
    }
  } else {
    // NFL stats are season totals.
    // With 5 player-season picks, a "good" pick is a quality starter season:
    //   QB:   ~4000 pass yds / ~30 pass TDs
    //   RB:   ~1200 rush yds / ~10 rush TDs
    //   WR/TE:~1100 rec yds  / ~9 rec TDs
    // Ranges are tuned so 3 good picks land mid-range, 5 elite picks risk a bust.
    switch (statCategory) {
      case 'passing_yards': return r(12000, 20000); // 3× 4000 = 12000; 5 elite = 20000+
      case 'passing_tds':   return r(80,   140);    // 3× 30   = 90;  5 elite = 180
      case 'rushing_yards': return r(4000, 7000);   // 3× 1200 = 3600; 5 elite = 8000
      case 'rushing_tds':   return r(35,   65);     // 3× 10   = 30;  5 elite = 75
      case 'receiving_yards': return r(3500, 6000); // 3× 1100 = 3300; 5 elite = 7000
      case 'receiving_tds':   return r(28,   50);   // 3× 9    = 27;  5 elite = 55
      // total_gp: career GP with one team. Franchise guys hit 100-200, avg starter 30-80.
      // 5 picks averaging ~50 GP each = 250. Range creates tension.
      case 'total_gp':        return r(175, 325);
      default: return 500;
    }
  }
}

/**
 * Select a random stat category for the given sport.
 * For NFL, rushing and receiving stats are 2× more likely than passing.
 * FORCE_NFL_STAT overrides selection for testing.
 */
export function selectRandomStatCategory(sport: Sport): StatCategory {
  if (sport === 'nba') {
    return NBA_STAT_CATEGORIES[Math.floor(Math.random() * NBA_STAT_CATEGORIES.length)];
  }
  if (FORCE_NFL_STAT) return FORCE_NFL_STAT;
  const total = NFL_STAT_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let rand = Math.random() * total;
  for (const { category, weight } of NFL_STAT_WEIGHTS) {
    rand -= weight;
    if (rand <= 0) return category;
  }
  return 'rushing_yards';
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
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHO', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

/**
 * All NFL teams for random assignment.
 */
export const NFL_TEAMS = [
  'KC', 'LV', 'LAC', 'DEN', 'BUF', 'MIA', 'NE', 'NYJ',
  'BAL', 'PIT', 'CLE', 'CIN',
  'PHI', 'DAL', 'NYG', 'WAS',
  'GB', 'MIN', 'DET', 'CHI',
  'ARI', 'LAR', 'SF', 'SEA',
  'NO', 'CAR', 'TB', 'ATL',
  'TEN', 'IND', 'HOU', 'JAX',
];

/**
 * NFL divisions: maps division label → current team abbreviations.
 * Franchise alias lookup handles relocated teams (OAK→LV, SD→LAC, STL→LA).
 */
export const NFL_DIVISIONS: Record<string, string[]> = {
  'AFC East':  ['BUF', 'MIA', 'NE',  'NYJ'],
  'AFC North': ['BAL', 'PIT', 'CLE', 'CIN'],
  'AFC South': ['HOU', 'IND', 'JAX', 'TEN'],
  'AFC West':  ['KC',  'LV',  'LAC', 'DEN'],
  'NFC East':  ['DAL', 'NYG', 'PHI', 'WAS'],
  'NFC North': ['GB',  'MIN', 'DET', 'CHI'],
  'NFC South': ['NO',  'CAR', 'TB',  'ATL'],
  'NFC West':  ['ARI', 'LAR', 'SF',  'SEA'],
};

/** Returns true if the string is a division label rather than a team abbreviation. */
export function isDivisionRound(teamOrDiv: string): boolean {
  return teamOrDiv in NFL_DIVISIONS;
}

function teamInDivision(dataTeam: string, division: string): boolean {
  const divTeams = NFL_DIVISIONS[division] ?? [];
  return divTeams.some(t => nflTeamMatches(dataTeam, t));
}

/**
 * Select a random team (or division) for the given sport.
 * For NFL, ~25% of rounds use a whole division instead of a single team,
 * unless the stat category is total_gp (career GP is team-specific only).
 */
export function assignRandomTeam(sport: Sport, statCategory?: StatCategory): string {
  if (sport === 'nfl' && statCategory !== 'total_gp' && Math.random() < 0.15) {
    const divs = Object.keys(NFL_DIVISIONS);
    return divs[Math.floor(Math.random() * divs.length)];
  }
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
      const players = await loadNFLLineupPool();
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
      const players = await loadNFLLineupPool();
      
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
      const players = await loadNFLLineupPool();
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
      const players = await loadNFLLineupPool();
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
      const players = await loadNFLLineupPool();
      const player = players.find(p => p.player_name.toLowerCase() === playerName.toLowerCase());
      
      if (!player) return 0;
      
      const season = player.seasons.find(
        s => s.season === year && (
          isDivisionRound(team)
            ? teamInDivision(s.team, team)
            : nflTeamMatches(s.team, team)
        )
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
 * Get a player's total career games played (GP) for a given NFL team.
 * Sums GP across ALL seasons the player was on that team.
 * Returns 0 if the player never played for that team.
 */
export async function getPlayerTotalGPForTeam(
  playerName: string,
  team: string
): Promise<number> {
  try {
    const players = await loadNFLLineupPool();
    const player = players.find(p => p.player_name.toLowerCase() === playerName.toLowerCase());
    if (!player) return 0;

    const total = player.seasons
      .filter(s =>
        isDivisionRound(team)
          ? teamInDivision(s.team, team)
          : nflTeamMatches(s.team, team)
      )
      .reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);

    return total;
  } catch (error) {
    console.error('Error getting player total GP:', error);
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
