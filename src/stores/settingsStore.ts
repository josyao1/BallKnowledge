/**
 * settingsStore.ts — Persisted user preferences.
 *
 * Stores sport selection, timer duration, year ranges, and gameplay options.
 * Uses Zustand's `persist` middleware to save/restore from localStorage
 * under the key "ball-knowledge-settings".
 * Exports the `useSettingsStore` Zustand store.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Sport } from '../types';

interface SettingsState {
  sport: Sport; // 'nba' or 'nfl'
  timerDuration: number; // seconds
  yearRange: { min: number; max: number };
  nflYearRange: { min: number; max: number };
  hideResultsDuringGame: boolean; // Don't show correct/incorrect until game ends
  showSeasonHints: boolean; // Show team record as a hint

  // Actions
  setSport: (sport: Sport) => void;
  setTimerDuration: (seconds: number) => void;
  setYearRange: (min: number, max: number) => void;
  setNFLYearRange: (min: number, max: number) => void;
  setHideResultsDuringGame: (hide: boolean) => void;
  setShowSeasonHints: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sport: 'nba', // Default to NBA
      timerDuration: 90, // 1:30 default
      yearRange: { min: 1985, max: 2026 }, // NBA year range
      nflYearRange: { min: 2000, max: 2025 }, // NFL year range
      hideResultsDuringGame: false, // Default: show results immediately
      showSeasonHints: false, // Default: don't show hints

      setSport: (sport) => set({ sport }),
      setTimerDuration: (seconds) => set({ timerDuration: seconds }),
      setYearRange: (min, max) => set({ yearRange: { min, max } }),
      setNFLYearRange: (min, max) => set({ nflYearRange: { min, max } }),
      setHideResultsDuringGame: (hide) => set({ hideResultsDuringGame: hide }),
      setShowSeasonHints: (show) => set({ showSeasonHints: show }),
    }),
    {
      name: 'ball-knowledge-settings',
    }
  )
);
