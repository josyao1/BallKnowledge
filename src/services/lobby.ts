import { supabase } from '../lib/supabase';
import type { Lobby, LobbyInsert, LobbyPlayer, LobbyPlayerInsert, LobbyStatus } from '../types/database';

// Generate a random 6-character join code
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a unique player ID (stored in localStorage)
export function getOrCreatePlayerId(): string {
  const stored = localStorage.getItem('ballknowledge_player_id');
  if (stored) return stored;

  const newId = crypto.randomUUID();
  localStorage.setItem('ballknowledge_player_id', newId);
  return newId;
}

// Get stored player name
export function getStoredPlayerName(): string | null {
  return localStorage.getItem('ballknowledge_player_name');
}

// Store player name
export function setStoredPlayerName(name: string): void {
  localStorage.setItem('ballknowledge_player_name', name);
}

// Create a new lobby
export async function createLobby(
  hostName: string,
  sport: string,
  teamAbbreviation: string,
  season: string,
  timerDuration: number = 90
): Promise<{ lobby: Lobby; error: null } | { lobby: null; error: string }> {
  if (!supabase) {
    return { lobby: null, error: 'Multiplayer not available' };
  }

  const hostId = getOrCreatePlayerId();
  setStoredPlayerName(hostName);

  // Try to generate a unique join code (max 5 attempts)
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();

    const lobbyData: LobbyInsert = {
      join_code: joinCode,
      host_id: hostId,
      host_name: hostName,
      sport,
      team_abbreviation: teamAbbreviation,
      season,
      timer_duration: timerDuration,
      status: 'waiting',
    };

    const { data: lobby, error } = await supabase
      .from('lobbies')
      .insert(lobbyData)
      .select()
      .single();

    if (error) {
      // If duplicate code, try again
      if (error.code === '23505') continue;
      return { lobby: null, error: error.message };
    }

    // Add host as first player
    const playerData: LobbyPlayerInsert = {
      lobby_id: lobby.id,
      player_id: hostId,
      player_name: hostName,
      is_host: true,
      is_ready: true,
    };

    const { error: playerError } = await supabase
      .from('lobby_players')
      .insert(playerData);

    if (playerError) {
      // Clean up lobby if player insert fails
      await supabase.from('lobbies').delete().eq('id', lobby.id);
      return { lobby: null, error: playerError.message };
    }

    return { lobby: lobby as Lobby, error: null };
  }

  return { lobby: null, error: 'Failed to generate unique code' };
}

// Find lobby by join code
export async function findLobbyByCode(
  joinCode: string
): Promise<{ lobby: Lobby; error: null } | { lobby: null; error: string }> {
  if (!supabase) {
    return { lobby: null, error: 'Multiplayer not available' };
  }

  const { data: lobby, error } = await supabase
    .from('lobbies')
    .select()
    .eq('join_code', joinCode.toUpperCase())
    .single();

  if (error || !lobby) {
    return { lobby: null, error: 'Lobby not found' };
  }

  return { lobby: lobby as Lobby, error: null };
}

