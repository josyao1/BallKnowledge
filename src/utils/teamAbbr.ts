/**
 * teamAbbr.ts — Normalize historical/legacy team abbreviations to their
 * modern equivalents for display purposes.
 *
 * Both NBA and NFL career data contain old abbreviations (e.g. "OAK" for the
 * Raiders before they moved to Las Vegas, "SAN" for the Spurs in older nba_api
 * records). This file maps every known legacy code to the current franchise
 * abbreviation so players see a consistent display in the career stats table.
 *
 * Multi-team season strings ("OAK/KC", "SAN/NJN") are handled by normalizing
 * each segment individually.
 */

const NBA_ABBR: Record<string, string> = {
  SAN: 'SAS',  // San Antonio Spurs (nba_api legacy code)
  NJN: 'BKN',  // New Jersey Nets → Brooklyn Nets (2012)
  NOH: 'NOP',  // New Orleans Hornets → Pelicans (2013)
  NOK: 'NOP',  // New Orleans/OKC Hornets (2005–07 displacement)
  SEA: 'OKC',  // Seattle SuperSonics → OKC Thunder (2008)
  VAN: 'MEM',  // Vancouver Grizzlies → Memphis (2001)
  UTH: 'UTA',  // Utah Jazz (alternate nba_api code)
  CHH: 'CHA',  // Charlotte Hornets (original era, pre-2002)
  GOS: 'GSW',  // Golden State Warriors (old code)
  KCK: 'SAC',  // Kansas City Kings → Sacramento Kings (1985)
  PHL: 'PHI',  // Philadelphia 76ers (alternate nba_api code)
  PHO: 'PHX',  // Phoenix Suns (alternate nba_api code)
};

const NFL_ABBR: Record<string, string> = {
  OAK: 'LV',   // Oakland Raiders → Las Vegas Raiders (2020)
  SD:  'LAC',  // San Diego Chargers → LA Chargers (2017)
  SL:  'LAR',  // St. Louis Rams → LA Rams (2016)
  LA:  'LAR',  // nfl_data_py used "LA" for the Rams in their first years back
  ARZ: 'ARI',  // Arizona Cardinals (nfl_data_py alternate)
  BLT: 'BAL',  // Baltimore Ravens (nfl_data_py alternate)
  CLV: 'CLE',  // Cleveland Browns (nfl_data_py alternate)
  HST: 'HOU',  // Houston Texans (nfl_data_py alternate)
};

/**
 * Return the modern abbreviation for a single team code.
 * Unknown codes are returned unchanged.
 */
function normOne(abbr: string, map: Record<string, string>): string {
  return map[abbr] ?? abbr;
}

/**
 * Normalize a team abbreviation (or slash-separated multi-team string like
 * "OAK/KC") for display, mapping every segment to its modern equivalent.
 */
export function normalizeTeamAbbr(team: string, sport: 'nba' | 'nfl'): string {
  const map = sport === 'nba' ? NBA_ABBR : NFL_ABBR;
  return team
    .split('/')
    .map(seg => normOne(seg.trim(), map))
    .join('/');
}
