/**
 * rollCallStore.ts — Zustand store for Roll Call entries and merge state.
 *
 * Tracks entries and merge decisions. Merges are persisted to Supabase
 * so all players in the lobby see the same merge state in realtime.
 */

import { create } from 'zustand';
import type { RollCallEntry, RollCallMerge } from '../types/database';
import {
  submitEntry as submitEntryService,
  getEntries,
  deleteAllEntries,
  saveMergeDecision,
  getMergeDecisions,
  deleteAllMerges,
} from '../services/rollCall';

interface RollCallState {
  entries: RollCallEntry[];
  mergeDecisions: RollCallMerge[];

  setEntries: (entries: RollCallEntry[]) => void;
  addEntry: (entry: RollCallEntry) => void;
  submitEntry: (lobbyId: string, text: string) => Promise<RollCallEntry | null>;
  fetchEntries: (lobbyId: string) => Promise<void>;

  setMergeDecisions: (merges: RollCallMerge[]) => void;
  fetchMergeDecisions: (lobbyId: string) => Promise<void>;
  confirmMerge: (lobbyId: string, key: string, entryIds: string[], canonical: string) => Promise<void>;
  dismissSuggestion: (lobbyId: string, key: string, entryIds: string[], canonical: string) => Promise<void>;

  clearAll: (lobbyId: string) => Promise<void>;
  reset: () => void;
}

export const useRollCallStore = create<RollCallState>((set, get) => ({
  entries: [],
  mergeDecisions: [],

  setEntries: (entries) => set({ entries }),

  addEntry: (entry) => {
    const existing = get().entries;
    if (existing.some(e => e.id === entry.id)) return;
    set({ entries: [...existing, entry] });
  },

  submitEntry: async (lobbyId, text) => {
    const result = await submitEntryService(lobbyId, text);
    if (result.error || !result.entry) return null;
    return result.entry;
  },

  fetchEntries: async (lobbyId) => {
    const result = await getEntries(lobbyId);
    if (!result.error) set({ entries: result.entries });
  },

  setMergeDecisions: (merges) => set({ mergeDecisions: merges }),

  fetchMergeDecisions: async (lobbyId) => {
    const result = await getMergeDecisions(lobbyId);
    if (!result.error) set({ mergeDecisions: result.merges });
  },

  confirmMerge: async (lobbyId, key, entryIds, canonical) => {
    await saveMergeDecision(lobbyId, key, entryIds, canonical, false);
  },

  dismissSuggestion: async (lobbyId, key, entryIds, canonical) => {
    await saveMergeDecision(lobbyId, key, entryIds, canonical, true);
  },

  clearAll: async (lobbyId) => {
    await deleteAllEntries(lobbyId);
    await deleteAllMerges(lobbyId);
    set({ entries: [], mergeDecisions: [] });
  },

  reset: () => set({ entries: [], mergeDecisions: [] }),
}));
