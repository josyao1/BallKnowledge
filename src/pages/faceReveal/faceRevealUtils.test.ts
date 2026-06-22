import { describe, it, expect } from 'vitest';
import {
  longestTenuredTeam,
  getInitials,
  getSuggestions,
  nflInPool,
  timerColor,
  nbaEndYear,
  nflEndYear,
  NFL_OFF_POSITIONS,
  NFL_ST_POSITIONS,
  type PlayerEntry,
} from './faceRevealUtils';
import type { NBACareerPlayer, NFLCareerPlayer } from '../../services/careerData';

describe('longestTenuredTeam', () => {
  it('returns team with most seasons', () => {
    const seasons = [
      { team: 'LAL' },
      { team: 'LAL' },
      { team: 'MIA' },
      { team: 'LAL' },
      { team: 'CLE' },
    ];
    expect(longestTenuredTeam(seasons)).toBe('LAL');
  });

  it('uses first team in slash-separated season', () => {
    const seasons = [
      { team: 'ORL/DEN' },
      { team: 'ORL' },
    ];
    expect(longestTenuredTeam(seasons)).toBe('ORL');
  });

  it('returns empty string for empty seasons', () => {
    expect(longestTenuredTeam([])).toBe('');
  });

  it('handles single season', () => {
    expect(longestTenuredTeam([{ team: 'BOS' }])).toBe('BOS');
  });

  it('handles empty team strings', () => {
    expect(longestTenuredTeam([{ team: '' }])).toBe('');
  });
});

describe('getInitials', () => {
  it('returns initials from full name', () => {
    expect(getInitials('LeBron James')).toBe('LJ');
  });

  it('handles single-word name', () => {
    expect(getInitials('Shaq')).toBe('S');
  });

  it('handles three-word name', () => {
    expect(getInitials('Michael Jeffrey Jordan')).toBe('MJJ');
  });

  it('returns empty for empty string', () => {
    expect(getInitials('')).toBe('');
  });
});

describe('getSuggestions', () => {
  const pool: PlayerEntry[] = [
    { player_id: 1, player_name: 'LeBron James' },
    { player_id: 2, player_name: 'Stephen Curry' },
    { player_id: 3, player_name: 'Kevin Durant' },
    { player_id: 4, player_name: 'LeBron Raymone' },
    { player_id: 5, player_name: 'Steve Nash' },
  ];

  it('returns empty for input shorter than 3 characters', () => {
    expect(getSuggestions('Le', pool)).toEqual([]);
    expect(getSuggestions('AB', pool)).toEqual([]);
  });

  it('prioritizes full-name prefix matches (score 100)', () => {
    const results = getSuggestions('LeBron', pool);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].player_name).toBe('LeBron James');
  });

  it('matches when all input words match name-word prefixes (score 80)', () => {
    const results = getSuggestions('Kev Dur', pool);
    expect(results.some(r => r.player_name === 'Kevin Durant')).toBe(true);
  });

  it('matches on first-token prefix (score 60)', () => {
    const results = getSuggestions('Ste', pool);
    expect(results.some(r => r.player_name === 'Stephen Curry')).toBe(true);
    expect(results.some(r => r.player_name === 'Steve Nash')).toBe(true);
  });

  it('limits results to specified count', () => {
    const results = getSuggestions('LeB', pool, 1);
    expect(results).toHaveLength(1);
  });

  it('returns empty when no matches', () => {
    expect(getSuggestions('Zzz', pool)).toEqual([]);
  });
});

describe('timerColor', () => {
  it('returns green for fraction > 0.6', () => {
    expect(timerColor(0.8)).toBe('#22c55e');
    expect(timerColor(1.0)).toBe('#22c55e');
    expect(timerColor(0.61)).toBe('#22c55e');
  });

  it('returns yellow for fraction 0.35-0.6', () => {
    expect(timerColor(0.5)).toBe('#eab308');
    expect(timerColor(0.36)).toBe('#eab308');
  });

  it('returns orange for fraction 0.15-0.35', () => {
    expect(timerColor(0.25)).toBe('#f97316');
    expect(timerColor(0.16)).toBe('#f97316');
  });

  it('returns red for fraction <= 0.15', () => {
    expect(timerColor(0.15)).toBe('#ef4444');
    expect(timerColor(0.05)).toBe('#ef4444');
    expect(timerColor(0)).toBe('#ef4444');
  });
});

