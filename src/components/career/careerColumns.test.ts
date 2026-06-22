import { describe, it, expect } from 'vitest';
import {
  getColumns,
  formatStat,
  NBA_COLUMNS,
  NFL_QB_COLUMNS,
  NFL_RB_COLUMNS,
  NFL_WR_TE_COLUMNS,
} from './careerColumns';

describe('getColumns', () => {
  it('returns NBA columns for NBA sport', () => {
    expect(getColumns('nba', 'PG')).toBe(NBA_COLUMNS);
    expect(getColumns('nba', 'SF')).toBe(NBA_COLUMNS);
  });

  it('returns QB columns for NFL QB', () => {
    expect(getColumns('nfl', 'QB')).toBe(NFL_QB_COLUMNS);
  });

  it('returns RB columns for NFL RB', () => {
    expect(getColumns('nfl', 'RB')).toBe(NFL_RB_COLUMNS);
  });

  it('returns WR/TE columns for NFL WR', () => {
    expect(getColumns('nfl', 'WR')).toBe(NFL_WR_TE_COLUMNS);
  });

  it('returns WR/TE columns for NFL TE', () => {
    expect(getColumns('nfl', 'TE')).toBe(NFL_WR_TE_COLUMNS);
  });

  it('returns WR/TE columns for other NFL positions (default)', () => {
    expect(getColumns('nfl', 'LB')).toBe(NFL_WR_TE_COLUMNS);
  });
});

describe('formatStat', () => {
  it('formats fg_pct as percentage', () => {
    expect(formatStat('fg_pct', 0.485)).toBe('48.5');
  });

  it('formats fg3_pct as percentage', () => {
    expect(formatStat('fg3_pct', 0.372)).toBe('37.2');
  });

  it('formats regular stats as strings', () => {
    expect(formatStat('pts', 25)).toBe('25');
    expect(formatStat('gp', 82)).toBe('82');
  });

  it('handles null/undefined values', () => {
    expect(formatStat('pts', null)).toBe('0');
    expect(formatStat('pts', undefined)).toBe('0');
  });

  it('handles zero values', () => {
    expect(formatStat('pts', 0)).toBe('0');
  });
});

describe('column structures', () => {
  it('NBA_COLUMNS starts with season and team', () => {
    expect(NBA_COLUMNS[0].key).toBe('season');
    expect(NBA_COLUMNS[1].key).toBe('team');
  });

  it('all column sets have season and team as first two columns', () => {
    for (const cols of [NBA_COLUMNS, NFL_QB_COLUMNS, NFL_RB_COLUMNS, NFL_WR_TE_COLUMNS]) {
      expect(cols[0].key).toBe('season');
      expect(cols[1].key).toBe('team');
    }
  });

  it('NBA_COLUMNS has 11 columns', () => {
    expect(NBA_COLUMNS).toHaveLength(11);
  });
});
