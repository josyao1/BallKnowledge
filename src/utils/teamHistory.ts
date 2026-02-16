/**
 * teamHistory.ts — Relocated franchise abbreviation mapping.
 *
 * Some NBA franchises relocated and changed abbreviations (e.g. NJN → BKN,
 * SEA → OKC). The nba_api expects the abbreviation that was in use *during*
 * the requested season, so this module translates our current abbreviations
 * to historical ones based on the season year.
 *
 * NFL translations are handled server-side in nfl_api_server.py.
 * Exports `getApiAbbreviation()`.
 */

interface AbbreviationEra {
  apiAbbr: string;
  fromYear: number; // first season year this abbreviation applies
}

// NBA: our abbreviation → what the API expects by era
const NBA_API_MAP: Record<string, AbbreviationEra[]> = {
  // Brooklyn Nets (2012-13+), previously New Jersey Nets
  BKN: [
    { apiAbbr: 'BKN', fromYear: 2012 },
    { apiAbbr: 'NJN', fromYear: 0 },
  ],
  // Oklahoma City Thunder (2008-09+), previously Seattle SuperSonics
  OKC: [
    { apiAbbr: 'OKC', fromYear: 2008 },
    { apiAbbr: 'SEA', fromYear: 0 },
  ],
  // New Orleans Pelicans (2013-14+), previously New Orleans Hornets
  NOP: [
    { apiAbbr: 'NOP', fromYear: 2013 },
    { apiAbbr: 'NOH', fromYear: 0 },
  ],
  // Memphis Grizzlies (2001-02+), previously Vancouver Grizzlies
  MEM: [
    { apiAbbr: 'MEM', fromYear: 2001 },
    { apiAbbr: 'VAN', fromYear: 0 },
  ],
};

/**
 * Translate our app's team abbreviation to the one the API expects
 * for a given season year. Only applies to NBA — NFL is handled server-side.
 */
export function getApiAbbreviation(
  abbreviation: string,
  year: number,
  sport: 'nba' | 'nfl'
): string {
  if (sport === 'nfl') return abbreviation;

  const eras = NBA_API_MAP[abbreviation];
  if (!eras) return abbreviation;

  for (const era of eras) {
    if (year >= era.fromYear) {
      return era.apiAbbr;
    }
  }

  return abbreviation;
}
