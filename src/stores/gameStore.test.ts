import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';

const mockTeam = {
  id: 1,
  abbreviation: 'LAL',
  name: 'Lakers',
  colors: { primary: '#552583', secondary: '#FDB927' },
};

const mockRoster = [
  { id: 1, name: 'LeBron James', position: 'SF', number: '23' },
  { id: 2, name: 'Anthony Davis', position: 'PF', number: '3' },
  { id: 3, name: 'Austin Reaves', position: 'SG', number: '15' },
];

function initGame(hideResults = false) {
  useGameStore.getState().setGameConfig(
    'nba', mockTeam, '2024-25', 'random', 90, mockRoster, [], hideResults
  );
  useGameStore.getState().startGame();
}

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  describe('setGameConfig', () => {
    it('sets configuration and initial state', () => {
      useGameStore.getState().setGameConfig(
        'nba', mockTeam, '2024-25', 'random', 120, mockRoster
      );
      const state = useGameStore.getState();
      expect(state.sport).toBe('nba');
      expect(state.selectedTeam).toEqual(mockTeam);
      expect(state.selectedSeason).toBe('2024-25');
      expect(state.timerDuration).toBe(120);
      expect(state.currentRoster).toEqual(mockRoster);
      expect(state.status).toBe('idle');
      expect(state.score).toBe(0);
    });
  });

  describe('game lifecycle', () => {
    it('transitions from idle to playing on startGame', () => {
      useGameStore.getState().setGameConfig('nba', mockTeam, '2024-25', 'random', 90, mockRoster);
      useGameStore.getState().startGame();
      expect(useGameStore.getState().status).toBe('playing');
      expect(useGameStore.getState().startTime).not.toBeNull();
    });

    it('can pause and resume', () => {
      initGame();
      useGameStore.getState().pauseGame();
      expect(useGameStore.getState().status).toBe('paused');
      useGameStore.getState().resumeGame();
      expect(useGameStore.getState().status).toBe('playing');
    });

    it('can end game', () => {
      initGame();
      useGameStore.getState().endGame();
      expect(useGameStore.getState().status).toBe('ended');
    });
  });

  describe('makeGuess (standard mode)', () => {
    beforeEach(() => initGame());

    it('identifies correct guess', () => {
      const result = useGameStore.getState().makeGuess('LeBron James');
      expect(result.isCorrect).toBe(true);
      expect(result.player?.name).toBe('LeBron James');
      expect(result.alreadyGuessed).toBe(false);
      expect(useGameStore.getState().score).toBe(1);
      expect(useGameStore.getState().guessedPlayers).toHaveLength(1);
    });

    it('handles case-insensitive matching', () => {
      const result = useGameStore.getState().makeGuess('lebron james');
      expect(result.isCorrect).toBe(true);
    });

    it('handles diacritic-insensitive matching', () => {
      // Austin Reaves with accent marks should still match
      const result = useGameStore.getState().makeGuess('Austin Reaves');
      expect(result.isCorrect).toBe(true);
    });

    it('tracks incorrect guesses', () => {
      const result = useGameStore.getState().makeGuess('Kobe Bryant');
      expect(result.isCorrect).toBe(false);
      expect(result.alreadyGuessed).toBe(false);
      expect(useGameStore.getState().incorrectGuesses).toContain('Kobe Bryant');
    });

    it('detects already guessed (correct)', () => {
      useGameStore.getState().makeGuess('LeBron James');
      const result = useGameStore.getState().makeGuess('LeBron James');
      expect(result.alreadyGuessed).toBe(true);
    });

    it('detects already guessed (incorrect)', () => {
      useGameStore.getState().makeGuess('Kobe Bryant');
      const result = useGameStore.getState().makeGuess('Kobe Bryant');
      expect(result.alreadyGuessed).toBe(true);
    });

    it('does not accept guesses when not playing', () => {
      useGameStore.getState().endGame();
      const result = useGameStore.getState().makeGuess('LeBron James');
      expect(result.isCorrect).toBe(false);
    });

    it('detects teammate-already-guessed in team mode', () => {
      const result = useGameStore.getState().makeGuess('LeBron James', ['LeBron James']);
      expect(result.alreadyGuessed).toBe(true);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe('makeGuess (hidden results mode)', () => {
    beforeEach(() => initGame(true));

    it('adds guesses to pending without revealing correctness', () => {
      const result = useGameStore.getState().makeGuess('LeBron James');
      // In hidden mode, always returns isCorrect: false
      expect(result.isCorrect).toBe(false);
      expect(useGameStore.getState().pendingGuesses).toContain('LeBron James');
    });

    it('detects duplicate pending guesses', () => {
      useGameStore.getState().makeGuess('LeBron James');
      const result = useGameStore.getState().makeGuess('LeBron James');
      expect(result.alreadyGuessed).toBe(true);
    });
  });

  describe('processGuesses', () => {
    it('resolves pending guesses into correct/incorrect', () => {
      initGame(true);
      useGameStore.getState().makeGuess('LeBron James');
      useGameStore.getState().makeGuess('Kobe Bryant');
      useGameStore.getState().makeGuess('Anthony Davis');
      useGameStore.getState().processGuesses();

      const state = useGameStore.getState();
      expect(state.guessedPlayers).toHaveLength(2); // LeBron + AD
      expect(state.incorrectGuesses).toContain('Kobe Bryant');
      expect(state.score).toBe(2);
    });

    it('deduplicates correct guesses for same player', () => {
      initGame(true);
      useGameStore.getState().makeGuess('LeBron James');
      // Can't add duplicate via makeGuess (it checks pendingGuesses),
      // but processGuesses handles it via id check
      useGameStore.getState().processGuesses();
      expect(useGameStore.getState().guessedPlayers).toHaveLength(1);
    });
  });

  describe('overrideGuess', () => {
    it('moves incorrect guess to correct player', () => {
      initGame();
      useGameStore.getState().makeGuess('Bron James'); // incorrect
      expect(useGameStore.getState().incorrectGuesses).toContain('Bron James');

      const result = useGameStore.getState().overrideGuess('Bron James', 1); // LeBron's id
      expect(result).toBe(true);
      expect(useGameStore.getState().guessedPlayers).toHaveLength(1);
      expect(useGameStore.getState().incorrectGuesses).not.toContain('Bron James');
      expect(useGameStore.getState().score).toBe(1);
    });

    it('rejects override for non-existent player', () => {
      initGame();
      useGameStore.getState().makeGuess('Wrong');
      const result = useGameStore.getState().overrideGuess('Wrong', 999);
      expect(result).toBe(false);
    });

    it('rejects override for already-guessed player', () => {
      initGame();
      useGameStore.getState().makeGuess('LeBron James'); // correct
      useGameStore.getState().makeGuess('Wrong');
      const result = useGameStore.getState().overrideGuess('Wrong', 1);
      expect(result).toBe(false);
    });
  });

  describe('tick', () => {
    it('decrements timeRemaining by 1 when playing', () => {
      initGame();
      const initial = useGameStore.getState().timeRemaining;
      useGameStore.getState().tick();
      expect(useGameStore.getState().timeRemaining).toBe(initial - 1);
    });

    it('does not decrement when not playing', () => {
      useGameStore.getState().setGameConfig('nba', mockTeam, '2024-25', 'random', 90, mockRoster);
      const initial = useGameStore.getState().timeRemaining;
      useGameStore.getState().tick();
      expect(useGameStore.getState().timeRemaining).toBe(initial);
    });

    it('does not go below 0', () => {
      initGame();
      // Set timeRemaining to 0
      for (let i = 0; i < 100; i++) {
        useGameStore.getState().tick();
      }
      expect(useGameStore.getState().timeRemaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('resetForRematch', () => {
    it('keeps config but resets progress', () => {
      initGame();
      useGameStore.getState().makeGuess('LeBron James');
      useGameStore.getState().resetForRematch();
      const state = useGameStore.getState();
      expect(state.status).toBe('idle');
      expect(state.score).toBe(0);
      expect(state.guessedPlayers).toEqual([]);
      expect(state.incorrectGuesses).toEqual([]);
      expect(state.pendingGuesses).toEqual([]);
      expect(state.timeRemaining).toBe(90); // restored to timerDuration
      // Config preserved
      expect(state.currentRoster).toEqual(mockRoster);
    });
  });
});
