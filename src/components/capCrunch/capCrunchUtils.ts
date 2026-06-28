/**
 * capCrunchUtils.ts — Pure helpers shared across Cap Crunch components.
 */

import confetti from 'canvas-confetti';
import type { StatCategory, SelectedPlayer } from '../../types/capCrunch';
import {
  isDivisionDraftRound,
  parseDivisionDraftRound,
  isTeammateRound,
  parseTeammateRound,
  isNameMatchRound,
  parseNameRound,
  isWildcardRound,
} from '../../services/capCrunch';

/**
 * Short badge label shown on an invalid pick — more specific than "NOT ON TEAM".
 * Priority: bust → draft round → HW filter → conference/college → team.
 */
export function getPickBadgeLabel(pick: SelectedPlayer): string {
  if (pick.isBust) return 'BUST';
  if (pick.actualTeammate && pick.nameMatchFailed) return 'WRONG NAME';
  if (pick.actualTeammate) return 'NEVER PLAYED';
  if (pick.actualDraftRound) return 'WRONG ROUND';
  if (pick.hwFilterFailed)
    return pick.hwFilterFailed.startsWith('height') ? 'WRONG HEIGHT' : 'WRONG WEIGHT';
  if (pick.actualCollege || pick.actualNflConf) return 'WRONG CONF';
  return 'NOT ON TEAM';
}

/**
 * Produce the human-readable reason a pick didn't qualify.
 * Used in the in-game pick list, scores panel, and results card.
 * Returns null when the pick is not a neverOnTeam failure.
 */
export const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

export function getPickErrorMessage(pick: SelectedPlayer): string | null {
  if (!pick.neverOnTeam) return null;
  if (pick.actualTeammate && pick.nameMatchFailed) {
    // "Pick N" means the referenced pick was missing/skipped — no initial to show
    if (/^Pick \d+$/.test(pick.actualTeammate))
      return `Pick ${pick.actualTeammate.split(' ')[1]} was skipped`;
    const parts = pick.actualTeammate.split(' ');
    const filtered = parts.filter((p) => !NAME_SUFFIXES.has(p.toLowerCase().replace(/\.$/, '')));
    const fullName =
      pick.nameMatchFailed === 'first'
        ? parts[0]
        : (filtered[filtered.length - 1] ?? parts[parts.length - 1]);
    const initial = (fullName?.[0] ?? '').toUpperCase();
    return `${pick.nameMatchFailed} initial isn't ${initial}`;
  }
  if (pick.actualTeammate) return `never played with ${pick.actualTeammate}`;
  const hwMsg = pick.hwFilterFailed
    ? pick.hwFilterFailed === 'height_above'
      ? pick.actualHeight
        ? `too short — ${pick.actualHeight.replace('-', "'")}"`
        : 'too short'
      : pick.hwFilterFailed === 'height_below'
        ? pick.actualHeight
          ? `too tall — ${pick.actualHeight.replace('-', "'")}"`
          : 'too tall'
        : pick.hwFilterFailed === 'weight_above'
          ? pick.actualWeight != null
            ? `too light — ${pick.actualWeight} lbs`
            : 'too light'
          : pick.actualWeight != null
            ? `too heavy — ${pick.actualWeight} lbs`
            : 'too heavy'
    : null;
  const teamMsg =
    pick.actualCollege && pick.actualNflConf
      ? `went to ${pick.actualCollege} / in ${pick.actualNflConf}`
      : pick.actualCollege
        ? `went to ${pick.actualCollege}`
        : pick.actualNflConf && pick.actualDraftRound
          ? `in ${pick.actualNflConf} / drafted ${pick.actualDraftRound}`
          : pick.actualNflConf
            ? `in ${pick.actualNflConf}`
            : pick.actualDraftRound
              ? `drafted ${pick.actualDraftRound}`
              : pick.actualTeam
                ? `played for ${pick.actualTeam}`
                : null;
  return hwMsg && teamMsg ? `${teamMsg} / ${hwMsg}` : (hwMsg ?? teamMsg ?? "didn't qualify");
}

