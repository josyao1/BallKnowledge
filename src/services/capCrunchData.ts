/**
 * capCrunchData.ts — Static lookup tables for Cap Crunch game logic.
 *
 * Contains franchise alias maps, team lists, division/conference sets,
 * P4 college conference rosters, logos, and stat labels.
 * Imported by capCrunch.ts so that file stays focused on game logic.
 */

import type { StatCategory } from '../types/capCrunch';

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
export const NFL_FRANCHISE_ALIASES: Record<string, string[]> = {
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

// ─── NBA franchise alias map ──────────────────────────────────────────────────
// The raw career data contains old/alternate abbreviations from earlier eras.
// Maps every known abbreviation → the full set of abbreviations for that franchise.
export const NBA_FRANCHISE_ALIASES: Record<string, string[]> = {
  // Utah Jazz (UTH was used pre-~1994)
  UTA: ['UTA', 'UTH'],
  UTH: ['UTA', 'UTH'],

  // Golden State Warriors (GOS older data; PHW = Philadelphia Warriors; SFW = San Francisco Warriors)
  GSW: ['GSW', 'GOS', 'PHW', 'SFW'],
  GOS: ['GSW', 'GOS', 'PHW', 'SFW'],

  // Charlotte — original CHH (1988–2002) shares franchise history with current CHA
  CHA: ['CHA', 'CHH'],
  CHH: ['CHA', 'CHH'],

  // Sacramento Kings (formerly Kansas City Kings KCK, Cincinnati Royals CIN)
  SAC: ['SAC', 'KCK', 'CIN'],
  KCK: ['SAC', 'KCK', 'CIN'],

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

  // Golden State Warriors historical — Philadelphia Warriors (PHW) and San Francisco Warriors (SFW)
  PHW: ['GSW', 'GOS', 'PHW', 'SFW'],
  SFW: ['GSW', 'GOS', 'PHW', 'SFW'],

  // Los Angeles Lakers historical — Minneapolis Lakers (MNL)
  LAL: ['LAL', 'MNL'],
  MNL: ['LAL', 'MNL'],

  // Sacramento Kings historical — Cincinnati Royals (CIN)
  CIN: ['SAC', 'KCK', 'CIN'],

  // Washington Wizards historical — Washington Bullets (WSB)
  WAS: ['WAS', 'WSB'],
  WSB: ['WAS', 'WSB'],
};

// ─── Team lists for random assignment ────────────────────────────────────────

export const NBA_TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

export const NFL_TEAMS = [
  'KC', 'LV', 'LAC', 'DEN', 'BUF', 'MIA', 'NE', 'NYJ',
  'BAL', 'PIT', 'CLE', 'CIN',
  'PHI', 'DAL', 'NYG', 'WAS',
  'GB', 'MIN', 'DET', 'CHI',
  'ARI', 'LAR', 'SF', 'SEA',
  'NO', 'CAR', 'TB', 'ATL',
  'TEN', 'IND', 'HOU', 'JAX',
];

// ─── NFL divisions ────────────────────────────────────────────────────────────
// Maps division label → current team abbreviations.
// Franchise alias lookup handles relocated teams (OAK→LV, SD→LAC, STL→LA).
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

// ─── NBA divisions ───────────────────────────────────────────────────────────
// Uses standard current abbreviations. Historical aliases (CHH→CHA, SEA→OKC,
// NJN→BKN, NOH/NOK→NOP, VAN→MEM) are resolved by NBA_FRANCHISE_ALIASES before
// the division lookup in capCrunch.ts.
export const NBA_DIVISIONS: Record<string, string[]> = {
  'Atlantic':  ['BOS', 'BKN', 'NYK', 'PHI', 'TOR'],
  'Central':   ['CHI', 'CLE', 'DET', 'IND', 'MIL'],
  'Southeast': ['ATL', 'CHA', 'MIA', 'ORL', 'WAS'],
  'Northwest': ['DEN', 'MIN', 'OKC', 'POR', 'UTA'],
  'Pacific':   ['GSW', 'LAC', 'LAL', 'PHX', 'SAC'],
  'Southwest': ['DAL', 'HOU', 'MEM', 'NOP', 'SAS'],
};

// ─── NBA conference team sets ────────────────────────────────────────────────
// Includes all historical/alternate abbreviations so conference checks work
// across relocated franchises and older data.
//
// Conference alignment notes:
//   CHH (original Charlotte Hornets 1988-2002) → East
//   NOH/NOK/NOP (relocated franchise) → West
//   CHA (Charlotte Bobcats/Hornets expansion 2004+) → East
//   NJN/BKN (New Jersey/Brooklyn Nets) → East
//   SEA/OKC (SuperSonics/Thunder) → West
//   VAN/MEM (Vancouver/Memphis Grizzlies) → West
//   GOS/GSW (Golden State Warriors) → West
//   UTH/UTA (Utah Jazz) → West
//   KCK/SAC (Kansas City/Sacramento Kings) → West
//   PHL/PHI (Philadelphia 76ers) → East
//   SAN/SAS (San Antonio Spurs) → West
export const NBA_EAST_TEAMS = new Set([
  'ATL', 'BOS', 'BKN', 'NJN', 'CHA', 'CHH', 'CHI', 'CLE',
  'DET', 'IND', 'MIA', 'MIL', 'NYK', 'ORL', 'PHI', 'PHL', 'TOR', 'WAS',
]);

export const NBA_WEST_TEAMS = new Set([
  'DAL', 'DEN', 'GSW', 'GOS', 'HOU', 'KCK', 'LAC', 'LAL',
  'MEM', 'VAN', 'MIN', 'NOH', 'NOK', 'NOP', 'OKC', 'SEA',
  'PHX', 'POR', 'SAC', 'SAN', 'SAS', 'UTA', 'UTH',
]);

// ─── NFL conference team sets ────────────────────────────────────────────────
// Includes all franchise alias abbreviations so nflTeamMatches() covers relocated teams.
export const AFC_TEAMS = new Set([
  'KC', 'LV', 'OAK', 'LAC', 'SD', 'DEN', 'BUF', 'MIA', 'NE', 'NYJ',
  'BAL', 'BLT', 'PIT', 'CLE', 'CLV', 'CIN', 'HOU', 'HST', 'IND', 'JAX', 'TEN',
]);

export const NFC_TEAMS = new Set([
  'PHI', 'PHL', 'DAL', 'NYG', 'WAS', 'GB', 'MIN', 'DET', 'CHI',
  'ARI', 'ARZ', 'LAR', 'LA', 'STL', 'SL', 'SF', 'SEA',
  'NO', 'CAR', 'TB', 'ATL',
]);

// ─── P4 college conferences ───────────────────────────────────────────────────
// All school name variants found in the NFL and NBA data are included
// (e.g. "Louisiana State" for LSU, "Southern California" for USC, HTML entities).
// "Non-P4" is a virtual conference — players who attended at least one non-P4 school.
export const P4_CONFERENCES: Record<string, string[]> = {
  'SEC': [
    'Alabama', 'Arkansas', 'Auburn', 'Florida', 'Georgia', 'Kentucky',
    'LSU', 'Louisiana State',
    'Mississippi', 'Mississippi State', 'Ole Miss',
    'Missouri', 'Oklahoma',
    'South Carolina', 'Tennessee',
    'Texas', 'Texas-Austin', 'University of Texas at Austin',
    'Texas A&M', 'Texas A&amp;M',
    'Vanderbilt',
  ],
  'Big Ten': [
    'Illinois', 'Illinois-Urbana-Champaign',
    'Indiana', 'Iowa', 'Maryland',
    'Michigan', 'Michigan State',
    'Minnesota', 'Nebraska', 'Northwestern', 'Ohio State', 'Oregon',
    'Penn State', 'Purdue', 'Rutgers', 'UCLA',
    'USC', 'Southern California',
    'Washington', 'Wisconsin',
  ],
  'Big 12': [
    'Arizona', 'Arizona State', 'Baylor',
    'BYU', 'Brigham Young',
    'Cincinnati', 'Colorado', 'Houston', 'Iowa State',
    'Kansas', 'Kansas State', 'Oklahoma State',
    'TCU', 'Texas Christian',
    'Texas Tech',
    'UCF', 'Central Florida',
    'Utah', 'West Virginia',
  ],
  'ACC': [
    'Boston College', 'Clemson', 'California', 'Duke', 'Florida State',
    'Georgia Tech', 'Louisville',
    'Miami', 'Miami (Fla.)',
    'NC State', 'North Carolina State',
    'North Carolina', 'Notre Dame', 'Pittsburgh',
    'SMU', 'Southern Methodist',
    'Stanford',
    'Syracuse', 'Virginia', 'Virginia Tech', 'Wake Forest',
  ],
};

// ─── Conference logo paths ─────────────────────────────────────────────────────
export const CONFERENCE_LOGOS: Record<string, string> = {
  'SEC':     '/sec.png',
  'Big Ten': '/b10.png',
  'Big 12':  '/b12.png',
  'ACC':     '/acc.png',
};

// ─── Stat labels ──────────────────────────────────────────────────────────────
export const STAT_LABELS: Record<StatCategory, string> = {
  pts: 'Points (avg)',
  ast: 'Assists (avg)',
  reb: 'Rebounds (avg)',
  min: 'Minutes (avg)',
  pra: 'PTS + REB + AST (avg)',
  total_pts: 'Total Points',
  total_reb: 'Total Rebounds',
  total_ast: 'Total Assists',
  total_blk: 'Total Blocks',
  total_3pm: 'Total 3-Pointers Made',
  total_ftm: 'Total Free Throws Made',
  total_pf:  'Total Personal Fouls',
  passing_yards: 'Passing Yards',
  passing_tds: 'Passing Touchdowns',
  interceptions: 'Interceptions Thrown',
  rushing_yards: 'Rushing Yards',
  rushing_tds: 'Rushing Touchdowns',
  receiving_yards: 'Receiving Yards',
  receiving_tds: 'Receiving Touchdowns',
  receptions: 'Receptions',
  fpts: 'Fantasy Points (PPR)',
  total_gp: 'Total Games Played',
  career_passing_yards:   'Career Passing Yards',
  career_passing_tds:     'Career Passing Touchdowns',
  career_rushing_yards:   'Career Rushing Yards',
  career_rushing_tds:     'Career Rushing Touchdowns',
  career_receiving_yards: 'Career Receiving Yards',
  career_receiving_tds:   'Career Receiving Touchdowns',
};

// ─── Weighted NFL stat pool ───────────────────────────────────────────────────
// Rushing/receiving appear 2× as often as QB passing stats.
// Career stats and total_gp get 2× weight for broad player pool variety.
export const NFL_STAT_WEIGHTS: Array<{ category: StatCategory; weight: number }> = [
  { category: 'passing_yards',   weight: 1 },
  { category: 'passing_tds',     weight: 1 },
  { category: 'interceptions',   weight: 1 },
  { category: 'fpts',            weight: 2 }, // fantasy points: broad skill-position coverage
  { category: 'rushing_yards',   weight: 2 },
  { category: 'rushing_tds',     weight: 2 },
  { category: 'receiving_yards', weight: 2 },
  { category: 'receiving_tds',   weight: 2 },
  { category: 'receptions',      weight: 2 },
  { category: 'total_gp',        weight: 2 },
  { category: 'career_passing_yards',   weight: 1 },
  { category: 'career_passing_tds',     weight: 1 },
  { category: 'career_rushing_yards',   weight: 2 },
  { category: 'career_rushing_tds',     weight: 2 },
  { category: 'career_receiving_yards', weight: 2 },
  { category: 'career_receiving_tds',   weight: 2 },
];

// ─── NBA stat categories ──────────────────────────────────────────────────────
export const NBA_STAT_CATEGORIES: StatCategory[] = ['pts', 'ast', 'reb', 'min', 'pra', 'total_gp', 'total_pts', 'total_reb', 'total_ast', 'total_blk', 'total_3pm', 'total_ftm', 'total_pf'];
