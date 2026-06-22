import { describe, it, expect } from 'vitest';
import { scrambleName } from './scramble';

describe('scrambleName', () => {
  it('preserves word boundaries', () => {
    const result = scrambleName('LeBron James');
    const words = result.split(' ');
    expect(words).toHaveLength(2);
  });

  it('leaves words of 2 or fewer characters unchanged', () => {
    const result = scrambleName('TJ Jr');
    const words = result.split(' ');
    expect(words[0]).toBe('TJ');
    expect(words[1]).toBe('Jr');
  });

  it('scrambles words longer than 2 characters so they differ from original', () => {
    // Run multiple times to account for randomness
    for (let i = 0; i < 20; i++) {
      const result = scrambleName('LeBron James');
      const [first, last] = result.split(' ');
      expect(first).not.toBe('LeBron');
      expect(last).not.toBe('James');
    }
  });

  it('preserves the same letters in each word', () => {
    const result = scrambleName('Stephen Curry');
    const [first, last] = result.split(' ');
    expect(first.split('').sort().join('')).toBe('Stephen'.split('').sort().join(''));
    expect(last.split('').sort().join('')).toBe('Curry'.split('').sort().join(''));
  });

  it('handles single-word names', () => {
    const result = scrambleName('Shaq');
    expect(result.split('').sort().join('')).toBe('Shaq'.split('').sort().join(''));
    expect(result).not.toBe('Shaq');
  });

  it('handles names with three words', () => {
    const result = scrambleName('Michael Jordan Jr');
    const words = result.split(' ');
    expect(words).toHaveLength(3);
    expect(words[2]).toBe('Jr'); // <= 2 chars, unchanged
  });

  it('returns empty string for empty input', () => {
    expect(scrambleName('')).toBe('');
  });

  it('handles word of exactly 3 characters', () => {
    // "Ray" has 3 chars — should be scrambled
    for (let i = 0; i < 20; i++) {
      const result = scrambleName('Ray');
      expect(result).not.toBe('Ray');
      expect(result.split('').sort().join('')).toBe('Ray'.split('').sort().join(''));
    }
  });
});
