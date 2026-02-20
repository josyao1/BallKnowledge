/**
 * lineupIsRightStore.ts — Zustand store for "Lineup Is Right" game state.
 *
 * [NOTE: Simplified for new 5-player selection gameplay]
 * The multiplayer page now handles state locally.
 */

import { create } from 'zustand';
import type { LineupIsRightGameState, PlayerSeason } from '../types/lineupIsRight';
import type { Sport } from '../types';

interface LineupIsRightStore {
  gameState: LineupIsRightGameState | null;
  initializeGame: (
    currentPlayerId: string,
    playerNames: Record<string, string>,
    sport: Sport,
    win_target: number
  ) => void;
  selectPlayer: (playerSeason: PlayerSeason) => void;
  passTurn: () => void;
  bust: () => void;
  resetGame: () => void;
}

export const useLineupIsRightStore = create<LineupIsRightStore>(() => ({
  gameState: null,
  initializeGame: () => {
    // Simplified - state now handled locally in pages
  },
  selectPlayer: () => {
    // Simplified - state now handled locally in pages
  },
  passTurn: () => {
    // Simplified - state now handled locally in pages
  },
  bust: () => {
    // Simplified - state now handled locally in pages
  },
  resetGame: () => {
    // Simplified - state now handled locally in pages
  },
}));
