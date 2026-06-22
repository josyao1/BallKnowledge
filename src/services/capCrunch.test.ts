import { describe, it, expect } from 'vitest';
import {
  generateTargetCap,
  isCareerStat,
  isDivisionRound,
  isDivisionDraftRound,
  isConferenceRound,
  isTeammateRound,
  isFNameRound,
  isLNameRound,
  isNameMatchRound,
  isWildcardRound,
  parseConferenceRound,
  parseDivisionDraftRound,
  parseTeammateRound,
  parseNameRound,
  classifySpecialRoundType,
  advanceSpecialRoundCycle,
  selectRandomStatCategory,
  getStatLabel,
  createPlayerLineup,
  isHWFilter,
  formatHeightInches,
  type SpecialRoundType,
} from './capCrunch';

describe('generateTargetCap', () => {
  it('generates NBA pts cap within expected range', () => {
    for (let i = 0; i < 50; i++) {
      const cap = generateTargetCap('nba', 'pts');
      expect(cap).toBeGreaterThanOrEqual(75);
      expect(cap).toBeLessThanOrEqual(120);
    }
  });

  it('generates NBA ast cap within expected range', () => {
    for (let i = 0; i < 50; i++) {
      const cap = generateTargetCap('nba', 'ast');
      expect(cap).toBeGreaterThanOrEqual(22);
      expect(cap).toBeLessThanOrEqual(40);
    }
  });

  it('generates NFL passing_yards cap within expected range', () => {
    for (let i = 0; i < 50; i++) {
      const cap = generateTargetCap('nfl', 'passing_yards');
      expect(cap).toBeGreaterThanOrEqual(12000);
      expect(cap).toBeLessThanOrEqual(20000);
    }
  });

  it('generates NFL rushing_yards cap within expected range', () => {
    for (let i = 0; i < 50; i++) {
      const cap = generateTargetCap('nfl', 'rushing_yards');
      expect(cap).toBeGreaterThanOrEqual(4000);
      expect(cap).toBeLessThanOrEqual(7500);
    }
  });

  it('generates NFL fpts cap within expected range', () => {
    for (let i = 0; i < 50; i++) {
      const cap = generateTargetCap('nfl', 'fpts');
      expect(cap).toBeGreaterThanOrEqual(650);
      expect(cap).toBeLessThanOrEqual(1750);
    }
  });

  it('generates career stat caps within expected ranges', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateTargetCap('nfl', 'career_passing_yards')).toBeGreaterThanOrEqual(55000);
      expect(generateTargetCap('nfl', 'career_rushing_tds')).toBeGreaterThanOrEqual(130);
    }
  });

  it('returns integer values', () => {
    for (let i = 0; i < 50; i++) {
      const cap = generateTargetCap('nba', 'pts');
      expect(Number.isInteger(cap)).toBe(true);
    }
  });
});

describe('isCareerStat', () => {
  it('returns true for career stat categories', () => {
    expect(isCareerStat('career_passing_yards')).toBe(true);
    expect(isCareerStat('career_passing_tds')).toBe(true);
    expect(isCareerStat('career_rushing_yards')).toBe(true);
    expect(isCareerStat('career_rushing_tds')).toBe(true);
    expect(isCareerStat('career_receiving_yards')).toBe(true);
    expect(isCareerStat('career_receiving_tds')).toBe(true);
  });

  it('returns false for non-career stat categories', () => {
    expect(isCareerStat('pts')).toBe(false);
    expect(isCareerStat('passing_yards')).toBe(false);
    expect(isCareerStat('fpts')).toBe(false);
    expect(isCareerStat('total_gp')).toBe(false);
  });
});

describe('isHWFilter', () => {
  it('returns true for valid HW filter values', () => {
    expect(isHWFilter('height_above')).toBe(true);
    expect(isHWFilter('height_below')).toBe(true);
    expect(isHWFilter('weight_above')).toBe(true);
    expect(isHWFilter('weight_below')).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isHWFilter(null)).toBe(false);
    expect(isHWFilter(undefined)).toBe(false);
  });
});

