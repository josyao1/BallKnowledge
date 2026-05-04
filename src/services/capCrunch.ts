/**
 * lineupIsRight.ts — Game logic and utilities for "Lineup Is Right".
 *
 * Handles stat selection, target cap generation, team assignment,
 * eligible player lookup, stat aggregation, and bust detection.
 */

import { loadNBALineupPool, loadNFLLineupPool } from './careerData';
import type {
  StatCategory,
  HWFilter,
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
  NBA_DIVISIONS,
  NBA_EAST_TEAMS,
  NBA_WEST_TEAMS,
  AFC_TEAMS,
  NFC_TEAMS,
  P4_CONFERENCES,
  STAT_LABELS,
  NFL_STAT_WEIGHTS,
  NBA_STAT_CATEGORIES,
  HEIGHT_THRESHOLD_NBA,
  HEIGHT_THRESHOLD_NFL,
  WEIGHT_THRESHOLD,
} from './capCrunchData';

// Re-export static data so existing importers don't need to update their import paths.
export { NFL_DIVISIONS, NBA_DIVISIONS, P4_CONFERENCES, CONFERENCE_LOGOS, NBA_TEAMS, NFL_TEAMS } from './capCrunchData';
// Re-export HWFilter type so importers only need to reference capCrunch.ts
export type { HWFilter } from '../types/capCrunch';

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

// ── Test flag — force a height/weight filter for testing. Set to null in production. ──
// Example: 'height_above' | 'height_below' | 'weight_above' | 'weight_below'
const FORCE_HW_FILTER: HWFilter | null = null;

// ── Test flag — restrict team pool to these abbreviations for targeted testing ─
// Example: ['LAR', 'LV'] to test franchise alias fixes. Set to null in production.
const TEST_NFL_TEAMS: string[] | null = null;

// ── Test flag — restrict NBA team pool for targeted testing. Set to null in production. ─
const TEST_NBA_TEAMS: string[] | null = null;


/** Compute a derived NBA season stat from a raw season object. */
function computeNbaStat(season: any, statCategory: string): number {
  if (statCategory === 'pra') return (season.pts ?? 0) + (season.reb ?? 0) + (season.ast ?? 0);
  if (statCategory === 'total_pts') return Math.round((season.pts   ?? 0) * (season.gp ?? 0));
  if (statCategory === 'total_reb') return Math.round((season.reb   ?? 0) * (season.gp ?? 0));
  if (statCategory === 'total_ast') return Math.round((season.ast   ?? 0) * (season.gp ?? 0));
  if (statCategory === 'total_blk') return Math.round((season.blk   ?? 0) * (season.gp ?? 0));
  if (statCategory === 'total_3pm') return Math.round((season.fg3m  ?? 0) * (season.gp ?? 0));
  if (statCategory === 'total_ftm') return Math.round((season.ftm   ?? 0) * (season.gp ?? 0));
  if (statCategory === 'total_pf')  return Math.round((season.pf    ?? 0) * (season.gp ?? 0));
  return (season[statCategory] as number) ?? 0;
}

/** Compute a derived NFL season stat from a raw season object. */
function computeNflStat(season: any, statCategory: string): number {
  if (statCategory === 'fpts') {
    return parseFloat((
      (season.passing_yards ?? 0) * 0.04 +
      (season.passing_tds ?? 0) * 4 +
      (season.rushing_yards ?? 0) * 0.1 +
      (season.rushing_tds ?? 0) * 6 +
      (season.receiving_yards ?? 0) * 0.1 +
      (season.receiving_tds ?? 0) * 6 +
      (season.receptions ?? 0) * 1
    ).toFixed(1));
  }
  return (season[statCategory] as number) ?? 0;
}

/** Returns true if `val` is a height/weight eligibility filter. */
export function isHWFilter(val: HWFilter | null | undefined): val is HWFilter {
  return val === 'height_above' || val === 'height_below' ||
         val === 'weight_above' || val === 'weight_below';
}

