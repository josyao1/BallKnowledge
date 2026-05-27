/**
 * EmoteOverlay.tsx — Floating emote taunts + chat messages for multiplayer modes.
 *
 * Emotes: Players send one of 5 emojis via Supabase Realtime broadcast. They fly
 * in from a screen edge, land at a predefined zone, show sender name, then exit.
 *
 * Chat: A ✍️ button opens a text input (100-char max). Sent messages float up
 * diagonally from a random bottom position (Instagram-heart style), fading out.
 *
 * Both use the same broadcast-only channel `emotes:{lobbyId}` with different event
 * names ('emote' and 'chat') so it never interferes with useLobbySubscription.
 */

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const EMOTES = ['💩', '👅', '🍆', '😰', '💀'];
const EMOTE_COOLDOWN_MS  = 10_000;
const CHAT_COOLDOWN_MS   = 5_000;
const EMOTE_DISPLAY_MS   = 2_500;
const CHAT_ANIM_DURATION = 3_200;
const MAX_CHAT_ON_SCREEN = 4;

const randBetween = (min: number, max: number) => Math.random() * (max - min) + min;

const ZONES = [
  { left: '5%',  top: '8%',  initX: -180, initY: 0    },
  { left: '38%', top: '4%',  initX: 0,    initY: -180 },
  { left: '68%', top: '8%',  initX: 180,  initY: 0    },
  { left: '4%',  top: '33%', initX: -180, initY: 0    },
  { left: '70%', top: '33%', initX: 180,  initY: 0    },
  { left: '36%', top: '20%', initX: 0,    initY: -180 },
] as const;

interface ActiveEmote {
  id: string;
  emoji: string;
  senderName: string;
  zoneIdx: number;
}

interface ActiveChat {
  id: string;
  text: string;
  senderName: string;
  isOwn: boolean;
  startX: number;  // left position as vw %
  driftX: number;  // total horizontal drift in px
}

interface EmoteOverlayProps {
  lobbyId: string | null | undefined;
  currentPlayerId: string | null | undefined;
  currentPlayerName: string | null | undefined;
}

function makeChatEntry(fields: Omit<ActiveChat, 'startX' | 'driftX'>): ActiveChat {
  return { ...fields, startX: randBetween(10, 68), driftX: randBetween(-60, 60) };
}

