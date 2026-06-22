/**
 * nflAwards.ts — Hardcoded NFL AP award voting results.
 *
 * Keyed by NFL *season* year (e.g. 2024 = the 2024 season, whose awards were
 * announced in February 2025 — listed on PFR as awards_2025.htm).
 *
 * stat field = voting rank (1 = winner). formatStat() renders it as "#1" etc.
 * Entries are pre-ordered rank-ascending so slot 1 on the board = rank 1.
 */

export interface AwardEntry {
  name: string;
  team: string; // NFL team abbreviation matching nfl-teams.ts
  rank: number;
}

export interface YearAwards {
  MVP: AwardEntry[];
  OPOY: AwardEntry[];
  OROY: AwardEntry[];
}

export const NFL_AWARDS: Record<number, YearAwards> = {
  // PFR awards_2022.htm → 2022 NFL season
  2022: {
    MVP: [
      { rank: 1, name: 'Patrick Mahomes', team: 'KC' },
      { rank: 2, name: 'Jalen Hurts', team: 'PHI' },
      { rank: 3, name: 'Josh Allen', team: 'BUF' },
      { rank: 4, name: 'Joe Burrow', team: 'CIN' },
      { rank: 5, name: 'Justin Jefferson', team: 'MIN' },
      { rank: 6, name: 'Nick Bosa', team: 'SF' },
      { rank: 7, name: 'Trevor Lawrence', team: 'JAX' },
      { rank: 8, name: 'Micah Parsons', team: 'DAL' },
      { rank: 9, name: 'A.J. Brown', team: 'PHI' },
      { rank: 10, name: 'Justin Fields', team: 'CHI' },
    ],
    OPOY: [
      { rank: 1, name: 'Justin Jefferson', team: 'MIN' },
      { rank: 2, name: 'Patrick Mahomes', team: 'KC' },
      { rank: 3, name: 'Jalen Hurts', team: 'PHI' },
      { rank: 4, name: 'Tyreek Hill', team: 'MIA' },
      { rank: 5, name: 'Josh Jacobs', team: 'LV' },
      { rank: 6, name: 'Travis Kelce', team: 'KC' },
      { rank: 7, name: 'Christian McCaffrey', team: 'SF' }, // traded CAR→SF mid-season
      { rank: 8, name: 'Josh Allen', team: 'BUF' },
      { rank: 9, name: 'Joe Burrow', team: 'CIN' },
      { rank: 10, name: 'Austin Ekeler', team: 'LAC' },
    ],
    OROY: [
      { rank: 1, name: 'Garrett Wilson', team: 'NYJ' },
      { rank: 2, name: 'Kenneth Walker III', team: 'SEA' },
      { rank: 3, name: 'Brock Purdy', team: 'SF' },
      { rank: 4, name: 'Chris Olave', team: 'NO' },
      { rank: 5, name: 'Tyler Allgeier', team: 'ATL' },
      { rank: 6, name: 'Kenny Pickett', team: 'PIT' },
      { rank: 7, name: 'Tyler Linderbaum', team: 'BAL' },
      { rank: 8, name: 'Christian Watson', team: 'GB' },
      { rank: 9, name: 'Dameon Pierce', team: 'HOU' },
      { rank: 10, name: 'Isiah Pacheco', team: 'KC' },
    ],
  },

  // PFR awards_2023.htm → 2023 NFL season
  2023: {
    MVP: [
      { rank: 1, name: 'Lamar Jackson', team: 'BAL' },
      { rank: 2, name: 'Dak Prescott', team: 'DAL' },
      { rank: 3, name: 'Christian McCaffrey', team: 'SF' },
      { rank: 4, name: 'Brock Purdy', team: 'SF' },
      { rank: 5, name: 'Josh Allen', team: 'BUF' },
      { rank: 6, name: 'Tyreek Hill', team: 'MIA' },
      { rank: 7, name: 'Patrick Mahomes', team: 'KC' },
      { rank: 8, name: 'Matthew Stafford', team: 'LAR' },
      { rank: 9, name: 'C.J. Stroud', team: 'HOU' },
      { rank: 10, name: 'Myles Garrett', team: 'CLE' },
    ],
    OPOY: [
      { rank: 1, name: 'Christian McCaffrey', team: 'SF' },
      { rank: 2, name: 'Tyreek Hill', team: 'MIA' },
      { rank: 3, name: 'CeeDee Lamb', team: 'DAL' },
      { rank: 4, name: 'Lamar Jackson', team: 'BAL' },
      { rank: 5, name: 'Dak Prescott', team: 'DAL' },
      { rank: 6, name: 'Josh Allen', team: 'BUF' },
      { rank: 7, name: 'Brock Purdy', team: 'SF' },
      { rank: 8, name: 'Travis Etienne', team: 'JAX' },
    ],
    OROY: [
      { rank: 1, name: 'C.J. Stroud', team: 'HOU' },
      { rank: 2, name: 'Puka Nacua', team: 'LAR' },
      { rank: 3, name: 'Sam LaPorta', team: 'DET' },
      { rank: 4, name: 'Jahmyr Gibbs', team: 'DET' },
      { rank: 5, name: 'Bijan Robinson', team: 'ATL' },
      { rank: 6, name: 'Zay Flowers', team: 'BAL' },
      { rank: 7, name: 'Jayden Reed', team: 'GB' },
      { rank: 8, name: 'Rashee Rice', team: 'KC' },
    ],
  },

  // PFR awards_2024.htm → 2024 NFL season
  2024: {
    MVP: [
      { rank: 1, name: 'Josh Allen', team: 'BUF' },
      { rank: 2, name: 'Lamar Jackson', team: 'BAL' },
      { rank: 3, name: 'Saquon Barkley', team: 'PHI' },
      { rank: 4, name: 'Joe Burrow', team: 'CIN' },
      { rank: 5, name: 'Jared Goff', team: 'DET' },
      { rank: 6, name: 'Patrick Mahomes', team: 'KC' },
      { rank: 7, name: 'Jayden Daniels', team: 'WAS' },
      { rank: 8, name: "Ja'Marr Chase", team: 'CIN' },
      { rank: 9, name: 'Justin Herbert', team: 'LAC' },
      { rank: 10, name: 'Sam Darnold', team: 'MIN' },
    ],
    OPOY: [
      { rank: 1, name: 'Saquon Barkley', team: 'PHI' },
      { rank: 2, name: 'Lamar Jackson', team: 'BAL' },
      { rank: 3, name: "Ja'Marr Chase", team: 'CIN' },
      { rank: 4, name: 'Derrick Henry', team: 'BAL' },
      { rank: 5, name: 'Joe Burrow', team: 'CIN' },
      { rank: 6, name: 'Josh Allen', team: 'BUF' },
      { rank: 7, name: 'Justin Jefferson', team: 'MIN' },
      { rank: 8, name: 'Jahmyr Gibbs', team: 'DET' },
      { rank: 9, name: 'Jared Goff', team: 'DET' },
      { rank: 10, name: 'Joe Thuney', team: 'KC' },
    ],
    OROY: [
      { rank: 1, name: 'Jayden Daniels', team: 'WAS' },
      { rank: 2, name: 'Brock Bowers', team: 'LV' },
      { rank: 3, name: 'Bo Nix', team: 'DEN' },
      { rank: 4, name: 'Brian Thomas', team: 'JAX' },
      { rank: 5, name: 'Malik Nabers', team: 'NYG' },
      { rank: 6, name: 'Bucky Irving', team: 'TB' },
      { rank: 7, name: 'Joe Alt', team: 'LAC' },
      { rank: 8, name: 'Drake Maye', team: 'NE' },
      { rank: 9, name: 'Ladd McConkey', team: 'LAC' },
      { rank: 10, name: 'Caleb Williams', team: 'CHI' },
    ],
  },

  // PFR awards_2025.htm → 2025 NFL season
  2025: {
    MVP: [
      { rank: 1, name: 'Matthew Stafford', team: 'LAR' },
      { rank: 2, name: 'Drake Maye', team: 'NE' },
      { rank: 3, name: 'Josh Allen', team: 'BUF' },
      { rank: 4, name: 'Christian McCaffrey', team: 'SF' },
      { rank: 5, name: 'Trevor Lawrence', team: 'JAX' },
      { rank: 6, name: 'Justin Herbert', team: 'LAC' },
    ],
    OPOY: [
      { rank: 1, name: 'Jaxon Smith-Njigba', team: 'SEA' },
      { rank: 2, name: 'Christian McCaffrey', team: 'SF' },
      { rank: 3, name: 'Puka Nacua', team: 'LAR' },
      { rank: 4, name: 'Bijan Robinson', team: 'ATL' },
      { rank: 5, name: 'Drake Maye', team: 'NE' },
      { rank: 6, name: 'Josh Allen', team: 'BUF' },
      { rank: 7, name: 'Trey McBride', team: 'ARI' },
      { rank: 8, name: 'Matthew Stafford', team: 'LAR' },
    ],
    OROY: [
      { rank: 1, name: 'Tetairoa McMillan', team: 'CAR' },
      { rank: 2, name: 'Tyler Shough', team: 'NO' },
      { rank: 3, name: 'TreVeyon Henderson', team: 'NE' },
      { rank: 4, name: 'Jaxson Dart', team: 'NYG' },
      { rank: 5, name: 'Emeka Egbuka', team: 'TB' },
      { rank: 6, name: 'Grey Zabel', team: 'SEA' },
    ],
  },
};

export type AwardKey = 'MVP' | 'OPOY' | 'OROY';

export const AWARD_CATEGORY_KEYS: Record<string, AwardKey> = {
  award_mvp: 'MVP',
  award_opoy: 'OPOY',
  award_oroy: 'OROY',
};

/** Returns entries for a given award category + season year, or [] if not found. */
export function getAwardEntries(categoryKey: string, seasonYear: number): AwardEntry[] {
  const awardKey = AWARD_CATEGORY_KEYS[categoryKey];
  if (!awardKey) return [];
  return NFL_AWARDS[seasonYear]?.[awardKey] ?? [];
}

/** All season years that have award data (for year-range filtering). */
export function getAwardYears(): number[] {
  return Object.keys(NFL_AWARDS)
    .map(Number)
    .sort((a, b) => a - b);
}