/**
 * The four "special" round types that must each appear before any can repeat.
 * Plain team (no filter) is unrestricted and sits outside this cycle.
 */
export type SpecialRoundType = 'division_draft' | 'division' | 'conference' | 'hw_filter';

/**
 * Classify which special round type a round is, or null for plain team (no filter).
 * Used to track the rotation cycle.
 */
export function classifySpecialRoundType(team: string, hwFilter: HWFilter | null): SpecialRoundType | null {
  if (isDivisionDraftRound(team)) return 'division_draft';
  if (isDivisionRound(team))      return 'division';
  if (isConferenceRound(team))    return 'conference';
  if (hwFilter !== null)          return 'hw_filter';
  return null;
}

/**
 * Return the updated usedSpecialTypes after a round with the given type.
 * Resets to [] once all 4 special types have appeared (cycle complete).
 */
export function advanceSpecialRoundCycle(
  current: SpecialRoundType[],
  roundType: SpecialRoundType | null,
): SpecialRoundType[] {
  if (roundType === null) return current; // plain team — no change
  const updated = current.includes(roundType) ? current : [...current, roundType];
  return updated.length >= 4 ? [] : updated; // reset cycle once all 4 seen
}

/**
 * Randomly pick a height/weight filter to layer onto a round, or null for no filter.
 * Only applicable to plain single-team rounds (not divisions/conferences/draft rounds).
 * ~15% chance of getting a filter for eligible stat/team combos.
 * Pass usedSpecialTypes to block hw_filter from repeating before the cycle completes.
 */
export function selectRandomHWFilter(
  _sport: Sport,
  team: string,
  statCategory: StatCategory,
  usedSpecialTypes?: SpecialRoundType[],
): HWFilter | null {
  if (FORCE_HW_FILTER) return FORCE_HW_FILTER;
  // Only applies to plain team rounds (not division, conference, or draft special rounds)
  if (isDivisionRound(team) || isConferenceRound(team) || isDivisionDraftRound(team)) return null;
  // Only applies to per-season stats — not career totals or total_gp
  if (statCategory === 'total_gp' || isCareerStat(statCategory)) return null;
  // Block if hw_filter already appeared this cycle
  if (usedSpecialTypes?.includes('hw_filter')) return null;
  if (Math.random() > 0.15) return null;
  const filters: HWFilter[] = ['height_above', 'height_below', 'weight_above', 'weight_below'];
  return filters[Math.floor(Math.random() * filters.length)];
}

/** Parse a bio height string like "6-4" → inches (76). Returns null if missing/invalid. */
function parseBioHeight(h: string | undefined): number | null {
  if (!h) return null;
  const parts = h.split('-').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return parts[0] * 12 + parts[1];
}

