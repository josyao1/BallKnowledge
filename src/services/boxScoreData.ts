/**
 * boxScoreData.ts — Static box score data loader for the Box Score game mode.
 *
 * Fetches /data/nfl/box_scores/{year}.json from the Vercel CDN once per
 * session per year, caches in memory, and exposes random game selection.
 * No backend required — all data is static JSON.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BoxScorePassingPlayer {
  id: string;
  name: string;
  number: string;
  completions: number;
  attempts: number;
  yards: number;
  tds: number;
  ints: number;
}

export interface BoxScoreRushingPlayer {
  id: string;
  name: string;
  number: string;
  carries: number;
  yards: number;
  tds: number;
}

export interface BoxScoreReceivingPlayer {
  id: string;
  name: string;
  number: string;
  targets: number;
  receptions: number;
  yards: number;
  tds: number;
}

export interface BoxScoreTeam {
  passing: BoxScorePassingPlayer[];
  rushing: BoxScoreRushingPlayer[];
  receiving: BoxScoreReceivingPlayer[];
}

export interface BoxScoreGame {
  game_id: string;
  season: number;
  week: number;
  game_type: string;   // "REG" | "WC" | "DIV" | "CON" | "SB"
  gameday: string;     // "2024-09-05"
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  stadium: string;
  roof: string;
  surface: string;
  temp: number | null;
  wind: number | null;
  overtime: boolean;
  spread_line: number | null;
  home_coach: string;
  away_coach: string;
  referee: string;
  box_score: {
    home: BoxScoreTeam;
    away: BoxScoreTeam;
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export const ALL_BOX_SCORE_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

// Per-season lazy cache — each year fetched at most once per session
const _cache: Record<number, Promise<BoxScoreGame[]>> = {};

// ─── Loaders ──────────────────────────────────────────────────────────────────

export function loadBoxScoreYear(year: number): Promise<BoxScoreGame[]> {
  if (!_cache[year]) {
    _cache[year] = fetch(`/data/nfl/box_scores/${year}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`Box score fetch failed: ${r.status} for ${year}`);
        return r.json() as Promise<BoxScoreGame[]>;
      })
      .catch(err => {
        // Remove from cache so a retry is possible
        delete _cache[year];
        throw err;
      });
  }
  return _cache[year];
}

export interface BoxScoreFilters {
  years?: number[];    // subset of ALL_BOX_SCORE_YEARS; defaults to all
  team?: string | null; // e.g. "KC" — either team in the game; null = any
}

/**
 * Pick one game uniformly at random from all qualifying games across the
 * requested years. Fetches only the year files that are needed.
 */
export async function getRandomBoxScoreGame(filters: BoxScoreFilters = {}): Promise<BoxScoreGame> {
  const years = (filters.years && filters.years.length > 0)
    ? filters.years
    : ALL_BOX_SCORE_YEARS;

  const pools = await Promise.all(years.map(loadBoxScoreYear));
  let games = pools.flat();

  if (filters.team) {
    const t = filters.team.toUpperCase();
    games = games.filter(g => g.home_team === t || g.away_team === t);
  }

  if (games.length === 0) {
    throw new Error('No box score games found for the selected filters.');
  }

  return games[Math.floor(Math.random() * games.length)];
}

/** Count total qualifying games for given filters (without loading full data). */
export async function countBoxScoreGames(filters: BoxScoreFilters = {}): Promise<number> {
  const years = (filters.years && filters.years.length > 0)
    ? filters.years
    : ALL_BOX_SCORE_YEARS;

  const pools = await Promise.all(years.map(loadBoxScoreYear));
  let games = pools.flat();

  if (filters.team) {
    const t = filters.team.toUpperCase();
    games = games.filter(g => g.home_team === t || g.away_team === t);
  }

  return games.length;
}

/** All unique player entries across all three categories for a given side. */
export function allPlayersInGame(game: BoxScoreGame): Array<{ id: string; name: string; side: 'home' | 'away' }> {
  const seen = new Set<string>();
  const result: Array<{ id: string; name: string; side: 'home' | 'away' }> = [];

  for (const side of ['home', 'away'] as const) {
    const team = game.box_score[side];
    for (const cat of [team.passing, team.rushing, team.receiving]) {
      for (const p of cat) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          result.push({ id: p.id, name: p.name, side });
        }
      }
    }
  }

  return result;
}
