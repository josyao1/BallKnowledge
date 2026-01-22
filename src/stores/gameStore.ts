import { create } from 'zustand';
import type { Player, Team, GameStatus, GameMode, GuessResult } from '../types';

interface LeaguePlayer {
  id: number;
  name: string;
}

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

  // League-wide players for autocomplete (all players from the season)
  leaguePlayers: LeaguePlayer[];

  // Scoring
  score: number;

  // Actions
  setGameConfig: (team: Team, season: string, mode: GameMode, duration: number, roster: Player[], leaguePlayers?: LeaguePlayer[]) => void;
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
  leaguePlayers: [],
  score: 0,

  setGameConfig: (team, season, mode, duration, roster, leaguePlayers = []) => {
    set({
      selectedTeam: team,
      selectedSeason: season,
      gameMode: mode,
      timerDuration: duration,
      timeRemaining: duration,
      currentRoster: roster,
      leaguePlayers,
      status: 'idle',
      guessedPlayers: [],
      incorrectGuesses: [],
      score: 0,
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
      return { isCorrect: false, alreadyGuessed: false };
    }

    const normalizedGuess = normalizePlayerName(playerName);

    // Check if already guessed correctly
    const alreadyGuessedCorrectly = state.guessedPlayers.some(
      (p) => normalizePlayerName(p.name) === normalizedGuess
    );
    if (alreadyGuessedCorrectly) {
      return { isCorrect: false, alreadyGuessed: true };
    }

    // Check if already guessed incorrectly
    const alreadyGuessedIncorrectly = state.incorrectGuesses.some(
      (g) => normalizePlayerName(g) === normalizedGuess
    );
    if (alreadyGuessedIncorrectly) {
      return { isCorrect: false, alreadyGuessed: true };
    }

    // Check against current roster
    const matchedPlayer = state.currentRoster.find(
      (p) => normalizePlayerName(p.name) === normalizedGuess
    );

    if (matchedPlayer) {
      set({
        guessedPlayers: [...state.guessedPlayers, matchedPlayer],
        score: state.score + 1,
      });

      return {
        isCorrect: true,
        player: matchedPlayer,
        alreadyGuessed: false,
      };
    }

    // Incorrect guess
    set({
      incorrectGuesses: [...state.incorrectGuesses, playerName],
    });

    return { isCorrect: false, alreadyGuessed: false };
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
      leaguePlayers: [],
      score: 0,
    });
  },

  tick: () => {
    const state = get();
    if (state.status === 'playing' && state.timeRemaining > 0) {
      set({ timeRemaining: state.timeRemaining - 1 });
    }
  },
}));
