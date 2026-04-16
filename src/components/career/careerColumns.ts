/**
 * careerColumns.ts — Shared column definitions and stat helpers for Career Arc game mode.
 * Used by both CareerGamePage (solo) and MultiplayerCareerPage.
 */

import type { Sport } from '../../types';

export const NBA_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'min', label: 'MIN' },
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'fg_pct', label: 'FG%' },
  { key: 'fg3_pct', label: '3P%' },
];

export const NFL_QB_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'completions', label: 'Comp' },
  { key: 'attempts', label: 'Att' },
  { key: 'passing_yards', label: 'Pass Yds' },
  { key: 'passing_tds', label: 'Pass TD' },
  { key: 'interceptions', label: 'INT' },
  { key: 'rushing_yards', label: 'Rush Yds' },
  { key: 'receiving_yards', label: 'Rec Yds' },
];

export const NFL_RB_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'carries', label: 'Rush Att' },
  { key: 'rushing_yards', label: 'Rush Yds' },
  { key: 'rushing_tds', label: 'Rush TD' },
  { key: 'receptions', label: 'Rec' },
  { key: 'receiving_yards', label: 'Rec Yds' },
];

export const NFL_WR_TE_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'targets', label: 'Targets' },
  { key: 'receptions', label: 'Rec' },
  { key: 'receiving_yards', label: 'Rec Yds' },
  { key: 'receiving_tds', label: 'Rec TD' },
];

export function getColumns(sport: Sport, position: string) {
  if (sport === 'nba') return NBA_COLUMNS;
  switch (position) {
    case 'QB': return NFL_QB_COLUMNS;
    case 'RB': return NFL_RB_COLUMNS;
    default:   return NFL_WR_TE_COLUMNS;
  }
}

export function formatStat(key: string, value: any): string {
  if (key === 'fg_pct' || key === 'fg3_pct') {
    return (value * 100).toFixed(1);
  }
  return String(value ?? 0);
}
