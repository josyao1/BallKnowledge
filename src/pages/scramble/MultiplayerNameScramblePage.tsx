/**
 * MultiplayerNameScramblePage.tsx — Multiplayer "Name Scramble" gameplay.
 *
 * Shows a scrambled player name. Players race to type the correct unscrambled name.
 * First correct answer starts a 30-second pressure timer. Positional scoring:
 * 1st correct = 5 pts, 2nd = 3 pts, 3rd = 2 pts, 4th = 1 pt.
 * First player to the win_target total points wins the match.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useGuessInput } from '../../hooks/useGuessInput';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { EmoteOverlay } from '../../components/multiplayer/EmoteOverlay';
import { HomeButton } from '../../components/multiplayer/HomeButton';
import {
  getLobbyPlayers,
  updateLobbyStatus,
  updatePlayerScore,
  addCareerPoints,
  incrementPlayerWins,
  startCareerRound,
  updateCareerState,
} from '../../services/lobby';
import { getRandomNBAScramblePlayer, getRandomNFLScramblePlayer } from '../../services/careerData';
import { scrambleName } from '../../utils/scramble';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import type { Sport } from '../../types';
import { useGameAbandonment } from '../../hooks/useGameAbandonment';
import { PlayerHeadshot } from '../../components/capCrunch/PlayerHeadshot';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScrambleState {
  playerName: string;
  scrambledName: string;
  playerId?: string | number;
  sport: 'nba' | 'nfl';
  round: number;
  win_target: number;
  career_to: number;
  min_mpg: number;
  min_yards: number;
  include_defense: boolean;
  firstCorrectAt?: string; // ISO timestamp written by host when first player answers correctly
}

interface RoundSummary {
  scrambledName: string;
  answer: string;
  playerId?: string | number;
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
  const { lobby, players, isHost, currentPlayerId } = useMultiplayerGame({ code });

  const careerState = lobby?.career_state as ScrambleState | null;

  // ── Local state ──
  const [localStatus, setLocalStatus] = useState<'playing' | 'done'>('playing');
  const { guessInput, setGuessInput, feedbackMsg, setFeedbackMsg, feedbackType, setFeedbackType } = useGuessInput();
  const [pressureTimer, setPressureTimer] = useState(30);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);

  // ── Refs ──
  const hasSubmittedRef = useRef(false);
  const hasAdvancedRef = useRef(false);
  const hasWrittenFirstCorrectAtRef = useRef(false);
  const atLeastOnePlayerWasActiveRef = useRef(false);
  const pressureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRoundRef = useRef(-1);
  const prevStatusRef = useRef<string | null>(null);
  const roundHistoryRef = useRef<RoundSummary[]>([]);
  // Snapshot of round scores taken when allPlayersFinished (still in 'playing' phase).
  // Prevents post-round realtime events from corrupting the interstitial ptsMap.
  const roundScoresSnapshotRef = useRef<Record<string, { score: number; finishedAt: string | null }>>({});

  // pressureActive is derived from the shared timestamp so all clients agree on when it's running
  const pressureActive = !!careerState?.firstCorrectAt && pressureTimer > 0 && localStatus === 'playing';

  // ── HOST: write firstCorrectAt to career_state when the first answer arrives ──
  // Capture stable values so the closure doesn't go stale between renders.
  const lobbyIdForFirstCorrect = lobby?.id;
  const careerStateForFirstCorrect = careerState;
  useEffect(() => {
    if (!isHost || !lobbyIdForFirstCorrect || !careerStateForFirstCorrect) return;
    if (careerStateForFirstCorrect.firstCorrectAt || hasWrittenFirstCorrectAtRef.current) return;
    if (!atLeastOnePlayerWasActiveRef.current) return;
    const firstCorrect = players.some(p => p.finished_at !== null && (p.score || 0) > 0);
    if (!firstCorrect) return;
    hasWrittenFirstCorrectAtRef.current = true;
    updateCareerState(lobbyIdForFirstCorrect, { ...careerStateForFirstCorrect, firstCorrectAt: new Date().toISOString() });
  }, [players.map(p => p.finished_at).join(','), isHost, lobbyIdForFirstCorrect, careerStateForFirstCorrect]);

  // ── ALL CLIENTS: compute pressure countdown from the shared firstCorrectAt timestamp ──
  useEffect(() => {
    if (pressureIntervalRef.current) clearInterval(pressureIntervalRef.current);
    if (!careerState?.firstCorrectAt) return;
    const anchor = new Date(careerState.firstCorrectAt).getTime();
    const tick = () => setPressureTimer(Math.max(0, 30 - Math.floor((Date.now() - anchor) / 1000)));
    tick();
    pressureIntervalRef.current = setInterval(tick, 500);
    return () => { if (pressureIntervalRef.current) clearInterval(pressureIntervalRef.current); };
  }, [careerState?.firstCorrectAt]);

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

      // Use the snapshot taken when allPlayersFinished (before post-round realtime events
      // could corrupt scores). Fall back to live players state if no snapshot available.
      const snapOrLive = (p: { player_id: string; score: number | null; finished_at: string | null }) => {
        const snap = roundScoresSnapshotRef.current[p.player_id];
        return snap ?? { score: p.score || 0, finishedAt: p.finished_at };
      };

      // Compute positional pts: sort correct players by finished_at, assign 5/3/2/1
      const correctPlayers = [...players]
        .filter(p => { const s = snapOrLive(p); return (s.score || 0) > 0 && s.finishedAt !== null; })
        .sort((a, b) => {
          const aT = new Date(snapOrLive(a).finishedAt!).getTime();
          const bT = new Date(snapOrLive(b).finishedAt!).getTime();
          return aT - bT;
        });

      players.forEach(p => {
        const posIdx = correctPlayers.findIndex(cp => cp.player_id === p.player_id);
        ptsMap[p.player_id] = posIdx >= 0 ? (POSITION_PTS[posIdx] ?? 1) : 0;
        finishedAt[p.player_id] = snapOrLive(p).finishedAt;
      });

      const newSummary: RoundSummary = {
        scrambledName: careerState.scrambledName || '',
        answer: careerState.playerName || '',
        playerId: careerState.playerId,
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

  const { handleEndGame } = useGameAbandonment({
    code,
    lobbyId: lobby?.id,
    careerState: lobby?.career_state as Record<string, unknown> | null,
    isHost,
  });

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
      hasSubmittedRef.current = false;
      hasWrittenFirstCorrectAtRef.current = false;
      atLeastOnePlayerWasActiveRef.current = false;
      roundScoresSnapshotRef.current = {};
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

  // Snapshot round scores the moment all players finish (still in 'playing' phase).
  // Prevents addCareerPoints / next-round score reset realtime events from
  // corrupting the interstitial's ptsMap computation.
  useEffect(() => {
    if (allPlayersFinished && lobby?.status === 'playing' && atLeastOnePlayerWasActiveRef.current) {
      players.forEach(p => {
        roundScoresSnapshotRef.current[p.player_id] = { score: p.score || 0, finishedAt: p.finished_at };
      });
    }
  }, [allPlayersFinished, lobby?.status]);

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
    const gameWinner = freshPlayers.find(p => (p.points ?? 0) >= winTarget);

    if (gameWinner) {
      // Award session win to the match winner
      await incrementPlayerWins(lobby.id, gameWinner.player_id);
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
      const careerTo       = careerState.career_to      || 0;
      const minMpg         = careerState.min_mpg        || 0;
      const minYards       = careerState.min_yards      || 0;
      const includeDefense = careerState.include_defense !== false;
      const filters = (careerTo || minMpg || minYards || !includeDefense) ? { careerTo, minMpg, minYards, includeDefense } : undefined;

      const player = sport === 'nba'
        ? await getRandomNBAScramblePlayer(filters)
        : await getRandomNFLScramblePlayer(filters);

      if (!player) { setIsLoadingNext(false); return; }

      const playerName = player.player_name;
      const scrambled = scrambleName(playerName);

      const newState: ScrambleState = {
        playerName,
        scrambledName: scrambled,
        playerId: (player as any).player_id ?? undefined,
        sport,
        round: (careerState.round || 0) + 1,
        win_target: careerState.win_target || 20,
        career_to: careerTo,
        min_mpg: minMpg,
        min_yards: minYards,
        include_defense: includeDefense,
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
      <div className="min-h-screen home-chalkboard flex items-center justify-center">
        <div className="text-white/50 capcrunch-kicker">Loading...</div>
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
      <div className="min-h-screen home-chalkboard text-white flex flex-col p-4 md:p-6">
        <header className="flex justify-between items-center mb-6">
          <div>
            <div className="capcrunch-kicker text-[10px] text-[#888] tracking-widest uppercase">Round Complete</div>
            <h1 className="capcrunch-title text-2xl text-white">
              Round {summary?.round ?? careerState.round}
            </h1>
          </div>
          <div className="text-right">
            <div className="capcrunch-kicker text-[8px] text-[#888] tracking-widest">FIRST TO</div>
            <div className="capcrunch-title text-2xl text-[#3b82f6]">{winTarget} pts</div>
          </div>
        </header>

        {/* Scrambled → Answer reveal */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-6 bg-black/40 border-2 border-[#d4af37]/50 text-center space-y-2"
          >
            <div className="capcrunch-kicker text-[10px] text-[#888] tracking-widest uppercase">The Scramble Was</div>
            <div className="capcrunch-title text-2xl text-[#3b82f6]">{summary.scrambledName}</div>
            <div className="capcrunch-kicker text-[10px] text-[#888] tracking-widest uppercase mt-2">The Answer Was</div>
            <div className="flex items-center justify-center gap-3 mt-1">
              <PlayerHeadshot
                playerId={summary.playerId ?? undefined}
                sport={careerState.sport}
                className="w-12 h-12 rounded-full object-cover shrink-0 border-2 border-white/10"
              />
              <div className="capcrunch-title text-3xl text-[#d4af37]">{summary.answer}</div>
            </div>
          </motion.div>
        )}

        {/* Positional results this round */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 bg-black/40 border border-white/10 p-4"
        >
          <div className="capcrunch-kicker text-[10px] text-[#888] tracking-widest mb-3 uppercase text-center">
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
                        <span className="capcrunch-kicker text-sm text-white/80">{player.player_name}</span>
                        {isMe && <span className="text-[10px] text-white/40 capcrunch-kicker ml-1">(you)</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="capcrunch-kicker text-[8px] text-[#888] tracking-wider">PTS</div>
                        <div className={`capcrunch-title text-lg ${gotIt ? 'text-[#d4af37]' : 'text-[#555]'}`}>
                          {ptsLabel}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="capcrunch-kicker text-[8px] text-[#888] tracking-wider">TOTAL</div>
                        <div className="capcrunch-title text-lg text-[#3b82f6]">{player.points ?? 0}</div>
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
          className="mb-6 bg-black/40 border border-white/10 p-4"
        >
          <div className="capcrunch-kicker text-[10px] text-[#888] tracking-widest mb-3 uppercase text-center">
            Race to {winTarget} pts
          </div>
          <div className="space-y-3">
            {[...players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).map(player => {
              const pts = player.points ?? 0;
              const pct = Math.min(100, (pts / winTarget) * 100);
              const isMe = player.player_id === currentPlayerId;
              return (
                <div key={player.player_id}>
                  <div className="flex justify-between mb-1">
                    <span className={`capcrunch-kicker text-xs ${isMe ? 'text-white' : 'text-white/60'}`}>
                      {player.player_name}{isMe ? ' (you)' : ''}
                    </span>
                    <span className="capcrunch-title text-sm text-[#3b82f6]">{pts}</span>
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
            className="capcrunch-btn-primary w-full py-4 capcrunch-title text-xl disabled:opacity-50"
          >
            {isLoadingNext ? 'Loading Next Player...' : 'Next Round'}
          </button>
        ) : (
          <div className="text-center text-white/30 capcrunch-kicker text-sm tracking-wider">
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
  const currentPlayerName = players.find(p => p.player_id === currentPlayerId)?.player_name;

  return (
    <div className="fixed inset-0 home-chalkboard text-white flex flex-col overflow-hidden">
      <EmoteOverlay lobbyId={lobby?.id} currentPlayerId={currentPlayerId} currentPlayerName={currentPlayerName} />

      {/* ── PINNED TOP: always visible even when keyboard is open ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/10 home-chalkboard">
        {/* Round / done badge row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] capcrunch-kicker tracking-wider bg-[#3b82f6] text-white">
              SCRAMBLE
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] capcrunch-kicker tracking-wider bg-black/40 text-[#888]">
              Round {careerState.round}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <HomeButton isHost={isHost} onEndGame={handleEndGame} />
            <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-center">
              <div className="capcrunch-kicker text-[8px] text-[#888] tracking-widest">DONE</div>
              <div className="capcrunch-title text-lg text-white leading-none">{doneCount}/{totalCount}</div>
            </div>
          </div>
        </div>

        {/* Scrambled name — the key thing that must stay visible */}
        <motion.div
          key={careerState.scrambledName}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-3"
        >
          <div className="capcrunch-kicker text-[9px] text-white/40 tracking-[0.4em] uppercase mb-2">
            Unscramble This Name
          </div>
          <div className="capcrunch-title text-4xl md:text-5xl text-[#3b82f6] tracking-wider leading-tight">
            {careerState.scrambledName}
          </div>
          <div className="capcrunch-kicker text-[9px] text-white/30 tracking-widest mt-2 uppercase">
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
                  : 'bg-black/40 border-[#3b82f6] text-[#3b82f6]'
              }`}
            >
              <span className="capcrunch-title text-xl">{pressureTimer}s</span>
              <span className="capcrunch-kicker text-xs ml-2 opacity-70">remaining</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── SCROLLABLE MIDDLE: progress bars + player status + feedback ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {/* Points progress bars */}
        <div className="space-y-2">
          {[...players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).map(player => {
            const pts = player.points ?? 0;
            const pct = Math.min(100, (pts / winTarget) * 100);
            const isMe = player.player_id === currentPlayerId;
            return (
              <div key={player.player_id} className="flex items-center gap-2">
                <span className={`capcrunch-kicker text-[10px] w-20 truncate flex-shrink-0 ${isMe ? 'text-white' : 'text-white/50'}`}>
                  {player.player_name}
                </span>
                <div className="flex-1 h-2 bg-[#222] rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4 }}
                    className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#60a5fa]"
                  />
                </div>
                <span className="capcrunch-title text-sm text-[#3b82f6] w-8 text-right flex-shrink-0">{pts}</span>
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border capcrunch-kicker text-xs ${
                  gotIt
                    ? 'bg-green-900/20 border-green-700/40 text-green-300'
                    : finished
                    ? 'bg-red-900/20 border-red-900/40 text-red-400'
                    : 'bg-black/40 border-white/10 text-white/60'
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
              className={`text-center capcrunch-kicker text-sm ${
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
              className="p-4 text-center bg-black/40 border border-white/10"
            >
              <div className="capcrunch-kicker text-sm text-[#888]">
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
        <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-white/10 home-chalkboard space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuess()}
              placeholder="Type the player's name..."
              className="flex-1 bg-black/40 border border-white/10 px-4 py-3 capcrunch-kicker text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#3b82f6]"
            />
            <button
              onClick={handleGuess}
              disabled={!guessInput.trim()}
              className="px-6 py-3 capcrunch-kicker text-sm text-white bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 transition-all"
            >
              Guess
            </button>
          </div>
          <button
            onClick={handleGiveUp}
            className="w-full py-2 capcrunch-kicker text-xs bg-black/40 border border-red-900/50 text-red-400 hover:border-red-700 transition-all"
          >
            Give Up
          </button>
        </div>
      )}
    </div>
  );
}
