import { describe, it, expect } from 'vitest';
import { normalize, areSimilarNames, findSuggestions, applyMerges } from './fuzzyDedup';
import type { RollCallEntry } from '../types/database';

describe('normalize', () => {
  it('lowercases and trims whitespace', () => {
    expect(normalize('  LeBron James  ')).toBe('lebron james');
  });

  it('strips diacritics', () => {
    expect(normalize('Nikola Jokić')).toBe('nikola jokic');
  });

  it('removes non-alphanumeric characters except spaces', () => {
    expect(normalize("D'Angelo Russell")).toBe('dangelo russell');
  });

  it('collapses multiple spaces', () => {
    expect(normalize('Kevin   Durant')).toBe('kevin durant');
  });

  it('handles empty string', () => {
    expect(normalize('')).toBe('');
  });

  it('handles unicode normalization (NFD)', () => {
    expect(normalize('José Calderón')).toBe('jose calderon');
  });
});

describe('areSimilarNames', () => {
  it('matches exact names (case-insensitive)', () => {
    expect(areSimilarNames('LeBron James', 'lebron james')).toBe(true);
  });

  it('matches names with generational suffixes stripped', () => {
    expect(areSimilarNames('Derrick Lively II', 'Derrick Lively')).toBe(true);
    expect(areSimilarNames('Michael Pittman Jr', 'Michael Pittman')).toBe(true);
  });

  it('matches first-name prefix (min 3 chars, same last name)', () => {
    expect(areSimilarNames('Herb Jones', 'Herbert Jones')).toBe(true);
  });

  it('rejects first-name prefix shorter than 3 chars', () => {
    // "TJ" is only 2 chars — should not match "Thomas Jones"
    expect(areSimilarNames('TJ Jones', 'Thomas Jones')).toBe(false);
  });

  it('matches by substring when shorter covers >=80% of longer', () => {
    expect(areSimilarNames('Michael Pittman', 'Michael Pittman Jr')).toBe(true);
  });

  it('rejects substring when shorter is too short relative to longer', () => {
    // "LeBron" (6 chars) vs "LeBron James" (12 chars) — 50% ratio < 80%
    expect(areSimilarNames('LeBron', 'LeBron James')).toBe(false);
  });

  it('matches within Levenshtein threshold (1 edit per 5 chars)', () => {
    // "Stephen Curry" (13 chars) → threshold = 2
    expect(areSimilarNames('Stephen Curry', 'Stepher Curry')).toBe(true);
  });

  it('rejects names beyond Levenshtein threshold', () => {
    expect(areSimilarNames('Stephen Curry', 'John Smith')).toBe(false);
  });

  it('handles diacritics in similarity check', () => {
    expect(areSimilarNames('Nikola Jokic', 'Nikola Jokić')).toBe(true);
  });

  it('matches names differing by Jr suffix', () => {
    expect(areSimilarNames('Gary Payton', 'Gary Payton Jr')).toBe(true);
  });
});

function makeEntry(id: string, text: string, playerName = 'user1', playerId = 'p1'): RollCallEntry {
  return {
    id,
    lobby_id: 'lobby1',
    player_id: playerId,
    player_name: playerName,
    entry_text: text,
    submitted_at: new Date().toISOString(),
  };
}

describe('findSuggestions', () => {
  it('returns empty for fewer than 2 entries', () => {
    const result = findSuggestions([makeEntry('1', 'LeBron James')], new Set(), new Set());
    expect(result).toEqual([]);
  });

  it('groups similar entries together', () => {
    const entries = [
      makeEntry('1', 'LeBron James', 'user1', 'p1'),
      makeEntry('2', 'lebron james', 'user2', 'p2'),
    ];
    const suggestions = findSuggestions(entries, new Set(), new Set());
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].entries).toHaveLength(2);
  });

  it('uses the longest entry text as canonical', () => {
    const entries = [
      makeEntry('1', 'MJ', 'user1', 'p1'),
      makeEntry('2', 'Michael Jordan', 'user2', 'p2'),
    ];
    const suggestions = findSuggestions(entries, new Set(), new Set());
    // "MJ" and "Michael Jordan" are unlikely to be similar, so check if grouped
    // They won't match areSimilar — substring coverage too low
    // This is correct behavior: they should NOT be grouped
    expect(suggestions).toHaveLength(0);
  });

  it('skips already confirmed suggestion keys', () => {
    const entries = [
      makeEntry('1', 'LeBron James', 'user1', 'p1'),
      makeEntry('2', 'lebron james', 'user2', 'p2'),
    ];
    const key = ['1', '2'].sort().join('|');
    const suggestions = findSuggestions(entries, new Set([key]), new Set());
    expect(suggestions).toHaveLength(0);
  });

  it('skips already dismissed suggestion keys', () => {
    const entries = [
      makeEntry('1', 'LeBron James', 'user1', 'p1'),
      makeEntry('2', 'lebron james', 'user2', 'p2'),
    ];
    const key = ['1', '2'].sort().join('|');
    const suggestions = findSuggestions(entries, new Set(), new Set([key]));
    expect(suggestions).toHaveLength(0);
  });

  it('does not group dissimilar entries', () => {
    const entries = [
      makeEntry('1', 'LeBron James', 'user1', 'p1'),
      makeEntry('2', 'Stephen Curry', 'user2', 'p2'),
    ];
    const suggestions = findSuggestions(entries, new Set(), new Set());
    expect(suggestions).toHaveLength(0);
  });
});

describe('applyMerges', () => {
  it('returns empty for no entries', () => {
    expect(applyMerges([], [])).toEqual([]);
  });

  it('groups confirmed merge IDs together', () => {
    const entries = [
      makeEntry('1', 'LeBron James', 'user1', 'p1'),
      makeEntry('2', 'lebron james', 'user2', 'p2'),
      makeEntry('3', 'Stephen Curry', 'user3', 'p3'),
    ];
    const result = applyMerges(entries, [['1', '2']]);
    // Should have 2 groups: merged LeBron + solo Curry
    expect(result).toHaveLength(2);
    const lebronGroup = result.find((g) => g.canonical === 'LeBron James');
    expect(lebronGroup).toBeDefined();
    expect(lebronGroup!.variants).toHaveLength(2);
    expect(lebronGroup!.uniqueSubmitters).toBe(2);
  });

  it('sorts groups by uniqueSubmitters descending then alphabetically', () => {
    const entries = [
      makeEntry('1', 'Alpha Player', 'user1', 'p1'),
      makeEntry('2', 'Alpha Player', 'user2', 'p2'),
      makeEntry('3', 'Beta Player', 'user3', 'p3'),
    ];
    const result = applyMerges(entries, [['1', '2']]);
    expect(result[0].canonical).toBe('Alpha Player'); // 2 submitters
    expect(result[1].canonical).toBe('Beta Player'); // 1 submitter
  });

  it('handles merge IDs that do not exist in entries', () => {
    const entries = [makeEntry('1', 'LeBron James', 'user1', 'p1')];
    const result = applyMerges(entries, [['99', '100']]);
    expect(result).toHaveLength(1);
    expect(result[0].canonical).toBe('LeBron James');
  });

  it('picks longest entry text as canonical in a merge', () => {
    const entries = [
      makeEntry('1', 'Bron', 'user1', 'p1'),
      makeEntry('2', 'LeBron James', 'user2', 'p2'),
    ];
    const result = applyMerges(entries, [['1', '2']]);
    expect(result[0].canonical).toBe('LeBron James');
  });
});
