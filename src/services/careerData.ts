/**
 * careerData.ts — Static career data loader.
 *
 * Fetches nba_careers.json / nfl_careers.json from Vercel static assets once
 * per session, caches in memory, and exposes random selection + lookup.
 * No backend required — replaces all /career/* API calls.
 *
 * Both loaders return a Promise that is shared across all callers, so the
 * JSON is only ever fetched once regardless of how many concurrent callers.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface NBASeason {
  season: string;   // e.g. "2003-04"
  team: string;
  gp: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg_pct: number;
  fg3_pct: number;
}

interface NFLSeason {
  season: string;   // e.g. "2010"
  team: string;
  gp: number;
  [key: string]: any;
}

export interface NBACareerPlayer {
  player_id: number;
  player_name: string;
  seasons: NBASeason[];
  bio: {
    height: string;
    weight: number;
    school: string;
    exp: number;
    draft_year: number;
  };
}

export interface NFLCareerPlayer {
  player_id: string;
  player_name: string;
  position: string;
  seasons: NFLSeason[];
  bio: {
    height: string;
    weight: number;
    college: string;
    years_exp: number;
    draft_club: string;
    draft_number: number;
  };
}

export interface CareerFilters {
  careerFrom?: number;
  careerTo?: number;
}

export interface ScrambleFilters {
  careerTo?: number;
}

// ─── Lazy loaders (promise shared across all callers) ─────────────────────────

let _nbaPromise: Promise<NBACareerPlayer[]> | null = null;
let _nflPromise: Promise<NFLCareerPlayer[]> | null = null;
let _nflLineupPoolPromise: Promise<NFLCareerPlayer[]> | null = null;
let _nflDefensiveNamesPromise: Promise<string[]> | null = null;

function loadNFLDefensiveNames(): Promise<string[]> {
  if (!_nflDefensiveNamesPromise) {
    _nflDefensiveNamesPromise = fetch('/data/nfl_defensive_names.json')
      .then(r => { if (!r.ok) throw new Error('Failed to load NFL defensive names'); return r.json(); })
      .catch(err => { _nflDefensiveNamesPromise = null; throw err; });
  }
  return _nflDefensiveNamesPromise;
}

export function loadNBACareers(): Promise<NBACareerPlayer[]> {
  if (!_nbaPromise) {
    _nbaPromise = fetch('/data/nba_careers.json')
      .then(r => { if (!r.ok) throw new Error('Failed to load NBA careers'); return r.json(); })
      .catch(err => { _nbaPromise = null; throw err; }); // reset on failure so it can be retried
  }
  return _nbaPromise;
}

export function loadNFLCareers(): Promise<NFLCareerPlayer[]> {
  if (!_nflPromise) {
    _nflPromise = fetch('/data/nfl_careers.json')
      .then(r => { if (!r.ok) throw new Error('Failed to load NFL careers'); return r.json(); })
      .catch(err => { _nflPromise = null; throw err; });
  }
  return _nflPromise;
}

/** Merge seasons from two player records, union by season year (later file wins per year). */
function mergeNFLPlayer(base: NFLCareerPlayer, incoming: NFLCareerPlayer): NFLCareerPlayer {
  const seasonMap = new Map<string, NFLSeason>();
  base.seasons.forEach(s => seasonMap.set(s.season, s));
  incoming.seasons.forEach(s => seasonMap.set(s.season, s));  // incoming wins on same year
  return {
    ...incoming,  // use incoming bio/position (more recent)
    seasons: Array.from(seasonMap.values()).sort((a, b) => a.season.localeCompare(b.season)),
  };
}

/**
 * Extended NFL player pool for Lineup Is Right.
 * Merges nfl_careers.json with nfl_lineup_pool.json, which includes current
 * players who don't yet meet the 5-season / career-yards thresholds
 * (e.g. Bijan Robinson, Drake London). Seasons are unioned per player so no
 * data is lost when the same player appears in both files.
 * Falls back gracefully if nfl_lineup_pool.json hasn't been generated yet.
 */
export function loadNFLLineupPool(): Promise<NFLCareerPlayer[]> {
  if (!_nflLineupPoolPromise) {
    _nflLineupPoolPromise = Promise.all([
      fetch('/data/nfl_careers.json')
        .then(r => { if (!r.ok) throw new Error('Failed to load nfl_careers.json'); return r.json(); }),
      fetch('/data/nfl_lineup_pool.json')
        .then(r => r.ok ? r.json() : [] as NFLCareerPlayer[])
        .catch(() => [] as NFLCareerPlayer[]),  // pool file optional — falls back to empty
    ])
    .then(([base, pool]: [NFLCareerPlayer[], NFLCareerPlayer[]]) => {
      const map = new Map<string, NFLCareerPlayer>();
      base.forEach(p => map.set(p.player_id, p));
      pool.forEach(p => {
        const existing = map.get(p.player_id);
        // If player is in both files, union their seasons rather than clobbering
        map.set(p.player_id, existing ? mergeNFLPlayer(existing, p) : p);
      });
      return Array.from(map.values());
    })
    .catch(err => { _nflLineupPoolPromise = null; throw err; });
  }
  return _nflLineupPoolPromise;
}

