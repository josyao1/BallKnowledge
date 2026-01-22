import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  timerDuration: number; // seconds
  yearRange: { min: number; max: number };

  // Actions
  setTimerDuration: (seconds: number) => void;
  setYearRange: (min: number, max: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      timerDuration: 90, // 1:30 default
      yearRange: { min: 1985, max: 2025 },

      setTimerDuration: (seconds) => set({ timerDuration: seconds }),
      setYearRange: (min, max) => set({ yearRange: { min, max } }),
    }),
    {
      name: 'ball-knowledge-settings',
    }
  )
);
