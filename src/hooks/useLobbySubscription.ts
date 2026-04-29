/**
 * useLobbySubscription.ts — Supabase realtime subscription for lobby updates.
 *
 * Subscribes to Postgres changes on both the `lobbies` and `lobby_players`
 * tables filtered by lobby ID. On any player change, re-fetches all players
 * (rather than applying individual deltas) to ensure consistency after
 * batch operations like round resets. Automatically cleans up the channel
 * on unmount or lobby ID change.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLobbyStore } from '../stores/lobbyStore';
import type { Lobby, LobbyPlayer } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useLobbySubscription(lobbyId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Monotonic counter: prevents an older in-flight fetch from overwriting a
  // newer one when two lobby_players events arrive in rapid succession.
  const fetchSeqRef = useRef(0);
  const { setLobby, setPlayers, updatePlayer, removePlayer } = useLobbyStore();

  useEffect(() => {
    if (!supabase || !lobbyId) return;

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create channel for this lobby
    const channel = supabase
      .channel(`lobby:${lobbyId}`)
      // Listen for lobby changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobbies',
          filter: `id=eq.${lobbyId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setLobby(payload.new as Lobby);
          } else if (payload.eventType === 'DELETE') {
            setLobby(null);
          }
        }
      )
      // Listen for player changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobby_players',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        async (payload) => {
          // Stamp this fetch; discard the result if a newer fetch completes first.
          const mySeq = ++fetchSeqRef.current;
          // Always refresh all players to ensure consistency
          // This handles batch updates (like reset) better than individual updates
          const { data } = await supabase!
            .from('lobby_players')
            .select()
            .eq('lobby_id', lobbyId)
            .order('joined_at', { ascending: true });
          if (data && mySeq === fetchSeqRef.current) {
            setPlayers(data as LobbyPlayer[]);
          }

          // Also handle deletion specifically
          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { player_id?: string };
            if (deleted.player_id) {
              removePlayer(deleted.player_id);
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup on unmount or lobbyId change
    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [lobbyId, setLobby, setPlayers, updatePlayer, removePlayer]);
}
