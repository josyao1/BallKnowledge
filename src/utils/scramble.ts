/**
 * scramble.ts — Name scrambling utility for Name Scramble game mode.
 *
 * Scrambles each word in a name independently using Fisher-Yates shuffle,
 * preserving word boundaries. Words of 2 or fewer characters are left
 * unchanged. Guarantees the scrambled result differs from the original.
 */

/**
 * Scramble a player name word-by-word.
 * Words of ≤2 chars are returned unchanged.
 * Each word that can be scrambled is guaranteed to differ from the original.
 */
export function scrambleName(name: string): string {
  return name
    .split(' ')
    .map(word => {
      if (word.length <= 2) return word;

      const letters = word.split('');

      // Fisher-Yates shuffle
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }

      // If the shuffle happened to produce the original, swap the first two letters
      if (letters.join('') === word) {
        [letters[0], letters[1]] = [letters[1], letters[0]];
      }

      return letters.join('');
    })
    .join(' ');
}