export function EmoteOverlay({ lobbyId, currentPlayerId, currentPlayerName }: EmoteOverlayProps) {
  const [activeEmotes, setActiveEmotes] = useState<ActiveEmote[]>([]);
  const [activeChats, setActiveChats]   = useState<ActiveChat[]>([]);
  const [emoteCooldown, setEmoteCooldown] = useState(false);
  const [chatCooldown, setChatCooldown]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');

  const channelRef  = useRef<RealtimeChannel | null>(null);
  const nextZoneRef = useRef(0);
  const sendingRef  = useRef(false); // Bug 3 fix: guard against Enter-repeat double-send

  const removeChat = useCallback((id: string) => {
    setActiveChats(prev => prev.filter(c => c.id !== id));
  }, []);

  useEffect(() => {
    if (!supabase || !lobbyId) return;

    const channel = supabase
      .channel(`emotes:${lobbyId}`)
      .on('broadcast', { event: 'emote' }, ({ payload }) => {
        if (payload.senderId === currentPlayerId) return;

        const zoneIdx = nextZoneRef.current % ZONES.length;
        nextZoneRef.current += 1;

        const id = Math.random().toString(36).slice(2);
        setActiveEmotes(prev => [...prev, { id, emoji: payload.emoji, senderName: payload.senderName ?? 'Someone', zoneIdx }]);
        setTimeout(() => setActiveEmotes(prev => prev.filter(e => e.id !== id)), EMOTE_DISPLAY_MS + 600);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (payload.senderId === currentPlayerId) return;

        // Sanitize untrusted broadcast payload at the boundary
        const rawText = typeof payload.text === 'string' ? payload.text : String(payload.text ?? '');
        const text = rawText.slice(0, 100).trim();
        if (!text) return;

        const senderName = typeof payload.senderName === 'string'
          ? payload.senderName.slice(0, 50)
          : 'Someone';

        const id = Math.random().toString(36).slice(2);
        setActiveChats(prev => [...prev, makeChatEntry({ id, text, senderName, isOwn: false })].slice(-MAX_CHAT_ON_SCREEN));
        // Bug 2 fix: backstop removal in case onAnimationComplete doesn't fire (e.g. mid-unmount)
        setTimeout(() => removeChat(id), CHAT_ANIM_DURATION + 500);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase?.removeChannel(channel);
      // Bug 2 fix: clear in-flight messages when lobby/channel changes
      setActiveChats([]);
    };
  }, [lobbyId, currentPlayerId, removeChat]);

  const sendEmote = useCallback((emoji: string) => {
    if (!supabase || !lobbyId || !channelRef.current || emoteCooldown) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'emote',
      payload: { emoji, senderName: currentPlayerName ?? 'Someone', senderId: currentPlayerId },
    });
    setEmoteCooldown(true);
    setTimeout(() => setEmoteCooldown(false), EMOTE_COOLDOWN_MS);
  }, [lobbyId, currentPlayerId, currentPlayerName, emoteCooldown]);

  const sendChat = useCallback(() => {
    const text = chatText.trim();
    // Bug 3 fix: synchronous re-entry guard prevents Enter-repeat double-send
    if (!supabase || !lobbyId || !channelRef.current || chatCooldown || !text || sendingRef.current) return;
    sendingRef.current = true;

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat',
      payload: { text, senderName: currentPlayerName ?? 'Someone', senderId: currentPlayerId },
    });

    const id = Math.random().toString(36).slice(2);
    setActiveChats(prev => [...prev, makeChatEntry({ id, text, senderName: currentPlayerName ?? 'You', isOwn: true })].slice(-MAX_CHAT_ON_SCREEN));
    setTimeout(() => removeChat(id), CHAT_ANIM_DURATION + 500);

    setChatText('');
    setChatOpen(false);
    setExpanded(false);
    setChatCooldown(true);
    setTimeout(() => setChatCooldown(false), CHAT_COOLDOWN_MS);

    // Release the re-entry guard after React has committed the state changes
    setTimeout(() => { sendingRef.current = false; }, 0);
  }, [lobbyId, currentPlayerId, currentPlayerName, chatCooldown, chatText, removeChat]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendChat();
    if (e.key === 'Escape') { setChatOpen(false); setChatText(''); }
  };

  const handleClose = () => {
    setExpanded(false);
    setChatOpen(false);
    setChatText('');
  };

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
              <span style={{ fontSize: 'clamp(48px, 14vw, 72px)', lineHeight: 1, display: 'block' }}>
                {emote.emoji}
              </span>
              <span className="sports-font text-white text-[11px] mt-1.5 bg-black/75 px-2.5 py-0.5 rounded-full whitespace-nowrap max-w-[100px] truncate block text-center">
                {emote.senderName}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* ── Floating chat messages — diagonal drift from random bottom position, fade out ── */}
      {activeChats.map(msg => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: [0, msg.driftX * 0.4, msg.driftX * 0.75, msg.driftX],
            y: [0, -40, -95, -150],
          }}
          transition={{ duration: CHAT_ANIM_DURATION / 1000, ease: 'easeOut', times: [0, 0.08, 0.55, 1] }}
          onAnimationComplete={() => removeChat(msg.id)}
          className={`fixed z-50 pointer-events-none px-3.5 py-2.5 rounded-xl shadow-lg ${
            msg.isOwn
              ? 'bg-black/70 border border-white/25'
              : 'bg-black/80 border border-white/15'
          }`}
          style={{
            left: `${msg.startX}%`,
            bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
            maxWidth: 'min(260px, 70vw)',
          }}
        >
          <p className={`sports-font text-[9px] tracking-widest uppercase leading-none mb-1 ${msg.isOwn ? 'text-white/50' : 'text-[#d4af37]/70'}`}>
            {msg.senderName}
          </p>
          <p className="text-white text-sm leading-snug break-words">{msg.text}</p>
        </motion.div>
      ))}

      {/* ── Send panel — fixed bottom-right, collapsible ── */}
      <div
        className="fixed right-4 z-40 flex items-center gap-1 bg-black/70 border border-white/10 rounded-xl p-1.5 backdrop-blur-sm"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <AnimatePresence initial={false} mode="wait">
          {expanded && !chatOpen && (
            <motion.div
              key="emotes"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex gap-1 overflow-hidden"
            >
              {EMOTES.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { sendEmote(emoji); setExpanded(false); }}
                  disabled={emoteCooldown}
                  className="w-11 h-11 text-xl flex items-center justify-center rounded-lg transition-all active:scale-90 active:bg-white/10 hover:bg-white/10 disabled:opacity-25"
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => setChatOpen(true)}
                disabled={chatCooldown}
                className="w-11 h-11 text-lg flex items-center justify-center rounded-lg transition-all active:scale-90 active:bg-white/10 hover:bg-white/10 disabled:opacity-25"
                title="Send a message"
              >
                ✍️
              </button>
            </motion.div>
          )}

          {expanded && chatOpen && (
            <motion.div
              key="chat"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-1.5 overflow-hidden"
            >
              {/* Bug 1 fix: autoFocus mounts exactly when the input does, immune to mode="wait" timing */}
              <input
                autoFocus
                type="text"
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={100}
                placeholder="say something..."
                className="h-9 w-[180px] bg-white/10 border border-white/20 rounded-lg px-3 text-white text-sm placeholder-white/30 outline-none focus:border-white/40"
              />
              <button
                onClick={sendChat}
                disabled={!chatText.trim() || chatCooldown}
                className="h-9 px-3 rounded-lg bg-white/15 text-white text-xs sports-font tracking-wider disabled:opacity-30 hover:bg-white/25 transition-colors"
              >
                send
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={expanded ? handleClose : () => setExpanded(true)}
          className="w-11 h-11 flex items-center justify-center rounded-lg transition-all active:bg-white/10 hover:bg-white/10 text-white/50 active:text-white hover:text-white"
        >
          {expanded ? '✕' : '💬'}
        </button>
      </div>
    </>
  );
}
