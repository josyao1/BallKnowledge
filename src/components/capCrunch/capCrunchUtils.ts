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
    case 'pts': return 'PTS/G';
    case 'ast': return 'AST/G';
    case 'reb': return 'REB/G';
    case 'min': return 'MIN/G';
    case 'pra': return 'PRA/G';
    case 'total_pts': return 'TOT PTS';
    case 'total_reb': return 'TOT REB';
    case 'total_ast': return 'TOT AST';
    case 'total_blk': return 'TOT BLK';
    case 'total_3pm': return 'TOT 3PM';
    case 'total_ftm': return 'TOT FTM';
    case 'total_pf':  return 'TOT PF';
    case 'fpts': return 'FPTS';
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
