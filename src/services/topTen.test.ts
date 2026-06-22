import { describe, it, expect } from 'vitest';
import { NBA_STAT_CATEGORIES, NFL_STAT_CATEGORIES, NFL_TEAM_STAT_CATEGORIES } from './topTen';

describe('stat category definitions', () => {
  describe('NBA categories', () => {
    it('has 7 categories', () => {
      expect(NBA_STAT_CATEGORIES).toHaveLength(7);
    });

    it('all have sport set to nba', () => {
      expect(NBA_STAT_CATEGORIES.every((c) => c.sport === 'nba')).toBe(true);
    });

    it('all have required fields', () => {
      for (const cat of NBA_STAT_CATEGORIES) {
        expect(cat.key).toBeTruthy();
        expect(cat.label).toBeTruthy();
        expect(cat.shortLabel).toBeTruthy();
      }
    });

    it('includes key stat categories', () => {
      const keys = NBA_STAT_CATEGORIES.map((c) => c.key);
      expect(keys).toContain('total_pts');
      expect(keys).toContain('total_reb');
      expect(keys).toContain('total_ast');
      expect(keys).toContain('total_blk');
      expect(keys).toContain('total_3pm');
    });
  });

  describe('NFL categories', () => {
    it('has more than 8 categories', () => {
      expect(NFL_STAT_CATEGORIES.length).toBeGreaterThan(8);
    });

    it('all have sport set to nfl', () => {
      expect(NFL_STAT_CATEGORIES.every((c) => c.sport === 'nfl')).toBe(true);
    });

    it('includes fantasy points categories by position', () => {
      const keys = NFL_STAT_CATEGORIES.map((c) => c.key);
      expect(keys).toContain('fantasy_pts_qb');
      expect(keys).toContain('fantasy_pts_rb');
      expect(keys).toContain('fantasy_pts_wr');
      expect(keys).toContain('fantasy_pts_te');
    });

    it('includes award categories', () => {
      const keys = NFL_STAT_CATEGORIES.map((c) => c.key);
      expect(keys).toContain('award_mvp');
    });
  });

  describe('NFL team categories', () => {
    it('has a combined fantasy_pts category', () => {
      const keys = NFL_TEAM_STAT_CATEGORIES.map((c) => c.key);
      expect(keys).toContain('fantasy_pts');
    });

    it('includes core offensive stats', () => {
      const keys = NFL_TEAM_STAT_CATEGORIES.map((c) => c.key);
      expect(keys).toContain('passing_yards');
      expect(keys).toContain('rushing_yards');
      expect(keys).toContain('receiving_yards');
    });
  });
});
