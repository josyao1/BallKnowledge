/**
 * lobbyStore.ts — Multiplayer lobby state management.
 *
 * Wraps the lobby service layer in a Zustand store so React components can
 * reactively read lobby/player state. Handles lobby creation, joining,
 * readiness, score syncing, and realtime update callbacks from Supabase.
 * Exports the `useLobbyStore` Zustand store.
 */

import { create } from 'zustand';
import type { Lobby, LobbyPlayer } from '../types/database';
import type { Sport } from '../types';
import {
  createLobby,
  findLobbyByCode,
  joinLobby,
  leaveLobby,
  getLobbyPlayers,
  updateLobbyStatus,
  updatePlayerScore,
  setPlayerReady,
  deleteLobby,
  getOrCreatePlayerId,
  updateLobbySettings,
  checkAllPlayersFinished,
  incrementPlayerWins,
  updatePlayerTeam,
  updateCareerState,
} from '../services/lobby';

interface LobbyState {
  // Current lobby data
  lobby: Lobby | null;
  players: LobbyPlayer[];
  currentPlayerId: string;
  isHost: boolean;

  // Loading/error states
  isLoading: boolean;
  error: string | null;

  // Actions
  createLobby: (
    hostName: string,
    sport: Sport,
    teamAbbreviation: string,
    season: string,
    timerDuration: number,
    gameMode: 'random' | 'manual',
    minYear: number,
    maxYear: number,
    gameType?: string,
    selectionScope?: string,
    divisionConference?: string | null,
    divisionName?: string | null
  ) => Promise<Lobby | null>;
  joinLobbyByCode: (joinCode: string, playerName: string) => Promise<boolean>;
  joinExistingLobby: (lobby: Lobby, playerName: string) => Promise<boolean>;
  leaveLobby: () => Promise<void>;
  setReady: (isReady: boolean) => Promise<void>;
  startGame: () => Promise<void>;
  endGame: () => Promise<void>;
  syncScore: (score: number, guessedCount: number, guessedPlayers?: string[], incorrectGuesses?: string[], isFinished?: boolean, fallbackLobbyId?: string) => Promise<void>;
  updateSettings: (settings: {
    sport?: Sport;
    teamAbbreviation?: string;
    season?: string;
    timerDuration?: number;
    gameMode?: 'random' | 'manual';
    minYear?: number;
    maxYear?: number;
    selectionScope?: string;
    divisionConference?: string | null;
    divisionName?: string | null;
  }) => Promise<void>;
  incrementWins: (playerId: string) => Promise<void>;
  assignTeam: (targetPlayerId: string, teamNumber: number | null) => Promise<void>;
  updateCareerState: (state: Record<string, unknown>) => Promise<void>;

  // Realtime updates (called by subscription hook)
  setLobby: (lobby: Lobby | null) => void;
  setPlayers: (players: LobbyPlayer[]) => void;
  updatePlayer: (player: LobbyPlayer) => void;
  removePlayer: (playerId: string) => void;

  // Cleanup
  reset: () => void;
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  lobby: null,
  players: [],
  currentPlayerId: getOrCreatePlayerId(),
  isHost: false,
  isLoading: false,
  error: null,

  createLobby: async (hostName, sport, teamAbbreviation, season, timerDuration, gameMode, minYear, maxYear, gameType, selectionScope, divisionConference, divisionName) => {
    set({ isLoading: true, error: null });

    const result = await createLobby(hostName, sport, teamAbbreviation, season, timerDuration, gameMode, minYear, maxYear, gameType, selectionScope, divisionConference, divisionName);

    if (result.error || !result.lobby) {
      set({ isLoading: false, error: result.error || 'Failed to create lobby' });
      return null;
    }

    const playerId = getOrCreatePlayerId();
    set({
      lobby: result.lobby,
      isHost: true,
      currentPlayerId: playerId,
      isLoading: false,
    });

    // Fetch initial players
    const playersResult = await getLobbyPlayers(result.lobby.id);
    if (playersResult.players) {
      set({ players: playersResult.players });
    }

    return result.lobby;
  },

  joinLobbyByCode: async (joinCode, playerName) => {
    set({ isLoading: true, error: null });

    const lobbyResult = await findLobbyByCode(joinCode);
    if (lobbyResult.error || !lobbyResult.lobby) {
      set({ isLoading: false, error: lobbyResult.error || 'Lobby not found' });
      return false;
    }

    return get().joinExistingLobby(lobbyResult.lobby, playerName);
  },

