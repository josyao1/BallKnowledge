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
import {
  NFL_FRANCHISE_ALIASES,
  NBA_FRANCHISE_ALIASES,
  NBA_TEAMS,
  NFL_TEAMS,
  NFL_DIVISIONS,
  NBA_EAST_TEAMS,
  NBA_WEST_TEAMS,
  AFC_TEAMS,
  NFC_TEAMS,
  P4_CONFERENCES,
  STAT_LABELS,
  NFL_STAT_WEIGHTS,
  NBA_STAT_CATEGORIES,
} from './capCrunchData';

// Re-export static data so existing importers don't need to update their import paths.
export { NFL_DIVISIONS, P4_CONFERENCES, CONFERENCE_LOGOS, NBA_TEAMS, NFL_TEAMS } from './capCrunchData';

/** Strip diacritics, periods, and lowercase so names like "T.Y. Hilton" match query "ty hilton". */
function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.'`']/g, '').toLowerCase();
}

// ─── Position Templates ──────────────────────────────────────────────────────

// No longer used - players are selected freely without position restrictions


function nflTeamMatches(dataTeam: string, targetTeam: string): boolean {
  const aliases = NFL_FRANCHISE_ALIASES[targetTeam];
  return aliases ? aliases.includes(dataTeam) : dataTeam === targetTeam;
}


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

// ── Test flag — set to a StatCategory to force that category every round ──────
// Set to null in production.
const FORCE_NFL_STAT: StatCategory | null = null;

// ── Test flag — restrict team pool to these abbreviations for targeted testing ─
// Example: ['LAR', 'LV'] to test franchise alias fixes. Set to null in production.
const TEST_NFL_TEAMS: string[] | null = null;

// ── Test flag — restrict NBA team pool for targeted testing. Set to null in production. ─
const TEST_NBA_TEAMS: string[] | null = null;


/** Career stat categories: sum all seasons across ALL teams — no team/year selection needed. */
export function isCareerStat(cat: StatCategory): boolean {
  return cat === 'career_passing_yards' || cat === 'career_passing_tds' ||
         cat === 'career_rushing_yards'  || cat === 'career_rushing_tds'  ||
         cat === 'career_receiving_yards'|| cat === 'career_receiving_tds';
}

/** The underlying per-season stat field for a career stat category. */
function careerStatField(cat: StatCategory): string {
  switch (cat) {
    case 'career_passing_yards':   return 'passing_yards';
    case 'career_passing_tds':     return 'passing_tds';
    case 'career_rushing_yards':   return 'rushing_yards';
    case 'career_rushing_tds':     return 'rushing_tds';
    case 'career_receiving_yards': return 'receiving_yards';
    case 'career_receiving_tds':   return 'receiving_tds';
    default: throw new Error(`careerStatField: unrecognized career category "${cat}"`);
  }
}

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
      case 'career_passing_yards':   return r(55000,  184000);
      case 'career_passing_tds':     return r(150,    800);
      case 'career_rushing_yards':   return r(18000,  51000);
      case 'career_rushing_tds':     return r(80,     300);
      case 'career_receiving_yards': return r(18000,  51000);
      case 'career_receiving_tds':   return r(80,     300);
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


/** Returns true if the string is a division label rather than a team abbreviation. */
export function isDivisionRound(teamOrDiv: string): boolean {
  return teamOrDiv in NFL_DIVISIONS;
}


/**
 * Returns true if a season's team value (including "ORL/DEN" slash strings)
 * played in the given NBA conference ('East' or 'West').
 */
function nbaConferenceMatches(dataTeam: string, conf: string): boolean {
  if (!conf) return true;
  const set = conf === 'East' ? NBA_EAST_TEAMS : NBA_WEST_TEAMS;
  // Slash-separated traded seasons: qualify if any component is in the conference
  const parts = dataTeam.includes('/') ? dataTeam.split('/') : [dataTeam];
  return parts.some(part => {
    const t = part.trim();
    if (set.has(t)) return true;
    // Also resolve through franchise aliases
    const aliases = NBA_FRANCHISE_ALIASES[t];
    return aliases ? aliases.some(a => set.has(a)) : false;
  });
}


