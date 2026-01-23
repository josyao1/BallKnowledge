import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLobbyStore } from '../stores/lobbyStore';
import type { Lobby, LobbyPlayer } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useLobbySubscription(lobbyId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
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
          if (payload.eventType === 'INSERT') {
            // Refresh all players to get correct order
            const { data } = await supabase!
              .from('lobby_players')
              .select()
              .eq('lobby_id', lobbyId)
              .order('joined_at', { ascending: true });
            if (data) setPlayers(data as LobbyPlayer[]);
          } else if (payload.eventType === 'UPDATE') {
            updatePlayer(payload.new as LobbyPlayer);
          } else if (payload.eventType === 'DELETE') {
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