/** Call this early (e.g. on homepage load) to warm the cache before career mode is entered. */
export function warmCareerCache(sport: 'nba' | 'nfl'): void {
  if (sport === 'nba') loadNBACareers().catch(() => {});
  else loadNFLCareers().catch(() => {});
}

// ─── Era filtering helpers ────────────────────────────────────────────────────

function nbaStartYear(p: NBACareerPlayer): number {
  const years = p.seasons.map(s => parseInt(s.season)).filter(Boolean);
  return years.length ? Math.min(...years) : 0;
}

function nbaEndYear(p: NBACareerPlayer): number {
  const years = p.seasons.map(s => parseInt(s.season)).filter(Boolean);
  return years.length ? Math.max(...years) : 0;
}

function nflStartYear(p: NFLCareerPlayer): number {
  const years = p.seasons.map(s => parseInt(s.season)).filter(Boolean);
  return years.length ? Math.min(...years) : 0;
}

function nflEndYear(p: NFLCareerPlayer): number {
  const years = p.seasons.map(s => parseInt(s.season)).filter(Boolean);
  return years.length ? Math.max(...years) : 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pick a random NBA career player, optionally filtered by era.
 * Returns the full player object (seasons + bio) — no second fetch needed.
 */
export async function getRandomNBACareer(
  filters?: CareerFilters
): Promise<NBACareerPlayer | null> {
  const all = await loadNBACareers();
  let pool = all;
  if (filters?.careerFrom) pool = pool.filter(p => nbaStartYear(p) >= filters.careerFrom!);
  if (filters?.careerTo)   pool = pool.filter(p => nbaEndYear(p)   >= filters.careerTo!);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Name Scramble eligibility ────────────────────────────────────────────────

const NFL_YARDS_THRESHOLD = { QB: 4000, RB: 1500, WR: 1500, TE: 1500 } as const;

function getMostRecentNBAYear(all: NBACareerPlayer[]): number {
  return Math.max(0, ...all.flatMap(p => p.seasons.map(s => parseInt(s.season)).filter(Boolean)));
}

function getMostRecentNFLYear(all: NFLCareerPlayer[]): number {
  return Math.max(0, ...all.flatMap(p => p.seasons.map(s => parseInt(s.season)).filter(Boolean)));
}

function isNBAScrambleEligible(p: NBACareerPlayer, mostRecentYear: number): boolean {
  return p.seasons.length >= 7 || nbaEndYear(p) >= mostRecentYear;
}

function getNFLCareerYards(p: NFLCareerPlayer): number {
  const pos = p.position?.toUpperCase();
  return p.seasons.reduce((sum, s) => {
    if (pos === 'QB') return sum + (Number(s.passing_yards) || 0);
    if (pos === 'RB') return sum + (Number(s.rushing_yards) || 0) + (Number(s.receiving_yards) || 0);
    if (pos === 'WR' || pos === 'TE') return sum + (Number(s.receiving_yards) || 0);
    return sum;
  }, 0);
}

function isNFLScrambleEligible(p: NFLCareerPlayer, mostRecentYear: number): boolean {
  const pos = p.position?.toUpperCase() as keyof typeof NFL_YARDS_THRESHOLD;
  if (!NFL_YARDS_THRESHOLD[pos]) return false;
  const yardsOk = getNFLCareerYards(p) >= NFL_YARDS_THRESHOLD[pos];
  const seasonsOk = p.seasons.length >= 5 || nflEndYear(p) >= mostRecentYear;
  return yardsOk && seasonsOk;
}

/** Pick a random NBA player eligible for Name Scramble. */
export async function getRandomNBAScramblePlayer(
  filters?: ScrambleFilters
): Promise<NBACareerPlayer | null> {
  const all = await loadNBACareers();
  const mostRecentYear = getMostRecentNBAYear(all);
  let pool = all.filter(p => isNBAScrambleEligible(p, mostRecentYear));
  if (filters?.careerTo) pool = pool.filter(p => nbaEndYear(p) >= filters.careerTo!);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Pick a random NFL player eligible for Name Scramble (offensive + notable defensive). */
export async function getRandomNFLScramblePlayer(
  filters?: ScrambleFilters
): Promise<{ player_name: string } | null> {
  const [all, defensiveNames] = await Promise.all([
    loadNFLCareers(),
    loadNFLDefensiveNames().catch(() => [] as string[]),
  ]);
  const mostRecentYear = getMostRecentNFLYear(all);
  let offensivePool: { player_name: string }[] = all.filter(p => isNFLScrambleEligible(p, mostRecentYear));
  if (filters?.careerTo) offensivePool = offensivePool.filter(p => nflEndYear(p as NFLCareerPlayer) >= filters.careerTo!);
  const defensivePool: { player_name: string }[] = defensiveNames.map(name => ({ player_name: name }));
  const pool = [...offensivePool, ...defensivePool];
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pick a random NFL career player, optionally filtered by position and era.
 * Returns the full player object.
 */
export async function getRandomNFLCareer(
  position?: string,
  filters?: CareerFilters
): Promise<NFLCareerPlayer | null> {
  const all = await loadNFLCareers();
  let pool = all;
  if (position) pool = pool.filter(p => p.position === position.toUpperCase());
  if (filters?.careerFrom) pool = pool.filter(p => nflStartYear(p) >= filters.careerFrom!);
  if (filters?.careerTo)   pool = pool.filter(p => nflEndYear(p)   >= filters.careerTo!);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
