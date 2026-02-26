/**
 * teamLogos.ts — ESPN CDN logo URL helpers.
 *
 * ESPN serves team logos at:
 *   https://a.espncdn.com/i/teamlogos/nba/500/{abbr}.png
 *   https://a.espncdn.com/i/teamlogos/nfl/500/{abbr}.png
 *
 * Handles two translation layers:
 *   1. Historical NBA abbreviations → current franchise (NJN→BKN, SEA→OKC, etc.)
 *   2. Standard abbreviation → ESPN's lowercase format where they differ (NYK→ny, etc.)
 */

// ── Historical NBA abbr → current franchise abbr ─────────────────────────────
const NBA_HISTORICAL_TO_CURRENT: Record<string, string> = {
  NJN: 'BKN',   // Nets moved to Brooklyn 2012
  SEA: 'OKC',   // SuperSonics became Thunder 2008
  NOH: 'NOP',   // Hornets → Pelicans 2013
  NOK: 'NOP',
  VAN: 'MEM',   // Grizzlies moved to Memphis 2001
};

// ── Standard abbr → ESPN CDN slug (NBA) ──────────────────────────────────────
// Most abbreviations pass through as lowercase. These are the exceptions.
const NBA_TO_ESPN: Record<string, string> = {
  GSW:  'gs',
  SAS:  'sa',
  NYK:  'ny',
  NOP:  'no',
  UTA:  'utah',
  WAS:  'wsh',
  PHX:  'phx',
  PHO:  'phx',
};

// ── Standard abbr → ESPN CDN slug (NFL) ──────────────────────────────────────
const NFL_TO_ESPN: Record<string, string> = {
  WAS:  'wsh',   // Washington Commanders
  JAX:  'jax',
};

/**
 * Returns the ESPN CDN URL for a team logo.
 * Returns null for division labels or unknown abbreviations.
 */
export function getTeamLogoUrl(sport: 'nba' | 'nfl', abbr: string): string | null {
  if (!abbr) return null;

  if (sport === 'nba') {
    // Resolve historical abbreviation to current franchise first
    const current = NBA_HISTORICAL_TO_CURRENT[abbr.toUpperCase()] ?? abbr.toUpperCase();
    const espnSlug = NBA_TO_ESPN[current] ?? current.toLowerCase();
    return `https://a.espncdn.com/i/teamlogos/nba/500/${espnSlug}.png`;
  } else {
    const espnSlug = NFL_TO_ESPN[abbr.toUpperCase()] ?? abbr.toLowerCase();
    return `https://a.espncdn.com/i/teamlogos/nfl/500/${espnSlug}.png`;
  }
}