describe('formatHeightInches', () => {
  it('formats 76 inches as 6\'4"', () => {
    expect(formatHeightInches(76)).toBe('6\'4"');
  });

  it('formats 72 inches as 6\'0"', () => {
    expect(formatHeightInches(72)).toBe('6\'0"');
  });

  it('formats 84 inches as 7\'0"', () => {
    expect(formatHeightInches(84)).toBe('7\'0"');
  });
});

describe('round type detection', () => {
  describe('isDivisionRound', () => {
    it('returns true for NFL division labels', () => {
      expect(isDivisionRound('NFC South')).toBe(true);
      expect(isDivisionRound('AFC North')).toBe(true);
    });

    it('returns false for team abbreviations', () => {
      expect(isDivisionRound('LAL')).toBe(false);
      expect(isDivisionRound('KC')).toBe(false);
    });
  });

  describe('isDivisionDraftRound', () => {
    it('detects division+draft-round format', () => {
      expect(isDivisionDraftRound('NFC South|R1')).toBe(true);
      expect(isDivisionDraftRound('AFC North|R23')).toBe(true);
      expect(isDivisionDraftRound('Atlantic|R2')).toBe(true);
      expect(isDivisionDraftRound('NFC West|R47')).toBe(true);
    });

    it('rejects non-draft-round suffixes', () => {
      expect(isDivisionDraftRound('SEC|AFC')).toBe(false);
      expect(isDivisionDraftRound('LAL')).toBe(false);
    });
  });

  describe('isConferenceRound', () => {
    it('detects P4 conference rounds', () => {
      expect(isConferenceRound('SEC')).toBe(true);
      expect(isConferenceRound('Big Ten')).toBe(true);
      expect(isConferenceRound('ACC')).toBe(true);
      expect(isConferenceRound('Big 12')).toBe(true);
      expect(isConferenceRound('Non-P4')).toBe(true);
    });

    it('detects combined conference format', () => {
      expect(isConferenceRound('SEC|AFC')).toBe(true);
      expect(isConferenceRound('Big Ten|NFC')).toBe(true);
    });

    it('rejects non-conference strings', () => {
      expect(isConferenceRound('LAL')).toBe(false);
      expect(isConferenceRound('NFC South')).toBe(false);
    });
  });

  describe('isTeammateRound', () => {
    it('detects MATE: prefix', () => {
      expect(isTeammateRound('MATE:2')).toBe(true);
      expect(isTeammateRound('MATE:5')).toBe(true);
    });

    it('rejects non-teammate strings', () => {
      expect(isTeammateRound('LAL')).toBe(false);
      expect(isTeammateRound('FNAME:1')).toBe(false);
    });
  });

  describe('name round detection', () => {
    it('isFNameRound detects FNAME: prefix', () => {
      expect(isFNameRound('FNAME:1')).toBe(true);
      expect(isFNameRound('FNAME:3|AFC')).toBe(true);
    });

    it('isLNameRound detects LNAME: prefix', () => {
      expect(isLNameRound('LNAME:2')).toBe(true);
    });

    it('isNameMatchRound detects both', () => {
      expect(isNameMatchRound('FNAME:1')).toBe(true);
      expect(isNameMatchRound('LNAME:2')).toBe(true);
      expect(isNameMatchRound('MATE:1')).toBe(false);
    });
  });

  describe('isWildcardRound', () => {
    it('detects WILDCARD', () => {
      expect(isWildcardRound('WILDCARD')).toBe(true);
    });

    it('rejects non-wildcard', () => {
      expect(isWildcardRound('LAL')).toBe(false);
    });
  });
});

