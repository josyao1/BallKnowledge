import { mulberry32 } from '../utils/seededRng';
import type { StatCategory, HWFilter, SelectedPlayer } from '../types/capCrunch';
import type { Sport } from '../types';
import {
  NBA_STAT_CATEGORIES,
  NFL_STAT_WEIGHTS,
  NBA_TEAMS,
  NFL_TEAMS,
  NFL_DIVISIONS,
  P4_CONFERENCES,
} from './capCrunchData';
import {
  isCareerStat,
  isDivisionRound,
  isConferenceRound,
  isDivisionDraftRound,
  classifySpecialRoundType,
  advanceSpecialRoundCycle,
  computePerfectDailyLineup,
} from './capCrunch';
import type { SpecialRoundType, PerfectPick } from './capCrunch';

export type { PerfectPick };
import { supabase } from '../lib/supabase';
import { getAuthPlayerId } from '../lib/supabase';

// Day 1 = June 22 2026 UTC midnight
const LAUNCH_DATE_UTC_MS = Date.UTC(2026, 5, 22); // months are 0-indexed

export function getDayNumber(): number {
  const now = Date.now();
  return Math.max(1, Math.floor((now - LAUNCH_DATE_UTC_MS) / 86400000) + 1);
}

/** UTC midnight for the next day, used to compute countdown. */
export function getNextResetMs(): number {
  const now = Date.now();
  const daysSinceLaunch = Math.floor((now - LAUNCH_DATE_UTC_MS) / 86400000);
  return LAUNCH_DATE_UTC_MS + (daysSinceLaunch + 1) * 86400000;
}

export interface DailyRoundFilter {
  team: string;
  hwFilter: HWFilter | null;
}

export interface DailyPuzzle {
  dayNumber: number;
  sport: Sport;
  statCategory: StatCategory;
  targetCap: number;
  roundFilters: DailyRoundFilter[];
}

export interface DailyEntry {
  id?: string;
  day_number: number;
  player_id: string;
  player_name: string;
  sport: Sport;
  total_stat: number;
  target_cap: number;
  distance: number;
  time_taken_ms: number;
  picks: SelectedPlayer[];
  submitted_at?: string;
}

// ─── Seeded puzzle generation ─────────────────────────────────────────────────

function seededPickFrom<T>(pool: T[], exclude: T[], rng: () => number): T {
  const available = pool.filter((x) => !exclude.includes(x));
  const source = available.length > 0 ? available : pool;
  return source[Math.floor(rng() * source.length)];
}

function seededPickNFLConf(rng: () => number): string {
  return rng() < 0.5 ? 'AFC' : 'NFC';
}

function seededPickNBAConf(rng: () => number): string {
  return rng() < 0.5 ? 'East' : 'West';
}

function generateDailyTeam(
  sport: Sport,
  statCategory: StatCategory,
  usedTeams: string[],
  usedSpecialTypes: SpecialRoundType[],
  rng: () => number,
): string {
  const isCareer = isCareerStat(statCategory);
  const isTotalGP = statCategory === 'total_gp';

  if (sport === 'nfl' && !isCareer && !isTotalGP) {
    const roll = rng();
    if (roll < 0.1) {
      if (!usedSpecialTypes.includes('division_draft')) {
        const divKeys = Object.keys(NFL_DIVISIONS);
        const div = seededPickFrom(divKeys, usedTeams, rng);
        const rounds = ['R1', 'R23', 'R47'] as const;
        return `${div}|${rounds[Math.floor(rng() * 3)]}`;
      }
    } else if (roll < 0.2) {
      if (!usedSpecialTypes.includes('division')) {
        const divKeys = Object.keys(NFL_DIVISIONS);
        return seededPickFrom(divKeys, usedTeams, rng);
      }
    } else if (roll < 0.3) {
      if (!usedSpecialTypes.includes('conference')) {
        const confs = [...Object.keys(P4_CONFERENCES), 'Non-P4'];
        const college = seededPickFrom(confs, [], rng);
        return `${college}|${seededPickNFLConf(rng)}`;
      }
    }
  }

  if (sport === 'nba' && !isTotalGP && !usedSpecialTypes.includes('conference') && rng() < 0.15) {
    const confs = [...Object.keys(P4_CONFERENCES), 'Non-P4'];
    const college = seededPickFrom(confs, [], rng);
    return `${college}|${seededPickNBAConf(rng)}`;
  }

  const allTeams = sport === 'nba' ? NBA_TEAMS : NFL_TEAMS;
  return seededPickFrom(allTeams, usedTeams, rng);
}

function generateDailyHWFilter(
  team: string,
  statCategory: StatCategory,
  usedSpecialTypes: SpecialRoundType[],
  rng: () => number,
): HWFilter | null {
  if (isDivisionRound(team) || isConferenceRound(team) || isDivisionDraftRound(team)) return null;
  if (statCategory === 'total_gp' || isCareerStat(statCategory)) return null;
  if (usedSpecialTypes.includes('hw_filter')) return null;
  if (rng() > 0.15) return null;
  const filters: HWFilter[] = ['height_above', 'height_below', 'weight_above', 'weight_below'];
  return filters[Math.floor(rng() * filters.length)];
}

function generateDailyStatCategory(sport: Sport, rng: () => number): StatCategory {
  if (sport === 'nba') {
    return NBA_STAT_CATEGORIES[Math.floor(rng() * NBA_STAT_CATEGORIES.length)];
  }
  const total = NFL_STAT_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let rand = rng() * total;
  for (const { category, weight } of NFL_STAT_WEIGHTS) {
    rand -= weight;
    if (rand <= 0) return category;
  }
  return 'rushing_yards';
}

