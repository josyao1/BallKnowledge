import { describe, it, expect } from 'vitest';
import { getPickBadgeLabel, getPickErrorMessage, fmt, getCategoryAbbr } from './capCrunchUtils';
import type { SelectedPlayer, StatCategory } from '../../types/capCrunch';

function makePick(overrides: Partial<SelectedPlayer> = {}): SelectedPlayer {
  return {
    playerName: 'Test Player',
    team: 'LAL',
    selectedYear: '2024',
    statValue: 20,
    ...overrides,
  };
}

describe('getPickBadgeLabel', () => {
  it('returns BUST when isBust is true', () => {
    expect(getPickBadgeLabel(makePick({ isBust: true }))).toBe('BUST');
  });

  it('returns WRONG NAME when actualTeammate set and nameMatchFailed', () => {
    expect(getPickBadgeLabel(makePick({
      actualTeammate: 'LeBron James',
      nameMatchFailed: 'first',
    }))).toBe('WRONG NAME');
  });

  it('returns NEVER PLAYED when actualTeammate set without nameMatchFailed', () => {
    expect(getPickBadgeLabel(makePick({
      actualTeammate: 'LeBron James',
    }))).toBe('NEVER PLAYED');
  });

  it('returns WRONG ROUND when actualDraftRound is set', () => {
    expect(getPickBadgeLabel(makePick({
      actualDraftRound: '1st Round',
    }))).toBe('WRONG ROUND');
  });

  it('returns WRONG HEIGHT for height HW filter failures', () => {
    expect(getPickBadgeLabel(makePick({
      hwFilterFailed: 'height_above',
    }))).toBe('WRONG HEIGHT');
    expect(getPickBadgeLabel(makePick({
      hwFilterFailed: 'height_below',
    }))).toBe('WRONG HEIGHT');
  });

  it('returns WRONG WEIGHT for weight HW filter failures', () => {
    expect(getPickBadgeLabel(makePick({
      hwFilterFailed: 'weight_above',
    }))).toBe('WRONG WEIGHT');
    expect(getPickBadgeLabel(makePick({
      hwFilterFailed: 'weight_below',
    }))).toBe('WRONG WEIGHT');
  });

  it('returns WRONG CONF when actualCollege or actualNflConf is set', () => {
    expect(getPickBadgeLabel(makePick({
      actualCollege: 'Duke',
    }))).toBe('WRONG CONF');
    expect(getPickBadgeLabel(makePick({
      actualNflConf: 'AFC',
    }))).toBe('WRONG CONF');
  });

  it('returns NOT ON TEAM as fallback', () => {
    expect(getPickBadgeLabel(makePick())).toBe('NOT ON TEAM');
  });

  it('prioritizes bust over all other labels', () => {
    expect(getPickBadgeLabel(makePick({
      isBust: true,
      actualTeammate: 'Someone',
      actualDraftRound: 'R1',
    }))).toBe('BUST');
  });
});