describe('nbaEndYear', () => {
  it('returns the latest season year', () => {
    const player = {
      seasons: [
        { season: '2018', team: 'LAL' },
        { season: '2022', team: 'LAL' },
        { season: '2020', team: 'LAL' },
      ],
    } as unknown as NBACareerPlayer;
    expect(nbaEndYear(player)).toBe(2022);
  });

  it('returns 0 for empty seasons', () => {
    const player = { seasons: [] } as unknown as NBACareerPlayer;
    expect(nbaEndYear(player)).toBe(0);
  });
});

describe('nflEndYear', () => {
  it('returns the latest season year', () => {
    const player = {
      seasons: [
        { season: '2019', team: 'KC' },
        { season: '2023', team: 'KC' },
      ],
    } as unknown as NFLCareerPlayer;
    expect(nflEndYear(player)).toBe(2023);
  });

  it('returns 0 for empty seasons', () => {
    const player = { seasons: [] } as unknown as NFLCareerPlayer;
    expect(nflEndYear(player)).toBe(0);
  });
});

describe('nflInPool', () => {
  it('excludes kickers (K)', () => {
    const player = {
      position: 'K',
      player_id: '1',
      seasons: [{ season: '2023', passing_yards: 0, rushing_yards: 0, receiving_yards: 0 }],
    } as unknown as NFLCareerPlayer;
    expect(nflInPool(player, 0, 'known')).toBe(false);
  });

  it('excludes punters (P)', () => {
    const player = {
      position: 'P',
      player_id: '2',
      seasons: [],
    } as unknown as NFLCareerPlayer;
    expect(nflInPool(player, 0, 'known')).toBe(false);
  });

  it('excludes long snappers (LS)', () => {
    const player = {
      position: 'LS',
      player_id: '3',
      seasons: [],
    } as unknown as NFLCareerPlayer;
    expect(nflInPool(player, 0, 'known')).toBe(false);
  });

  it('includes offensive players with minYards=0', () => {
    const player = {
      position: 'QB',
      player_id: '4',
      seasons: [{ season: '2023', passing_yards: 100, rushing_yards: 0, receiving_yards: 0 }],
    } as unknown as NFLCareerPlayer;
    expect(nflInPool(player, 0, 'known')).toBe(true);
  });

  it('filters offensive players by minYards threshold', () => {
    const player = {
      position: 'WR',
      player_id: '5',
      seasons: [
        { season: '2023', passing_yards: 0, rushing_yards: 0, receiving_yards: 400 },
        { season: '2024', passing_yards: 0, rushing_yards: 0, receiving_yards: 800 },
      ],
    } as unknown as NFLCareerPlayer;
    expect(nflInPool(player, 500, 'known')).toBe(true);  // 800 >= 500
    expect(nflInPool(player, 1000, 'known')).toBe(false); // max is 800
  });

  it('includes all non-ST defensive players in "all" mode', () => {
    const player = {
      position: 'LB',
      player_id: '6',
      seasons: [],
    } as unknown as NFLCareerPlayer;
    expect(nflInPool(player, 0, 'all')).toBe(true);
  });
});

describe('position sets', () => {
  it('NFL_OFF_POSITIONS includes QB, RB, WR, TE, FB', () => {
    expect(NFL_OFF_POSITIONS.has('QB')).toBe(true);
    expect(NFL_OFF_POSITIONS.has('RB')).toBe(true);
    expect(NFL_OFF_POSITIONS.has('WR')).toBe(true);
    expect(NFL_OFF_POSITIONS.has('TE')).toBe(true);
    expect(NFL_OFF_POSITIONS.has('FB')).toBe(true);
  });

  it('NFL_ST_POSITIONS includes K, P, LS', () => {
    expect(NFL_ST_POSITIONS.has('K')).toBe(true);
    expect(NFL_ST_POSITIONS.has('P')).toBe(true);
    expect(NFL_ST_POSITIONS.has('LS')).toBe(true);
  });
});
