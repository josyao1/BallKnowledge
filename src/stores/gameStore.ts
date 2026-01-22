import { create } from 'zustand';
import type { Player, Team, GameStatus, GameMode, GuessResult } from '../types';

interface GameState {
  // Configuration
  selectedTeam: Team | null;
  selectedSeason: string | null;
  gameMode: GameMode;
  timerDuration: number;

  // Game progress
  status: GameStatus;
  timeRemaining: number;
  startTime: number | null;

  // Roster data
  currentRoster: Player[];
  guessedPlayers: Player[];
  incorrectGuesses: string[];

  // Scoring
  score: number;
  bonusPoints: number;

  // Actions
  setGameConfig: (team: Team, season: string, mode: GameMode, duration: number, roster: Player[]) => void;
  startGame: () => void;
  makeGuess: (playerName: string) => GuessResult;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  resetGame: () => void;
  tick: () => void;
}

// Normalize player name for comparison
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z\s]/g, '') // Remove non-letters except spaces
    .replace(/\s+/g, ' ')
    .trim();
}

const BONUS_THRESHOLD = 10; // PPG below which bonus is awarded

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  selectedTeam: null,
  selectedSeason: null,
  gameMode: 'random',
  timerDuration: 90,
  status: 'idle',
  timeRemaining: 90,
  startTime: null,
  currentRoster: [],
  guessedPlayers: [],
  incorrectGuesses: [],
  score: 0,
  bonusPoints: 0,

  setGameConfig: (team, season, mode, duration, roster) => {
    set({
      selectedTeam: team,
      selectedSeason: season,
      gameMode: mode,
      timerDuration: duration,
      timeRemaining: duration,
      currentRoster: roster,
      status: 'idle',
      guessedPlayers: [],
      incorrectGuesses: [],
      score: 0,
      bonusPoints: 0,
      startTime: null,
    });
  },

  startGame: () => {
    set({
      status: 'playing',
      startTime: Date.now(),
    });
  },

  makeGuess: (playerName: string): GuessResult => {
    const state = get();

    if (state.status !== 'playing') {
      return { isCorrect: false, alreadyGuessed: false, bonusAwarded: false };
    }

    const normalizedGuess = normalizePlayerName(playerName);

    // Check if already guessed correctly
    const alreadyGuessedCorrectly = state.guessedPlayers.some(
      (p) => normalizePlayerName(p.name) === normalizedGuess
    );
    if (alreadyGuessedCorrectly) {
      return { isCorrect: false, alreadyGuessed: true, bonusAwarded: false };
    }

    // Check if already guessed incorrectly
    const alreadyGuessedIncorrectly = state.incorrectGuesses.some(
      (g) => normalizePlayerName(g) === normalizedGuess
    );
    if (alreadyGuessedIncorrectly) {
      return { isCorrect: false, alreadyGuessed: true, bonusAwarded: false };
    }

    // Check against current roster
    const matchedPlayer = state.currentRoster.find(
      (p) => normalizePlayerName(p.name) === normalizedGuess
    );

    if (matchedPlayer) {
      const bonusAwarded = matchedPlayer.ppg < BONUS_THRESHOLD;

      set({
        guessedPlayers: [...state.guessedPlayers, matchedPlayer],
        score: state.score + 1,
        bonusPoints: state.bonusPoints + (bonusAwarded ? 1 : 0),
      });

      return {
        isCorrect: true,
        player: matchedPlayer,
        bonusAwarded,
        alreadyGuessed: false,
      };
    }

    // Incorrect guess
    set({
      incorrectGuesses: [...state.incorrectGuesses, playerName],
    });

    return { isCorrect: false, alreadyGuessed: false, bonusAwarded: false };
  },

  pauseGame: () => {
    set({ status: 'paused' });
  },

  resumeGame: () => {
    set({ status: 'playing' });
  },

  endGame: () => {
    set({ status: 'ended' });
  },

  resetGame: () => {
    set({
      selectedTeam: null,
      selectedSeason: null,
      gameMode: 'random',
      status: 'idle',
      timeRemaining: get().timerDuration,
      startTime: null,
      currentRoster: [],
      guessedPlayers: [],
      incorrectGuesses: [],
      score: 0,
      bonusPoints: 0,
    });
  },

  tick: () => {
    const state = get();
    if (state.status === 'playing' && state.timeRemaining > 0) {
      set({ timeRemaining: state.timeRemaining - 1 });
    }
  },
}));