/** Format a season year as "YYYY-YY" (e.g. 2019 → "2019-20", 1999 → "1999-00"). */
export function formatSeasonYear(year: string | number): string {
  const y = parseInt(String(year));
  if (isNaN(y)) return String(year);
  const next = (y + 1) % 100;
  return `${y}-${String(next).padStart(2, '0')}`;
}

/** Format a stat value: whole numbers show no decimal, others show 1 decimal place. */
export function fmt(val: number): string {
  const r = parseFloat(val.toFixed(1));
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
}

export function getCategoryAbbr(category: StatCategory): string {
  switch (category) {
    case 'pts':
      return 'PTS/G';
    case 'ast':
      return 'AST/G';
    case 'reb':
      return 'REB/G';
    case 'min':
      return 'MIN/G';
    case 'pra':
      return 'PRA/G';
    case 'total_pts':
      return 'TOT PTS';
    case 'total_reb':
      return 'TOT REB';
    case 'total_ast':
      return 'TOT AST';
    case 'total_blk':
      return 'TOT BLK';
    case 'total_3pm':
      return 'TOT 3PM';
    case 'total_ftm':
      return 'TOT FTM';
    case 'total_pf':
      return 'TOT PF';
    case 'fpts':
      return 'FPTS';
    case 'passing_yards':
      return 'PASS YD';
    case 'passing_tds':
      return 'PASS TD';
    case 'interceptions':
      return 'INT';
    case 'rushing_yards':
      return 'RUSH YD';
    case 'rushing_tds':
      return 'RUSH TD';
    case 'receiving_yards':
      return 'REC YD';
    case 'receiving_tds':
      return 'REC TD';
    case 'receptions':
      return 'REC';
    case 'total_gp':
      return 'TOT GP';
    case 'career_passing_yards':
      return 'CAREER PASS YD';
    case 'career_passing_tds':
      return 'CAREER PASS TD';
    case 'career_rushing_yards':
      return 'CAREER RUSH YD';
    case 'career_rushing_tds':
      return 'CAREER RUSH TD';
    case 'career_receiving_yards':
      return 'CAREER REC YD';
    case 'career_receiving_tds':
      return 'CAREER REC TD';
    default:
      return 'STAT';
  }
}

export function draftLabel(code: string): string {
  if (code === 'R1') return '1st Round';
  if (code === 'R2') return '2nd Round';
  if (code === 'R23') return '2nd–3rd Round';
  if (code === 'R47') return '4th Round+';
  return code;
}

/**
 * Fire the 3-burst confetti sequence used on an exact cap hit.
 * Returns the two setTimeout IDs so callers can store them in confettiTimersRef for cleanup.
 */
export function fireCapCrunchConfetti(): ReturnType<typeof setTimeout>[] {
  confetti({
    particleCount: 160,
    spread: 90,
    origin: { y: 0.55 },
    colors: ['#d4af37', '#f5e6c8', '#ffffff', '#facc15', '#fbbf24'],
  });
  return [
    setTimeout(
      () =>
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.4, x: 0.3 },
          colors: ['#d4af37', '#ffffff'],
        }),
      250,
    ),
    setTimeout(
      () =>
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.4, x: 0.7 },
          colors: ['#d4af37', '#ffffff'],
        }),
      400,
    ),
  ];
}

export function formatPickTeam(team: string): string {
  if (isDivisionDraftRound(team)) {
    const { division, draftRound } = parseDivisionDraftRound(team);
    return `${division} · ${draftLabel(draftRound)}`;
  }
  if (isTeammateRound(team)) {
    const { pickIndex } = parseTeammateRound(team);
    return `Played with Pick ${pickIndex}`;
  }
  if (isNameMatchRound(team)) {
    const { type, pickIndex, proConf } = parseNameRound(team);
    const label = type === 'first' ? 'First Initial' : 'Last Initial';
    return proConf ? `${label}: Pick ${pickIndex} + ${proConf}` : `${label}: Pick ${pickIndex}`;
  }
  if (isWildcardRound(team)) return 'Wildcard';
  return team;
}
