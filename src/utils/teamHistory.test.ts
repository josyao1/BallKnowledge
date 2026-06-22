import { describe, it, expect } from 'vitest';
import { getApiAbbreviation } from './teamHistory';

describe('getApiAbbreviation', () => {
  describe('NBA translations', () => {
    it('returns BKN for BKN after 2012', () => {
      expect(getApiAbbreviation('BKN', 2013, 'nba')).toBe('BKN');
      expect(getApiAbbreviation('BKN', 2012, 'nba')).toBe('BKN');
    });

    it('returns NJN for BKN before 2012', () => {
      expect(getApiAbbreviation('BKN', 2011, 'nba')).toBe('NJN');
      expect(getApiAbbreviation('BKN', 2000, 'nba')).toBe('NJN');
    });

    it('returns OKC for OKC after 2008', () => {
      expect(getApiAbbreviation('OKC', 2008, 'nba')).toBe('OKC');
      expect(getApiAbbreviation('OKC', 2024, 'nba')).toBe('OKC');
    });

    it('returns SEA for OKC before 2008', () => {
      expect(getApiAbbreviation('OKC', 2007, 'nba')).toBe('SEA');
      expect(getApiAbbreviation('OKC', 1990, 'nba')).toBe('SEA');
    });

    it('returns NOP for NOP after 2013', () => {
      expect(getApiAbbreviation('NOP', 2013, 'nba')).toBe('NOP');
    });

    it('returns NOH for NOP before 2013', () => {
      expect(getApiAbbreviation('NOP', 2012, 'nba')).toBe('NOH');
    });

    it('returns MEM for MEM after 2001', () => {
      expect(getApiAbbreviation('MEM', 2001, 'nba')).toBe('MEM');
    });

    it('returns VAN for MEM before 2001', () => {
      expect(getApiAbbreviation('MEM', 2000, 'nba')).toBe('VAN');
    });

    it('returns non-relocated teams unchanged', () => {
      expect(getApiAbbreviation('LAL', 2024, 'nba')).toBe('LAL');
      expect(getApiAbbreviation('BOS', 1990, 'nba')).toBe('BOS');
      expect(getApiAbbreviation('GSW', 2015, 'nba')).toBe('GSW');
    });
  });

  describe('NFL passthrough', () => {
    it('returns any NFL abbreviation unchanged regardless of year', () => {
      expect(getApiAbbreviation('KC', 2024, 'nfl')).toBe('KC');
      expect(getApiAbbreviation('LV', 2019, 'nfl')).toBe('LV');
      expect(getApiAbbreviation('OAK', 2015, 'nfl')).toBe('OAK');
    });
  });
});