  joinExistingLobby: async (lobby, playerName) => {
    set({ isLoading: true, error: null });

    const result = await joinLobby(lobby.id, playerName);
    if (result.error || !result.player) {
      set({ isLoading: false, error: result.error || 'Failed to join lobby' });
      return false;
    }

    const playerId = getOrCreatePlayerId();
    set({
      lobby,
      isHost: result.player.is_host,
      currentPlayerId: playerId,
      isLoading: false,
    });

    // Fetch all players
    const playersResult = await getLobbyPlayers(lobby.id);
    if (playersResult.players) {
      set({ players: playersResult.players });
    }

    return true;
  },

  leaveLobby: async () => {
    const { lobby, isHost } = get();
    if (!lobby) return;

    if (isHost) {
      // Host leaving deletes the lobby
      await deleteLobby(lobby.id);
    } else {
      await leaveLobby(lobby.id);
    }

    get().reset();
  },

  setReady: async (isReady) => {
    const { lobby } = get();
    if (!lobby) return;

    await setPlayerReady(lobby.id, isReady);
  },

  startGame: async () => {
    const { lobby, isHost } = get();
    if (!lobby || !isHost) return;

    // First set to countdown
    await updateLobbyStatus(lobby.id, 'countdown');

    // After 3 seconds, set to playing (this will be handled by the UI)
  },

  endGame: async () => {
    const { lobby } = get();
    if (!lobby) return;

    // Check if all players have finished before setting lobby to finished
    const allFinished = await checkAllPlayersFinished(lobby.id);
    if (allFinished) {
      await updateLobbyStatus(lobby.id, 'finished');
    }
  },

  syncScore: async (score, guessedCount, guessedPlayers, incorrectGuesses, isFinished, fallbackLobbyId) => {
    const { lobby } = get();
    const lobbyId = lobby?.id || fallbackLobbyId;

    if (!lobbyId) {
      console.error('syncScore called but no lobby ID available (store lobby is null and no fallback provided)');
      return;
    }

    const result = await updatePlayerScore(lobbyId, score, guessedCount, guessedPlayers, incorrectGuesses, isFinished);
    if (result.error) {
      console.error('syncScore error:', result.error);
    }
  },

  updateSettings: async (settings) => {
    const { lobby, isHost } = get();
    if (!lobby || !isHost) return;

    // Map camelCase frontend keys to snake_case Supabase column names
    const dbSettings: Record<string, unknown> = {};
    if (settings.sport !== undefined) dbSettings.sport = settings.sport;
    if (settings.teamAbbreviation !== undefined) dbSettings.team_abbreviation = settings.teamAbbreviation;
    if (settings.season !== undefined) dbSettings.season = settings.season;
    if (settings.timerDuration !== undefined) dbSettings.timer_duration = settings.timerDuration;
    if (settings.gameMode !== undefined) dbSettings.game_mode = settings.gameMode;
    if (settings.minYear !== undefined) dbSettings.min_year = settings.minYear;
    if (settings.maxYear !== undefined) dbSettings.max_year = settings.maxYear;
    if (settings.selectionScope !== undefined) dbSettings.selection_scope = settings.selectionScope;
    if (settings.divisionConference !== undefined) dbSettings.division_conference = settings.divisionConference;
    if (settings.divisionName !== undefined) dbSettings.division_name = settings.divisionName;

    await updateLobbySettings(lobby.id, dbSettings as Parameters<typeof updateLobbySettings>[1]);
  },

  incrementWins: async (playerId) => {
    const { lobby } = get();
    if (!lobby) return;

    await incrementPlayerWins(lobby.id, playerId);
  },

  assignTeam: async (targetPlayerId, teamNumber) => {
    const { lobby, isHost } = get();
    if (!lobby || !isHost) return;

    await updatePlayerTeam(lobby.id, targetPlayerId, teamNumber);
  },

  updateCareerState: async (state) => {
    const { lobby } = get();
    if (!lobby) return;
    await updateCareerState(lobby.id, state);
  },

  // Realtime update handlers
  setLobby: (lobby) => {
    set({ lobby });
  },

  setPlayers: (players) => {
    // Also update isHost based on whether current player is the host
    const currentPlayerId = get().currentPlayerId;
    const currentPlayer = players.find(p => p.player_id === currentPlayerId);
    const isHost = currentPlayer?.is_host ?? false;
    set({ players, isHost });
  },

  updatePlayer: (updatedPlayer) => {
    set((state) => ({
      players: state.players.map((p) =>
        p.player_id === updatedPlayer.player_id ? updatedPlayer : p
      ),
    }));
  },

  removePlayer: (playerId) => {
    set((state) => ({
      players: state.players.filter((p) => p.player_id !== playerId),
    }));
  },

  reset: () => {
    set({
      lobby: null,
      players: [],
      isHost: false,
      isLoading: false,
      error: null,
    });
  },
}));
