/**
 * lineupIsRight.ts — Game logic and utilities for "Lineup Is Right".
 *
 * Handles stat selection, target cap generation, team assignment,
 * eligible player lookup, stat aggregation, and bust detection.
 */

import { loadNBALineupPool, loadNFLLineupPool } from './careerData';
import type {
  StatCategory,
  LineupIsRightGameState,
  PlayerLineup,
  PlayerSeason,
  SelectedPlayer,
} from '../types/capCrunch';
import type { Sport } from '../types';

/** Strip diacritics, periods, and lowercase so names like "T.Y. Hilton" match query "ty hilton". */
function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').toLowerCase();
}

// ─── Position Templates ──────────────────────────────────────────────────────

// No longer used - players are selected freely without position restrictions

// ─── NFL franchise alias map ─────────────────────────────────────────────────
// Teams that relocated get a new abbreviation but share the same franchise history.
// Maps every known abbreviation → the full set of abbreviations for that franchise.
//
// The raw career data uses ESPN abbreviations which differ from standard NFL ones:
//   LA  (not LAR) for current LA Rams
//   SL  (not STL) for old St. Louis Rams
//   ARZ (not ARI) for Arizona Cardinals
//   BLT (not BAL) for Baltimore Ravens
//   CLV (not CLE) for Cleveland Browns
//   HST (not HOU) for Houston Texans
//
// NFL_TEAMS and NFL_DIVISIONS use the standard NFL abbreviations (LAR, ARI, BAL,
// CLE, HOU). Both sides are included so nflTeamMatches works in either direction.
const NFL_FRANCHISE_ALIASES: Record<string, string[]> = {
  // Raiders (OAK → LV 2020)
  LV:  ['LV',  'OAK'],
  OAK: ['LV',  'OAK'],

  // Chargers (SD → LAC 2017)
  LAC: ['LAC', 'SD'],
  SD:  ['LAC', 'SD'],

  // Rams (STL/SL → LA/LAR 2016; data=LA+SL, standard=LAR+STL)
  LAR: ['LA',  'LAR', 'STL', 'SL'],
  LA:  ['LA',  'LAR', 'STL', 'SL'],
  STL: ['LA',  'LAR', 'STL', 'SL'],
  SL:  ['LA',  'LAR', 'STL', 'SL'],

  // ESPN alternate abbreviations present in raw career data
  ARI: ['ARI', 'ARZ'],
  ARZ: ['ARI', 'ARZ'],
  BAL: ['BAL', 'BLT'],
  BLT: ['BAL', 'BLT'],
  CLE: ['CLE', 'CLV'],
  CLV: ['CLE', 'CLV'],
  HOU: ['HOU', 'HST'],
  HST: ['HOU', 'HST'],
};

function nflTeamMatches(dataTeam: string, targetTeam: string): boolean {
  const aliases = NFL_FRANCHISE_ALIASES[targetTeam];
  return aliases ? aliases.includes(dataTeam) : dataTeam === targetTeam;
}

// ─── NBA franchise alias map ──────────────────────────────────────────────────
// The raw career data contains old/alternate abbreviations from earlier eras.
// Maps every known abbreviation → the full set of abbreviations for that franchise.
const NBA_FRANCHISE_ALIASES: Record<string, string[]> = {
  // Utah Jazz (UTH was used pre-~1994)
  UTA: ['UTA', 'UTH'],
  UTH: ['UTA', 'UTH'],

  // Golden State Warriors (GOS was used in older data)
  GSW: ['GSW', 'GOS'],
  GOS: ['GSW', 'GOS'],

  // Charlotte — original CHH (1988–2002) shares franchise history with current CHA
  CHA: ['CHA', 'CHH'],
  CHH: ['CHA', 'CHH'],

  // Sacramento Kings (formerly Kansas City Kings, KCK)
  SAC: ['SAC', 'KCK'],
  KCK: ['SAC', 'KCK'],

  // Philadelphia 76ers (PHL was an older abbreviation)
  PHI: ['PHI', 'PHL'],
  PHL: ['PHI', 'PHL'],

  // San Antonio Spurs (SAN was an older abbreviation)
  SAS: ['SAS', 'SAN'],
  SAN: ['SAS', 'SAN'],

  // New Orleans Pelicans (NOH = Hornets 2002–2013, NOK = Katrina relocation 2005–2007)
  NOP: ['NOP', 'NOH', 'NOK'],
  NOH: ['NOP', 'NOH', 'NOK'],
  NOK: ['NOP', 'NOH', 'NOK'],

  // Oklahoma City Thunder (formerly Seattle SuperSonics)
  OKC: ['OKC', 'SEA'],
  SEA: ['OKC', 'SEA'],

  // Brooklyn Nets (formerly New Jersey Nets)
  BKN: ['BKN', 'NJN'],
  NJN: ['BKN', 'NJN'],

  // Memphis Grizzlies (formerly Vancouver Grizzlies)
  MEM: ['MEM', 'VAN'],
  VAN: ['MEM', 'VAN'],
};

