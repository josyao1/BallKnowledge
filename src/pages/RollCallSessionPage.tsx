/**
 * RollCallSessionPage.tsx — Main Roll Call session page.
 *
 * Three phases driven by lobby.status:
 * - waiting: show join code, player list, host "Start" button
 * - playing: text input, live entry feed, merge suggestion sidebar
 * - finished: navigate to results page
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useRollCallStore } from '../stores/rollCallStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { useRollCallSubscription } from '../hooks/useRollCallSubscription';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus } from '../services/lobby';
import { findSuggestions, applyMerges, normalize } from '../utils/fuzzyDedup';
import type { RollCallMerge } from '../types/database';

export function RollCallSessionPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const {
    lobby, players, isHost, currentPlayerId,
    setLobby, setPlayers, leaveLobby,
  } = useLobbyStore();
  const {
    entries, mergeDecisions,
    submitEntry, fetchEntries, fetchMergeDecisions,
    confirmMerge, dismissSuggestion,
    reset: resetEntries,
  } = useRollCallStore();

  const [isLoadingLobby, setIsLoadingLobby] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dupeWarning, setDupeWarning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useLobbySubscription(lobby?.id || null);
  useRollCallSubscription(lobby?.id || null);

  // Load lobby on mount
  useEffect(() => {
    if (!code) { navigate('/'); return; }

    const loadLobby = async () => {
      setIsLoadingLobby(true);
      const result = await findLobbyByCode(code);
      if (!result.lobby) { navigate('/'); return; }

      setLobby(result.lobby);
      const playersResult = await getLobbyPlayers(result.lobby.id);
      if (playersResult.players) setPlayers(playersResult.players);
      await fetchEntries(result.lobby.id);
      await fetchMergeDecisions(result.lobby.id);
      setIsLoadingLobby(false);
    };

    loadLobby();
    return () => { resetEntries(); };
  }, [code, navigate, setLobby, setPlayers, fetchEntries, fetchMergeDecisions, resetEntries]);

  // Navigate to results when finished
  useEffect(() => {
    if (lobby?.status === 'finished') {
      navigate(`/roll-call/${code}/results`);
    }
  }, [lobby?.status, code, navigate]);

  // Auto-focus input when playing starts
  useEffect(() => {
    if (lobby?.status === 'playing') {
      inputRef.current?.focus();
    }
  }, [lobby?.status]);

  // Derive merge keys from DB decisions
  const { confirmedKeys, dismissedKeys, confirmedMerges } = useMemo(
    () => deriveMergeState(mergeDecisions),
    [mergeDecisions]
  );

  const suggestions = useMemo(
    () => findSuggestions(entries, confirmedKeys, dismissedKeys),
    [entries, confirmedKeys, dismissedKeys]
  );

  const groups = useMemo(
    () => applyMerges(entries, confirmedMerges),
    [entries, confirmedMerges]
  );

  const handleSubmitEntry = async () => {
    if (!inputText.trim() || !lobby || isSubmitting) return;

    const normalizedInput = normalize(inputText.trim());
    const alreadyExists = entries.some(e => normalize(e.entry_text) === normalizedInput);
    if (alreadyExists) {
      setDupeWarning(true);
      setTimeout(() => setDupeWarning(false), 2000);
      return;
    }

    setIsSubmitting(true);
    await submitEntry(lobby.id, inputText.trim());
    setInputText('');
    setIsSubmitting(false);
    inputRef.current?.focus();
  };

  const handleStartSession = async () => {
    if (!isHost || !lobby) return;
    await updateLobbyStatus(lobby.id, 'playing');
  };

  const handleEndSession = async () => {
    if (!isHost || !lobby) return;
    await updateLobbyStatus(lobby.id, 'finished');
  };

  const handleCopyCode = () => {
    if (!lobby?.join_code) return;
    navigator.clipboard.writeText(lobby.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    await leaveLobby();
    navigate('/');
  };

  const handleConfirmMerge = async (key: string, entryIds: string[], canonical: string) => {
    if (!lobby) return;
    await confirmMerge(lobby.id, key, entryIds, canonical);
  };

  const handleDismissSuggestion = async (key: string, entryIds: string[], canonical: string) => {
    if (!lobby) return;
    await dismissSuggestion(lobby.id, key, entryIds, canonical);
  };

  if (!lobby || isLoadingLobby) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d2a0b]">
        <div className="text-white/50 sports-font">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d2a0b] text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
      />

      {/* Header */}
      <header className="relative z-10 p-4 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleLeave} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="retro-title text-xl text-[#d4af37]">Roll Call</h1>
              <p className="sports-font text-[8px] text-white/30 tracking-[0.3em] uppercase">
                {lobby.status === 'waiting' ? 'Waiting for Players' : 'In Progress'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 px-3 py-1.5 bg-black/50 rounded-sm border border-white/20 hover:border-[#d4af37] transition-colors"
          >
            <span className="font-mono text-lg tracking-widest text-[#d4af37]">{lobby.join_code}</span>
            {copied && <span className="text-emerald-400 text-xs sports-font">Copied!</span>}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full p-4 space-y-4 overflow-y-auto">
        {lobby.status === 'waiting' && (
          <WaitingPhase
            players={players}
            currentPlayerId={currentPlayerId}
            isHost={isHost}
            playerCount={players.length}
            onStart={handleStartSession}
          />
        )}

        {lobby.status === 'playing' && (
          <>
            <PlayingPhase
              inputText={inputText}
              isSubmitting={isSubmitting}
              dupeWarning={dupeWarning}
              entries={entries}
              groups={groups}
              confirmedMerges={confirmedMerges}
              uniqueCount={groups.length}
              suggestionCount={suggestions.length}
              isHost={isHost}
              inputRef={inputRef}
              onInputChange={setInputText}
              onSubmit={handleSubmitEntry}
              onEnd={handleEndSession}
              onShowSuggestions={() => setShowSuggestions(true)}
            />

            {/* Merge suggestions sidebar */}
            <AnimatePresence>
              {showSuggestions && (
                <MergeSuggestionPanel
                  suggestions={suggestions}
                  onConfirm={(key, ids, canonical) => handleConfirmMerge(key, ids, canonical)}
                  onDismiss={(key, ids, canonical) => handleDismissSuggestion(key, ids, canonical)}
                  onClose={() => setShowSuggestions(false)}
                />
              )}
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}

// --- Helpers ---

/** Derive confirmedKeys, dismissedKeys, and confirmedMerges from DB rows. */
function deriveMergeState(decisions: RollCallMerge[]) {
  const confirmedKeys = new Set<string>();
  const dismissedKeys = new Set<string>();
  const confirmedMerges: string[][] = [];

  for (const d of decisions) {
    if (d.is_dismissed) {
      dismissedKeys.add(d.suggestion_key);
    } else {
      confirmedKeys.add(d.suggestion_key);
      confirmedMerges.push(d.entry_ids);
    }
  }

  return { confirmedKeys, dismissedKeys, confirmedMerges };
}

// --- Waiting Phase ---

function WaitingPhase({
  players, currentPlayerId, isHost, playerCount, onStart,
}: {
  players: { player_id: string; player_name: string; is_host: boolean }[];
  currentPlayerId: string;
  isHost: boolean;
  playerCount: number;
  onStart: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/50 border border-white/10 rounded-sm p-4"
      >
        <div className="sports-font text-[10px] text-white/40 mb-3 tracking-[0.3em] uppercase">
          Players ({playerCount})
        </div>
        <div className="space-y-2">
          {players.map((player, i) => (
            <motion.div
              key={player.player_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-sm border ${
                player.player_id === currentPlayerId
                  ? 'border-[#d4af37]/50 bg-[#d4af37]/10'
                  : 'border-white/10 bg-black/30'
              }`}
            >
              {player.is_host && (
                <svg className="w-4 h-4 text-[#d4af37]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
              <span className="sports-font text-sm text-white/90">{player.player_name}</span>
              {player.player_id === currentPlayerId && (
                <span className="text-[10px] text-white/40 sports-font">(you)</span>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {isHost && playerCount >= 1 && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={onStart}
          className="w-full py-4 rounded-sm retro-title text-lg tracking-wider bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_4px_0_#166534] active:shadow-none active:translate-y-1"
        >
          Start Session
        </motion.button>
      )}

      {!isHost && (
        <p className="text-center text-white/30 text-sm sports-font tracking-widest">
          Waiting for host to start...
        </p>
      )}

      <p className="text-center text-white/20 text-[10px] sports-font tracking-wider">
        Share the code above to invite friends
      </p>
    </>
  );
}

// --- Playing Phase ---

interface PlayingPhaseProps {
  inputText: string;
  isSubmitting: boolean;
  dupeWarning: boolean;
  entries: { id: string; entry_text: string; player_name: string; submitted_at: string }[];
  groups: { canonical: string; variants: { text: string; submitter: string }[]; uniqueSubmitters: number }[];
  confirmedMerges: string[][];
  uniqueCount: number;
  suggestionCount: number;
  isHost: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (text: string) => void;
  onSubmit: () => void;
  onEnd: () => void;
  onShowSuggestions: () => void;
}

function PlayingPhase({
  inputText, isSubmitting, dupeWarning, entries, groups, confirmedMerges, uniqueCount, suggestionCount,
  isHost, inputRef, onInputChange, onSubmit, onEnd, onShowSuggestions,
}: PlayingPhaseProps) {
  // Build a set of entry IDs that have been merged, so we can skip them in the raw feed
  const mergedEntryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of confirmedMerges) {
      for (const id of group) ids.add(id);
    }
    return ids;
  }, [confirmedMerges]);

  // Build merged groups with their earliest timestamp for ordering
  const mergedGroups = useMemo(() => {
    return groups
      .filter(g => g.variants.length > 1)
      .map(g => {
        const earliestEntry = entries.find(e => e.entry_text === g.variants[0]?.text);
        return { ...g, timestamp: earliestEntry?.submitted_at || '' };
      });
  }, [groups, entries]);

  // Interleave: unmerged entries + merged groups, sorted by time (newest first)
  const feedItems = useMemo(() => {
    const items: { type: 'entry'; entry: typeof entries[0] }[] | { type: 'group'; group: typeof mergedGroups[0] }[] = [];

    // Unmerged individual entries
    for (const entry of entries) {
      if (!mergedEntryIds.has(entry.id)) {
        (items as { type: 'entry'; entry: typeof entries[0] }[]).push({ type: 'entry', entry });
      }
    }

    // Merged groups — use the earliest entry's timestamp
    for (const group of mergedGroups) {
      (items as { type: 'group'; group: typeof mergedGroups[0] }[]).push({ type: 'group', group });
    }

    // Sort newest first
    (items as { type: string; entry?: typeof entries[0]; group?: typeof mergedGroups[0] }[]).sort((a, b) => {
      const timeA = a.type === 'entry' ? a.entry!.submitted_at : a.group!.timestamp;
      const timeB = b.type === 'entry' ? b.entry!.submitted_at : b.group!.timestamp;
      return timeB.localeCompare(timeA);
    });

    return items as ({ type: 'entry'; entry: typeof entries[0] } | { type: 'group'; group: typeof mergedGroups[0] })[];
  }, [entries, mergedEntryIds, mergedGroups]);

  return (
    <>
      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/50 border border-white/10 rounded-sm p-3"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            placeholder="Type a player name..."
            maxLength={60}
            className="flex-1 p-3 bg-[#111] rounded-sm border-2 border-white/20 text-white focus:outline-none focus:border-[#d4af37] transition-colors sports-font"
          />
          <button
            onClick={onSubmit}
            disabled={!inputText.trim() || isSubmitting}
            className="px-5 py-3 rounded-sm retro-title tracking-wider bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black disabled:opacity-50 active:shadow-none active:translate-y-0.5"
          >
            Add
          </button>
        </div>
        <AnimatePresence>
          {dupeWarning && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-red-400 sports-font text-xs mt-1.5 tracking-wider"
            >
              Already submitted!
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stats bar */}
      <div className="flex justify-between items-center px-1">
        <div className="sports-font text-xs text-white/50">
          <span className="text-[#d4af37] font-bold">{uniqueCount}</span> unique players
        </div>
        <div className="flex items-center gap-3">
          {suggestionCount > 0 && (
            <button
              onClick={onShowSuggestions}
              className="sports-font text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold">
                {suggestionCount}
              </span>
              possible duplicates
            </button>
          )}
        </div>
      </div>

      {/* Live feed */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-black/50 border border-white/10 rounded-sm p-3 flex-1 max-h-[50vh] overflow-y-auto"
      >
        <div className="sports-font text-[10px] text-white/40 mb-2 tracking-[0.3em] uppercase">
          Live Feed
        </div>
        <div className="space-y-1.5">
          <AnimatePresence>
            {feedItems.map((item) => {
              if (item.type === 'entry') {
                return (
                  <motion.div
                    key={item.entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between py-1.5 px-2 rounded bg-black/30 border border-white/5"
                  >
                    <span className="text-white/90 sports-font text-sm">{item.entry.entry_text}</span>
                    <span className="text-white/30 sports-font text-[10px] tracking-wider">{item.entry.player_name}</span>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={`merged-${item.group.canonical}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-black/30 border border-white/5"
                >
                  <span className="text-white/90 sports-font text-sm">{item.group.canonical}</span>
                  <span className="text-white/30 sports-font text-[10px] tracking-wider">
                    {item.group.variants.map(v => v.submitter).join(', ')}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {entries.length === 0 && (
            <p className="text-center text-white/20 text-sm sports-font py-4">
              No entries yet — start typing!
            </p>
          )}
        </div>
      </motion.div>

      {/* Host end button */}
      {isHost && (
        <button
          onClick={onEnd}
          className="w-full py-3 rounded-sm sports-font text-sm tracking-wider bg-black/50 text-red-400 border border-red-700/50 hover:border-red-500 hover:bg-red-900/20 transition-all"
        >
          End Session
        </button>
      )}
    </>
  );
}

// --- Merge Suggestion Panel (slide-up overlay) ---

function MergeSuggestionPanel({
  suggestions, onConfirm, onDismiss, onClose,
}: {
  suggestions: { key: string; canonical: string; entries: { id: string; text: string; submitter: string }[] }[];
  onConfirm: (key: string, entryIds: string[], canonical: string) => void;
  onDismiss: (key: string, entryIds: string[], canonical: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] flex flex-col"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 bg-[#111] border-t-2 border-[#d4af37]/50 rounded-t-xl max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="retro-title text-lg text-[#d4af37]">Possible Duplicates</h2>
            <p className="sports-font text-[9px] text-white/40 tracking-widest uppercase">
              Merge similar entries or dismiss
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Suggestion list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {suggestions.length === 0 ? (
            <p className="text-center text-white/30 sports-font text-sm py-4">
              No duplicate suggestions right now.
            </p>
          ) : (
            suggestions.map((s) => (
              <SuggestionCard
                key={s.key}
                suggestion={s}
                onConfirm={() => onConfirm(s.key, s.entries.map(e => e.id), s.canonical)}
                onDismiss={() => onDismiss(s.key, s.entries.map(e => e.id), s.canonical)}
              />
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SuggestionCard({
  suggestion, onConfirm, onDismiss,
}: {
  suggestion: { canonical: string; entries: { id: string; text: string; submitter: string }[] };
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-black/50 border border-orange-500/30 rounded-sm p-3 space-y-2">
      <div className="sports-font text-xs text-orange-400 tracking-wider">
        These look like the same player:
      </div>
      <div className="space-y-1">
        {suggestion.entries.map((e) => (
          <div key={e.id} className="flex justify-between py-1 px-2 bg-black/30 rounded">
            <span className="text-white/80 sports-font text-sm">{e.text}</span>
            <span className="text-white/30 sports-font text-[10px]">{e.submitter}</span>
          </div>
        ))}
      </div>
      <div className="sports-font text-[10px] text-white/40">
        Merge as: <span className="text-white/70">{suggestion.canonical}</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 py-2 rounded-sm sports-font text-xs tracking-wider bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 hover:bg-emerald-800/40 transition-colors"
        >
          Merge
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 py-2 rounded-sm sports-font text-xs tracking-wider bg-black/40 text-white/40 border border-white/10 hover:border-white/30 transition-colors"
        >
          Not the same
        </button>
      </div>
    </div>
  );
}
