import { describe, it, expect } from 'vitest';
import { normalizeTeamAbbr } from './teamAbbr';

describe('normalizeTeamAbbr', () => {
  describe('NBA abbreviations', () => {
    it('maps SAN to SAS (San Antonio Spurs)', () => {
      expect(normalizeTeamAbbr('SAN', 'nba')).toBe('SAS');
    });

    it('maps NJN to BKN (New Jersey Nets)', () => {
      expect(normalizeTeamAbbr('NJN', 'nba')).toBe('BKN');
    });

    it('maps NOH to NOP (New Orleans Hornets)', () => {
      expect(normalizeTeamAbbr('NOH', 'nba')).toBe('NOP');
    });

    it('maps NOK to NOP (New Orleans/OKC Hornets)', () => {
      expect(normalizeTeamAbbr('NOK', 'nba')).toBe('NOP');
    });

    it('maps SEA to OKC (Seattle SuperSonics)', () => {
      expect(normalizeTeamAbbr('SEA', 'nba')).toBe('OKC');
    });

    it('maps VAN to MEM (Vancouver Grizzlies)', () => {
      expect(normalizeTeamAbbr('VAN', 'nba')).toBe('MEM');
    });

    it('maps UTH to UTA (Utah Jazz)', () => {
      expect(normalizeTeamAbbr('UTH', 'nba')).toBe('UTA');
    });

    it('maps CHH to CHA (Charlotte Hornets original)', () => {
      expect(normalizeTeamAbbr('CHH', 'nba')).toBe('CHA');
    });

    it('maps GOS to GSW (Golden State Warriors)', () => {
      expect(normalizeTeamAbbr('GOS', 'nba')).toBe('GSW');
    });

    it('maps KCK to SAC (Kansas City Kings)', () => {
      expect(normalizeTeamAbbr('KCK', 'nba')).toBe('SAC');
    });

    it('maps PHL to PHI (Philadelphia 76ers)', () => {
      expect(normalizeTeamAbbr('PHL', 'nba')).toBe('PHI');
    });

    it('maps PHO to PHX (Phoenix Suns)', () => {
      expect(normalizeTeamAbbr('PHO', 'nba')).toBe('PHX');
    });

    it('returns unknown NBA codes unchanged', () => {
      expect(normalizeTeamAbbr('LAL', 'nba')).toBe('LAL');
      expect(normalizeTeamAbbr('BOS', 'nba')).toBe('BOS');
    });
  });

  describe('NFL abbreviations', () => {
    it('maps OAK to LV (Oakland Raiders)', () => {
      expect(normalizeTeamAbbr('OAK', 'nfl')).toBe('LV');
    });

    it('maps SD to LAC (San Diego Chargers)', () => {
      expect(normalizeTeamAbbr('SD', 'nfl')).toBe('LAC');
    });

    it('maps SL to LAR (St. Louis Rams)', () => {
      expect(normalizeTeamAbbr('SL', 'nfl')).toBe('LAR');
    });

    it('maps LA to LAR (LA Rams alternate)', () => {
      expect(normalizeTeamAbbr('LA', 'nfl')).toBe('LAR');
    });

    it('maps ARZ to ARI (Arizona Cardinals)', () => {
      expect(normalizeTeamAbbr('ARZ', 'nfl')).toBe('ARI');
    });

    it('maps BLT to BAL (Baltimore Ravens)', () => {
      expect(normalizeTeamAbbr('BLT', 'nfl')).toBe('BAL');
    });

    it('maps CLV to CLE (Cleveland Browns)', () => {
      expect(normalizeTeamAbbr('CLV', 'nfl')).toBe('CLE');
    });

    it('maps HST to HOU (Houston Texans)', () => {
      expect(normalizeTeamAbbr('HST', 'nfl')).toBe('HOU');
    });

    it('returns unknown NFL codes unchanged', () => {
      expect(normalizeTeamAbbr('KC', 'nfl')).toBe('KC');
      expect(normalizeTeamAbbr('BUF', 'nfl')).toBe('BUF');
    });
  });

  describe('slash-separated multi-team strings', () => {
    it('normalizes each segment of a slash-separated NBA string', () => {
      expect(normalizeTeamAbbr('SAN/NJN', 'nba')).toBe('SAS/BKN');
    });

    it('normalizes each segment of a slash-separated NFL string', () => {
      expect(normalizeTeamAbbr('OAK/KC', 'nfl')).toBe('LV/KC');
    });

    it('handles mixed known and unknown codes', () => {
      expect(normalizeTeamAbbr('SEA/LAL', 'nba')).toBe('OKC/LAL');
    });

    it('handles three-team slash strings', () => {
      expect(normalizeTeamAbbr('SAN/NJN/VAN', 'nba')).toBe('SAS/BKN/MEM');
    });
  });
});