// Join a lobby
export async function joinLobby(
  lobbyId: string,
  playerName: string
): Promise<{ player: LobbyPlayer; error: null } | { player: null; error: string }> {
  if (!supabase) {
    return { player: null, error: 'Multiplayer not available' };
  }

  const playerId = getOrCreatePlayerId();
  setStoredPlayerName(playerName);

  // Check if lobby exists and is joinable
  const { data: lobby, error: lobbyError } = await supabase
    .from('lobbies')
    .select()
    .eq('id', lobbyId)
    .single();

  if (lobbyError || !lobby) {
    return { player: null, error: 'Lobby not found' };
  }

  if (lobby.status !== 'waiting') {
    return { player: null, error: 'Game already started' };
  }

  // Check player count
  const { count } = await supabase
    .from('lobby_players')
    .select('*', { count: 'exact', head: true })
    .eq('lobby_id', lobbyId);

  if (count && count >= lobby.max_players) {
    return { player: null, error: 'Lobby is full' };
  }

  // Check if already in lobby
  const { data: existingPlayer } = await supabase
    .from('lobby_players')
    .select()
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId)
    .single();

  if (existingPlayer) {
    // Update connection status if rejoining
    const { data: updated, error: updateError } = await supabase
      .from('lobby_players')
      .update({ is_connected: true, player_name: playerName })
      .eq('id', existingPlayer.id)
      .select()
      .single();

    if (updateError) {
      return { player: null, error: updateError.message };
    }
    return { player: updated as LobbyPlayer, error: null };
  }

  // Add new player
  const playerData: LobbyPlayerInsert = {
    lobby_id: lobbyId,
    player_id: playerId,
    player_name: playerName,
    is_host: false,
    is_ready: false,
  };

  const { data: player, error } = await supabase
    .from('lobby_players')
    .insert(playerData)
    .select()
    .single();

  if (error) {
    return { player: null, error: error.message };
  }

  return { player: player as LobbyPlayer, error: null };
}

// Leave a lobby
export async function leaveLobby(lobbyId: string): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  const playerId = getOrCreatePlayerId();

  const { error } = await supabase
    .from('lobby_players')
    .delete()
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId);

  return { error: error?.message || null };
}

// Get lobby players
export async function getLobbyPlayers(
  lobbyId: string
): Promise<{ players: LobbyPlayer[]; error: null } | { players: null; error: string }> {
  if (!supabase) {
    return { players: null, error: 'Multiplayer not available' };
  }

  const { data: players, error } = await supabase
    .from('lobby_players')
    .select()
    .eq('lobby_id', lobbyId)
    .order('joined_at', { ascending: true });

  if (error) {
    return { players: null, error: error.message };
  }

  return { players: players as LobbyPlayer[], error: null };
}

// Update lobby status
export async function updateLobbyStatus(
  lobbyId: string,
  status: LobbyStatus
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  const updates: Record<string, unknown> = { status };

  if (status === 'playing') {
    updates.started_at = new Date().toISOString();
  } else if (status === 'finished') {
    updates.finished_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('lobbies')
    .update(updates)
    .eq('id', lobbyId);

  return { error: error?.message || null };
}

// Update player score
export async function updatePlayerScore(
  lobbyId: string,
  score: number,
  guessedCount: number
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  const playerId = getOrCreatePlayerId();

  const { error } = await supabase
    .from('lobby_players')
    .update({ score, guessed_count: guessedCount })
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId);

  return { error: error?.message || null };
}

// Set player ready status
export async function setPlayerReady(
  lobbyId: string,
  isReady: boolean
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  const playerId = getOrCreatePlayerId();

  const { error } = await supabase
    .from('lobby_players')
    .update({ is_ready: isReady })
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId);

  return { error: error?.message || null };
}

// Delete a lobby (host only)
export async function deleteLobby(lobbyId: string): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  const { error } = await supabase
    .from('lobbies')
    .delete()
    .eq('id', lobbyId);

  return { error: error?.message || null };
}

// Reset lobby for a new round (host only)
export async function resetLobbyForNewRound(lobbyId: string): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  // Reset lobby status to waiting
  const { error: lobbyError } = await supabase
    .from('lobbies')
    .update({
      status: 'waiting',
      started_at: null,
      finished_at: null,
    })
    .eq('id', lobbyId);

  if (lobbyError) {
    return { error: lobbyError.message };
  }

  // Reset all player scores and ready status
  const { error: playersError } = await supabase
    .from('lobby_players')
    .update({
      score: 0,
      guessed_count: 0,
      is_ready: false,
      finished_at: null,
    })
    .eq('lobby_id', lobbyId);

  if (playersError) {
    return { error: playersError.message };
  }

  return { error: null };
}
