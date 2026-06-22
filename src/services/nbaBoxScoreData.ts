export interface NBABoxScorePlayer {
  id: string;
  name: string;
  number: string;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
}

export interface NBABoxScoreGame {
  game_id: string;
  season: number; // season start year: 2014 = 2014-15
  game_date: string; // "2014-10-28"
  game_type: string; // "REG" | "PO" | "PI"
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  overtime: boolean;
  box_score: {
    home: NBABoxScorePlayer[];
    away: NBABoxScorePlayer[];
  };
}

export const ALL_NBA_BOX_SCORE_YEARS = [
  2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
];

export const NBA_BOX_SCORE_GAME_TYPE_LABELS: Record<string, string> = {
  REG: 'Regular Season',
  PO: 'Playoffs',
  PI: 'Play-In',
};

const _cache: Record<number, Promise<NBABoxScoreGame[]>> = {};

export function loadNBABoxScoreYear(year: number): Promise<NBABoxScoreGame[]> {
  if (!_cache[year]) {
    _cache[year] = fetch(`/data/nba/box_scores/${year}.json`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`NBA box score fetch failed: ${r.status} for ${year}`);
        return r.json() as Promise<NBABoxScoreGame[]>;
      })
      .catch((err) => {
        delete _cache[year];
        throw err;
      });
  }
  return _cache[year];
}

export interface NBABoxScoreFilters {
  years?: number[];
  team?: string | null;
}

export async function getNBASeasonPlayerPool(year: number): Promise<{ name: string }[]> {
  const games = await loadNBABoxScoreYear(year);
  const seen = new Set<string>();
  const out: { name: string }[] = [];
  for (const g of games)
    for (const p of [...g.box_score.home, ...g.box_score.away])
      if (!seen.has(p.name)) {
        seen.add(p.name);
        out.push({ name: p.name });
      }
  return out;
}

export async function getRandomNBABoxScoreGame(
  filters: NBABoxScoreFilters = {},
): Promise<NBABoxScoreGame> {
  const years = filters.years && filters.years.length > 0 ? filters.years : ALL_NBA_BOX_SCORE_YEARS;

  const pools = await Promise.all(years.map(loadNBABoxScoreYear));
  let games = pools.flat();

  if (filters.team) {
    const t = filters.team.toUpperCase();
    games = games.filter((g) => g.home_team === t || g.away_team === t);
  }

  if (games.length === 0) throw new Error('No NBA box score games found for the selected filters.');

  return games[Math.floor(Math.random() * games.length)];
}