/** Returns true if dataTeam played in the given NFL conference ('AFC' or 'NFC'). */
function nflConferenceMatches(dataTeam: string, nflConf: string): boolean {
  if (!nflConf) return true;
  const set = nflConf === 'AFC' ? AFC_TEAMS : NFC_TEAMS;
  // dataTeam may itself be an alias (e.g. "OAK", "SL") — check directly
  if (set.has(dataTeam)) return true;
  // Also resolve through franchise alias map in case data uses a different abbreviation
  const aliases = NFL_FRANCHISE_ALIASES[dataTeam];
  return aliases ? aliases.some(a => set.has(a)) : false;
}

function teamInDivision(dataTeam: string, division: string): boolean {
  const divTeams = NFL_DIVISIONS[division] ?? [];
  return divTeams.some(t => nflTeamMatches(dataTeam, t));
}


const ALL_P4_SCHOOLS = new Set<string>(
  Object.values(P4_CONFERENCES).flat().map(s => s.toLowerCase())
);

const COLLEGE_TO_CONF: Record<string, string> = {};
for (const [conf, schools] of Object.entries(P4_CONFERENCES)) {
  for (const school of schools) {
    COLLEGE_TO_CONF[school.toLowerCase()] = conf;
  }
}


/**
 * Returns true if the string is a P4 conference round.
 * Handles both plain ("SEC") and combined ("SEC|AFC") formats.
 */
export function isConferenceRound(s: string): boolean {
  const base = s.split('|')[0];
  return base in P4_CONFERENCES || base === 'Non-P4';
}

/**
 * Parse a combined conference assignment into its college and NFL-conf parts.
 * e.g. "SEC|AFC" → { college: "SEC", nflConf: "AFC" }
 *      "Big Ten"  → { college: "Big Ten", nflConf: "" }
 */
export function parseConferenceRound(s: string): { college: string; nflConf: string } {
  const [college, nflConf = ''] = s.split('|');
  return { college, nflConf };
}

/**
 * Returns true if the player's college(s) match the given conference.
 * Handles semicolon-separated colleges (e.g. "USC; Oklahoma").
 * "Non-P4" qualifies if the player attended at least one non-P4 school.
 * Players with no college data are treated as Non-P4.
 */
function playerCollegeInConference(bio: any, conference: string): boolean {
  // NBA uses bio.school (single value); NFL uses bio.college (semicolon-separated)
  const raw = (bio?.college ?? bio?.school ?? '') as string;
  if (!raw.trim()) return conference === 'Non-P4';
  const colleges = raw.split(';').map(c => c.trim()).filter(Boolean);
  if (conference === 'Non-P4') {
    return colleges.some(c => !ALL_P4_SCHOOLS.has(c.toLowerCase()));
  }
  return colleges.some(c => COLLEGE_TO_CONF[c.toLowerCase()] === conference);
}

/**
 * Select a random team (or division/conference) for the given sport.
 * For NFL non-career, non-total_gp rounds:
 *   ~15% chance → random division
 *   ~15% chance → random P4 conference (or Non-P4)
 *   ~70% chance → single team
 * Career/total_gp rounds always use a single team (conference/division don't apply).
 * Pass excludeTeams to avoid repeating teams across rounds.
 */
// ── Test flag — force conference rounds every time for NFL ────────────────────
const TEST_FORCE_CONFERENCE = false;

// ── Test flag — force a specific college conference every round (both sports) ─
// Set to any key from P4_CONFERENCES or 'Non-P4'. Set to null in production.
// Example: 'SEC', 'Big Ten', 'ACC', 'Big 12', 'Non-P4'
const TEST_FORCE_COLLEGE: string | null = 'SEC';

