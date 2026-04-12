/**
 * capCrunchUtils.ts — Pure helpers shared across Cap Crunch components.
 */

import type { StatCategory } from '../../types/capCrunch';

/** Format a stat value: whole numbers show no decimal, others show 1 decimal place. */
export function fmt(val: number): string {
  const r = parseFloat(val.toFixed(1));
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
}

export function getCategoryAbbr(category: StatCategory): string {
  switch (category) {
    case 'pts': return 'PTS';
    case 'ast': return 'AST';
    case 'reb': return 'REB';
    case 'min': return 'MIN';
    case 'pra': return 'PRA';
    case 'passing_yards': return 'PASS YD';
    case 'passing_tds': return 'PASS TD';
    case 'interceptions': return 'INT';
    case 'rushing_yards': return 'RUSH YD';
    case 'rushing_tds': return 'RUSH TD';
    case 'receiving_yards': return 'REC YD';
    case 'receiving_tds': return 'REC TD';
    case 'receptions': return 'REC';
    case 'total_gp': return 'TOT GP';
    case 'career_passing_yards':   return 'CAREER PASS YD';
    case 'career_passing_tds':     return 'CAREER PASS TD';
    case 'career_rushing_yards':   return 'CAREER RUSH YD';
    case 'career_rushing_tds':     return 'CAREER RUSH TD';
    case 'career_receiving_yards': return 'CAREER REC YD';
    case 'career_receiving_tds':   return 'CAREER REC TD';
    default: return 'STAT';
  }
}
