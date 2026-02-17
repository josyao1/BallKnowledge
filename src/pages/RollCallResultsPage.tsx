/**
 * RollCallResultsPage.tsx — Final grouped results for a Roll Call session.
 *
 * Fetches all entries and merge decisions from DB, displays grouped results.
 * Unresolved suggestions can still be merged here. Host can start a new round.
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useRollCallStore } from '../stores/rollCallStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { useRollCallSubscription } from '../hooks/useRollCallSubscription';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus } from '../services/lobby';
import { getEntries, deleteEntriesByIds } from '../services/rollCall';
import { applyMerges, findSuggestions, type PlayerGroup } from '../utils/fuzzyDedup';
import type { RollCallEntry, RollCallMerge } from '../types/database';

export function RollCallResultsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, isHost, setLobby, setPlayers } = useLobbyStore();
  const {
    mergeDecisions, fetchMergeDecisions,
    confirmMerge, dismissSuggestion, clearAll,
    reset: resetRollCall,
  } = useRollCallStore();

  const [allEntries, setAllEntries] = useState<RollCallEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copiedList, setCopiedList] = useState(false);

  useLobbySubscription(lobby?.id || null);
  useRollCallSubscription(lobby?.id || null);

  // Load lobby + entries + merges
  useEffect(() => {
    if (!code) { navigate('/'); return; }

    const load = async () => {
      setIsLoading(true);

      let currentLobby = lobby;
      if (!currentLobby) {
        const result = await findLobbyByCode(code);
        if (!result.lobby) { navigate('/'); return; }
        currentLobby = result.lobby;
        setLobby(currentLobby);
        const playersResult = await getLobbyPlayers(currentLobby.id);
        if (playersResult.players) setPlayers(playersResult.players);
      }

      const entriesResult = await getEntries(currentLobby.id);
      setAllEntries(entriesResult.entries);
      await fetchMergeDecisions(currentLobby.id);
      setIsLoading(false);
    };

    load();
  }, [code, navigate, lobby, setLobby, setPlayers, fetchMergeDecisions]);

  // Navigate back to session if lobby resets to waiting
  useEffect(() => {
    if (lobby?.status === 'waiting') {
      navigate(`/roll-call/${code}`);
    }
  }, [lobby?.status, code, navigate]);

  // Derive merge state from DB decisions
  const { confirmedKeys, dismissedKeys, confirmedMerges } = useMemo(
    () => deriveMergeState(mergeDecisions),
    [mergeDecisions]
  );

  const groups = useMemo(
    () => applyMerges(allEntries, confirmedMerges),
    [allEntries, confirmedMerges]
  );

  const suggestions = useMemo(
    () => findSuggestions(allEntries, confirmedKeys, dismissedKeys),
    [allEntries, confirmedKeys, dismissedKeys]
  );

  const handleNewRound = async () => {
    if (!isHost || !lobby) return;
    await clearAll(lobby.id);
    resetRollCall();
    await updateLobbyStatus(lobby.id, 'waiting');
  };

  const handleLeave = () => navigate('/');

  const handleDeleteGroup = async (group: PlayerGroup) => {
    const idsToDelete = allEntries
      .filter(e => group.variants.some(v => v.text === e.entry_text))
      .map(e => e.id);
    if (idsToDelete.length === 0) return;
    await deleteEntriesByIds(idsToDelete);
    setAllEntries(prev => prev.filter(e => !idsToDelete.includes(e.id)));
  };

  const handleCopyList = () => {
    const capitalize = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());
    const list = groups.map((g, i) => `${i + 1}. ${capitalize(g.canonical)}`).join('\n');
    navigator.clipboard.writeText(list);
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 2000);
  };

  const handleConfirmMerge = async (key: string, entryIds: string[], canonical: string) => {
    if (!lobby) return;
    await confirmMerge(lobby.id, key, entryIds, canonical);
  };

  const handleDismissSuggestion = async (key: string, entryIds: string[], canonical: string) => {
    if (!lobby) return;
    await dismissSuggestion(lobby.id, key, entryIds, canonical);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d2a0b]">
        <div className="text-white/50 sports-font">Loading results...</div>
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
              <h1 className="retro-title text-xl text-[#d4af37]">Roll Call Results</h1>
              <p className="sports-font text-[8px] text-white/30 tracking-[0.3em] uppercase">Final Tally</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full p-4 space-y-4 overflow-y-auto">
        {/* Summary stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/50 border border-[#d4af37]/30 rounded-sm p-4"
        >
          <div className="text-center">
            <div className="retro-title text-3xl text-[#d4af37]">{groups.length}</div>
            <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">Unique Players</div>
          </div>
        </motion.div>

        {/* Merge suggestions banner */}
        {suggestions.length > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowSuggestions(true)}
            className="w-full p-3 bg-orange-900/20 border border-orange-500/30 rounded-sm flex items-center justify-between hover:bg-orange-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold sports-font">
                {suggestions.length}
              </span>
              <span className="sports-font text-sm text-orange-400">possible duplicates to review</span>
            </div>
            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        )}

        {/* Grouped results */}
        <div className="space-y-2">
          {groups.map((group, i) => (
            <ResultGroupRow
              key={group.canonical + i}
              group={group}
              index={i}
              isExpanded={expandedGroup === group.canonical}
              onToggle={() => setExpandedGroup(expandedGroup === group.canonical ? null : group.canonical)}
              onDelete={() => handleDeleteGroup(group)}
            />
          ))}
        </div>

        {groups.length === 0 && (
          <div className="text-center py-8 text-white/30 sports-font">
            No entries were submitted.
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pb-4">
          {groups.length > 0 && (
            <button
              onClick={handleCopyList}
              className="w-full py-3 rounded-sm sports-font text-sm tracking-wider bg-black/50 text-white/70 border border-white/20 hover:border-[#d4af37] hover:text-[#d4af37] transition-all flex items-center justify-center gap-2"
            >
              {copiedList ? 'Copied!' : 'Copy Player List'}
            </button>
          )}
          {isHost && (
            <button
              onClick={handleNewRound}
              className="w-full py-4 rounded-sm retro-title text-lg tracking-wider bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1"
            >
              New Round
            </button>
          )}
          <button
            onClick={handleLeave}
            className="w-full py-3 rounded-sm sports-font text-sm tracking-wider bg-black/50 text-white/50 border border-white/20 hover:border-white/40 transition-all"
          >
            Leave
          </button>
        </div>
      </main>

      {/* Merge suggestions panel */}
      <AnimatePresence>
        {showSuggestions && (
          <MergeSuggestionOverlay
            suggestions={suggestions}
            onConfirm={(key, ids, canonical) => handleConfirmMerge(key, ids, canonical)}
            onDismiss={(key, ids, canonical) => handleDismissSuggestion(key, ids, canonical)}
            onClose={() => setShowSuggestions(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helpers ---

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

// --- Result group row ---

function ResultGroupRow({
  group, index, isExpanded, onToggle, onDelete,
}: {
  group: PlayerGroup;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isMerged = group.variants.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      className="bg-black/50 border border-white/10 rounded-sm overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="retro-title text-sm text-white/20 w-6">{index + 1}</span>
          <span className="sports-font text-sm text-white/90">{group.canonical}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold sports-font bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30">
            {group.uniqueSubmitters} {group.uniqueSubmitters === 1 ? 'person' : 'people'}
          </span>
          <svg
            className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5">
          {isMerged && (
            <div className="space-y-1 mb-2">
              {group.variants.map((v, vi) => (
                <div key={vi} className="flex justify-between text-xs py-1">
                  <span className="text-white/60 sports-font">{v.text}</span>
                  <span className="text-white/30 sports-font">{v.submitter}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-full py-1.5 rounded-sm sports-font text-xs tracking-wider text-red-400 border border-red-700/40 hover:bg-red-900/20 transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </motion.div>
  );
}

// --- Merge suggestion overlay ---

function MergeSuggestionOverlay({
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
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 bg-[#111] border-t-2 border-[#d4af37]/50 rounded-t-xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="retro-title text-lg text-[#d4af37]">Possible Duplicates</h2>
            <p className="sports-font text-[9px] text-white/40 tracking-widest uppercase">
              Merge similar entries or dismiss
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {suggestions.length === 0 ? (
            <p className="text-center text-white/30 sports-font text-sm py-4">
              All duplicates have been resolved!
            </p>
          ) : (
            suggestions.map((s) => (
              <div key={s.key} className="bg-black/50 border border-orange-500/30 rounded-sm p-3 space-y-2">
                <div className="sports-font text-xs text-orange-400 tracking-wider">
                  These look like the same player:
                </div>
                <div className="space-y-1">
                  {s.entries.map((e) => (
                    <div key={e.id} className="flex justify-between py-1 px-2 bg-black/30 rounded">
                      <span className="text-white/80 sports-font text-sm">{e.text}</span>
                      <span className="text-white/30 sports-font text-[10px]">{e.submitter}</span>
                    </div>
                  ))}
                </div>
                <div className="sports-font text-[10px] text-white/40">
                  Merge as: <span className="text-white/70">{s.canonical}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onConfirm(s.key, s.entries.map(e => e.id), s.canonical)}
                    className="flex-1 py-2 rounded-sm sports-font text-xs tracking-wider bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 hover:bg-emerald-800/40 transition-colors"
                  >
                    Merge
                  </button>
                  <button
                    onClick={() => onDismiss(s.key, s.entries.map(e => e.id), s.canonical)}
                    className="flex-1 py-2 rounded-sm sports-font text-xs tracking-wider bg-black/40 text-white/40 border border-white/10 hover:border-white/30 transition-colors"
                  >
                    Not the same
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
