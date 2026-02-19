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

// ─── Lazy loaders (promise shared across all callers) ─────────────────────────

let _nbaPromise: Promise<NBACareerPlayer[]> | null = null;
let _nflPromise: Promise<NFLCareerPlayer[]> | null = null;

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