/**
 * Returns true if a season's team value matches the target team abbreviation.
 * Handles:
 *   - Old/alternate NBA abbreviations (UTH → UTA, GOS → GSW, etc.)
 *   - Traded players whose team is stored as "ORL/DEN" or "UTA/CLE/SAC"
 */
function nbaTeamMatches(dataTeam: string, targetTeam: string, depth = 0): boolean {
  // Traded players: team stored as "ORL/DEN" — match if any part matches
  if (dataTeam.includes('/')) {
    if (depth > 5) {
      console.error('[nbaTeamMatches] Unexpected depth; dataTeam:', dataTeam);
      return false;
    }
    return dataTeam.split('/').some(part => nbaTeamMatches(part.trim(), targetTeam, depth + 1));
  }
  const aliases = NBA_FRANCHISE_ALIASES[targetTeam];
  return aliases ? aliases.includes(dataTeam) : dataTeam === targetTeam;
}

const NBA_STAT_CATEGORIES: StatCategory[] = ['pts', 'ast', 'reb', 'min', 'pra', 'total_gp'];

// ── Test flag — set to a StatCategory to force that category every round ──────
// Set to null in production.
const FORCE_NFL_STAT: StatCategory | null = null;

// ── Test flag — restrict team pool to these abbreviations for targeted testing ─
// Example: ['LAR', 'LV'] to test franchise alias fixes. Set to null in production.
const TEST_NFL_TEAMS: string[] | null = null;

// ── Test flag — restrict NBA team pool for targeted testing. Set to null in production. ─
const TEST_NBA_TEAMS: string[] | null = null;

// Weighted NFL stat pool: rushing/receiving appear 2× as often as QB passing stats
// total_gp gets 2× weight as well (broad player pool, fun variation)
const NFL_STAT_WEIGHTS: Array<{ category: StatCategory; weight: number }> = [
  { category: 'passing_yards',   weight: 1 },
  { category: 'passing_tds',     weight: 1 },
  { category: 'interceptions',   weight: 1 },
  { category: 'rushing_yards',   weight: 2 },
  { category: 'rushing_tds',     weight: 2 },
  { category: 'receiving_yards', weight: 2 },
  { category: 'receiving_tds',   weight: 2 },
  { category: 'receptions',      weight: 2 },
  { category: 'total_gp',        weight: 2 },
];

const STAT_LABELS: Record<StatCategory, string> = {
  pts: 'Points',
  ast: 'Assists',
  reb: 'Rebounds',
  min: 'Minutes Played',
  pra: 'Points + Rebounds + Assists',
  passing_yards: 'Passing Yards',
  passing_tds: 'Passing Touchdowns',
  interceptions: 'Interceptions Thrown',
  rushing_yards: 'Rushing Yards',
  rushing_tds: 'Rushing Touchdowns',
  receiving_yards: 'Receiving Yards',
  receiving_tds: 'Receiving Touchdowns',
  receptions: 'Receptions',
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
      case 'pts': return r(75, 120);   // 5× avg starter ~20 PPG = 100
      case 'ast': return r(22, 40);    // 5× avg starter ~6 APG = 30
      case 'reb': return r(30, 50);    // 5× avg starter ~8 RPG = 40
      case 'min': return r(130, 175);  // 5× avg starter ~34 MPG = 170
      case 'pra': return r(120, 225);  // 5× avg starter ~22+7+5=34 PRA; elite ~45+ PRA
      case 'total_gp': return r(700, 2000); // 5 picks of career GP with one team; franchise guy ~300-500+ GP
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
      // interceptions: avg ~9/yr, bad QBs 20+. 3 avg = 27; 5 bad = 75+
      case 'interceptions': return r(25,   55);
      case 'rushing_yards': return r(4000, 7000);   // 3× 1200 = 3600; 5 elite = 8000
      case 'rushing_tds':   return r(35,   65);     // 3× 10   = 30;  5 elite = 75
      case 'receiving_yards': return r(3500, 6000); // 3× 1100 = 3300; 5 elite = 7000
      case 'receiving_tds':   return r(28,   50);   // 3× 9    = 27;  5 elite = 55
      // receptions: avg ~35/yr, elite 100+. 3 avg = 105; 5 elite = 500+
      case 'receptions':      return r(150, 300);
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
    bustCount: 0,
    isFinished: false,
  };
}

