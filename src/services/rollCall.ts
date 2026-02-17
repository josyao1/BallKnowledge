/**
 * rollCall.ts — Supabase service for Roll Call entries.
 *
 * Handles CRUD for roll_call_entries table. Follows the same
 * `{ data, error }` return pattern as lobby.ts.
 */

import { supabase } from '../lib/supabase';
import type { Lobby, RollCallEntry, RollCallEntryInsert, RollCallMerge } from '../types/database';
import { getOrCreatePlayerId, getStoredPlayerName, createLobby } from './lobby';

export async function submitEntry(
  lobbyId: string,
  entryText: string
): Promise<{ entry: RollCallEntry | null; error: string | null }> {
  if (!supabase) {
    return { entry: null, error: 'Multiplayer not available' };
  }

  const playerId = getOrCreatePlayerId();
  const playerName = getStoredPlayerName() || 'Anonymous';

  const data: RollCallEntryInsert = {
    lobby_id: lobbyId,
    player_id: playerId,
    player_name: playerName,
    entry_text: entryText.trim(),
  };

  const { data: entry, error } = await supabase
    .from('roll_call_entries')
    .insert(data)
    .select()
    .single();

  if (error) {
    return { entry: null, error: error.message };
  }

  return { entry: entry as RollCallEntry, error: null };
}

export async function getEntries(
  lobbyId: string
): Promise<{ entries: RollCallEntry[]; error: string | null }> {
  if (!supabase) {
    return { entries: [], error: 'Multiplayer not available' };
  }

  const { data: entries, error } = await supabase
    .from('roll_call_entries')
    .select()
    .eq('lobby_id', lobbyId)
    .order('submitted_at', { ascending: true });

  if (error) {
    return { entries: [], error: error.message };
  }

  return { entries: entries as RollCallEntry[], error: null };
}

export async function deleteAllEntries(
  lobbyId: string
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Multiplayer not available' };
  }

  const { error } = await supabase
    .from('roll_call_entries')
    .delete()
    .eq('lobby_id', lobbyId);

  return { error: error?.message || null };
}

export async function deleteEntriesByIds(
  entryIds: string[]
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Multiplayer not available' };

  const { error } = await supabase
    .from('roll_call_entries')
    .delete()
    .in('id', entryIds);

  return { error: error?.message || null };
}

export async function saveMergeDecision(
  lobbyId: string,
  suggestionKey: string,
  entryIds: string[],
  canonical: string,
  isDismissed: boolean
): Promise<{ merge: RollCallMerge | null; error: string | null }> {
  if (!supabase) return { merge: null, error: 'Multiplayer not available' };

  const { data, error } = await supabase
    .from('roll_call_merges')
    .insert({
      lobby_id: lobbyId,
      suggestion_key: suggestionKey,
      entry_ids: entryIds,
      canonical,
      is_dismissed: isDismissed,
    })
    .select()
    .single();

  if (error) return { merge: null, error: error.message };
  return { merge: data as RollCallMerge, error: null };
}

export async function getMergeDecisions(
  lobbyId: string
): Promise<{ merges: RollCallMerge[]; error: string | null }> {
  if (!supabase) return { merges: [], error: 'Multiplayer not available' };

  const { data, error } = await supabase
    .from('roll_call_merges')
    .select()
    .eq('lobby_id', lobbyId)
    .order('created_at', { ascending: true });

  if (error) return { merges: [], error: error.message };
  return { merges: data as RollCallMerge[], error: null };
}

export async function deleteAllMerges(
  lobbyId: string
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Multiplayer not available' };

  const { error } = await supabase
    .from('roll_call_merges')
    .delete()
    .eq('lobby_id', lobbyId);

  return { error: error?.message || null };
}

export async function createRollCallLobby(
  hostName: string
): Promise<{ lobby: Lobby | null; error: string | null }> {
  const result = await createLobby(
    hostName,
    'nba',
    'ALL',
    'all-time',
    0,
    'manual',
    2000,
    2024,
    'roll_call'
  );

  if (result.error) {
    return { lobby: null, error: result.error };
  }

  return { lobby: result.lobby, error: null };
}
