import { describe, it, expect } from 'vitest';
import { getTeamLogoUrl } from './teamLogos';

describe('getTeamLogoUrl', () => {
  describe('NBA logos', () => {
    it('returns correct URL for standard NBA abbreviation', () => {
      expect(getTeamLogoUrl('nba', 'LAL')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/lal.png'
      );
    });

    it('maps historical NBA abbreviation to current franchise', () => {
      expect(getTeamLogoUrl('nba', 'NJN')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png'
      );
      expect(getTeamLogoUrl('nba', 'SEA')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/okc.png'
      );
    });

    it('uses ESPN-specific slug overrides', () => {
      expect(getTeamLogoUrl('nba', 'GSW')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/gs.png'
      );
      expect(getTeamLogoUrl('nba', 'SAS')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/sa.png'
      );
      expect(getTeamLogoUrl('nba', 'NYK')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/ny.png'
      );
      expect(getTeamLogoUrl('nba', 'NOP')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/no.png'
      );
      expect(getTeamLogoUrl('nba', 'UTA')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/utah.png'
      );
      expect(getTeamLogoUrl('nba', 'WAS')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png'
      );
    });

    it('resolves historical + ESPN slug together', () => {
      // SAN → SAS → sa
      expect(getTeamLogoUrl('nba', 'SAN')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/sa.png'
      );
      // NOH → NOP → no
      expect(getTeamLogoUrl('nba', 'NOH')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/no.png'
      );
    });

    it('handles case-insensitive input', () => {
      expect(getTeamLogoUrl('nba', 'lal')).toBe(
        'https://a.espncdn.com/i/teamlogos/nba/500/lal.png'
      );
    });
  });

  describe('NFL logos', () => {
    it('returns correct URL for standard NFL abbreviation', () => {
      expect(getTeamLogoUrl('nfl', 'KC')).toBe(
        'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png'
      );
    });

    it('uses ESPN-specific slug overrides for NFL', () => {
      expect(getTeamLogoUrl('nfl', 'WAS')).toBe(
        'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png'
      );
    });
  });

  describe('edge cases', () => {
    it('returns null for empty abbreviation', () => {
      expect(getTeamLogoUrl('nba', '')).toBeNull();
    });
  });
});
