import { describe, it, expect } from 'vitest';
import {
  NFL_FRANCHISE_ALIASES,
  NBA_FRANCHISE_ALIASES,
  NBA_TEAMS,
  NFL_TEAMS,
  NBA_DIVISIONS,
  NFL_DIVISIONS,
} from './capCrunchData';

describe('franchise aliases', () => {
  describe('NFL aliases', () => {
    it('includes LV/OAK mapping', () => {
      expect(NFL_FRANCHISE_ALIASES['LV']).toContain('OAK');
      expect(NFL_FRANCHISE_ALIASES['OAK']).toContain('LV');
    });

    it('includes LAC/SD mapping', () => {
      expect(NFL_FRANCHISE_ALIASES['LAC']).toContain('SD');
      expect(NFL_FRANCHISE_ALIASES['SD']).toContain('LAC');
    });

    it('includes Rams multi-alias mapping (LA, LAR, STL, SL)', () => {
      const ramsAliases = NFL_FRANCHISE_ALIASES['LAR'];
      expect(ramsAliases).toContain('LA');
      expect(ramsAliases).toContain('STL');
      expect(ramsAliases).toContain('SL');
    });

    it('is symmetric (if A→B then B→A)', () => {
      for (const [key, aliases] of Object.entries(NFL_FRANCHISE_ALIASES)) {
        for (const alias of aliases) {
          expect(NFL_FRANCHISE_ALIASES[alias]).toBeDefined();
          expect(NFL_FRANCHISE_ALIASES[alias]).toContain(key);
        }
      }
    });
  });

  describe('NBA aliases', () => {
    it('includes BKN/NJN mapping', () => {
      expect(NBA_FRANCHISE_ALIASES['BKN']).toContain('NJN');
      expect(NBA_FRANCHISE_ALIASES['NJN']).toContain('BKN');
    });

    it('includes OKC/SEA mapping', () => {
      expect(NBA_FRANCHISE_ALIASES['OKC']).toContain('SEA');
      expect(NBA_FRANCHISE_ALIASES['SEA']).toContain('OKC');
    });

    it('includes Utah Jazz multi-alias (UTA, UTH, NOJ)', () => {
      const utahAliases = NBA_FRANCHISE_ALIASES['UTA'];
      expect(utahAliases).toContain('UTH');
      expect(utahAliases).toContain('NOJ');
    });

    it('is symmetric', () => {
      for (const [key, aliases] of Object.entries(NBA_FRANCHISE_ALIASES)) {
        for (const alias of aliases) {
          expect(NBA_FRANCHISE_ALIASES[alias]).toBeDefined();
          expect(NBA_FRANCHISE_ALIASES[alias]).toContain(key);
        }
      }
    });
  });
});

describe('team lists', () => {
  it('NBA_TEAMS has 30 entries', () => {
    expect(NBA_TEAMS).toHaveLength(30);
  });

  it('NFL_TEAMS has 32 entries', () => {
    expect(NFL_TEAMS).toHaveLength(32);
  });

  it('NBA teams are unique', () => {
    expect(new Set(NBA_TEAMS).size).toBe(NBA_TEAMS.length);
  });

  it('NFL teams are unique', () => {
    expect(new Set(NFL_TEAMS).size).toBe(NFL_TEAMS.length);
  });
});

describe('division structure', () => {
  it('NBA divisions include Atlantic, Central, Pacific', () => {
    const divNames = Object.keys(NBA_DIVISIONS);
    expect(divNames).toContain('Atlantic');
    expect(divNames).toContain('Central');
    expect(divNames).toContain('Pacific');
  });

  it('NFL divisions include AFC and NFC divisions', () => {
    const divNames = Object.keys(NFL_DIVISIONS);
    expect(divNames).toContain('AFC East');
    expect(divNames).toContain('NFC West');
  });

  it('each NBA division has 5 teams', () => {
    for (const [div, teams] of Object.entries(NBA_DIVISIONS)) {
      expect(teams).toHaveLength(5);
    }
  });

  it('each NFL division has 4 teams', () => {
    for (const [div, teams] of Object.entries(NFL_DIVISIONS)) {
      expect(teams).toHaveLength(4);
    }
  });

  it('NFL has 8 divisions', () => {
    expect(Object.keys(NFL_DIVISIONS)).toHaveLength(8);
  });

  it('NBA has 6 divisions', () => {
    expect(Object.keys(NBA_DIVISIONS)).toHaveLength(6);
  });
});
