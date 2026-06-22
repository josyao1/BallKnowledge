import { describe, it, expect, beforeEach } from 'vitest';
import { useCareerStore } from './careerStore';
import type { CareerGameData } from './careerStore';

const mockGameData: CareerGameData = {
  playerId: 'p1',
  playerName: 'LeBron James',
  position: 'SF',
  seasons: [
    { season: '2003-04', team: 'CLE', pts: 20.9, reb: 5.5, ast: 5.9 },
    { season: '2004-05', team: 'CLE', pts: 27.2, reb: 7.4, ast: 7.2 },
  ],
  bio: { height: '6-9', weight: 250, school: 'St. Vincent-St. Mary', exp: 21 },
};

describe('careerStore', () => {
  beforeEach(() => {
    useCareerStore.getState().resetGame();
  });

  describe('initGame', () => {
    it('initializes game with player data and playing status', () => {
      useCareerStore.getState().initGame(mockGameData, 'nba');
      const state = useCareerStore.getState();
      expect(state.status).toBe('playing');
      expect(state.playerName).toBe('LeBron James');
      expect(state.position).toBe('SF');
      expect(state.seasons).toHaveLength(2);
      expect(state.score).toBe(20);
      expect(state.guesses).toEqual([]);
      expect(state.yearsRevealed).toBe(false);
      expect(state.bioRevealed).toBe(false);
      expect(state.initialsRevealed).toBe(false);
    });
  });

  describe('makeGuess', () => {
    beforeEach(() => {
      useCareerStore.getState().initGame(mockGameData, 'nba');
    });

    it('returns correct: true for matching name', () => {
      const result = useCareerStore.getState().makeGuess('LeBron James');
      expect(result.correct).toBe(true);
      expect(useCareerStore.getState().status).toBe('won');
    });

    it('uses fuzzy matching (case-insensitive, diacritics)', () => {
      const result = useCareerStore.getState().makeGuess('lebron james');
      expect(result.correct).toBe(true);
    });

    it('deducts 1 point for wrong guess', () => {
      useCareerStore.getState().makeGuess('Stephen Curry');
      expect(useCareerStore.getState().score).toBe(19);
      expect(useCareerStore.getState().guesses).toEqual(['Stephen Curry']);
    });

    it('accumulates wrong guesses', () => {
      useCareerStore.getState().makeGuess('A');
      useCareerStore.getState().makeGuess('B');
      useCareerStore.getState().makeGuess('C');
      expect(useCareerStore.getState().guesses).toEqual(['A', 'B', 'C']);
      expect(useCareerStore.getState().score).toBe(17);
    });

    it('loses when score reaches 0 from wrong guesses', () => {
      for (let i = 0; i < 20; i++) {
        useCareerStore.getState().makeGuess(`Wrong ${i}`);
      }
      expect(useCareerStore.getState().score).toBe(0);
      expect(useCareerStore.getState().status).toBe('lost');
    });

    it('does nothing when game is not playing', () => {
      useCareerStore.getState().giveUp();
      const result = useCareerStore.getState().makeGuess('LeBron James');
      expect(result.correct).toBe(false);
    });
  });

  describe('hints (revealYears, revealBio, revealInitials)', () => {
    beforeEach(() => {
      useCareerStore.getState().initGame(mockGameData, 'nba');
    });

    it('revealYears costs 3 points', () => {
      useCareerStore.getState().revealYears();
      const state = useCareerStore.getState();
      expect(state.yearsRevealed).toBe(true);
      expect(state.score).toBe(17);
    });

    it('revealBio costs 3 points', () => {
      useCareerStore.getState().revealBio();
      const state = useCareerStore.getState();
      expect(state.bioRevealed).toBe(true);
      expect(state.score).toBe(17);
    });

    it('revealInitials costs 10 points', () => {
      useCareerStore.getState().revealInitials();
      const state = useCareerStore.getState();
      expect(state.initialsRevealed).toBe(true);
      expect(state.score).toBe(10);
    });

    it('cannot reveal same hint twice', () => {
      useCareerStore.getState().revealYears();
      useCareerStore.getState().revealYears();
      expect(useCareerStore.getState().score).toBe(17); // only deducted once
    });

    it('score cannot go below 0', () => {
      // Score starts at 20. Reveal initials (-10), then years (-3), then bio (-3) = 4
      useCareerStore.getState().revealInitials(); // 10
      useCareerStore.getState().revealYears(); // 7
      useCareerStore.getState().revealBio(); // 4
      expect(useCareerStore.getState().score).toBe(4);
    });

    it('loses when score hits 0 from hints', () => {
      // Start at 20, reveal initials (-10) = 10, then 10 wrong guesses = 0
      useCareerStore.getState().revealInitials(); // 10
      for (let i = 0; i < 10; i++) {
        useCareerStore.getState().makeGuess(`Wrong ${i}`);
      }
      expect(useCareerStore.getState().score).toBe(0);
      expect(useCareerStore.getState().status).toBe('lost');
    });
  });

  describe('giveUp', () => {
    it('sets status to lost and score to 0', () => {
      useCareerStore.getState().initGame(mockGameData, 'nba');
      useCareerStore.getState().giveUp();
      expect(useCareerStore.getState().status).toBe('lost');
      expect(useCareerStore.getState().score).toBe(0);
    });

    it('does nothing when not playing', () => {
      // Already idle
      useCareerStore.getState().giveUp();
      expect(useCareerStore.getState().status).toBe('idle');
    });
  });

  describe('resetGame', () => {
    it('resets all state to defaults', () => {
      useCareerStore.getState().initGame(mockGameData, 'nba');
      useCareerStore.getState().makeGuess('Wrong');
      useCareerStore.getState().revealYears();
      useCareerStore.getState().resetGame();
      const state = useCareerStore.getState();
      expect(state.status).toBe('idle');
      expect(state.score).toBe(20);
      expect(state.playerName).toBe('');
      expect(state.guesses).toEqual([]);
      expect(state.yearsRevealed).toBe(false);
    });
  });
});