// ─── Team Assignment ────────────────────────────────────────────────────────

/**
 * All NBA teams for random assignment.
 */
export const NBA_TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
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
 * Pass excludeTeams to avoid repeating teams across rounds (falls back to full
 * pool if all teams have been used).
 */
export function assignRandomTeam(sport: Sport, statCategory?: StatCategory, excludeTeams?: string[]): string {
  if (sport === 'nfl' && statCategory !== 'total_gp' && Math.random() < 0.15) {
    const divs = Object.keys(NFL_DIVISIONS);
    const available = excludeTeams ? divs.filter(d => !excludeTeams.includes(d)) : divs;
    const pool = available.length > 0 ? available : divs;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const allTeams = sport === 'nba' ? (TEST_NBA_TEAMS ?? NBA_TEAMS) : (TEST_NFL_TEAMS ?? NFL_TEAMS);
  const available = excludeTeams ? allTeams.filter(t => !excludeTeams.includes(t)) : allTeams;
  const pool = available.length > 0 ? available : allTeams;
  return pool[Math.floor(Math.random() * pool.length)];
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
    const searchLower = normalizeStr(playerName);
    
    if (sport === 'nba') {
      const players = await loadNBALineupPool();
      const seasonStr = `${year}-${String(year + 1).slice(-2)}`;
      
      const results = players
        .filter(p => normalizeStr(p.player_name).includes(searchLower))
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
        .filter(p => normalizeStr(p.player_name).includes(searchLower))
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
    const searchLower = normalizeStr(playerName);
    
    if (sport === 'nba') {
      const players = await loadNBALineupPool();
      
      const results = players
        .filter(p => normalizeStr(p.player_name).includes(searchLower))
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
        .filter(p => normalizeStr(p.player_name).includes(searchLower))
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
 * When two players share the same name, their position is appended:
 *   "Michael Pittman (RB)" / "Michael Pittman (WR)"
 */
export async function searchPlayersByNameOnly(
  sport: Sport,
  playerName: string
): Promise<Array<{ playerId: string | number; playerName: string }>> {
  try {
    const searchLower = normalizeStr(playerName);
    const pool = sport === 'nba' ? await loadNBALineupPool() : await loadNFLLineupPool();

    // Deduplicate by player_id first
    const seen = new Map<string | number, { playerId: string | number; playerName: string; position?: string }>();
    for (const p of pool) {
      if (!normalizeStr(p.player_name).includes(searchLower)) continue;
      if (!seen.has(p.player_id)) {
        seen.set(p.player_id, {
          playerId: p.player_id,
          playerName: p.player_name,
          position: (p as any).position as string | undefined,
        });
      }
    }

    const dedupedResults = Array.from(seen.values());

    // Find names that appear more than once (different player_ids, same display name)
    const nameCounts = new Map<string, number>();
    for (const r of dedupedResults) {
      const key = normalizeStr(r.playerName);
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }

    // For duplicate names, append position to disambiguate
    return dedupedResults.map(r => {
      if ((nameCounts.get(normalizeStr(r.playerName)) ?? 0) > 1 && r.position) {
        return { playerId: r.playerId, playerName: `${r.playerName} (${r.position})` };
      }
      return { playerId: r.playerId, playerName: r.playerName };
    });
  } catch (error) {
    console.error('Error searching players by name only:', error);
    return [];
  }
}

/** Strip ` (POS)` disambiguation suffix if present, e.g. "Michael Pittman (WR)" → "Michael Pittman". */
function stripPositionSuffix(name: string): string {
  return name.replace(/\s*\([A-Z]+\)$/, '');
}

/** Find a player in the pool, using player_id when available (exact), falling back to name. */
function findPlayer<T extends { player_id: string | number; player_name: string }>(
  pool: T[],
  playerName: string,
  playerId?: string | number
): T | undefined {
  if (playerId != null) {
    return pool.find(p => String(p.player_id) === String(playerId));
  }
  const cleanName = normalizeStr(stripPositionSuffix(playerName));
  return pool.find(p => normalizeStr(p.player_name) === cleanName);
}

/**
 * Get all years a specific player played in (not restricted to team).
 * This allows selecting any year for any player - if they weren't on the
 * random team that year, they get 0 points.
 */
export async function getPlayerYearsOnTeam(
  sport: Sport,
  playerName: string,
  _team: string,
  playerId?: string | number
): Promise<string[]> {
  try {
    if (sport === 'nba') {
      const players = await loadNBALineupPool();
      const player = findPlayer(players, playerName, playerId);

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
      const player = findPlayer(players, playerName, playerId);

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
  statCategory: string,
  playerId?: string | number
): Promise<number> {
  try {
    if (sport === 'nba') {
      const players = await loadNBALineupPool();
      const player = findPlayer(players, playerName, playerId);
      
      if (!player) return 0;
      
      // Convert year to season format (e.g., "2023" -> "2023-24")
      const numYear = parseInt(year);
      const seasonStr = `${numYear}-${String(numYear + 1).slice(-2)}`;
      
      const season = player.seasons.find(
        s => s.season === seasonStr && nbaTeamMatches(s.team, team)
      );

      if (!season) return 0;

      // PRA is a computed stat: pts + reb + ast for that season
      if (statCategory === 'pra') {
        return (season.pts ?? 0) + (season.reb ?? 0) + (season.ast ?? 0);
      }

      const statKey = statCategory as keyof typeof season;
      return (season[statKey] as number) ?? 0;
    } else {
      // NFL
      const players = await loadNFLLineupPool();
      const player = findPlayer(players, playerName, playerId);

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
 * Get a player's total career games played (GP) for a given team.
 * Sums GP across ALL seasons the player was on that team.
 * Returns 0 if the player never played for that team.
 * Works for both NBA and NFL — no year selection needed.
 */
export async function getPlayerTotalGPForTeam(
  sport: Sport,
  playerName: string,
  team: string,
  playerId?: string | number
): Promise<number> {
  try {
    if (sport === 'nba') {
      const players = await loadNBALineupPool();
      const player = findPlayer(players, playerName, playerId);
      if (!player) return 0;
      return player.seasons
        .filter(s => nbaTeamMatches(s.team, team))
        .reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
    } else {
      const players = await loadNFLLineupPool();
      const player = findPlayer(players, playerName, playerId);
      if (!player) return 0;
      return player.seasons
        .filter(s =>
          isDivisionRound(team)
            ? teamInDivision(s.team, team)
            : nflTeamMatches(s.team, team)
        )
        .reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
    }
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
  _targetCap: number
): { total: number } {
  // Bust picks (isBust: true) count as 0 — only valid picks contribute to the total.
  // Bust detection is done inline at pick time (statValue > remainingBudget);
  // this function purely recalculates the running total from stored picks.
  const sum = lineup.selectedPlayers.reduce((acc, player) => {
    return acc + (player.isBust ? 0 : player.statValue);
  }, 0);

  // Round to 1 decimal place cleanly (parseFloat avoids floating-point noise)
  const total = parseFloat(sum.toFixed(1));

  return { total };
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
    lineup => lineup.selectedPlayers.length === 5 && lineup.isFinished
  );
}

/**
 * Determine winners and return sorted players by score and bust status.
 * Tiebreaker: lower average pick year wins (older lineup beat a tied newer one).
 * 'career' picks (total_gp) count as year 2025 for averaging.
 */
export function calculateWinners(
  lineups: PlayerLineup[]
): PlayerLineup[] {
  const avgPickYear = (lineup: PlayerLineup): number => {
    const picks = lineup.selectedPlayers;
    if (picks.length === 0) return 2025;
    const sum = picks.reduce((acc, p) => {
      const yr = p.selectedYear === 'career' ? 2025 : (parseInt(p.selectedYear) || 2025);
      return acc + yr;
    }, 0);
    return sum / picks.length;
  };

  return [...lineups].sort((a, b) => {
    // Primary: highest score
    if (b.totalStat !== a.totalStat) return b.totalStat - a.totalStat;
    // Tiebreak 1: fewer busts
    const aBusts = a.bustCount ?? 0, bBusts = b.bustCount ?? 0;
    if (aBusts !== bBusts) return aBusts - bBusts;
    // Tiebreak 2: older avg pick year
    return avgPickYear(a) - avgPickYear(b);
  });
}

export interface OptimalPick {
  playerName: string;
  year: string;   // season string or 'career' for total_gp
  team: string;   // actual team the player was on
  statValue: number;
}

/**
 * Find the optimal player the user could have picked for their last slot.
 *
 * Scans every player-season for the given team and finds the one with the
 * highest stat value that fits within the remaining budget (targetCap minus
 * total before the last pick) and beats what the user actually got.
 *
 * Returns null if no better option exists (user hit the cap exactly, busted
 * with nothing better fitting, or their pick was already optimal).
 */
export async function findOptimalLastPick(
  sport: Sport,
  team: string,
  statCategory: StatCategory,
  remainingBudget: number,
  actualStatValue: number,
  excludePlayerNames?: string[],
): Promise<OptimalPick | null> {
  // No headroom left, or they already hit exactly on the dot
  if (remainingBudget <= 0 || remainingBudget === actualStatValue) return null;

  const excluded = excludePlayerNames && excludePlayerNames.length > 0
    ? new Set(excludePlayerNames)
    : null;

  try {
    let best: OptimalPick | null = null;

    if (sport === 'nba') {
      const players = await loadNBALineupPool();

      if (statCategory === 'total_gp') {
        for (const p of players) {
          if (excluded?.has(p.player_name)) continue;
          const totalGP = p.seasons
            .filter(s => nbaTeamMatches(s.team, team))
            .reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
          if (totalGP > actualStatValue && totalGP <= remainingBudget) {
            if (!best || totalGP > best.statValue) {
              best = { playerName: p.player_name, year: 'career', team, statValue: totalGP };
            }
          }
        }
      } else {
        for (const p of players) {
          if (excluded?.has(p.player_name)) continue;
          for (const s of p.seasons) {
            if (!nbaTeamMatches(s.team, team)) continue;
            const val = statCategory === 'pra'
              ? ((s.pts ?? 0) + (s.reb ?? 0) + (s.ast ?? 0))
              : ((s as any)[statCategory] ?? 0);
            if (val > actualStatValue && val <= remainingBudget) {
              if (!best || val >= best.statValue) {
                best = { playerName: p.player_name, year: s.season, team: s.team, statValue: val };
              }
            }
          }
        }
      }
    } else {
      const players = await loadNFLLineupPool();

      if (statCategory === 'total_gp') {
        for (const p of players) {
          if (excluded?.has(p.player_name)) continue;
          const totalGP = p.seasons
            .filter(s => isDivisionRound(team) ? teamInDivision(s.team, team) : nflTeamMatches(s.team, team))
            .reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
          if (totalGP > actualStatValue && totalGP <= remainingBudget) {
            if (!best || totalGP > best.statValue) {
              best = { playerName: p.player_name, year: 'career', team, statValue: totalGP };
            }
          }
        }
      } else {
        for (const p of players) {
          if (excluded?.has(p.player_name)) continue;
          for (const s of p.seasons) {
            const teamMatch = isDivisionRound(team)
              ? teamInDivision(s.team, team)
              : nflTeamMatches(s.team, team);
            if (!teamMatch) continue;
            const val = (s as any)[statCategory] ?? 0;
            if (val > actualStatValue && val <= remainingBudget) {
              if (!best || val >= best.statValue) {
                best = { playerName: p.player_name, year: s.season, team: s.team, statValue: val };
              }
            }
          }
        }
      }
    }

    return best;
  } catch (err) {
    console.error('Error finding optimal last pick:', err);
    return null;
  }
}
