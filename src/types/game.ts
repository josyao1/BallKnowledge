import type { Player } from './player';
import type { Team } from './team';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended';
export type GameMode = 'random' | 'manual';

export interface GameSettings {
  timerDuration: number; // seconds
  yearRange: {
    min: number;
    max: number;
  };
}

export interface GameState {
  // Configuration
  selectedTeam: Team | null;
  selectedSeason: string | null;
  gameMode: GameMode;

  // Game progress
  status: GameStatus;
  timeRemaining: number;

  // Roster data
  currentRoster: Player[];
  guessedPlayers: Player[];
  incorrectGuesses: string[];

  // Scoring
  score: number;
  bonusPoints: number;
}

export interface GuessResult {
  isCorrect: boolean;
  player?: Player;
  bonusAwarded: boolean;
  alreadyGuessed: boolean;
}

export interface GameSession {
  id?: string;
  teamAbbreviation: string;
  season: string;
  score: number;
  bonusPoints: number;
  totalPlayers: number;
  guessedCount: number;
  percentage: number;
  timeTaken: number;
  timerDuration: number;
  guessedPlayers: string[];
  incorrectGuesses: string[];
  createdAt?: string;
}
