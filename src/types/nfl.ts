/**
 * NFL-specific types
 */

export interface NFLTeam {
  id: number;
  abbreviation: string;
  name: string;
  city: string;
  colors: {
    primary: string;
    secondary: string;
  };
  conference: 'AFC' | 'NFC';
  division: 'East' | 'North' | 'South' | 'West';
}

export interface NFLPlayer {
  id: string;
  name: string;
  position: string;
  number: string;
  unit: 'Offense' | 'Defense' | 'Special Teams';
}

export type NFLGameMode = 'random' | 'manual';

export type NFLGameStatus = 'idle' | 'playing' | 'paused' | 'ended';

export interface NFLGuessResult {
  isCorrect: boolean;
  player?: NFLPlayer;
  alreadyGuessed: boolean;
}
