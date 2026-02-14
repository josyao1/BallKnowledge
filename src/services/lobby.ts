import { supabase } from '../lib/supabase';
import type { Lobby, LobbyInsert, LobbyPlayer, LobbyPlayerInsert, LobbyStatus } from '../types/database';
import { teams } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';

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
  timerDuration: number = 90,
  gameMode: 'random' | 'manual' = 'manual',
  minYear: number = 2015,
  maxYear: number = 2024
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
      game_mode: gameMode,
      min_year: minYear,
      max_year: maxYear,
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
  guessedCount: number,
  guessedPlayers?: string[],
  incorrectGuesses?: string[],
  isFinished?: boolean
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  const playerId = getOrCreatePlayerId();

  const updateData: Record<string, unknown> = { score, guessed_count: guessedCount };
  if (guessedPlayers !== undefined) {
    updateData.guessed_players = guessedPlayers;
  }
  if (incorrectGuesses !== undefined) {
    updateData.incorrect_guesses = incorrectGuesses;
  }
  if (isFinished) {
    updateData.finished_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('lobby_players')
    .update(updateData)
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId);

  return { error: error?.message || null };
}

// Check if all players have finished
export async function checkAllPlayersFinished(lobbyId: string): Promise<boolean> {
  if (!supabase) return false;

  const { data: players, error } = await supabase
    .from('lobby_players')
    .select('finished_at, is_connected')
    .eq('lobby_id', lobbyId);

  if (error || !players) return false;

  // All connected players must have finished_at set
  return players.every(p => p.finished_at !== null);
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

// Update lobby settings (host only)
export async function updateLobbySettings(
  lobbyId: string,
  settings: {
    sport?: string;
    team_abbreviation?: string;
    season?: string;
    timer_duration?: number;
    game_mode?: 'random' | 'manual';
    min_year?: number;
    max_year?: number;
  }
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  const { error } = await supabase
    .from('lobbies')
    .update(settings)
    .eq('id', lobbyId);

  return { error: error?.message || null };
}

// Increment wins for a player
export async function incrementPlayerWins(lobbyId: string, playerId: string): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  // First get the current wins count
  const { data: player, error: fetchError } = await supabase
    .from('lobby_players')
    .select('wins')
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId)
    .single();

  if (fetchError || !player) {
    return { error: fetchError?.message || 'Player not found' };
  }

  const { error } = await supabase
    .from('lobby_players')
    .update({ wins: (player.wins || 0) + 1 })
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId);

  return { error: error?.message || null };
}

// Reset lobby for a new round (host only)
export async function resetLobbyForNewRound(lobbyId: string): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  // First, fetch the current lobby to check game_mode, year range, and used teams
  const { data: currentLobby, error: fetchError } = await supabase
    .from('lobbies')
    .select('game_mode, sport, min_year, max_year, used_nba_teams, used_nfl_teams, team_abbreviation')
    .eq('id', lobbyId)
    .single();

  if (fetchError || !currentLobby) {
    return { error: fetchError?.message || 'Lobby not found' };
  }

  // Build the update object
  const lobbyUpdate: Record<string, unknown> = {
    status: 'waiting',
    started_at: null,
    finished_at: null,
  };

  // If random mode, pick a new random team and season using stored year range
  if (currentLobby.game_mode === 'random') {
    const sport = currentLobby.sport;
    const teamList = sport === 'nba' ? teams : nflTeams;
    const allTeamAbbrs = teamList.map(t => t.abbreviation);

    // Get used teams for this sport, including the current team
    const usedTeamsKey = sport === 'nba' ? 'used_nba_teams' : 'used_nfl_teams';
    let usedTeams: string[] = (currentLobby[usedTeamsKey] as string[]) || [];

    // Add current team to used list if not already there
    if (currentLobby.team_abbreviation && !usedTeams.includes(currentLobby.team_abbreviation)) {
      usedTeams = [...usedTeams, currentLobby.team_abbreviation];
    }

    // Filter out used teams
    let availableTeams = allTeamAbbrs.filter(abbr => !usedTeams.includes(abbr));

    console.log(`[Team Tracking] Sport: ${sport}`);
    console.log(`[Team Tracking] Total teams: ${allTeamAbbrs.length}`);
    console.log(`[Team Tracking] Used teams (${usedTeams.length}): ${usedTeams.join(', ')}`);
    console.log(`[Team Tracking] Available teams (${availableTeams.length}): ${availableTeams.join(', ')}`);

    // If all teams used, reset the list
    if (availableTeams.length === 0) {
      console.log(`[Team Tracking] All ${sport.toUpperCase()} teams used! Resetting list.`);
      usedTeams = [];
      availableTeams = allTeamAbbrs;
    }

    // Pick a random team from available
    const randomTeamAbbr = availableTeams[Math.floor(Math.random() * availableTeams.length)];
    const randomTeam = teamList.find(t => t.abbreviation === randomTeamAbbr)!;

    // Update used teams list
    const newUsedTeams = [...usedTeams, randomTeamAbbr];
    lobbyUpdate[usedTeamsKey] = newUsedTeams;

    console.log(`[Team Tracking] Selected: ${randomTeamAbbr} (${randomTeam.name})`);
    console.log(`[Team Tracking] Updated used teams (${newUsedTeams.length}): ${newUsedTeams.join(', ')}`);

    // Use stored year range, fallback to defaults if not set
    const minYear = currentLobby.min_year || (sport === 'nfl' ? 2000 : 2015);
    const maxYear = currentLobby.max_year || 2024;
    const randomYear = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;

    lobbyUpdate.team_abbreviation = randomTeamAbbr;
    lobbyUpdate.season = sport === 'nba'
      ? `${randomYear}-${String(randomYear + 1).slice(-2)}`
      : `${randomYear}`;
  }

  // Reset lobby status (and team/season if random)
  const { error: lobbyError } = await supabase
    .from('lobbies')
    .update(lobbyUpdate)
    .eq('id', lobbyId);

  if (lobbyError) {
    return { error: lobbyError.message };
  }

  // Reset non-host player scores and ready status
  const { error: playersError } = await supabase
    .from('lobby_players')
    .update({
      score: 0,
      guessed_count: 0,
      guessed_players: [],
      incorrect_guesses: [],
      is_ready: false,
      finished_at: null,
    })
    .eq('lobby_id', lobbyId)
    .eq('is_host', false);

  if (playersError) {
    return { error: playersError.message };
  }

  // Reset host scores but keep them ready
  const { error: hostError } = await supabase
    .from('lobby_players')
    .update({
      score: 0,
      guessed_count: 0,
      guessed_players: [],
      incorrect_guesses: [],
      is_ready: true,
      finished_at: null,
    })
    .eq('lobby_id', lobbyId)
    .eq('is_host', true);

  if (hostError) {
    return { error: hostError.message };
  }

  return { error: null };
}

// Update team assignment for a player (host only)
export async function updatePlayerTeam(
  lobbyId: string,
  targetPlayerId: string,
  teamNumber: number | null
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  const { error } = await supabase
    .from('lobby_players')
    .update({ team_number: teamNumber })
    .eq('lobby_id', lobbyId)
    .eq('player_id', targetPlayerId);

  return { error: error?.message || null };
}

// Toggle dummy mode for a player (host only)
export async function setPlayerDummyMode(
  lobbyId: string,
  playerId: string,
  isDummy: boolean
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  const { error } = await supabase
    .from('lobby_players')
    .update({ is_dummy: isDummy })
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId);

  return { error: error?.message || null };
}
