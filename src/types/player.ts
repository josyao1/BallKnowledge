/** player.ts — NBA player type definitions. */

export interface Player {
  id: number;
  name: string;
  position?: string;
  number?: string;
  ppg: number;
  isLowScorer: boolean; // ppg < 10
}

export interface PlayerSearchResult {
  id: number;
  name: string;
}
