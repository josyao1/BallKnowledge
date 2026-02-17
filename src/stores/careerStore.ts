/**
 * careerStore.ts — Zustand store for Career game mode state.
 *
 * Manages the "Guess the Career" game where players see year-by-year stat lines
 * revealed one at a time and try to identify the mystery player.
 * Scoring: starts at 20, -1 per row revealed, -1 per wrong guess, -3 per hint. Min 0.
 */

import { create } from 'zustand';
import type { Sport } from '../types';

export interface CareerSeason {
  season: string;
  team: string;
  [key: string]: any;
}

export interface CareerBio {
  height: string;
  weight: number;
  school: string;
  exp: number;
  draftYear?: number;
  // NFL-specific
  draftClub?: string;
  draftNumber?: number;
  college?: string;
  yearsExp?: number;
}

export interface CareerGameData {
  playerId: string | number;
  playerName: string;
  position: string;
  seasons: CareerSeason[];
  bio: CareerBio;
}

interface CareerGameState {
  // Player data
  playerId: string | number;
  playerName: string;
  position: string;
  seasons: CareerSeason[];
  bio: CareerBio;
  sport: Sport;

  // Game progress
  status: 'idle' | 'playing' | 'won' | 'lost';
  yearsRevealed: boolean;
  bioRevealed: boolean;
  guesses: string[];
  score: number;

  // Actions
  initGame: (data: CareerGameData, sport: Sport) => void;
  revealYears: () => void;
  revealBio: () => void;
  giveUp: () => void;
  makeGuess: (name: string) => { correct: boolean };
  resetGame: () => void;
}

function normalizeCareerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const useCareerStore = create<CareerGameState>((set, get) => ({
  playerId: '',
  playerName: '',
  position: '',
  seasons: [],
  bio: { height: '', weight: 0, school: '', exp: 0 },
  sport: 'nba',

  status: 'idle',
  yearsRevealed: false,
  bioRevealed: false,
  guesses: [],
  score: 20,

  initGame: (data, sport) => {
    set({
      playerId: data.playerId,
      playerName: data.playerName,
      position: data.position,
      seasons: data.seasons,
      bio: data.bio,
      sport,
      status: 'playing',
      yearsRevealed: false,
      bioRevealed: false,
      guesses: [],
      score: 20,
    });
  },

  revealYears: () => {
    const state = get();
    if (state.status !== 'playing' || state.yearsRevealed) return;

    const newScore = Math.max(0, state.score - 3);
    set({ yearsRevealed: true, score: newScore });

    if (newScore === 0) {
      set({ status: 'lost' });
    }
  },

  revealBio: () => {
    const state = get();
    if (state.status !== 'playing' || state.bioRevealed) return;

    const newScore = Math.max(0, state.score - 3);
    set({ bioRevealed: true, score: newScore });

    if (newScore === 0) {
      set({ status: 'lost' });
    }
  },

  giveUp: () => {
    const state = get();
    if (state.status !== 'playing') return;
    set({ status: 'lost', score: 0 });
  },

  makeGuess: (name) => {
    const state = get();
    if (state.status !== 'playing') return { correct: false };

    const normalizedGuess = normalizeCareerName(name);
    const normalizedAnswer = normalizeCareerName(state.playerName);

    if (normalizedGuess === normalizedAnswer) {
      set({ status: 'won' });
      return { correct: true };
    }

    // Wrong guess
    const newScore = Math.max(0, state.score - 1);
    set({
      guesses: [...state.guesses, name],
      score: newScore,
    });

    if (newScore === 0) {
      set({ status: 'lost' });
    }

    return { correct: false };
  },

  resetGame: () => {
    set({
      playerId: '',
      playerName: '',
      position: '',
      seasons: [],
      bio: { height: '', weight: 0, school: '', exp: 0 },
      status: 'idle',
      yearsRevealed: false,
      bioRevealed: false,
      guesses: [],
      score: 20,
    });
  },
}));
