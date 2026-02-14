import { create } from 'zustand';
import type { GameStatus, GameMode, Sport } from '../types';

interface LeaguePlayer {
  id: number | string;
  name: string;
}

// Local GuessResult that uses GenericPlayer
interface GuessResult {
  isCorrect: boolean;
  player?: GenericPlayer;
  alreadyGuessed: boolean;
}

// Generic team type to support both NBA and NFL
interface GenericTeam {
  id: number;
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
  // Optional NBA-specific fields
  city?: string;
  conference?: string;
  division?: string;
}

// Generic player type to support both NBA and NFL
interface GenericPlayer {
  id: number | string;
  name: string;
  position?: string;
  number?: string;
  // Optional NBA-specific fields
  ppg?: number;
  isLowScorer?: boolean;
  // Optional NFL-specific fields
  unit?: string;
}

interface GameState {
  // Configuration
  sport: Sport;
  selectedTeam: GenericTeam | null;
  selectedSeason: string | null;
  gameMode: GameMode;
  timerDuration: number;
  hideResultsDuringGame: boolean;

  // Game progress
  status: GameStatus;
  timeRemaining: number;
  startTime: number | null;

  // Roster data
  currentRoster: GenericPlayer[];

  // Pending guesses (during game - not yet validated, used when hideResultsDuringGame is true)
  pendingGuesses: string[];

  // Final results (after game ends, or during game if hideResultsDuringGame is false)
  guessedPlayers: GenericPlayer[];
  incorrectGuesses: string[];

  // League-wide players for autocomplete (all players from the season)
  leaguePlayers: LeaguePlayer[];

  // Scoring
  score: number;

  // Actions
  setGameConfig: (sport: Sport, team: GenericTeam, season: string, mode: GameMode, duration: number, roster: GenericPlayer[], leaguePlayers?: LeaguePlayer[], hideResultsDuringGame?: boolean) => void;
  startGame: () => void;
  makeGuess: (playerName: string, teammateGuessedNames?: string[]) => GuessResult;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  processGuesses: () => void;
  overrideGuess: (incorrectGuess: string, correctPlayerId: number) => boolean;
  resetGame: () => void;
  resetForRematch: () => void;
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
  sport: 'nba',
  selectedTeam: null,
  selectedSeason: null,
  gameMode: 'random',
  timerDuration: 90,
  hideResultsDuringGame: false,
  status: 'idle',
  timeRemaining: 90,
  startTime: null,
  currentRoster: [],
  pendingGuesses: [],
  guessedPlayers: [],
  incorrectGuesses: [],
  leaguePlayers: [],
  score: 0,

  setGameConfig: (sport, team, season, mode, duration, roster, leaguePlayers = [], hideResultsDuringGame = false) => {
    set({
      sport,
      selectedTeam: team,
      selectedSeason: season,
      gameMode: mode,
      timerDuration: duration,
      hideResultsDuringGame,
      timeRemaining: duration,
      currentRoster: roster,
      leaguePlayers,
      status: 'idle',
      pendingGuesses: [],
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

  makeGuess: (playerName: string, teammateGuessedNames?: string[]): GuessResult => {
    const state = get();

    if (state.status !== 'playing') {
      return { isCorrect: false, alreadyGuessed: false };
    }

    const normalizedGuess = normalizePlayerName(playerName);

    // Check if a teammate already guessed this player (team mode)
    if (teammateGuessedNames && teammateGuessedNames.length > 0) {
      const guessedByTeammate = teammateGuessedNames.some(
        (name) => normalizePlayerName(name) === normalizedGuess
      );
      if (guessedByTeammate) {
        return { isCorrect: false, alreadyGuessed: true };
      }
    }

    // Hidden results mode: use pendingGuesses, don't reveal correctness
    if (state.hideResultsDuringGame) {
      // Check if already guessed (pending guesses)
      const alreadyGuessed = state.pendingGuesses.some(
        (g) => normalizePlayerName(g) === normalizedGuess
      );
      if (alreadyGuessed) {
        return { isCorrect: false, alreadyGuessed: true };
      }

      // Add to pending guesses (don't reveal if correct/incorrect yet)
      set({
        pendingGuesses: [...state.pendingGuesses, playerName],
      });

      // Return neutral result - we don't reveal correctness during game
      return { isCorrect: false, alreadyGuessed: false };
    }

    // Standard mode: show results immediately (original behavior)
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

  // Process all pending guesses to determine correct/incorrect
  processGuesses: () => {
    const state = get();
    const correct: GenericPlayer[] = [];
    const incorrect: string[] = [];

    for (const guess of state.pendingGuesses) {
      const normalizedGuess = normalizePlayerName(guess);
      const matchedPlayer = state.currentRoster.find(
        (p) => normalizePlayerName(p.name) === normalizedGuess
      );

      if (matchedPlayer && !correct.some(p => p.id === matchedPlayer.id)) {
        correct.push(matchedPlayer);
      } else if (!matchedPlayer) {
        incorrect.push(guess);
      }
      // Duplicates that matched same player are silently ignored
    }

    set({
      guessedPlayers: correct,
      incorrectGuesses: incorrect,
      score: correct.length,
    });
  },

  // Override an incorrect guess by assigning it to a correct player (drag-to-correct)
  overrideGuess: (incorrectGuess: string, correctPlayerId: number): boolean => {
    const state = get();

    // Find the player to assign this guess to
    const targetPlayer = state.currentRoster.find(p => p.id === correctPlayerId);
    if (!targetPlayer) return false;

    // Check if this player was already guessed correctly
    if (state.guessedPlayers.some(p => p.id === correctPlayerId)) {
      return false;
    }

    // Remove from incorrect guesses and add to correct
    const newIncorrect = state.incorrectGuesses.filter(g => g !== incorrectGuess);
    const newCorrect = [...state.guessedPlayers, targetPlayer];

    set({
      guessedPlayers: newCorrect,
      incorrectGuesses: newIncorrect,
      score: newCorrect.length,
    });

    return true;
  },

  resetGame: () => {
    set({
      sport: 'nba',
      selectedTeam: null,
      selectedSeason: null,
      gameMode: 'random',
      hideResultsDuringGame: false,
      status: 'idle',
      timeRemaining: get().timerDuration,
      startTime: null,
      currentRoster: [],
      pendingGuesses: [],
      guessedPlayers: [],
      incorrectGuesses: [],
      leaguePlayers: [],
      score: 0,
    });
  },

  // Reset for rematch - keep team, season, roster, settings but reset game progress
  resetForRematch: () => {
    const state = get();
    set({
      status: 'idle',
      timeRemaining: state.timerDuration,
      startTime: null,
      pendingGuesses: [],
      guessedPlayers: [],
      incorrectGuesses: [],
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
