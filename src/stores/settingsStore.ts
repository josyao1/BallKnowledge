import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Sport } from '../types';

interface SettingsState {
  sport: Sport; // 'nba' or 'nfl'
  timerDuration: number; // seconds
  yearRange: { min: number; max: number };
  nflYearRange: { min: number; max: number };
  hideResultsDuringGame: boolean; // Don't show correct/incorrect until game ends

  // Actions
  setSport: (sport: Sport) => void;
  setTimerDuration: (seconds: number) => void;
  setYearRange: (min: number, max: number) => void;
  setNFLYearRange: (min: number, max: number) => void;
  setHideResultsDuringGame: (hide: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sport: 'nba', // Default to NBA
      timerDuration: 90, // 1:30 default
      yearRange: { min: 1985, max: 2025 }, // NBA year range
      nflYearRange: { min: 2000, max: 2024 }, // NFL year range
      hideResultsDuringGame: false, // Default: show results immediately

      setSport: (sport) => set({ sport }),
      setTimerDuration: (seconds) => set({ timerDuration: seconds }),
      setYearRange: (min, max) => set({ yearRange: { min, max } }),
      setNFLYearRange: (min, max) => set({ nflYearRange: { min, max } }),
      setHideResultsDuringGame: (hide) => set({ hideResultsDuringGame: hide }),
    }),
    {
      name: 'ball-knowledge-settings',
    }
  )
);