export function assignRandomTeam(sport: Sport, statCategory?: StatCategory, excludeTeams?: string[]): string {
  if (TEST_FORCE_COLLEGE) {
    const nflConf = Math.random() < 0.5 ? 'AFC' : 'NFC';
    const nbaConf = Math.random() < 0.5 ? 'East' : 'West';
    return `${TEST_FORCE_COLLEGE}|${sport === 'nba' ? nbaConf : nflConf}`;
  }
  if (sport === 'nfl' && TEST_FORCE_CONFERENCE) {
    const confs = [...Object.keys(P4_CONFERENCES), 'Non-P4'];
    const available = excludeTeams ? confs.filter(c => !excludeTeams.some(e => e.startsWith(c))) : confs;
    const pool = available.length > 0 ? available : confs;
    const college = pool[Math.floor(Math.random() * pool.length)];
    const nflConf = Math.random() < 0.5 ? 'AFC' : 'NFC';
    return `${college}|${nflConf}`;
  }
  if (sport === 'nba' && (TEST_FORCE_CONFERENCE || statCategory !== 'total_gp')) {
    if (TEST_FORCE_CONFERENCE || Math.random() < 0.15) {
      const confs = [...Object.keys(P4_CONFERENCES), 'Non-P4'];
      const available = excludeTeams
        ? confs.filter(c => !excludeTeams.some(e => e.startsWith(c)))
        : confs;
      const pool = available.length > 0 ? available : confs;
      const college = pool[Math.floor(Math.random() * pool.length)];
      const nbaConf = Math.random() < 0.5 ? 'East' : 'West';
      return `${college}|${nbaConf}`;
    }
  }
  if (sport === 'nfl' && statCategory !== 'total_gp' && !isCareerStat(statCategory!)) {
    const roll = Math.random();
    if (roll < 0.15) {
      const divs = Object.keys(NFL_DIVISIONS);
      const available = excludeTeams ? divs.filter(d => !excludeTeams.includes(d)) : divs;
      const pool = available.length > 0 ? available : divs;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    if (roll < 0.30) {
      const confs = [...Object.keys(P4_CONFERENCES), 'Non-P4'];
      const available = excludeTeams
        ? confs.filter(c => !excludeTeams.some(e => e.startsWith(c)))
        : confs;
      const pool = available.length > 0 ? available : confs;
      const college = pool[Math.floor(Math.random() * pool.length)];
      const nflConf = Math.random() < 0.5 ? 'AFC' : 'NFC';
      return `${college}|${nflConf}`;
    }
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
const NFL_SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'FB']);

export async function searchPlayersByNameOnly(
  sport: Sport,
  playerName: string,
  statCategory?: StatCategory
): Promise<Array<{ playerId: string | number; playerName: string }>> {
  try {
    const searchLower = normalizeStr(playerName);
    const pool = sport === 'nba' ? await loadNBALineupPool() : await loadNFLLineupPool();

    // For NFL non-total_gp categories, restrict to offensive skill positions
    const filterToSkill = sport === 'nfl' && statCategory && statCategory !== 'total_gp';

    // Deduplicate by player_id first
    const seen = new Map<string | number, { playerId: string | number; playerName: string; position?: string }>();
    for (const p of pool) {
      if (!normalizeStr(p.player_name).includes(searchLower)) continue;
      if (filterToSkill && !NFL_SKILL_POSITIONS.has((p as any).position ?? '')) continue;
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

    // For duplicate names, append position; if position also collides, append primary team too
    // Build a position+name key to detect same-position dupes
    const posNameCounts = new Map<string, number>();
    for (const r of dedupedResults) {
      const key = normalizeStr(r.playerName) + '|' + (r.position ?? '');
      posNameCounts.set(key, (posNameCounts.get(key) ?? 0) + 1);
    }

    // For each player, find their most-played-for team from the pool seasons
    const playerTeams = new Map<string | number, string>();
    for (const p of pool) {
      if (!playerTeams.has(p.player_id)) {
        const gpByTeam = new Map<string, number>();
        for (const s of p.seasons) {
          const t = (s as any).team as string;
          if (t && t !== '???') gpByTeam.set(t, (gpByTeam.get(t) ?? 0) + ((s as any).gp ?? 1));
        }
        const topTeam = [...gpByTeam.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        playerTeams.set(p.player_id, topTeam);
      }
    }

    return dedupedResults.map(r => {
      const nameCount = nameCounts.get(normalizeStr(r.playerName)) ?? 0;
      if (nameCount <= 1) return { playerId: r.playerId, playerName: r.playerName };

      const posNameKey = normalizeStr(r.playerName) + '|' + (r.position ?? '');
      const posNameDupe = (posNameCounts.get(posNameKey) ?? 0) > 1;

      if (posNameDupe) {
        // Same name AND same position — append team to disambiguate
        const team = playerTeams.get(r.playerId) ?? '';
        const suffix = r.position ? `${r.position}, ${team}` : team;
        return { playerId: r.playerId, playerName: `${r.playerName} (${suffix})` };
      }

      if (r.position) {
        return { playerId: r.playerId, playerName: `${r.playerName} (${r.position})` };
      }
      return { playerId: r.playerId, playerName: r.playerName };
    });
  } catch (error) {
    console.error('Error searching players by name only:', error);
    return [];
  }
}

/** Strip ` (POS)` or ` (POS, TEAM)` disambiguation suffix if present, e.g. "Adrian Peterson (RB, MIN)" → "Adrian Peterson". */
export function stripPositionSuffix(name: string): string {
  return name.replace(/\s*\([A-Z]+(,\s*[A-Z]+)?\)$/, '');
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

      const years = player.seasons.map(s => s.season);
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
): Promise<{ value: number; neverOnTeam: boolean; actualTeam?: string; actualNflConf?: string; actualCollege?: string }> {
  try {
    if (sport === 'nba') {
      const players = await loadNBALineupPool();
      const player = findPlayer(players, playerName, playerId);

      if (!player) return { value: 0, neverOnTeam: true };

      // Conference round: qualify by college school; year-by-year also requires NBA conf match
      if (isConferenceRound(team)) {
        const { college: confName, nflConf: nbaConf } = parseConferenceRound(team);
        if (!playerCollegeInConference((player as any).bio, confName)) {
          // Wrong college conf — also check if NBA conf is wrong so we can show both
          const actualCollege = (player as any).bio?.school ?? (player as any).bio?.college ?? '';
          if (nbaConf) {
            const numYear = parseInt(year);
            const seasonStr = `${numYear}-${String(numYear + 1).slice(-2)}`;
            const actualSeason = player.seasons.find(s => s.season === seasonStr);
            if (actualSeason) {
              const inEast = nbaConferenceMatches(actualSeason.team, 'East');
              const actualNflConf = inEast ? 'East' : 'West';
              if (actualNflConf !== nbaConf) {
                return { value: 0, neverOnTeam: true, actualCollege, actualNflConf };
              }
            }
          }
          return { value: 0, neverOnTeam: true, actualCollege };
        }
        // College check passed — verify NBA conf
        const numYear = parseInt(year);
        const seasonStr = `${numYear}-${String(numYear + 1).slice(-2)}`;
        const season = player.seasons.find(
          s => s.season === seasonStr && nbaConferenceMatches(s.team, nbaConf)
        );
        if (!season) {
          const actualSeason = player.seasons.find(s => s.season === seasonStr);
          if (actualSeason) {
            const inEast = nbaConferenceMatches(actualSeason.team, 'East');
            return { value: 0, neverOnTeam: true, actualNflConf: inEast ? 'East' : 'West' };
          }
          return { value: 0, neverOnTeam: true };
        }
        if (statCategory === 'pra') {
          return { value: (season.pts ?? 0) + (season.reb ?? 0) + (season.ast ?? 0), neverOnTeam: false };
        }
        const statKey = statCategory as keyof typeof season;
        return { value: (season[statKey] as number) ?? 0, neverOnTeam: false };
      }

      // Convert year to season format (e.g., "2023" -> "2023-24")
      const numYear = parseInt(year);
      const seasonStr = `${numYear}-${String(numYear + 1).slice(-2)}`;

      const season = player.seasons.find(
        s => s.season === seasonStr && nbaTeamMatches(s.team, team)
      );

      if (!season) return { value: 0, neverOnTeam: true };

      // PRA is a computed stat: pts + reb + ast for that season
      if (statCategory === 'pra') {
        return { value: (season.pts ?? 0) + (season.reb ?? 0) + (season.ast ?? 0), neverOnTeam: false };
      }

      const statKey = statCategory as keyof typeof season;
      return { value: (season[statKey] as number) ?? 0, neverOnTeam: false };
    } else {
      // NFL
      const players = await loadNFLLineupPool();
      const player = findPlayer(players, playerName, playerId);

      if (!player) return { value: 0, neverOnTeam: true };

      // Conference round: qualify by college bio; year-by-year also requires NFL conf match
      if (isConferenceRound(team)) {
        const { college: confName, nflConf } = parseConferenceRound(team);
        if (!playerCollegeInConference((player as any).bio, confName)) {
          // Wrong college conference — also check if NFL conf is wrong so we can show both errors
          const actualCollege = (player as any).bio?.college ?? '';
          if (nflConf && !isCareerStat(statCategory as StatCategory)) {
            const actualSeason = player.seasons.find(s => s.season === year);
            if (actualSeason) {
              const inAFC = AFC_TEAMS.has(actualSeason.team) ||
                (NFL_FRANCHISE_ALIASES[actualSeason.team] ?? []).some(a => AFC_TEAMS.has(a));
              const actualNflConf = inAFC ? 'AFC' : 'NFC';
              if (actualNflConf !== nflConf) {
                return { value: 0, neverOnTeam: true, actualCollege, actualNflConf };
              }
            }
          }
          return { value: 0, neverOnTeam: true, actualCollege };
        }
        if (isCareerStat(statCategory as StatCategory)) {
          // Career stats: college check only, no NFL conf restriction
          const field = careerStatField(statCategory as StatCategory);
          return { value: player.seasons.reduce((sum, s) => sum + ((s as any)[field] ?? 0), 0), neverOnTeam: false };
        }
        // Year-by-year: season must be with an NFL conf team
        const season = player.seasons.find(s =>
          s.season === year && nflConferenceMatches(s.team, nflConf)
        );
        if (!season) {
          // College conf was right — show which NFL conf they actually played in that year
          const actualSeason = player.seasons.find(s => s.season === year);
          if (actualSeason) {
            const inAFC = AFC_TEAMS.has(actualSeason.team) ||
              (NFL_FRANCHISE_ALIASES[actualSeason.team] ?? []).some(a => AFC_TEAMS.has(a));
            return { value: 0, neverOnTeam: true, actualNflConf: inAFC ? 'AFC' : 'NFC' };
          }
          return { value: 0, neverOnTeam: true };
        }
        const statKey = statCategory as keyof typeof season;
        return { value: (season[statKey] as number) ?? 0, neverOnTeam: false };
      }

      // Career stat: full career total, but only counts if player was on the assigned team at any point
      if (isCareerStat(statCategory as StatCategory)) {
        const wasOnTeam = player.seasons.some(s =>
          isDivisionRound(team) ? teamInDivision(s.team, team) : nflTeamMatches(s.team, team)
        );
        if (!wasOnTeam) return { value: 0, neverOnTeam: true };
        const field = careerStatField(statCategory as StatCategory);
        return { value: player.seasons.reduce((sum, s) => sum + ((s as any)[field] ?? 0), 0), neverOnTeam: false };
      }

      const season = player.seasons.find(
        s => s.season === year && (
          isDivisionRound(team)
            ? teamInDivision(s.team, team)
            : nflTeamMatches(s.team, team)
        )
      );

      if (!season) {
        const actualSeason = player.seasons.find(s => s.season === year);
        return { value: 0, neverOnTeam: true, actualTeam: actualSeason?.team };
      }

      const statKey = statCategory as keyof typeof season;
      return { value: (season[statKey] as number) ?? 0, neverOnTeam: false };
    }
  } catch (error) {
    console.error('Error getting player stat:', error);
    return { value: 0, neverOnTeam: true };
  }
}

/**
 * Returns the team abbreviation a player spent the most time with (by GP, falling back to season count).
 * Used to display a meaningful team label on career-stat picks instead of the round's division.
 */
export async function getPlayerMostPlayedTeam(
  sport: Sport,
  playerName: string,
  playerId?: string | number
): Promise<string> {
  try {
    const pool: Array<{ player_id: string | number; player_name: string; seasons: any[] }> =
      sport === 'nba' ? await loadNBALineupPool() : await loadNFLLineupPool();
    const player = findPlayer(pool, playerName, playerId);
    if (!player || !player.seasons.length) return '';

    // Accumulate GP (or season count as fallback) per team
    const gpByTeam = new Map<string, number>();
    for (const s of player.seasons) {
      const team = s.team;
      if (!team || team === '???') continue;
      const gp = (s as any).gp ?? 1; // fall back to 1 per season if GP missing
      gpByTeam.set(team, (gpByTeam.get(team) ?? 0) + gp);
    }
    if (!gpByTeam.size) return '';

    let best = '';
    let bestGP = -1;
    for (const [team, gp] of gpByTeam) {
      if (gp > bestGP) { bestGP = gp; best = team; }
    }
    return best;
  } catch (error) {
    console.error('[getPlayerMostPlayedTeam] Failed:', error);
    return '';
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
): Promise<{ value: number; neverOnTeam: boolean; actualTeam?: string; actualNflConf?: string; actualCollege?: string }> {
  try {
    if (sport === 'nba') {
      const players = await loadNBALineupPool();
      const player = findPlayer(players, playerName, playerId);
      if (!player) return { value: 0, neverOnTeam: true };
      // Conference round: college check only for total_gp (career stat)
      if (isConferenceRound(team)) {
        const { college: confName } = parseConferenceRound(team);
        if (!playerCollegeInConference((player as any).bio, confName)) {
          return { value: 0, neverOnTeam: true, actualCollege: (player as any).bio?.school ?? (player as any).bio?.college ?? '' };
        }
        return { value: player.seasons.reduce((sum, s) => sum + ((s as any).gp ?? 0), 0), neverOnTeam: false };
      }
      const seasonsOnTeam = player.seasons.filter(s => nbaTeamMatches(s.team, team));
      if (seasonsOnTeam.length === 0) return { value: 0, neverOnTeam: true };
      return { value: seasonsOnTeam.reduce((sum, s) => sum + ((s as any).gp ?? 0), 0), neverOnTeam: false };
    } else {
      const players = await loadNFLLineupPool();
      const player = findPlayer(players, playerName, playerId);
      if (!player) return { value: 0, neverOnTeam: true };
      // Conference round: qualify by college; total_gp is a career stat so no NFL conf restriction
      if (isConferenceRound(team)) {
        const { college: confName } = parseConferenceRound(team);
        if (!playerCollegeInConference((player as any).bio, confName)) {
          return { value: 0, neverOnTeam: true, actualCollege: (player as any).bio?.college ?? '' };
        }
        return { value: player.seasons.reduce((sum, s) => sum + ((s as any).gp ?? 0), 0), neverOnTeam: false };
      }
      const seasonsOnTeam = player.seasons.filter(s =>
        isDivisionRound(team) ? teamInDivision(s.team, team) : nflTeamMatches(s.team, team)
      );
      if (seasonsOnTeam.length === 0) return { value: 0, neverOnTeam: true };
      return { value: seasonsOnTeam.reduce((sum, s) => sum + ((s as any).gp ?? 0), 0), neverOnTeam: false };
    }
  } catch (error) {
    console.error('Error getting player total GP:', error);
    return { value: 0, neverOnTeam: true };
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
  playerId?: string | number;
  year: string;      // season string or 'career' for total_gp
  team: string;      // actual team the player was on
  statValue: number;
  college?: string;  // set for conference rounds — the school that qualified them
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

      // Conference round: filter by college school, then optionally NBA conf
      if (isConferenceRound(team)) {
        const { college: confName, nflConf: nbaConf } = parseConferenceRound(team);
        const confPlayers = players.filter(p => playerCollegeInConference((p as any).bio, confName));
        if (statCategory === 'total_gp') {
          for (const p of confPlayers) {
            if (excluded?.has(p.player_name)) continue;
            const totalGP = p.seasons.reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
            if (totalGP > actualStatValue && totalGP <= remainingBudget) {
              if (!best || totalGP > best.statValue) {
                best = { playerName: p.player_name, playerId: p.player_id, year: 'career', team, statValue: totalGP, college: (p as any).bio?.school };
              }
            }
          }
        } else {
          for (const p of confPlayers) {
            if (excluded?.has(p.player_name)) continue;
            for (const s of p.seasons) {
              if (nbaConf && !nbaConferenceMatches(s.team, nbaConf)) continue;
              const val = statCategory === 'pra'
                ? ((s.pts ?? 0) + (s.reb ?? 0) + (s.ast ?? 0))
                : ((s as any)[statCategory] ?? 0);
              if (val > actualStatValue && val <= remainingBudget) {
                if (!best || val >= best.statValue) {
                  best = { playerName: p.player_name, playerId: p.player_id, year: s.season, team: s.team, statValue: val, college: (p as any).bio?.school };
                }
              }
            }
          }
        }
      } else if (statCategory === 'total_gp') {
        for (const p of players) {
          if (excluded?.has(p.player_name)) continue;
          const totalGP = p.seasons
            .filter(s => nbaTeamMatches(s.team, team))
            .reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
          if (totalGP > actualStatValue && totalGP <= remainingBudget) {
            if (!best || totalGP > best.statValue) {
              best = { playerName: p.player_name, playerId: p.player_id, year: 'career', team, statValue: totalGP };
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
                best = { playerName: p.player_name, playerId: p.player_id, year: s.season, team: s.team, statValue: val };
              }
            }
          }
        }
      }
    } else {
      const players = await loadNFLLineupPool();

      // Conference round: qualify by college bio; year-by-year also requires NFL conf match
      if (isConferenceRound(team)) {
        const { college: confName, nflConf } = parseConferenceRound(team);
        const confPlayers = players.filter(p => playerCollegeInConference((p as any).bio, confName));
        if (statCategory === 'total_gp') {
          // Career stat — no NFL conf restriction
          for (const p of confPlayers) {
            if (excluded?.has(p.player_name)) continue;
            const totalGP = p.seasons.reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
            if (totalGP > actualStatValue && totalGP <= remainingBudget) {
              if (!best || totalGP > best.statValue) {
                best = { playerName: p.player_name, playerId: p.player_id, year: 'career', team, statValue: totalGP, college: (p as any).bio?.college };
              }
            }
          }
        } else if (statCategory && isCareerStat(statCategory)) {
          // Career stat — no NFL conf restriction
          const field = careerStatField(statCategory);
          for (const p of confPlayers) {
            if (excluded?.has(p.player_name)) continue;
            const val = p.seasons.reduce((sum, s) => sum + ((s as any)[field] ?? 0), 0);
            if (val > actualStatValue && val <= remainingBudget) {
              if (!best || val >= best.statValue) {
                best = { playerName: p.player_name, playerId: p.player_id, year: 'career', team, statValue: val, college: (p as any).bio?.college };
              }
            }
          }
        } else if (statCategory) {
          // Year-by-year — must also match NFL conf
          for (const p of confPlayers) {
            if (excluded?.has(p.player_name)) continue;
            for (const s of p.seasons) {
              if (!nflConferenceMatches(s.team, nflConf)) continue;
              const val = (s as any)[statCategory] ?? 0;
              if (val > actualStatValue && val <= remainingBudget) {
                if (!best || val >= best.statValue) {
                  best = { playerName: p.player_name, playerId: p.player_id, year: s.season, team: s.team, statValue: val, college: (p as any).bio?.college };
                }
              }
            }
          }
        }
      } else if (statCategory === 'total_gp') {
        for (const p of players) {
          if (excluded?.has(p.player_name)) continue;
          const totalGP = p.seasons
            .filter(s => isDivisionRound(team) ? teamInDivision(s.team, team) : nflTeamMatches(s.team, team))
            .reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
          if (totalGP > actualStatValue && totalGP <= remainingBudget) {
            if (!best || totalGP > best.statValue) {
              best = { playerName: p.player_name, playerId: p.player_id, year: 'career', team, statValue: totalGP };
            }
          }
        }
      } else if (statCategory && isCareerStat(statCategory)) {
        const field = careerStatField(statCategory);
        // Minimum career yards with the team to count as a meaningful optimal pick
        const careerYardMinimum = 100;
        for (const p of players) {
          if (excluded?.has(p.player_name)) continue;
          const teamSeasons = p.seasons.filter(s =>
            isDivisionRound(team) ? teamInDivision(s.team, team) : nflTeamMatches(s.team, team)
          );
          if (teamSeasons.length === 0) continue;
          // For yardage career stats, require at least 100 yards with the team
          const yardCategories = ['career_passing_yards', 'career_rushing_yards', 'career_receiving_yards'];
          if (yardCategories.includes(statCategory)) {
            const yardsWithTeam = teamSeasons.reduce((sum, s) => sum + ((s as any)[field] ?? 0), 0);
            if (yardsWithTeam < careerYardMinimum) continue;
          }
          const val = p.seasons.reduce((sum, s) => sum + ((s as any)[field] ?? 0), 0);
          if (val > actualStatValue && val <= remainingBudget) {
            if (!best || val >= best.statValue) {
              best = { playerName: p.player_name, playerId: p.player_id, year: 'career', team, statValue: val };
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
                best = { playerName: p.player_name, playerId: p.player_id, year: s.season, team: s.team, statValue: val };
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