function generateDailyTargetCap(sport: Sport, statCategory: StatCategory, rng: () => number): number {
  const r = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

  if (sport === 'nba') {
    switch (statCategory) {
      case 'pts': return r(75, 120);
      case 'ast': return r(22, 40);
      case 'reb': return r(30, 50);
      case 'min': return r(130, 175);
      case 'pra': return r(120, 225);
      case 'total_pts': return r(3500, 10000);
      case 'total_reb': return r(2000, 4000);
      case 'total_ast': return r(900, 3000);
      case 'total_blk': return r(200, 1050);
      case 'total_3pm': return r(100, 2000);
      case 'total_ftm': return r(200, 2100);
      case 'total_pf': return r(600, 1500);
      case 'total_gp': return r(700, 2000);
      default: return 100;
    }
  } else {
    switch (statCategory) {
      case 'passing_yards': return r(12000, 20000);
      case 'passing_tds': return r(80, 140);
      case 'interceptions': return r(25, 55);
      case 'rushing_yards': return r(4000, 7500);
      case 'rushing_tds': return r(35, 65);
      case 'receiving_yards': return r(3500, 6000);
      case 'receiving_tds': return r(28, 50);
      case 'receptions': return r(220, 500);
      case 'fpts': return r(650, 1750);
      case 'total_gp': return r(225, 450);
      case 'career_passing_yards': return r(55000, 184000);
      case 'career_passing_tds': return r(300, 800);
      case 'career_rushing_yards': return r(18000, 51000);
      case 'career_rushing_tds': return r(130, 450);
      case 'career_receiving_yards': return r(18000, 51000);
      case 'career_receiving_tds': return r(130, 450);
      default: return 500;
    }
  }
}

export function generateDailyPuzzle(sport: Sport, dayNumber: number): DailyPuzzle {
  // Separate seeds per sport so NBA and NFL produce different puzzles each day
  const sportOffset = sport === 'nba' ? 0 : 999983;
  const seed = ((dayNumber * 1000003 + sportOffset) >>> 0);
  const rng = mulberry32(seed);

  const statCategory = generateDailyStatCategory(sport, rng);
  const targetCap = generateDailyTargetCap(sport, statCategory, rng);

  const roundFilters: DailyRoundFilter[] = [];
  let usedSpecialTypes: SpecialRoundType[] = [];
  const usedTeams: string[] = [];

  for (let i = 0; i < 5; i++) {
    const team = generateDailyTeam(sport, statCategory, usedTeams, usedSpecialTypes, rng);
    const hwFilter = generateDailyHWFilter(team, statCategory, usedSpecialTypes, rng);
    const roundType = classifySpecialRoundType(team, hwFilter);
    usedSpecialTypes = advanceSpecialRoundCycle(usedSpecialTypes, roundType);
    usedTeams.push(team);
    roundFilters.push({ team, hwFilter });
  }

  return { dayNumber, sport, statCategory, targetCap, roundFilters };
}

// ─── Supabase operations ──────────────────────────────────────────────────────

export async function submitDailyEntry(
  entry: Omit<DailyEntry, 'id' | 'submitted_at'>,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const { error } = await supabase
    .from('daily_cap_crunch_entries')
    .upsert(entry, { onConflict: 'day_number,player_id,sport', ignoreDuplicates: false });
  return { error: error?.message ?? null };
}

export async function getExistingEntry(
  dayNumber: number,
  sport: Sport,
): Promise<DailyEntry | null> {
  if (!supabase) return null;
  const playerId = await getAuthPlayerId();
  if (!playerId) return null;
  const { data } = await supabase
    .from('daily_cap_crunch_entries')
    .select('*')
    .eq('day_number', dayNumber)
    .eq('player_id', playerId)
    .eq('sport', sport)
    .maybeSingle();
  return data ?? null;
}

export async function fetchDailyLeaderboard(
  dayNumber: number,
  sport: Sport,
): Promise<DailyEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('daily_cap_crunch_entries')
    .select('id, day_number, player_id, player_name, sport, total_stat, target_cap, distance, time_taken_ms, picks, submitted_at')
    .eq('day_number', dayNumber)
    .eq('sport', sport)
    .order('distance', { ascending: true })
    .order('time_taken_ms', { ascending: true })
    .limit(100);
  if (error) return [];
  return (data ?? []) as DailyEntry[];
}

// ─── Perfect lineup (cached per session) ─────────────────────────────────────

const _perfectCache = new Map<string, PerfectPick[] | null>();

export async function getPerfectLineup(
  dayNumber: number,
  sport: Sport,
  statCategory: StatCategory,
  targetCap: number,
  filters: DailyRoundFilter[],
): Promise<PerfectPick[] | null> {
  const key = `${dayNumber}_${sport}_${statCategory}`;
  if (_perfectCache.has(key)) return _perfectCache.get(key)!;
  const result = await computePerfectDailyLineup(sport, statCategory, targetCap, filters);
  _perfectCache.set(key, result);
  return result;
}

export function getStoredPlayerName(): string | null {
  try {
    return localStorage.getItem('ballknowledge_player_name');
  } catch {
    return null;
  }
}

export function setStoredPlayerName(name: string): void {
  try {
    localStorage.setItem('ballknowledge_player_name', name);
  } catch {}
}
