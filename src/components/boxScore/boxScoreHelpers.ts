/**
 * boxScoreHelpers.ts — Shared pure utilities for Box Score game mode.
 * Used by BoxScoreGamePage (solo) and MultiplayerBoxScorePage.
 */

import { nflTeams } from '../../data/nfl-teams';
import { areSimilarNames, normalize } from '../../utils/fuzzyDedup';

export const GAME_TYPE_LABELS: Record<string, string> = {
  REG: 'Regular Season', WC: 'Wild Card', DIV: 'Divisional',
  CON: 'Conf. Championship', SB: 'Super Bowl',
};

export function getTeamColor(abbr: string): string {
  return nflTeams.find(t => t.abbreviation === abbr)?.colors.primary ?? '#4a4a4a';
}

export function getLogoUrl(abbr: string): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;
}

/** Strip ".0" from jersey numbers stored as floats in parquet */
export function cleanJersey(n: string): string {
  if (!n) return '';
  const f = parseFloat(n);
  return isNaN(f) ? n : String(Math.round(f));
}

/** "Patrick Mahomes" → "P.M." */
export function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('.') + '.';
}

export function scoreMatch(query: string, name: string): number {
  if (!query || query.length < 2) return 0;
  const q = normalize(query), n = normalize(name);
  if (q === n) return 100;
  if (n.startsWith(q)) return 85;
  if (n.split(' ').some(w => w.startsWith(q) && q.length >= 2)) return 70;
  if (n.includes(q)) return 55;
  if (areSimilarNames(query, name)) return 35;
  return 0;
}

/** Build a stable row key: "{side}_{category}_{index}" */
export function bk(side: 'home' | 'away', cat: string, idx: number): string {
  return `${side}_${cat}_${idx}`;
}
