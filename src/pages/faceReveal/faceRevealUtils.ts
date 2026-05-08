import { normalize } from '../../utils/fuzzyDedup';
import type { NBACareerPlayer, NFLCareerPlayer } from '../../services/careerData';
import { DEFENSE_ALLOWLIST } from '../../data/faceRevealDefenseAllowlist';

export interface PlayerEntry {
  player_id: string | number;
  player_name: string;
  position?: string;    // NFL only; used for pick weighting
  longestTeam?: string; // most-season team abbreviation; shown at zoom level 4
}

export const NFL_OFF_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'FB']);
export const NFL_ST_POSITIONS  = new Set(['K', 'P', 'LS']);

/** Team abbreviation a player spent the most seasons with. Slash seasons use the first team. */
export function longestTenuredTeam(seasons: Array<{ team: string }>): string {
  const counts: Record<string, number> = {};
  for (const s of seasons) {
    const team = (s.team || '').split('/')[0].trim();
    if (team) counts[team] = (counts[team] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/** First letter of each space-separated word in uppercase. */
export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase();
}

/** Offensive positions are weighted 3×; all others 1×. */
export function weightedRandom(candidates: PlayerEntry[]): PlayerEntry {
  const total = candidates.reduce((sum, p) =>
    sum + (p.position && NFL_OFF_POSITIONS.has(p.position) ? 3 : 1), 0);
  let r = Math.random() * total;
  for (const p of candidates) {
    r -= p.position && NFL_OFF_POSITIONS.has(p.position) ? 3 : 1;
    if (r <= 0) return p;
  }
  return candidates[candidates.length - 1];
}

/**
 * Returns up to `limit` pool entries whose names match the input.
 * Requires ≥3 characters; scores on full-name prefix (100), every input word
 * matching a name-word prefix (80), or first-token prefix of 3+ chars (60).
 */
export function getSuggestions(input: string, pool: PlayerEntry[], limit = 5): PlayerEntry[] {
  if (input.length < 3) return [];
  const norm = normalize(input);
  const normWords = norm.split(' ').filter(Boolean);

  const scored: { entry: PlayerEntry; score: number }[] = [];
  for (const p of pool) {
    const pNorm = normalize(p.player_name);
    const pWords = pNorm.split(' ');
    if (pNorm.startsWith(norm)) {
      scored.push({ entry: p, score: 100 });
    } else if (normWords.every(iw => pWords.some(pw => pw.startsWith(iw)))) {
      scored.push({ entry: p, score: 80 });
    } else if (normWords[0]?.length >= 3 && pWords[0]?.startsWith(normWords[0])) {
      scored.push({ entry: p, score: 60 });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.entry);
}

/** Last season year from an NBA player's seasons array. */
export function nbaEndYear(p: NBACareerPlayer): number {
  const years = p.seasons.map(s => parseInt(s.season)).filter(Boolean);
  return years.length ? Math.max(...years) : 0;
}

/** Last season year from an NFL player's seasons array. */
export function nflEndYear(p: NFLCareerPlayer): number {
  const years = p.seasons.map(s => parseInt(s.season)).filter(Boolean);
  return years.length ? Math.max(...years) : 0;
}

/**
 * Returns true if this NFL player should be in the Face Reveal pool.
 * K/P/LS are always excluded. Offense requires minYards peak (0 = any).
 * Defense: 'known' = curated DEFENSE_ALLOWLIST only; 'all' = all non-ST.
 */
export function nflInPool(p: NFLCareerPlayer, minYards: number, defenseMode: 'known' | 'all'): boolean {
  if (NFL_ST_POSITIONS.has(p.position)) return false;
  if (NFL_OFF_POSITIONS.has(p.position)) {
    if (minYards === 0) return true;
    return p.seasons.some(
      s => (s.passing_yards || 0) + (s.rushing_yards || 0) + (s.receiving_yards || 0) >= minYards
    );
  }
  return defenseMode === 'all' || DEFENSE_ALLOWLIST.has(String(p.player_id));
}

/** Maps a timer fraction (0–1) to a status color: green → yellow → orange → red. */
export function timerColor(fraction: number): string {
  if (fraction > 0.6) return '#22c55e';
  if (fraction > 0.35) return '#eab308';
  if (fraction > 0.15) return '#f97316';
  return '#ef4444';
}
