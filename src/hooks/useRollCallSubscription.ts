/**
 * useRollCallSubscription.ts — Realtime subscriptions for Roll Call.
 *
 * Subscribes to both roll_call_entries and roll_call_merges tables
 * filtered by lobby_id. Re-fetches on any change to stay consistent.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRollCallStore } from '../stores/rollCallStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRollCallSubscription(lobbyId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { fetchEntries, fetchMergeDecisions } = useRollCallStore();

  useEffect(() => {
    if (!supabase || !lobbyId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`roll_call:${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'roll_call_entries',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => { fetchEntries(lobbyId); }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'roll_call_merges',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => { fetchMergeDecisions(lobbyId); }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [lobbyId, fetchEntries, fetchMergeDecisions]);
}
