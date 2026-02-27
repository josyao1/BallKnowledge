/**
 * EmoteOverlay.tsx — Floating emote taunts for multiplayer modes.
 *
 * Players send one of 5 emojis via Supabase Realtime broadcast.
 * Incoming emotes fly in from a screen edge, land at a predefined zone
 * with a spring bounce, show the sender's name underneath, then exit
 * back the same way after 2.5s. Up to 6 can be on screen simultaneously,
 * each occupying its own zone (cycled via a rotating index so simultaneous
 * sends never overlap).
 *
 * Uses a dedicated broadcast-only channel `emotes:{lobbyId}` so it never
 * interferes with the postgres-changes subscription in useLobbySubscription.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const EMOTES = ['💩', '👅', '🍆', '😰', '💀'];
const COOLDOWN_MS = 10_000;
const DISPLAY_MS  = 2_500;

/**
 * Six fixed anchor positions that cover the screen without touching
 * the bottom area where inputs live. Each zone knows which edge to
 * enter/exit from (initX/initY pixel offset).
 */
const ZONES = [
  { left: '6%',  top: '8%',  initX: -180, initY: 0    }, // TL  — from left
  { left: '40%', top: '4%',  initX: 0,    initY: -180 }, // TC  — from top
  { left: '76%', top: '8%',  initX: 180,  initY: 0    }, // TR  — from right
  { left: '4%',  top: '40%', initX: -180, initY: 0    }, // ML  — from left
  { left: '78%', top: '40%', initX: 180,  initY: 0    }, // MR  — from right
  { left: '38%', top: '24%', initX: 0,    initY: -180 }, // UC  — from top
] as const;

interface ActiveEmote {
  id: string;
  emoji: string;
  senderName: string;
  zoneIdx: number;
}

interface EmoteOverlayProps {
  lobbyId: string | null | undefined;
  currentPlayerId: string | null | undefined;
  currentPlayerName: string | null | undefined;
}

export function EmoteOverlay({ lobbyId, currentPlayerId, currentPlayerName }: EmoteOverlayProps) {
  const [activeEmotes, setActiveEmotes] = useState<ActiveEmote[]>([]);
  const [onCooldown, setOnCooldown]     = useState(false);
  const [expanded, setExpanded]         = useState(false);
  const channelRef   = useRef<RealtimeChannel | null>(null);
  const nextZoneRef  = useRef(0);

  useEffect(() => {
    if (!supabase || !lobbyId) return;

    const channel = supabase
      .channel(`emotes:${lobbyId}`)
      .on('broadcast', { event: 'emote' }, ({ payload }) => {
        // Don't show your own emotes back to yourself
        if (payload.senderId === currentPlayerId) return;

        const zoneIdx = nextZoneRef.current % ZONES.length;
        nextZoneRef.current += 1;

        const id = Math.random().toString(36).slice(2);
        setActiveEmotes(prev => [...prev, {
          id,
          emoji: payload.emoji,
          senderName: payload.senderName ?? 'Someone',
          zoneIdx,
        }]);

        setTimeout(() => {
          setActiveEmotes(prev => prev.filter(e => e.id !== id));
        }, DISPLAY_MS + 600); // extra 600ms for exit animation
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase?.removeChannel(channel); };
  }, [lobbyId, currentPlayerId]);

  const sendEmote = useCallback((emoji: string) => {
    if (!supabase || !lobbyId || !channelRef.current || onCooldown) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'emote',
      payload: {
        emoji,
        senderName: currentPlayerName ?? 'Someone',
        senderId: currentPlayerId,
      },
    });
    setOnCooldown(true);
    setTimeout(() => setOnCooldown(false), COOLDOWN_MS);
  }, [lobbyId, currentPlayerId, currentPlayerName, onCooldown]);

  return (
    <>
      {/* ── Incoming emotes ── */}
      <AnimatePresence>
        {activeEmotes.map(emote => {
          const zone = ZONES[emote.zoneIdx % ZONES.length];
          return (
            <motion.div
              key={emote.id}
              initial={{ x: zone.initX, y: zone.initY, opacity: 0, scale: 0.4 }}
              animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              exit={{ x: zone.initX, y: zone.initY, opacity: 0, scale: 0.4 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
              className="fixed pointer-events-none z-50 flex flex-col items-center"
              style={{ left: zone.left, top: zone.top }}
            >
              <span style={{ fontSize: 72, lineHeight: 1, display: 'block' }}>
                {emote.emoji}
              </span>
              <span className="sports-font text-white text-[11px] mt-1.5 bg-black/75 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                {emote.senderName}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* ── Send buttons — fixed bottom-right, collapsible ── */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-1 bg-black/70 border border-white/10 rounded-xl p-1.5 backdrop-blur-sm">
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex gap-1 overflow-hidden"
            >
              {EMOTES.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => sendEmote(emoji)}
                  disabled={onCooldown}
                  title={onCooldown ? 'Cooling down…' : `Send ${emoji}`}
                  className="w-9 h-9 text-xl flex items-center justify-center rounded-lg transition-all active:scale-90 hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Toggle button — always visible */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all text-white/50 hover:text-white"
          title={expanded ? 'Hide emotes' : 'Emotes'}
        >
          {expanded ? '✕' : '💬'}
        </button>
      </div>
    </>
  );
}