describe('round parsing', () => {
  describe('parseConferenceRound', () => {
    it('parses combined conference string', () => {
      expect(parseConferenceRound('SEC|AFC')).toEqual({
        college: 'SEC',
        nflConf: 'AFC',
      });
    });

    it('parses plain conference string', () => {
      expect(parseConferenceRound('Big Ten')).toEqual({
        college: 'Big Ten',
        nflConf: '',
      });
    });
  });

  describe('parseDivisionDraftRound', () => {
    it('parses division+draft string', () => {
      expect(parseDivisionDraftRound('NFC South|R1')).toEqual({
        division: 'NFC South',
        draftRound: 'R1',
      });
    });

    it('parses NBA division+draft string', () => {
      expect(parseDivisionDraftRound('Atlantic|R2')).toEqual({
        division: 'Atlantic',
        draftRound: 'R2',
      });
    });
  });

  describe('parseTeammateRound', () => {
    it('parses MATE:N format', () => {
      expect(parseTeammateRound('MATE:2')).toEqual({ pickIndex: 2 });
      expect(parseTeammateRound('MATE:5')).toEqual({ pickIndex: 5 });
    });
  });

  describe('parseNameRound', () => {
    it('parses FNAME with pro conference', () => {
      expect(parseNameRound('FNAME:1|AFC')).toEqual({
        type: 'first',
        pickIndex: 1,
        proConf: 'AFC',
      });
    });

    it('parses LNAME without pro conference', () => {
      expect(parseNameRound('LNAME:2')).toEqual({
        type: 'last',
        pickIndex: 2,
        proConf: undefined,
      });
    });
  });
});

describe('classifySpecialRoundType', () => {
  it('classifies name-match as teammate', () => {
    expect(classifySpecialRoundType('FNAME:1', null)).toBe('teammate');
    expect(classifySpecialRoundType('LNAME:2', null)).toBe('teammate');
  });

  it('classifies MATE as teammate', () => {
    expect(classifySpecialRoundType('MATE:2', null)).toBe('teammate');
  });

  it('classifies division+draft rounds', () => {
    expect(classifySpecialRoundType('NFC South|R1', null)).toBe('division_draft');
  });

  it('classifies conference rounds', () => {
    expect(classifySpecialRoundType('SEC', null)).toBe('conference');
    expect(classifySpecialRoundType('SEC|AFC', null)).toBe('conference');
  });

  it('classifies HW filter rounds', () => {
    expect(classifySpecialRoundType('LAL', 'height_above')).toBe('hw_filter');
  });

  it('returns null for plain team rounds', () => {
    expect(classifySpecialRoundType('LAL', null)).toBeNull();
    expect(classifySpecialRoundType('KC', null)).toBeNull();
  });
});

describe('advanceSpecialRoundCycle', () => {
  it('adds new round type to cycle', () => {
    const result = advanceSpecialRoundCycle([], 'teammate');
    expect(result).toEqual(['teammate']);
  });

  it('does not duplicate existing types', () => {
    const result = advanceSpecialRoundCycle(['teammate'], 'teammate');
    expect(result).toEqual(['teammate']);
  });

  it('does nothing for null (plain team)', () => {
    const result = advanceSpecialRoundCycle(['teammate'], null);
    expect(result).toEqual(['teammate']);
  });

  it('resets cycle when all 5 types seen', () => {
    const all: SpecialRoundType[] = ['division_draft', 'division', 'conference', 'hw_filter', 'teammate'];
    const result = advanceSpecialRoundCycle(
      ['division_draft', 'division', 'conference', 'hw_filter'],
      'teammate'
    );
    expect(result).toEqual([]); // cycle resets
  });
});

describe('selectRandomStatCategory', () => {
  it('returns valid NBA stat categories', () => {
    for (let i = 0; i < 50; i++) {
      const cat = selectRandomStatCategory('nba');
      expect(typeof cat).toBe('string');
      expect(cat.length).toBeGreaterThan(0);
    }
  });

  it('returns valid NFL stat categories', () => {
    for (let i = 0; i < 50; i++) {
      const cat = selectRandomStatCategory('nfl');
      expect(typeof cat).toBe('string');
      expect(cat.length).toBeGreaterThan(0);
    }
  });
});

describe('getStatLabel', () => {
  it('returns a non-empty label for common categories', () => {
    expect(getStatLabel('pts')).toBeTruthy();
    expect(getStatLabel('passing_yards')).toBeTruthy();
    expect(getStatLabel('fpts')).toBeTruthy();
  });
});

describe('createPlayerLineup', () => {
  it('creates a fresh lineup with empty state', () => {
    const lineup = createPlayerLineup('p1', 'Test Player');
    expect(lineup.playerId).toBe('p1');
    expect(lineup.playerName).toBe('Test Player');
    expect(lineup.selectedPlayers).toEqual([]);
    expect(lineup.totalStat).toBe(0);
    expect(lineup.bustCount).toBe(0);
    expect(lineup.isFinished).toBe(false);
  });
});
