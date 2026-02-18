/**
 * careerPrefetch.ts — Background prefetch cache for Career mode.
 *
 * While a player is mid-game, silently fetches a couple of random players
 * so "Play Again" loads instantly. Both CareerGamePage and CareerResultsPage
 * consume from this cache.
 */

import type { Sport } from '../types';
import type { CareerGameData } from '../stores/careerStore';
import { fetchRandomCareerPlayer, fetchCareerStats } from './api';
import { fetchNFLRandomCareerPlayer, fetchNFLCareerStats } from './nfl-api';

export interface CareerFilters {
  careerFrom?: number;
  careerTo?: number;
}

interface PrefetchedGame {
  data: CareerGameData;
  sport: Sport;
}

const _cache: PrefetchedGame[] = [];
let _prefetching = false;
const PREFETCH_COUNT = 2;

/** Build a CareerGameData from raw NBA API responses. */
function buildNBAGame(player: { player_id: number; player_name: string }, career: any): PrefetchedGame | null {
  if (!career || career.seasons.length < 2) return null;
  return {
    sport: 'nba',
    data: {
      playerId: career.player_id,
      playerName: player.player_name,
      position: '',
      seasons: career.seasons,
      bio: {
        height: career.bio.height,
        weight: career.bio.weight,
        school: career.bio.school,
        exp: career.bio.exp,
        draftYear: career.bio.draft_year,
      },
    },
  };
}

/** Build a CareerGameData from raw NFL API responses. */
function buildNFLGame(career: any): PrefetchedGame | null {
  if (!career || career.seasons.length < 2) return null;
  return {
    sport: 'nfl',
    data: {
      playerId: career.player_id,
      playerName: career.player_name,
      position: career.position,
      seasons: career.seasons,
      bio: {
        height: career.bio.height,
        weight: career.bio.weight,
        school: '',
        exp: career.bio.years_exp,
        college: career.bio.college,
        yearsExp: career.bio.years_exp,
        draftClub: career.bio.draft_club,
        draftNumber: career.bio.draft_number,
      },
    },
  };
}

async function fetchOneGame(sport: Sport, filters?: CareerFilters): Promise<PrefetchedGame | null> {
  try {
    if (sport === 'nba') {
      const player = await fetchRandomCareerPlayer(filters);
      if (!player) return null;
      const career = await fetchCareerStats(player.player_id);
      return buildNBAGame(player, career);
    } else {
      const player = await fetchNFLRandomCareerPlayer(undefined, filters);
      if (!player) return null;
      const career = await fetchNFLCareerStats(player.player_id);
      return buildNFLGame(career);
    }
  } catch {
    return null;
  }
}

/**
 * Start prefetching games in the background for the given sport.
 * Safe to call multiple times — will not duplicate work.
 */
export function startPrefetch(sport: Sport): void {
  if (_prefetching) return;
  _prefetching = true;

  (async () => {
    // Fill cache up to PREFETCH_COUNT for the requested sport
    const needed = PREFETCH_COUNT - _cache.filter((g) => g.sport === sport).length;
    for (let i = 0; i < needed; i++) {
      const game = await fetchOneGame(sport);
      if (game) _cache.push(game);
    }
    _prefetching = false;
  })();
}

/**
 * Pop a prefetched game from the cache for the given sport.
 * Returns null if nothing cached — caller should fall back to live fetch.
 */
export function popPrefetched(sport: Sport): PrefetchedGame | null {
  const idx = _cache.findIndex((g) => g.sport === sport);
  if (idx === -1) return null;
  return _cache.splice(idx, 1)[0];
}

/**
 * Fetch a game — tries cache first (unless filters are active), falls back to live fetch.
 * After returning, kicks off another prefetch to refill the cache.
 */
export async function getNextGame(sport: Sport, filters?: CareerFilters): Promise<PrefetchedGame | null> {
  const hasFilters = filters && (filters.careerFrom || filters.careerTo);
  // Skip prefetch cache when era filters are active — cache has no filter awareness
  const cached = hasFilters ? null : popPrefetched(sport);
  // Always refill in background
  startPrefetch(sport);
  if (cached) return cached;
  // Cache miss (or filtered) — live fetch
  return fetchOneGame(sport, hasFilters ? filters : undefined);
}
