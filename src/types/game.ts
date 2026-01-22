import type { Player } from './player';
import type { Team } from './team';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended';
export type GameMode = 'random' | 'manual';
export type Sport = 'nba' | 'nfl';

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
}

export interface GuessResult {
  isCorrect: boolean;
  player?: Player;
  alreadyGuessed: boolean;
}

export interface GameSession {
  id?: string;
  teamAbbreviation: string;
  season: string;
  score: number;
  totalPlayers: number;
  guessedCount: number;
  percentage: number;
  timeTaken: number;
  timerDuration: number;
  guessedPlayers: string[];
  incorrectGuesses: string[];
  createdAt?: string;
}
