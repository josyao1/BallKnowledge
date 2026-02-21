/**
 * MultiplayerNameScramblePage.tsx — Multiplayer "Name Scramble" gameplay.
 *
 * Shows a scrambled player name. Players race to type the correct unscrambled name.
 * First correct answer starts a 30-second pressure timer. Positional scoring:
 * 1st correct = 5 pts, 2nd = 3 pts, 3rd = 2 pts, 4th = 1 pt.
 * First player to the win_target total points wins the match.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import {
  findLobbyByCode,
  getLobbyPlayers,
  updateLobbyStatus,
  updatePlayerScore,
  addCareerPoints,
  startCareerRound,
} from '../services/lobby';
import { getRandomNBAScramblePlayer, getRandomNFLScramblePlayer } from '../services/careerData';
import { scrambleName } from '../utils/scramble';
import { areSimilarNames } from '../utils/fuzzyDedup';
import type { Sport } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScrambleState {
  playerName: string;
  scrambledName: string;
  sport: 'nba' | 'nfl';
  round: number;
  win_target: number;
  career_to: number;
}

interface RoundSummary {
  scrambledName: string;
  answer: string;
  round: number;
  // Map playerId → pts awarded this round (0 = gave up / missed)
  pts: Record<string, number>;
  // Map playerId → finished_at
  finishedAt: Record<string, string | null>;
}

const POSITION_PTS = [5, 3, 2, 1];

// ─── Component ───────────────────────────────────────────────────────────────

export function MultiplayerNameScramblePage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers } = useLobbyStore();

  useLobbySubscription(lobby?.id || null);

  const careerState = lobby?.career_state as ScrambleState | null;

  // ── Local state ──
  const [localStatus, setLocalStatus] = useState<'playing' | 'done'>('playing');
  const [guessInput, setGuessInput] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackType, setFeedbackType] = useState<'correct' | 'wrong' | ''>('');
  const [pressureTimer, setPressureTimer] = useState(30);
  const [pressureActive, setPressureActive] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);

  // ── Refs ──
  const hasSubmittedRef = useRef(false);
  const hasAdvancedRef = useRef(false);
  const atLeastOnePlayerWasActiveRef = useRef(false);
  const firstCorrectTimerStartedRef = useRef(false);
  const pressureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRoundRef = useRef(-1);
  const prevStatusRef = useRef<string | null>(null);
  const roundHistoryRef = useRef<RoundSummary[]>([]);

  // ── Load lobby on mount ──
  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby) return;

    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => {
        if (pr.players) setPlayers(pr.players);
      });
    });
  }, []);

  // ── Pressure timer: start when first correct answer arrives ──
  useEffect(() => {
    const firstCorrect = players.some(p => p.finished_at !== null && (p.score || 0) > 0);
    // atLeastOnePlayerWasActiveRef guards against stale player data from the previous round
    // triggering the timer at the start of a new round before player resets have propagated.
    if (firstCorrect && !firstCorrectTimerStartedRef.current && localStatus === 'playing'
        && atLeastOnePlayerWasActiveRef.current) {
      firstCorrectTimerStartedRef.current = true;
      setPressureActive(true);
      setPressureTimer(30);

      pressureIntervalRef.current = setInterval(() => {
        setPressureTimer(prev => {
          if (prev <= 1) {
            // Auto give-up at 0
            clearInterval(pressureIntervalRef.current!);
            setPressureActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [players, localStatus]);

  // ── Auto give-up when timer hits 0 ──
  useEffect(() => {
    if (pressureTimer === 0 && !hasSubmittedRef.current && localStatus === 'playing') {
      hasSubmittedRef.current = true;
      setLocalStatus('done');
      if (lobby) {
        updatePlayerScore(lobby.id, 0, 0, [], [], true);
      }
    }
  }, [pressureTimer, localStatus, lobby]);

  // ── Handle lobby status transitions ──
  useEffect(() => {
    if (!lobby) return;

    const prev = prevStatusRef.current;
    prevStatusRef.current = lobby.status;

    // Capture round summary when round ends
    if (prev === 'playing' && (lobby.status === 'waiting' || lobby.status === 'finished') && careerState) {
      const ptsMap: Record<string, number> = {};
      const finishedAt: Record<string, string | null> = {};

      // Compute positional pts: sort correct players by finished_at, assign 5/3/2/1
      const correctPlayers = [...players]
        .filter(p => (p.score || 0) > 0 && p.finished_at !== null)
        .sort((a, b) => new Date(a.finished_at!).getTime() - new Date(b.finished_at!).getTime());

      players.forEach(p => {
        const posIdx = correctPlayers.findIndex(cp => cp.player_id === p.player_id);
        ptsMap[p.player_id] = posIdx >= 0 ? (POSITION_PTS[posIdx] ?? 1) : 0;
        finishedAt[p.player_id] = p.finished_at;
      });

      const newSummary: RoundSummary = {
        scrambledName: careerState.scrambledName || '',
        answer: careerState.playerName || '',
        round: careerState.round || 0,
        pts: ptsMap,
        finishedAt,
      };
      setRoundSummary(newSummary);
      roundHistoryRef.current = [...roundHistoryRef.current, newSummary];
      hasAdvancedRef.current = false;
    }

    if (lobby.status === 'finished') {
      navigate(`/lobby/${code}/scramble/results`, { state: { roundHistory: roundHistoryRef.current } });
    }
  }, [lobby?.status]);

  // ── Detect new round — reset all local state ──
  const currentRound = careerState?.round ?? 0;
  useEffect(() => {
    if (currentRound > 0 && currentRound !== prevRoundRef.current) {
      prevRoundRef.current = currentRound;
      setLocalStatus('playing');
      setGuessInput('');
      setFeedbackMsg('');
      setFeedbackType('');
      setPressureTimer(30);
      setPressureActive(false);
      hasSubmittedRef.current = false;
      atLeastOnePlayerWasActiveRef.current = false;
      firstCorrectTimerStartedRef.current = false;
      if (pressureIntervalRef.current) {
        clearInterval(pressureIntervalRef.current);
        pressureIntervalRef.current = null;
      }
    }
  }, [currentRound]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pressureIntervalRef.current) clearInterval(pressureIntervalRef.current);
    };
  }, []);

  // ── Track when players are active ──
  useEffect(() => {
    if (players.some(p => p.finished_at === null)) {
      atLeastOnePlayerWasActiveRef.current = true;
    }
  }, [players]);

  // ── HOST: Advance round when all players finish ──
  const allPlayersFinished = players.length > 0 && players.every(p => p.finished_at !== null);

  const advanceRound = useCallback(async () => {
    if (!lobby || !careerState) return;
    hasAdvancedRef.current = true;

    // Award positional pts (5/3/2/1) to correct players sorted by finish time
    const correctPlayers = [...players]
      .filter(p => (p.score || 0) > 0 && p.finished_at !== null)
      .sort((a, b) => new Date(a.finished_at!).getTime() - new Date(b.finished_at!).getTime());

    await Promise.all(
      correctPlayers.slice(0, POSITION_PTS.length).map((p, i) =>
        addCareerPoints(lobby.id, p.player_id, POSITION_PTS[i])
      )
    );

    // Check win condition with fresh data
    const freshResult = await getLobbyPlayers(lobby.id);
    const freshPlayers = freshResult.players || [];
    const winTarget = careerState.win_target || 20;
    const gameWinner = freshPlayers.find(p => (p.wins || 0) >= winTarget);

    if (gameWinner) {
      await updateLobbyStatus(lobby.id, 'finished');
    } else {
      await updateLobbyStatus(lobby.id, 'waiting');
    }
  }, [lobby, careerState, players]);

  useEffect(() => {
    if (!isHost || !allPlayersFinished || lobby?.status !== 'playing' || hasAdvancedRef.current) return;
    if (!atLeastOnePlayerWasActiveRef.current) return;
    advanceRound();
  }, [allPlayersFinished, lobby?.status, isHost]);

  // ── Guess handler ──
  function handleGuess() {
    if (!careerState || localStatus !== 'playing' || !lobby) return;
    const name = guessInput.trim();
    if (!name) return;

    setGuessInput('');

    if (areSimilarNames(name, careerState.playerName)) {
      setFeedbackMsg('Correct!');
      setFeedbackType('correct');
      setLocalStatus('done');
      if (!hasSubmittedRef.current) {
        hasSubmittedRef.current = true;
        // Submit score=1 to mark as correct; actual pts awarded in advanceRound()
        updatePlayerScore(lobby.id, 1, 0, [], [], true);
      }
    } else {
      setFeedbackMsg(`"${name}" — try again`);
      setFeedbackType('wrong');
      setTimeout(() => { setFeedbackMsg(''); setFeedbackType(''); }, 1800);
    }
  }

  function handleGiveUp() {
    if (localStatus !== 'playing' || hasSubmittedRef.current || !lobby) return;
    hasSubmittedRef.current = true;
    setLocalStatus('done');
    updatePlayerScore(lobby.id, 0, 0, [], [], true);
  }

  // ── HOST: Load and start next round ──
  async function handleNextRound() {
    if (!isHost || !lobby || isLoadingNext || !careerState) return;
    setIsLoadingNext(true);

    try {
      const sport = (careerState.sport || lobby.sport) as Sport;
      const careerTo = careerState.career_to || 0;
      const filters = careerTo ? { careerTo } : undefined;

      const player = sport === 'nba'
        ? await getRandomNBAScramblePlayer(filters)
        : await getRandomNFLScramblePlayer(filters);

      if (!player) { setIsLoadingNext(false); return; }

      const playerName = player.player_name;
      const scrambled = scrambleName(playerName);

      const newState: ScrambleState = {
        playerName,
        scrambledName: scrambled,
        sport,
        round: (careerState.round || 0) + 1,
        win_target: careerState.win_target || 20,
        career_to: careerTo,
      };

      await startCareerRound(lobby.id, newState as unknown as Record<string, unknown>);
    } catch {
      // ignore
    }
    setIsLoadingNext(false);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!lobby || !careerState) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="text-white/50 sports-font">Loading...</div>
      </div>
    );
  }

  const winTarget = careerState.win_target || 20;
  const doneCount = players.filter(p => p.finished_at !== null).length;
  const totalCount = players.length;
  const isDone = localStatus === 'done';

  // ── BETWEEN-ROUND INTERSTITIAL ──
  if (lobby.status === 'waiting') {
    const summary = roundSummary;

    return (
      <div className="min-h-screen bg-[#111] text-white flex flex-col p-4 md:p-6">
        <header className="flex justify-between items-center mb-6">
          <div>
            <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase">Round Complete</div>
            <h1 className="retro-title text-2xl text-[var(--vintage-cream)]">
              Round {summary?.round ?? careerState.round}
            </h1>
          </div>
          <div className="text-right">
            <div className="sports-font text-[8px] text-[#888] tracking-widest">FIRST TO</div>
            <div className="retro-title text-2xl text-[#3b82f6]">{winTarget} pts</div>
          </div>
        </header>

        {/* Scrambled → Answer reveal */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-6 bg-[#1a1a1a] border-2 border-[#d4af37]/50 rounded-lg text-center space-y-2"
          >
            <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase">The Scramble Was</div>
            <div className="retro-title text-2xl text-[#3b82f6]">{summary.scrambledName}</div>
            <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase mt-1">The Answer Was</div>
            <div className="retro-title text-3xl text-[#d4af37]">{summary.answer}</div>
          </motion.div>
        )}

        {/* Positional results this round */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 bg-[#1a1a1a] border border-[#333] rounded-lg p-4"
        >
          <div className="sports-font text-[10px] text-[#888] tracking-widest mb-3 uppercase text-center">
            This Round
          </div>
          <div className="space-y-2">
            {(() => {
              const ptsMap = summary?.pts ?? {};
              // Sort by pts desc, then by finished_at asc
              const finishedAt = summary?.finishedAt ?? {};
              const sorted = [...players].sort((a, b) => {
                const diff = (ptsMap[b.player_id] ?? 0) - (ptsMap[a.player_id] ?? 0);
                if (diff !== 0) return diff;
                const aT = finishedAt[a.player_id] ? new Date(finishedAt[a.player_id]!).getTime() : Infinity;
                const bT = finishedAt[b.player_id] ? new Date(finishedAt[b.player_id]!).getTime() : Infinity;
                return aT - bT;
              });

              const badges = ['🥇', '🥈', '🥉', '4th'];

              return sorted.map((player, rank) => {
                const pts = ptsMap[player.player_id] ?? 0;
                const isMe = player.player_id === currentPlayerId;
                const gotIt = pts > 0;
                const badge = gotIt ? (badges[rank] ?? `${rank + 1}th`) : '—';
                const ptsLabel = gotIt ? `+${pts}` : '—';

                return (
                  <div
                    key={player.player_id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isMe ? 'bg-[#3b82f6]/10 border border-[#3b82f6]/30' : 'bg-black/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl w-8 text-center">{badge}</span>
                      <div>
                        <span className="sports-font text-sm text-white/80">{player.player_name}</span>
                        {isMe && <span className="text-[10px] text-white/40 sports-font ml-1">(you)</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="sports-font text-[8px] text-[#888] tracking-wider">PTS</div>
                        <div className={`retro-title text-lg ${gotIt ? 'text-[#d4af37]' : 'text-[#555]'}`}>
                          {ptsLabel}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="sports-font text-[8px] text-[#888] tracking-wider">TOTAL</div>
                        <div className="retro-title text-lg text-[#3b82f6]">{player.wins || 0}</div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </motion.div>

        {/* Points progress bars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 bg-[#1a1a1a] border border-[#333] rounded-lg p-4"
        >
          <div className="sports-font text-[10px] text-[#888] tracking-widest mb-3 uppercase text-center">
            Race to {winTarget} pts
          </div>
          <div className="space-y-3">
            {[...players].sort((a, b) => (b.wins || 0) - (a.wins || 0)).map(player => {
              const pts = player.wins || 0;
              const pct = Math.min(100, (pts / winTarget) * 100);
              const isMe = player.player_id === currentPlayerId;
              return (
                <div key={player.player_id}>
                  <div className="flex justify-between mb-1">
                    <span className={`sports-font text-xs ${isMe ? 'text-white' : 'text-white/60'}`}>
                      {player.player_name}{isMe ? ' (you)' : ''}
                    </span>
                    <span className="retro-title text-sm text-[#3b82f6]">{pts}</span>
                  </div>
                  <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#60a5fa]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {isHost ? (
          <button
            onClick={handleNextRound}
            disabled={isLoadingNext}
            className="w-full py-4 rounded-lg retro-title text-xl tracking-wider transition-all bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1 disabled:opacity-50"
          >
            {isLoadingNext ? 'Loading Next Player...' : 'Next Round'}
          </button>
        ) : (
          <div className="text-center text-white/30 sports-font text-sm tracking-wider">
            Waiting for host to start next round...
          </div>
        )}
      </div>
    );
  }

  // ── GAMEPLAY ──
  // Layout: fixed-height container so the mobile keyboard doesn't scroll the
  // scrambled name off screen. Name is pinned at top, input pinned at bottom,
  // everything else scrolls in the middle.
  return (
    <div className="h-[100dvh] bg-[#111] text-white flex flex-col overflow-hidden">

      {/* ── PINNED TOP: always visible even when keyboard is open ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-[#111]">
        {/* Round / done badge row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] sports-font tracking-wider bg-[#3b82f6] text-white">
              SCRAMBLE
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] sports-font tracking-wider bg-[#1a1a1a] text-[#888]">
              Round {careerState.round}
            </span>
          </div>
          <div className="bg-[#1a1a1a] border border-[#3d3d3d] rounded-lg px-3 py-1 text-center">
            <div className="sports-font text-[8px] text-[#888] tracking-widest">DONE</div>
            <div className="retro-title text-lg text-white leading-none">{doneCount}/{totalCount}</div>
          </div>
        </div>

        {/* Scrambled name — the key thing that must stay visible */}
        <motion.div
          key={careerState.scrambledName}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-3"
        >
          <div className="sports-font text-[9px] text-[#888] tracking-[0.4em] uppercase mb-2">
            Unscramble This Name
          </div>
          <div className="retro-title text-4xl md:text-5xl text-[#d4af37] tracking-wider leading-tight">
            {careerState.scrambledName}
          </div>
          <div className="sports-font text-[9px] text-[#555] tracking-widest mt-2 uppercase">
            {careerState.sport?.toUpperCase()} Player
          </div>
        </motion.div>

        {/* Pressure timer — compact inline under the name */}
        <AnimatePresence>
          {pressureActive && pressureTimer > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mt-2 px-3 py-1.5 rounded-lg text-center border ${
                pressureTimer <= 10
                  ? 'bg-red-900/30 border-red-500 text-red-400'
                  : pressureTimer <= 20
                  ? 'bg-yellow-900/20 border-yellow-600 text-yellow-400'
                  : 'bg-[#1a1a1a] border-[#3b82f6] text-[#3b82f6]'
              }`}
            >
              <span className="retro-title text-xl">{pressureTimer}s</span>
              <span className="sports-font text-xs ml-2 opacity-70">remaining</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── SCROLLABLE MIDDLE: progress bars + player status + feedback ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {/* Points progress bars */}
        <div className="space-y-2">
          {[...players].sort((a, b) => (b.wins || 0) - (a.wins || 0)).map(player => {
            const pts = player.wins || 0;
            const pct = Math.min(100, (pts / winTarget) * 100);
            const isMe = player.player_id === currentPlayerId;
            return (
              <div key={player.player_id} className="flex items-center gap-2">
                <span className={`sports-font text-[10px] w-20 truncate flex-shrink-0 ${isMe ? 'text-white' : 'text-white/50'}`}>
                  {player.player_name}
                </span>
                <div className="flex-1 h-2 bg-[#222] rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4 }}
                    className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#60a5fa]"
                  />
                </div>
                <span className="retro-title text-sm text-[#3b82f6] w-8 text-right flex-shrink-0">{pts}</span>
              </div>
            );
          })}
        </div>

        {/* Live player status */}
        <div className="flex gap-2 flex-wrap">
          {players.map(player => {
            const isMe = player.player_id === currentPlayerId;
            const finished = player.finished_at !== null;
            const gotIt = finished && (player.score || 0) > 0;
            return (
              <div
                key={player.player_id}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border sports-font text-xs ${
                  gotIt
                    ? 'bg-green-900/20 border-green-700/40 text-green-300'
                    : finished
                    ? 'bg-red-900/20 border-red-900/40 text-red-400'
                    : 'bg-[#1a1a1a] border-[#333] text-white/60'
                }`}
              >
                <span>{player.player_name}{isMe ? ' (you)' : ''}</span>
                {gotIt && <span className="text-green-400">✓</span>}
                {finished && !gotIt && <span>✗</span>}
                {!finished && (
                  <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin opacity-70" />
                )}
              </div>
            );
          })}
        </div>

        {/* Feedback / done messages */}
        <AnimatePresence>
          {feedbackMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center sports-font text-sm ${
                feedbackType === 'correct' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {feedbackMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-lg text-center bg-[#1a1a1a] border border-[#333]"
            >
              <div className="sports-font text-sm text-[#888]">
                {feedbackType === 'correct' || hasSubmittedRef.current
                  ? `Waiting for ${doneCount}/${totalCount} players...`
                  : 'No points this round — waiting for others...'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── PINNED BOTTOM: input always accessible above keyboard ── */}
      {!isDone && (
        <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-white/10 bg-[#111] space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuess()}
              placeholder="Type the player's name..."
              className="flex-1 bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-3 sports-font text-sm text-[var(--vintage-cream)] placeholder-[#555] focus:outline-none focus:border-[#3b82f6]"
            />
            <button
              onClick={handleGuess}
              disabled={!guessInput.trim()}
              className="px-6 py-3 rounded-lg sports-font text-sm text-white bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 transition-all"
            >
              Guess
            </button>
          </div>
          <button
            onClick={handleGiveUp}
            className="w-full py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-red-900/50 text-red-400 hover:border-red-700 transition-all"
          >
            Give Up
          </button>
        </div>
      )}
    </div>
  );
}