/** Format inches as feet-and-inches string, e.g. 76 → "6'4\"" */
export function formatHeightInches(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

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
      case 'total_pts': return r(3500, 10000); // 5× season totals; good scorer ~1200 pts/yr (15 PPG × 80), elite ~2400 (LeBron, Kobe)
      case 'total_reb': return r(2000, 4000); // 5× season totals; good big ~700 reb/yr (9 RPG × 78), elite ~1100 (Dwight, Gobert)
      case 'total_ast': return r(900,  3000); // 5× season totals; good PG ~500 ast/yr (7 APG × 72), elite ~1164 (Stockton '90-91)
      case 'total_blk': return r(200,  700);  // 5× season totals; good blocker ~120 blk/yr (1.5 BPG × 80), elite ~456 (Mark Eaton '85)
      // total_3pm: elite shooter ~200/yr (Curry '15-16: 402); good shooter ~100/yr; role player ~30
      case 'total_3pm': return r(250,  1400);  // 5 picks avg ~100-200 each; Curry '15-16: 402 alone
      // total_ftm: elite FT shooter ~700/yr (Harden '18-19: 702); good player ~300/yr; role ~100
      case 'total_ftm': return r(500,  2100); // 5 picks avg ~300 each = 1500 mid-range
      // total_pf: heavy fouler ~300/yr (3.8 PF/G × 80); guard ~150/yr; 5 picks avg ~220 = 1100
      case 'total_pf':  return r(600,  1500); // 5 picks avg ~220 each = 1100 mid-range
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
      // fpts (PPR): QB ~350-450, WR/TE ~200-300, RB ~200-300 in a good season.
      // 5 picks averaging ~200 each = 1000. Elite 5-stack = 1500+.
      case 'fpts':            return r(500, 1750);
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

// ─── Division + Draft Round helpers ─────────────────────────────────────────
//
// Assignment format: "NFC South|R1", "Atlantic|R2", "AFC North|R23", etc.
// The |R suffix is unambiguous — conference rounds use "|AFC"/"|NFC"/"|East"/"|West".
//
// NFL draft round buckets (derived from bio.draft_number — overall pick):
//   R1  : picks  1–32    (1st round)
//   R23 : picks 33–105   (2nd–3rd round; extends to ~105 to include comp picks)
//   R47 : picks 106–262  (4th–7th round)
//   null: undrafted (draft_number missing or 0)
//
// NBA draft rounds (stored as bio.draft_round after backfill script):
//   R1  : round 1  (picks 1–30)
//   R2  : round 2  (picks 31–60)
//   null: undrafted

/** True when the assignment string encodes a division+draft-round category. */
export function isDivisionDraftRound(s: string): boolean {
  return /\|(R1|R23|R47|R2)$/.test(s);
}

/** Parse "NFC South|R1" → { division: "NFC South", draftRound: "R1" } */
export function parseDivisionDraftRound(s: string): { division: string; draftRound: string } {
  const idx = s.lastIndexOf('|');
  return { division: s.slice(0, idx), draftRound: s.slice(idx + 1) };
}

/** Human-readable label for a draft round code. */
function draftRoundLabel(code: string): string {
  if (code === 'R1')  return '1st Round';
  if (code === 'R23') return '2nd-3rd Round';
  if (code === 'R47') return '4th-7th Round';
  if (code === 'R2')  return '2nd Round';
  return code;
}

/** Human-readable draft round with pick number for optimal pick display. */
function draftRoundWithPick(bio: any, sport: 'nba' | 'nfl'): string | undefined {
  if (sport === 'nfl') {
    const pick = bio?.draft_number;
    if (!pick || pick <= 0) return 'Undrafted';
    const round = nflDraftRoundCode(bio);
    return round ? `${draftRoundLabel(round)} (pick ${pick})` : undefined;
  } else {
    const r = String(bio?.draft_round ?? '');
    const pick = bio?.draft_pick;
    if (r === '1') return pick ? `1st Round (pick ${pick})` : '1st Round';
    if (r === '2') return pick ? `2nd Round (pick ${pick})` : '2nd Round';
    return 'Undrafted';
  }
}

/** Return the draft round bucket code for an NFL player's bio, or null if undrafted. */
function nflDraftRoundCode(bio: any): string | null {
  const pick = bio?.draft_number;
  if (!pick || pick <= 0) return null;
  if (pick <= 32)  return 'R1';
  if (pick <= 105) return 'R23';
  return 'R47';
}

/** Return the draft round bucket code for an NBA player's bio, or null if undrafted. */
function nbaDraftRoundCode(bio: any): string | null {
  const r = String(bio?.draft_round ?? '');
  if (r === '1') return 'R1';
  if (r === '2') return 'R2';
  return null;
}

/** True if the player's bio matches the target draft round bucket for the given sport. */
function playerInDraftRound(bio: any, draftRound: string, sport: 'nba' | 'nfl'): boolean {
  const actual = sport === 'nfl' ? nflDraftRoundCode(bio) : nbaDraftRoundCode(bio);
  return actual === draftRound;
}

/** Which NFL division does this team belong to? Returns the division name or null. */
function getActualNflDivision(team: string): string | null {
  const aliases = NFL_FRANCHISE_ALIASES[team] ?? [team];
  for (const [div, teams] of Object.entries(NFL_DIVISIONS)) {
    if (aliases.some(a => teams.includes(a)) || teams.includes(team)) return div;
  }
  return null;
}

/** Which NBA division does this team belong to? Returns the division name or null. */
function getActualNbaDivision(team: string): string | null {
  const candidates = NBA_FRANCHISE_ALIASES[team] ? [team, ...NBA_FRANCHISE_ALIASES[team]] : [team];
  for (const [div, teams] of Object.entries(NBA_DIVISIONS)) {
    if (candidates.some(c => teams.includes(c))) return div;
  }
  return null;
}

/** Returns true if dataTeam played in the given NBA division. Handles slash-seasons and franchise aliases. */
function teamInNbaDivision(dataTeam: string, division: string): boolean {
  if (dataTeam.includes('/')) {
    return dataTeam.split('/').some(t => teamInNbaDivision(t.trim(), division));
  }
  const divTeams = NBA_DIVISIONS[division] ?? [];
  const candidates = NBA_FRANCHISE_ALIASES[dataTeam] ? [dataTeam, ...NBA_FRANCHISE_ALIASES[dataTeam]] : [dataTeam];
  return candidates.some(t => divTeams.includes(t));
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
const TEST_FORCE_COLLEGE: string | null = null;

// ── Test flag — force division+draft-round category every round ──────────────
// Set to true to test the new round type in both solo and multiplayer.
// Must be false before merging to production.
const TEST_FORCE_DIVISION_DRAFT = false;

export function assignRandomTeam(
  sport: Sport,
  statCategory?: StatCategory,
  excludeTeams?: string[],
  usedSpecialTypes?: SpecialRoundType[],
): string {
  // ── Test overrides ──
  if (TEST_FORCE_DIVISION_DRAFT && sport === 'nfl') {
    const divs = Object.keys(NFL_DIVISIONS);
    const div = divs[Math.floor(Math.random() * divs.length)];
    const rounds = ['R1', 'R23', 'R47'] as const;
    return `${div}|${rounds[Math.floor(Math.random() * rounds.length)]}`;
  }
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
  // NBA conference round — skip if 'conference' already used this cycle
  if (sport === 'nba' && (TEST_FORCE_CONFERENCE || statCategory !== 'total_gp')) {
    const conferenceUsed = usedSpecialTypes?.includes('conference');
    if (TEST_FORCE_CONFERENCE || (!conferenceUsed && Math.random() < 0.15)) {
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
    // Each band is exclusive — a blocked type falls to plain team, not the next special type.
    if (roll < 0.10) {
      // ~10% → division + draft round; skip if already used this cycle
      if (!usedSpecialTypes?.includes('division_draft')) {
        const divs = Object.keys(NFL_DIVISIONS);
        const available = excludeTeams ? divs.filter(d => !excludeTeams.includes(d)) : divs;
        const pool = available.length > 0 ? available : divs;
        const div = pool[Math.floor(Math.random() * pool.length)];
        const rounds = ['R1', 'R23', 'R47'] as const;
        return `${div}|${rounds[Math.floor(Math.random() * rounds.length)]}`;
      }
    } else if (roll < 0.20) {
      // ~10% → division only; skip if already used this cycle
      if (!usedSpecialTypes?.includes('division')) {
        const divs = Object.keys(NFL_DIVISIONS);
        const available = excludeTeams ? divs.filter(d => !excludeTeams.includes(d)) : divs;
        const pool = available.length > 0 ? available : divs;
        return pool[Math.floor(Math.random() * pool.length)];
      }
    } else if (roll < 0.30) {
      // ~10% → conference round; skip if already used this cycle
      if (!usedSpecialTypes?.includes('conference')) {
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

type StatResult = { value: number; neverOnTeam: boolean; actualTeam?: string; actualNflConf?: string; actualCollege?: string; actualDraftRound?: string; hwFilterFailed?: HWFilter; actualHeight?: string; actualWeight?: number };

type HWCheckResult = { passes: true } | { passes: false; hwFilterFailed: HWFilter; actualHeight?: string; actualWeight?: number };

/**
 * Check whether a player's bio satisfies a height/weight filter.
 * Thresholds are inclusive on the "below/light" side — a player exactly at the threshold
 * qualifies for "below" (e.g. 6'2" passes height_below), NOT for "above" (height_above requires strictly taller).
 * Returns { passes: true } if the constraint is met, or a failure object with hwFilterFailed always set.
 */
function checkHWFilter(bio: any, hwFilter: HWFilter, sport: Sport): HWCheckResult {
  const heightInches = parseBioHeight(bio?.height);
  const weight: number | null = bio?.weight ?? null;
  const threshold = (hwFilter === 'height_above' || hwFilter === 'height_below')
    ? (sport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)
    : WEIGHT_THRESHOLD;
  if (hwFilter === 'height_above' || hwFilter === 'height_below') {
    if (heightInches === null) return { passes: false, hwFilterFailed: hwFilter };
    // height_above: strictly above threshold; height_below: at or below (inclusive)
    const qualifies = hwFilter === 'height_above' ? heightInches > threshold : heightInches <= threshold;
    return qualifies ? { passes: true } : { passes: false, hwFilterFailed: hwFilter, actualHeight: bio?.height };
  } else {
    if (weight === null) return { passes: false, hwFilterFailed: hwFilter };
    // weight_above: strictly above threshold; weight_below: at or below (inclusive)
    const qualifies = hwFilter === 'weight_above' ? weight > threshold : weight <= threshold;
    return qualifies ? { passes: true } : { passes: false, hwFilterFailed: hwFilter, actualWeight: weight };
  }
}

/**
 * Get a player's stat value for a specific year on a specific team.
 * Returns 0 if the player was not on that team in that year.
 * Optionally also checks a height/weight filter; if the player fails it, neverOnTeam=true with actualHeight/actualWeight set.
 */
export async function getPlayerStatForYearAndTeam(
  sport: Sport,
  playerName: string,
  team: string,
  year: string,
  statCategory: string,
  playerId?: string | number,
  hwFilter?: HWFilter | null
): Promise<StatResult> {
  try {
    if (sport === 'nba') {
      const players = await loadNBALineupPool();
      const player = findPlayer(players, playerName, playerId);

      if (!player) return { value: 0, neverOnTeam: true };

      // Division + Draft round: player must be in the right draft round AND play for a team in the division that year
      if (isDivisionDraftRound(team)) {
        const { division, draftRound } = parseDivisionDraftRound(team);
        if (!playerInDraftRound((player as any).bio, draftRound, 'nba')) {
          const actual = nbaDraftRoundCode((player as any).bio);
          return { value: 0, neverOnTeam: true, actualDraftRound: actual ? draftRoundLabel(actual) : 'Undrafted' };
        }
        const numYear = parseInt(year);
        const seasonStr = `${numYear}-${String(numYear + 1).slice(-2)}`;
        const season = player.seasons.find(s => s.season === seasonStr && teamInNbaDivision(s.team, division));
        if (!season) {
          const actualSeason = player.seasons.find(s => s.season === seasonStr);
          const actualDiv = actualSeason ? getActualNbaDivision(actualSeason.team) : null;
          return { value: 0, neverOnTeam: true, actualNflConf: actualDiv ?? undefined };
        }
        return { value: computeNbaStat(season, statCategory), neverOnTeam: false };
      }

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
        return { value: computeNbaStat(season, statCategory), neverOnTeam: false };
      }

      // Convert year to season format (e.g., "2023" -> "2023-24")
      const numYear = parseInt(year);
      const seasonStr = `${numYear}-${String(numYear + 1).slice(-2)}`;

      const season = player.seasons.find(
        s => s.season === seasonStr && nbaTeamMatches(s.team, team)
      );

      if (!season) return { value: 0, neverOnTeam: true };

      if (hwFilter) {
        const hw = checkHWFilter((player as any).bio, hwFilter, sport);
        if (!hw.passes) return { value: 0, neverOnTeam: true, hwFilterFailed: hw.hwFilterFailed, actualHeight: hw.actualHeight, actualWeight: hw.actualWeight };
      }
      return { value: computeNbaStat(season, statCategory), neverOnTeam: false };
    } else {
      // NFL
      const players = await loadNFLLineupPool();
      const player = findPlayer(players, playerName, playerId);

      if (!player) return { value: 0, neverOnTeam: true };

      // Division + Draft round: player must be in the right draft round AND play for a team in the division that year
      if (isDivisionDraftRound(team)) {
        const { division, draftRound } = parseDivisionDraftRound(team);
        if (!playerInDraftRound((player as any).bio, draftRound, 'nfl')) {
          const actual = nflDraftRoundCode((player as any).bio);
          return { value: 0, neverOnTeam: true, actualDraftRound: actual ? draftRoundLabel(actual) : 'Undrafted' };
        }
        if (isCareerStat(statCategory as StatCategory)) {
          const wasInDiv = player.seasons.some(s => teamInDivision(s.team, division));
          if (!wasInDiv) return { value: 0, neverOnTeam: true };
          const field = careerStatField(statCategory as StatCategory);
          return { value: player.seasons.reduce((sum, s) => sum + ((s as any)[field] ?? 0), 0), neverOnTeam: false };
        }
        const season = player.seasons.find(s => s.season === year && teamInDivision(s.team, division));
        if (!season) {
          const actualSeason = player.seasons.find(s => s.season === year);
          const actualDiv = actualSeason ? getActualNflDivision(actualSeason.team) : null;
          return { value: 0, neverOnTeam: true, actualNflConf: actualDiv ?? undefined };
        }
        return { value: computeNflStat(season, statCategory), neverOnTeam: false };
      }

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
        return { value: computeNflStat(season, statCategory), neverOnTeam: false };
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

      if (hwFilter) {
        const hw = checkHWFilter((player as any).bio, hwFilter, sport);
        if (!hw.passes) return { value: 0, neverOnTeam: true, hwFilterFailed: hw.hwFilterFailed, actualHeight: hw.actualHeight, actualWeight: hw.actualWeight };
      }
      return { value: computeNflStat(season, statCategory), neverOnTeam: false };
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
  playerId?: string | number,
  hwFilter?: HWFilter | null
): Promise<StatResult> {
  try {
    if (sport === 'nba') {
      const players = await loadNBALineupPool();
      const player = findPlayer(players, playerName, playerId);
      if (!player) return { value: 0, neverOnTeam: true };
      // Division + Draft round: check draft round then sum GP for seasons in the division
      if (isDivisionDraftRound(team)) {
        const { division, draftRound } = parseDivisionDraftRound(team);
        if (!playerInDraftRound((player as any).bio, draftRound, 'nba')) {
          const actual = nbaDraftRoundCode((player as any).bio);
          return { value: 0, neverOnTeam: true, actualDraftRound: actual ? draftRoundLabel(actual) : 'Undrafted' };
        }
        const total = player.seasons
          .filter(s => teamInNbaDivision(s.team, division))
          .reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
        if (total === 0) return { value: 0, neverOnTeam: true };
        return { value: total, neverOnTeam: false };
      }
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
      if (hwFilter) {
        const hw = checkHWFilter((player as any).bio, hwFilter, sport);
        if (!hw.passes) return { value: 0, neverOnTeam: true, hwFilterFailed: hw.hwFilterFailed, actualHeight: hw.actualHeight, actualWeight: hw.actualWeight };
      }
      return { value: seasonsOnTeam.reduce((sum, s) => sum + ((s as any).gp ?? 0), 0), neverOnTeam: false };
    } else {
      const players = await loadNFLLineupPool();
      const player = findPlayer(players, playerName, playerId);
      if (!player) return { value: 0, neverOnTeam: true };
      // Division + Draft round: check draft round then sum GP for seasons in the division
      if (isDivisionDraftRound(team)) {
        const { division, draftRound } = parseDivisionDraftRound(team);
        if (!playerInDraftRound((player as any).bio, draftRound, 'nfl')) {
          const actual = nflDraftRoundCode((player as any).bio);
          return { value: 0, neverOnTeam: true, actualDraftRound: actual ? draftRoundLabel(actual) : 'Undrafted' };
        }
        const seasonsInDiv = player.seasons.filter(s => teamInDivision(s.team, division));
        if (seasonsInDiv.length === 0) return { value: 0, neverOnTeam: true };
        return { value: seasonsInDiv.reduce((sum, s) => sum + ((s as any).gp ?? 0), 0), neverOnTeam: false };
      }
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
      if (hwFilter) {
        const hw = checkHWFilter((player as any).bio, hwFilter, sport);
        if (!hw.passes) return { value: 0, neverOnTeam: true, hwFilterFailed: hw.hwFilterFailed, actualHeight: hw.actualHeight, actualWeight: hw.actualWeight };
      }
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
 * Fetch the stat for a pick, build the SelectedPlayer, and return the updated lineup.
 * Shared by solo and multiplayer confirm handlers — only differs in isBlindMode.
 */
export async function resolvePickResult(params: {
  sport: Sport;
  playerName: string;
  playerId?: string | number;
  team: string;
  year: string;
  statCategory: StatCategory;
  hwFilter: HWFilter | null;
  lineup: PlayerLineup;
  targetCap: number;
  isBlindMode?: boolean;
}): Promise<{ selectedPlayer: SelectedPlayer; updatedLineup: PlayerLineup }> {
  const { sport, playerName, playerId, team, year, statCategory, hwFilter, lineup, targetCap, isBlindMode = false } = params;

  const isTotalGP = statCategory === 'total_gp';
  const isCareerStatRound = isCareerStat(statCategory);
  const isNoYearSelect = isTotalGP || isCareerStatRound;

  const statResult = isTotalGP
    ? await getPlayerTotalGPForTeam(sport, playerName, team, playerId, hwFilter)
    : isCareerStatRound
      ? await getPlayerStatForYearAndTeam(sport, playerName, team, 'career', statCategory, playerId, hwFilter)
      : await getPlayerStatForYearAndTeam(sport, playerName, team, year, statCategory, playerId, hwFilter);

  const r = statResult as any;
  const statValue: number        = r.value;
  const neverOnTeam: boolean     = r.neverOnTeam;
  const actualTeam               = r.actualTeam       as string | undefined;
  const actualNflConf            = r.actualNflConf    as string | undefined;
  const actualCollege            = r.actualCollege    as string | undefined;
  const actualDraftRound         = r.actualDraftRound as string | undefined;
  const hwFilterFailed           = r.hwFilterFailed   as HWFilter | undefined;
  const actualHeight             = r.actualHeight     as string | undefined;
  const actualWeight             = r.actualWeight     as number | undefined;

  const wouldBust = !isBlindMode && (lineup.totalStat + statValue) > targetCap;

  const selectedPlayer: SelectedPlayer = {
    playerName: stripPositionSuffix(playerName),
    team,
    selectedYear: isNoYearSelect ? 'career' : year,
    playerSeason: null,
    statValue,
    isBust: wouldBust,
    neverOnTeam,
    actualTeam,
    actualNflConf,
    actualCollege,
    actualDraftRound,
    hwFilterFailed,
    actualHeight,
    actualWeight,
    playerId,
  };

  const updatedLineup: PlayerLineup = {
    ...lineup,
    selectedPlayers: [...lineup.selectedPlayers, selectedPlayer],
    totalStat: wouldBust ? lineup.totalStat : parseFloat((lineup.totalStat + statValue).toFixed(1)),
    bustCount: wouldBust ? (lineup.bustCount ?? 0) + 1 : (lineup.bustCount ?? 0),
  };

  return { selectedPlayer, updatedLineup };
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
  draftRound?: string; // set for division+draft rounds — e.g. "1st Round (pick 5)"
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

      // Division + Draft round: filter by draft round, then by division per-season
      if (isDivisionDraftRound(team)) {
        const { division, draftRound } = parseDivisionDraftRound(team);
        const draftPlayers = players.filter(p => playerInDraftRound((p as any).bio, draftRound, 'nba'));
        if (statCategory === 'total_gp') {
          for (const p of draftPlayers) {
            if (excluded?.has(p.player_name)) continue;
            const totalGP = p.seasons
              .filter(s => teamInNbaDivision(s.team, division))
              .reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
            if (totalGP > actualStatValue && totalGP <= remainingBudget) {
              if (!best || totalGP > best.statValue) {
                best = { playerName: p.player_name, playerId: p.player_id, year: 'career', team, statValue: totalGP, draftRound: draftRoundWithPick((p as any).bio, 'nba') };
              }
            }
          }
        } else {
          for (const p of draftPlayers) {
            if (excluded?.has(p.player_name)) continue;
            for (const s of p.seasons) {
              if (!teamInNbaDivision(s.team, division)) continue;
              const val = computeNbaStat(s, statCategory);
              if (val > actualStatValue && val <= remainingBudget) {
                if (!best || val >= best.statValue) {
                  best = { playerName: p.player_name, playerId: p.player_id, year: s.season, team: s.team, statValue: val, draftRound: draftRoundWithPick((p as any).bio, 'nba') };
                }
              }
            }
          }
        }
      // Conference round: filter by college school, then optionally NBA conf
      } else if (isConferenceRound(team)) {
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
              const val = computeNbaStat(s, statCategory);
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
            const val = computeNbaStat(s, statCategory);
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

      // Division + Draft round: filter by draft round, then by division per-season
      if (isDivisionDraftRound(team)) {
        const { division, draftRound } = parseDivisionDraftRound(team);
        const draftPlayers = players.filter(p => playerInDraftRound((p as any).bio, draftRound, 'nfl'));
        if (statCategory === 'total_gp') {
          for (const p of draftPlayers) {
            if (excluded?.has(p.player_name)) continue;
            const totalGP = p.seasons
              .filter(s => teamInDivision(s.team, division))
              .reduce((sum, s) => sum + ((s as any).gp ?? 0), 0);
            if (totalGP > actualStatValue && totalGP <= remainingBudget) {
              if (!best || totalGP > best.statValue) {
                best = { playerName: p.player_name, playerId: p.player_id, year: 'career', team, statValue: totalGP, draftRound: draftRoundWithPick((p as any).bio, 'nfl') };
              }
            }
          }
        } else if (statCategory && isCareerStat(statCategory)) {
          const field = careerStatField(statCategory);
          for (const p of draftPlayers) {
            if (excluded?.has(p.player_name)) continue;
            const wasInDiv = p.seasons.some(s => teamInDivision(s.team, division));
            if (!wasInDiv) continue;
            const val = p.seasons.reduce((sum, s) => sum + ((s as any)[field] ?? 0), 0);
            if (val > actualStatValue && val <= remainingBudget) {
              if (!best || val >= best.statValue) {
                best = { playerName: p.player_name, playerId: p.player_id, year: 'career', team, statValue: val, draftRound: draftRoundWithPick((p as any).bio, 'nfl') };
              }
            }
          }
        } else if (statCategory) {
          for (const p of draftPlayers) {
            if (excluded?.has(p.player_name)) continue;
            for (const s of p.seasons) {
              if (!teamInDivision(s.team, division)) continue;
              const val = computeNflStat(s, statCategory);
              if (val > actualStatValue && val <= remainingBudget) {
                if (!best || val >= best.statValue) {
                  best = { playerName: p.player_name, playerId: p.player_id, year: s.season, team: s.team, statValue: val, draftRound: draftRoundWithPick((p as any).bio, 'nfl') };
                }
              }
            }
          }
        }
      // Conference round: qualify by college bio; year-by-year also requires NFL conf match
      } else if (isConferenceRound(team)) {
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
              const val = computeNflStat(s, statCategory);
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
            const val = computeNflStat(s, statCategory);
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
