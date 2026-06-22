/**
 * boxScoreHelpers.ts — Shared pure utilities for Box Score game mode.
 * Used by BoxScoreGamePage (solo) and MultiplayerBoxScorePage.
 */

import { nflTeams } from '../../data/nfl-teams';
import { teams as nbaTeams } from '../../data/teams';
import { areSimilarNames, normalize } from '../../utils/fuzzyDedup';

export const GAME_TYPE_LABELS: Record<string, string> = {
  REG: 'Regular Season',
  WC: 'Wild Card',
  DIV: 'Divisional',
  CON: 'Conf. Championship',
  SB: 'Super Bowl',
};

export function getTeamColor(abbr: string): string {
  return nflTeams.find((t) => t.abbreviation === abbr)?.colors.primary ?? '#4a4a4a';
}

export function getLogoUrl(abbr: string): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const [r, g, b] =
    s === 0 ? [l, l, l] : [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
  return (
    '#' +
    [r, g, b]
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Ensure a hex color is bright enough to read on a near-black background. */
function ensureReadable(hex: string, minL = 45): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const [h, s, l] = hexToHsl(hex);
  return l >= minL ? hex : hslToHex(h, s, minL);
}

export function getNBATeamColor(abbr: string): string {
  const color = nbaTeams.find((t) => t.abbreviation === abbr)?.colors.primary ?? '#4a4a4a';
  return ensureReadable(color);
}

export function getNBALogoUrl(abbr: string): string {
  return `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png`;
}

/** Strip ".0" from jersey numbers stored as floats in parquet */
export function cleanJersey(n: string): string {
  if (!n) return '';
  const f = parseFloat(n);
  return isNaN(f) ? n : String(Math.round(f));
}

/** "Patrick Mahomes" → "P.M." */
export function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('.') + '.'
  );
}

export function scoreMatch(query: string, name: string): number {
  if (!query || query.length < 2) return 0;
  const q = normalize(query),
    n = normalize(name);
  if (q === n) return 100;
  if (n.startsWith(q)) return 85;
  if (n.split(' ').some((w) => w.startsWith(q) && q.length >= 2)) return 70;
  if (n.includes(q)) return 55;
  if (areSimilarNames(query, name)) return 35;
  return 0;
}

/** Build a stable row key: "{side}_{category}_{index}" */
export function bk(side: 'home' | 'away', cat: string, idx: number): string {
  return `${side}_${cat}_${idx}`;
}

/** Build a stable NBA row key: "{side}_{index}" (no category) */
export function nbk(side: 'home' | 'away', idx: number): string {
  return `${side}_${idx}`;
}

/** Convert NBA season start year to display string: 2014 → "2014-15" */
export function nbaSeasonStr(year: number): string {
  return `${year}-${String(year + 1).slice(-2)}`;
}

export function formatDate(s: string): string {
  try {
    return new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}