describe('getPickErrorMessage', () => {
  it('returns null when neverOnTeam is false/undefined', () => {
    expect(getPickErrorMessage(makePick())).toBeNull();
    expect(getPickErrorMessage(makePick({ neverOnTeam: false }))).toBeNull();
  });

  it('returns team mismatch message when actualTeam is set', () => {
    const msg = getPickErrorMessage(makePick({
      neverOnTeam: true,
      actualTeam: 'GSW',
    }));
    expect(msg).toBe('played for GSW');
  });

  it('returns college conference message when actualCollege is set', () => {
    const msg = getPickErrorMessage(makePick({
      neverOnTeam: true,
      actualCollege: 'Duke',
    }));
    expect(msg).toBe('went to Duke');
  });

  it('returns NFL conference message when actualNflConf is set', () => {
    const msg = getPickErrorMessage(makePick({
      neverOnTeam: true,
      actualNflConf: 'AFC',
    }));
    expect(msg).toBe('in AFC');
  });

  it('combines college and NFL conf messages', () => {
    const msg = getPickErrorMessage(makePick({
      neverOnTeam: true,
      actualCollege: 'Duke',
      actualNflConf: 'AFC',
    }));
    expect(msg).toBe('went to Duke / in AFC');
  });

  it('returns height error messages', () => {
    expect(getPickErrorMessage(makePick({
      neverOnTeam: true,
      hwFilterFailed: 'height_above',
      actualHeight: '6-4',
    }))).toBe("too short — 6'4\"");

    expect(getPickErrorMessage(makePick({
      neverOnTeam: true,
      hwFilterFailed: 'height_below',
      actualHeight: '7-0',
    }))).toBe("too tall — 7'0\"");
  });

  it('returns weight error messages', () => {
    expect(getPickErrorMessage(makePick({
      neverOnTeam: true,
      hwFilterFailed: 'weight_above',
      actualWeight: 180,
    }))).toBe('too light — 180 lbs');

    expect(getPickErrorMessage(makePick({
      neverOnTeam: true,
      hwFilterFailed: 'weight_below',
      actualWeight: 300,
    }))).toBe('too heavy — 300 lbs');
  });

  it('returns "never played with" for teammate rounds', () => {
    const msg = getPickErrorMessage(makePick({
      neverOnTeam: true,
      actualTeammate: 'LeBron James',
    }));
    expect(msg).toBe('never played with LeBron James');
  });

  it('returns name-match failure for first initial mismatch', () => {
    const msg = getPickErrorMessage(makePick({
      neverOnTeam: true,
      actualTeammate: 'LeBron James',
      nameMatchFailed: 'first',
    }));
    expect(msg).toBe("first initial isn't L");
  });

  it('returns name-match failure for last initial mismatch', () => {
    const msg = getPickErrorMessage(makePick({
      neverOnTeam: true,
      actualTeammate: 'LeBron James',
      nameMatchFailed: 'last',
    }));
    expect(msg).toBe("last initial isn't J");
  });

  it('handles skipped pick reference in name-match', () => {
    const msg = getPickErrorMessage(makePick({
      neverOnTeam: true,
      actualTeammate: 'Pick 3',
      nameMatchFailed: 'first',
    }));
    expect(msg).toBe('Pick 3 was skipped');
  });

  it('returns fallback message when no specific reason', () => {
    const msg = getPickErrorMessage(makePick({ neverOnTeam: true }));
    expect(msg).toBe("didn't qualify");
  });

  it('strips Jr suffix when determining last initial', () => {
    const msg = getPickErrorMessage(makePick({
      neverOnTeam: true,
      actualTeammate: 'Michael Pittman Jr',
      nameMatchFailed: 'last',
    }));
    expect(msg).toBe("last initial isn't P");
  });
});

describe('fmt', () => {
  it('formats whole numbers without decimals', () => {
    expect(fmt(25)).toBe('25');
    expect(fmt(0)).toBe('0');
    expect(fmt(100)).toBe('100');
  });

  it('formats decimal numbers to 1 decimal place', () => {
    expect(fmt(25.5)).toBe('25.5');
    expect(fmt(3.14159)).toBe('3.1');
  });

  it('formats numbers that round to whole as whole', () => {
    expect(fmt(25.04)).toBe('25');
  });

  it('handles negative numbers', () => {
    expect(fmt(-5.5)).toBe('-5.5');
    expect(fmt(-10)).toBe('-10');
  });
});

describe('getCategoryAbbr', () => {
  const cases: [StatCategory, string][] = [
    ['pts', 'PTS/G'],
    ['ast', 'AST/G'],
    ['reb', 'REB/G'],
    ['min', 'MIN/G'],
    ['pra', 'PRA/G'],
    ['total_pts', 'TOT PTS'],
    ['total_reb', 'TOT REB'],
    ['total_ast', 'TOT AST'],
    ['total_blk', 'TOT BLK'],
    ['total_3pm', 'TOT 3PM'],
    ['total_ftm', 'TOT FTM'],
    ['total_pf', 'TOT PF'],
    ['fpts', 'FPTS'],
    ['passing_yards', 'PASS YD'],
    ['passing_tds', 'PASS TD'],
    ['interceptions', 'INT'],
    ['rushing_yards', 'RUSH YD'],
    ['rushing_tds', 'RUSH TD'],
    ['receiving_yards', 'REC YD'],
    ['receiving_tds', 'REC TD'],
    ['receptions', 'REC'],
    ['total_gp', 'TOT GP'],
    ['career_passing_yards', 'CAREER PASS YD'],
    ['career_passing_tds', 'CAREER PASS TD'],
    ['career_rushing_yards', 'CAREER RUSH YD'],
    ['career_rushing_tds', 'CAREER RUSH TD'],
    ['career_receiving_yards', 'CAREER REC YD'],
    ['career_receiving_tds', 'CAREER REC TD'],
  ];

  it.each(cases)('getCategoryAbbr(%s) returns %s', (category, expected) => {
    expect(getCategoryAbbr(category)).toBe(expected);
  });
});
