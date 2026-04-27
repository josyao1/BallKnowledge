/**
 * MultiplayerFaceRevealPage.tsx — Multiplayer "Face Reveal" gameplay.
 *
 * A player's headshot is shown zoomed in. Every `timer` seconds (tracked via
 * ISO timestamp in career_state.zoom_deadline) it zooms out one level. Players
 * guess at any time. First correct = 3 pts; every other correct guess = 1 pt.
 * First to win_target total points wins the match.
 *
 * Correctness tracking uses lobby_players (score > 0, finished_at) rather than
 * career_state fields to avoid read-modify-write races between simultaneous
 * correct guesses.
 *
 * career_state shape:
 * {
 *   sport, win_target, career_to, timer,
 *   round, player_name, player_id,
 *   zoom_level: 1 | 2 | 3,
 *   zoom_deadline: ISO string (when current level expires),
 * }
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { EmoteOverlay } from '../../components/multiplayer/EmoteOverlay';
import { HomeButton } from '../../components/multiplayer/HomeButton';
import { ZoomedHeadshot } from '../../components/faceReveal/ZoomedHeadshot';
import {
  findLobbyByCode,
  getLobbyPlayers,
  updateLobbyStatus,
  updateCareerState,
  updatePlayerScore,
  addCareerPoints,
  incrementPlayerWins,
  startCareerRound,
} from '../../services/lobby';
import { loadNBALineupPool, loadNFLLineupPool } from '../../services/careerData';
import type { NBACareerPlayer, NFLCareerPlayer } from '../../services/careerData';
import { DEFENSE_ALLOWLIST } from '../../data/faceRevealDefenseAllowlist';
import { areSimilarNames } from '../../utils/fuzzyDedup';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FaceRevealState {
  sport: 'nba' | 'nfl';
  win_target: number;
  career_to: number;
  timer: number;
  round: number;
  player_name: string;
  player_id: string | number;
  zoom_level: 1 | 2 | 3;
  zoom_deadline: string; // ISO timestamp when current level expires
  skip_votes?: string[]; // player_ids who voted to skip to the next zoom level
}

interface PlayerEntry {
  player_id: string | number;
  player_name: string;
  position?: string;
}

const MP_OFF_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'FB']);

function weightedRandom(candidates: PlayerEntry[]): PlayerEntry {
  const total = candidates.reduce((sum, p) =>
    sum + (p.position && MP_OFF_POSITIONS.has(p.position) ? 3 : 1), 0);
  let r = Math.random() * total;
  for (const p of candidates) {
    r -= p.position && MP_OFF_POSITIONS.has(p.position) ? 3 : 1;
    if (r <= 0) return p;
  }
  return candidates[candidates.length - 1];
}

interface RoundSummary {
  playerName: string;
  playerId: string | number;
  round: number;
  pts: Record<string, number>;
}

function nbaEndYear(p: NBACareerPlayer): number {
  const years = p.seasons.map(s => parseInt(s.season)).filter(Boolean);
  return years.length ? Math.max(...years) : 0;
}

function nflEndYear(p: NFLCareerPlayer): number {
  const years = p.seasons.map(s => parseInt(s.season)).filter(Boolean);
  return years.length ? Math.max(...years) : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MultiplayerFaceRevealPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers } = useLobbyStore();

  useLobbySubscription(lobby?.id || null);

  const careerState = lobby?.career_state as FaceRevealState | null;

  // ── Local state ──
  const [guessInput, setGuessInput]     = useState('');
  const [feedbackMsg, setFeedbackMsg]   = useState('');
  const [feedbackType, setFeedbackType] = useState<'correct' | 'wrong' | ''>('');
  const [localDone, setLocalDone]       = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  // Live countdown for current zoom level (computed from zoom_deadline).
  const [countdown, setCountdown]       = useState(0);
  // Local zoom level display (mirrors careerState but updates instantly from deadline watcher).
  const [displayZoom, setDisplayZoom]   = useState<1 | 2 | 3>(1);

  // ── Refs ──
  const hasSubmittedRef    = useRef(false);
  const hasAdvancedRef     = useRef(false);  // guards endRound from double-firing
  const isZoomAdvancingRef = useRef(false);  // guards zoom-level advance from double-firing
  const prevRoundRef       = useRef(-1);
  const prevStatusRef      = useRef<string | null>(null);
  const roundHistoryRef    = useRef<RoundSummary[]>([]);
  const zoomTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef           = useRef<HTMLInputElement>(null);

  // Player pool for host (to pick next player).
  const playerPoolRef = useRef<PlayerEntry[]>([]);
  const usedIdsRef    = useRef<Set<string | number>>(new Set());

  // ── Load lobby on mount ──
  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby?.career_state) return;

    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => {
        if (pr.players) setPlayers(pr.players);
      });
    });
  }, []);

  // ── Pre-load player pool (host needs it to start rounds) ──
  useEffect(() => {
    if (!careerState || playerPoolRef.current.length) return;
    const { sport, career_to } = careerState;
    const min_yards: number     = (careerState as any).min_yards    || 0;
    const defense_mode: string  = (careerState as any).defense_mode || 'known';
    const NFL_OFF = MP_OFF_POSITIONS;
    const NFL_ST  = new Set(['K', 'P', 'LS']);

    async function loadPool() {
      if (sport === 'nba') {
        const all = await loadNBALineupPool();
        let filtered = all.filter(p => p.player_id != null);
        if (career_to) filtered = filtered.filter(p => nbaEndYear(p) >= career_to);
        playerPoolRef.current = filtered.map(p => ({ player_id: p.player_id, player_name: p.player_name }));
      } else {
        const all = await loadNFLLineupPool();
        let filtered = all.filter(p => p.player_id != null);
        if (career_to) filtered = filtered.filter(p => nflEndYear(p) >= career_to);
        filtered = filtered.filter(p => {
          if (NFL_ST.has(p.position)) return false;
          if (NFL_OFF.has(p.position)) {
            if (min_yards === 0) return true;
            return p.seasons.some(
              (s: any) => (s.passing_yards || 0) + (s.rushing_yards || 0) + (s.receiving_yards || 0) >= min_yards
            );
          }
          return defense_mode === 'all' || DEFENSE_ALLOWLIST.has(String(p.player_id));
        });
        playerPoolRef.current = filtered.map(p => ({ player_id: p.player_id, player_name: p.player_name, position: p.position }));
      }
    }
    loadPool();
  }, [careerState?.sport, careerState?.career_to, (careerState as any)?.min_yards, (careerState as any)?.defense_mode]);

  // ── Countdown timer: tracks seconds until zoom_deadline ──
  useEffect(() => {
    if (!careerState?.zoom_deadline || lobby?.status !== 'playing') {
      if (zoomTimerRef.current) clearInterval(zoomTimerRef.current);
      return;
    }

    setDisplayZoom(careerState.zoom_level);
    // A new zoom level has arrived from Supabase — clear the advancing guard.
    isZoomAdvancingRef.current = false;

    function tick() {
      const remaining = Math.max(0, Math.ceil((new Date(careerState!.zoom_deadline).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
    }

    tick();
    zoomTimerRef.current = setInterval(tick, 500);
    return () => { if (zoomTimerRef.current) clearInterval(zoomTimerRef.current); };
  }, [careerState?.zoom_deadline, careerState?.zoom_level, lobby?.status]);

  // ── HOST: watch zoom_deadline and advance zoom level when expired ──
  useEffect(() => {
    if (!isHost || !careerState || lobby?.status !== 'playing') return;
    if (countdown > 0) return;
    // Guard against firing multiple times while countdown stays at 0
    // between 500ms ticks and before the Supabase write propagates back.
    if (hasAdvancedRef.current) return;

    const currentZoom = careerState.zoom_level;
    if (currentZoom < 3) {
      if (isZoomAdvancingRef.current) return;
      isZoomAdvancingRef.current = true;
      const nextDeadline = new Date(Date.now() + careerState.timer * 1000).toISOString();
      updateCareerState(lobby!.id, {
        ...careerState,
        zoom_level: (currentZoom + 1) as 1 | 2 | 3,
        zoom_deadline: nextDeadline,
        skip_votes: [],
      });
    } else {
      // Level 3 expired — end the round.
      endRound();
    }
  }, [countdown, isHost, lobby?.status]);

  // ── HOST: advance zoom when all eligible players voted to skip ──
  useEffect(() => {
    if (!isHost || !careerState || lobby?.status !== 'playing') return;
    if (displayZoom >= 3) return;
    if (isZoomAdvancingRef.current) return;

    const skipVotes  = careerState.skip_votes ?? [];
    // Eligible = players still guessing (finished_at null).
    const eligible   = players.filter(p => p.finished_at === null);
    if (eligible.length === 0) return;
    if (!eligible.every(p => skipVotes.includes(p.player_id))) return;

    isZoomAdvancingRef.current = true;
    const nextDeadline = new Date(Date.now() + careerState.timer * 1000).toISOString();
    updateCareerState(lobby!.id, {
      ...careerState,
      zoom_level: (displayZoom + 1) as 1 | 2 | 3,
      zoom_deadline: nextDeadline,
      skip_votes: [],
    });
  }, [careerState?.skip_votes?.length, players, isHost, displayZoom, lobby?.status]);

  // ── Detect new round — reset all local state ──
  const currentRound = careerState?.round ?? 0;
  useEffect(() => {
    if (currentRound > 0 && currentRound !== prevRoundRef.current) {
      prevRoundRef.current = currentRound;
      setLocalDone(false);
      setGuessInput('');
      setFeedbackMsg('');
      setFeedbackType('');
      hasSubmittedRef.current = false;
      hasAdvancedRef.current = false;
      isZoomAdvancingRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentRound]);

  // ── Handle lobby status transitions ──
  useEffect(() => {
    if (!lobby) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = lobby.status;

    if (prev === 'playing' && (lobby.status === 'waiting' || lobby.status === 'finished') && careerState) {
      // Derive pts from lobby_players: score > 0 means correct; earliest finished_at = first (3pts).
      const ptsMap: Record<string, number> = {};
      const correctPlayers = [...players]
        .filter(p => (p.score || 0) > 0 && p.finished_at !== null)
        .sort((a, b) => new Date(a.finished_at!).getTime() - new Date(b.finished_at!).getTime());
      const firstId = correctPlayers[0]?.player_id ?? null;
      players.forEach(p => {
        if (p.player_id === firstId) ptsMap[p.player_id] = 3;
        else if ((p.score || 0) > 0) ptsMap[p.player_id] = 1;
        else ptsMap[p.player_id] = 0;
      });

      const newSummary: RoundSummary = {
        playerName: careerState.player_name,
        playerId: careerState.player_id,
        round: careerState.round,
        pts: ptsMap,
      };
      setRoundSummary(newSummary);
      roundHistoryRef.current = [...roundHistoryRef.current, newSummary];
      hasAdvancedRef.current = false;
    }

    if (lobby.status === 'finished') {
      navigate(`/lobby/${code}/face-reveal/results`, { state: { roundHistory: roundHistoryRef.current } });
    }
  }, [lobby?.status]);

  // ── Abandoned by host ──
  useEffect(() => {
    if ((lobby?.career_state as { abandoned?: boolean } | null)?.abandoned) navigate('/');
  }, [(lobby?.career_state as { abandoned?: boolean } | null)?.abandoned]);

  async function handleEndGame() {
    if (!lobby) return;
    await updateCareerState(lobby.id, { abandoned: true });
    await updateLobbyStatus(lobby.id, 'waiting');
  }

  // ── End round (host only) ──
  // Reads fresh lobby_players to avoid stale closure issues: score > 0 means
  // correct, and finished_at order determines who was first (3pts vs 1pt).
  const endRound = useCallback(async () => {
    if (!lobby || hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;

    const winTarget = (lobby.career_state as FaceRevealState | null)?.win_target || 20;

    // Fetch fresh player data to get authoritative score/finished_at values.
    const freshResult = await getLobbyPlayers(lobby.id);
    const freshPlayers = freshResult.players || [];

    // Correct players sorted by finish time; earliest = first correct (+3pts).
    const correctPlayers = freshPlayers
      .filter(p => (p.score || 0) > 0 && p.finished_at !== null)
      .sort((a, b) => new Date(a.finished_at!).getTime() - new Date(b.finished_at!).getTime());

    await Promise.all([
      correctPlayers[0] ? addCareerPoints(lobby.id, correctPlayers[0].player_id, 3) : Promise.resolve(),
      ...correctPlayers.slice(1).map(p => addCareerPoints(lobby.id, p.player_id, 1)),
    ]);

    // Check win condition with updated points.
    const afterPtsResult = await getLobbyPlayers(lobby.id);
    const afterPts = afterPtsResult.players || [];
    const gameWinner = afterPts.find(p => (p.points ?? 0) >= winTarget);

    if (gameWinner) {
      await incrementPlayerWins(lobby.id, gameWinner.player_id);
      await updateLobbyStatus(lobby.id, 'finished');
    } else {
      await updateLobbyStatus(lobby.id, 'waiting');
    }
  }, [lobby]);

  // ── Guess handler ──
  function handleGuess() {
    if (!careerState || localDone || !lobby || hasSubmittedRef.current) return;
    const name = guessInput.trim();
    if (!name) return;

    setGuessInput('');

    if (areSimilarNames(name, careerState.player_name)) {
      hasSubmittedRef.current = true;
      setLocalDone(true);
      setFeedbackMsg('Correct!');
      setFeedbackType('correct');

      // Write score=1 + finished_at to lobby_players. The host's endRound reads
      // these to award pts (first finished_at = 3pts, others = 1pt).
      // Avoids the read-modify-write race that would occur writing to career_state.
      updatePlayerScore(lobby.id, 1, 0, [], [], true);
    } else {
      setFeedbackMsg(`"${name}" — try again`);
      setFeedbackType('wrong');
      setTimeout(() => { setFeedbackMsg(''); setFeedbackType(''); }, 1800);
    }
  }

  function handleGiveUp() {
    if (localDone || hasSubmittedRef.current || !lobby) return;
    hasSubmittedRef.current = true;
    setLocalDone(true);
    updatePlayerScore(lobby.id, 0, 0, [], [], true);
  }

  // Vote to skip to the next zoom level. Each player writes their own ID.
  // Host watches the vote count and advances when all eligible players agree.
  async function handleSkipZoom() {
    if (!careerState || !lobby || !currentPlayerId) return;
    if (displayZoom >= 3) return;
    const already = (careerState.skip_votes ?? []).includes(currentPlayerId);
    if (already) return;
    await updateCareerState(lobby.id, {
      ...careerState,
      skip_votes: [...(careerState.skip_votes ?? []), currentPlayerId],
    });
  }

  // ── HOST: pick a random player from pool (weighted: offense 3×, others 1×) ──
  function pickNextPlayer(): PlayerEntry | null {
    const pool = playerPoolRef.current;
    if (!pool.length) return null;

    let candidates = pool.filter(p => !usedIdsRef.current.has(p.player_id));
    if (!candidates.length) {
      usedIdsRef.current.clear();
      candidates = pool;
    }

    const chosen = weightedRandom(candidates);
    usedIdsRef.current.add(chosen.player_id);
    return chosen;
  }

  // ── HOST: start next round ──
  async function handleNextRound() {
    if (!isHost || !lobby || isLoadingNext || !careerState) return;
    setIsLoadingNext(true);

    const player = pickNextPlayer();
    if (!player) { setIsLoadingNext(false); return; }

    const timerSecs = careerState.timer || 60;
    const newState: FaceRevealState = {
      sport: careerState.sport,
      win_target: careerState.win_target || 20,
      career_to: careerState.career_to || 0,
      timer: timerSecs,
      round: (careerState.round || 0) + 1,
      player_name: player.player_name,
      player_id: player.player_id,
      zoom_level: 1,
      zoom_deadline: new Date(Date.now() + timerSecs * 1000).toISOString(),
    };

    await startCareerRound(lobby.id, newState as unknown as Record<string, unknown>);
    setIsLoadingNext(false);
  }

  // ── Render guard ──
  if (!lobby || !careerState) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="text-white/50 sports-font">Loading...</div>
      </div>
    );
  }

  const COLOR = '#06b6d4';
  const winTarget = careerState.win_target || 20;
  const doneCount = players.filter(p => p.finished_at !== null).length;
  const totalCount = players.length;
  const myPlayerName = players.find(p => p.player_id === currentPlayerId)?.player_name;

  // Derive correctness from lobby_players (authoritative, no race conditions).
  const myRow = players.find(p => p.player_id === currentPlayerId);
  const iGotIt = (myRow?.score || 0) > 0;
  const correctPlayersSorted = players
    .filter(p => (p.score || 0) > 0 && p.finished_at !== null)
    .sort((a, b) => new Date(a.finished_at!).getTime() - new Date(b.finished_at!).getTime());
  const isFirstCorrect = correctPlayersSorted[0]?.player_id === currentPlayerId;

  // Skip-zoom vote state.
  const skipVotes    = careerState.skip_votes ?? [];
  const iHaveVoted   = currentPlayerId ? skipVotes.includes(currentPlayerId) : false;
  const votedPlayers = players.filter(p => skipVotes.includes(p.player_id));
  const eligibleForSkip = players.filter(p => p.finished_at === null);

  // Timer color.
  const timerFraction = careerState.timer ? countdown / careerState.timer : 0;
  const timerColor = timerFraction > 0.6 ? '#22c55e'
    : timerFraction > 0.35 ? '#eab308'
    : timerFraction > 0.15 ? '#f97316'
    : '#ef4444';

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
            <div className="retro-title text-2xl" style={{ color: COLOR }}>{winTarget} pts</div>
          </div>
        </header>

        {/* Answer reveal + headshot */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-6 bg-[#1a1a1a] border-2 rounded-lg text-center space-y-3"
            style={{ borderColor: `${COLOR}50` }}
          >
            <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase">The Answer Was</div>
            <div className="retro-title text-3xl text-[#d4af37]">{summary.playerName}</div>
            <div className="flex justify-center">
              <div className="rounded-xl overflow-hidden" style={{ width: 160, height: 160 }}>
                <ZoomedHeadshot playerId={summary.playerId} sport={careerState.sport} zoomLevel={3} className="w-full h-full" />
              </div>
            </div>
          </motion.div>
        )}

        {/* This round results */}
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
            {[...players].sort((a, b) => ((summary?.pts[b.player_id] ?? 0) - (summary?.pts[a.player_id] ?? 0))).map((player) => {
              const pts = summary?.pts[player.player_id] ?? 0;
              const isMe = player.player_id === currentPlayerId;
              const badge = pts === 3 ? '🥇' : pts === 1 ? '✓' : '—';

              return (
                <div
                  key={player.player_id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isMe ? 'bg-[#06b6d4]/10 border border-[#06b6d4]/30' : 'bg-black/30'
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
                      <div className="sports-font text-[8px] text-[#888] tracking-wider">RND</div>
                      <div className={`retro-title text-lg ${pts > 0 ? 'text-[#d4af37]' : 'text-[#555]'}`}>
                        {pts > 0 ? `+${pts}` : '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="sports-font text-[8px] text-[#888] tracking-wider">TOTAL</div>
                      <div className="retro-title text-lg" style={{ color: COLOR }}>{player.points ?? 0}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Progress to win */}
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
            {[...players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).map(player => {
              const pts = player.points ?? 0;
              const pct = Math.min(100, (pts / winTarget) * 100);
              const isMe = player.player_id === currentPlayerId;
              return (
                <div key={player.player_id}>
                  <div className="flex justify-between mb-1">
                    <span className={`sports-font text-xs ${isMe ? 'text-white' : 'text-white/60'}`}>
                      {player.player_name}{isMe ? ' (you)' : ''}
                    </span>
                    <span className="retro-title text-sm" style={{ color: COLOR }}>{pts}</span>
                  </div>
                  <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(to right, ${COLOR}, #67e8f9)` }}
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
            {isLoadingNext ? 'Loading...' : 'Next Round'}
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
  return (
    <div className="fixed inset-0 bg-[#111] text-white flex flex-col overflow-hidden">
      <EmoteOverlay lobbyId={lobby?.id} currentPlayerId={currentPlayerId} currentPlayerName={myPlayerName} />

      {/* Pinned top */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-[#111]">
        {/* Round / done badge row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] sports-font tracking-wider text-[#111]" style={{ backgroundColor: COLOR }}>
              FACE REVEAL
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] sports-font tracking-wider bg-[#1a1a1a] text-[#888]">
              Round {careerState.round}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <HomeButton isHost={isHost} onEndGame={handleEndGame} />
            <div className="bg-[#1a1a1a] border border-[#3d3d3d] rounded-lg px-3 py-1 text-center">
              <div className="sports-font text-[8px] text-[#888] tracking-widest">DONE</div>
              <div className="retro-title text-lg text-white leading-none">{doneCount}/{totalCount}</div>
            </div>
          </div>
        </div>

        {/* Zoom level info + countdown */}
        <div className="flex items-center justify-between mb-2">
          <div className="sports-font text-[9px] text-[#888] tracking-widest uppercase">
            Zoom {displayZoom}/3
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1 bg-[#222] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(countdown / (careerState.timer || 60)) * 100}%`,
                  backgroundColor: timerColor,
                }}
              />
            </div>
            <span className="sports-font text-[10px] tabular-nums" style={{ color: timerColor }}>
              {countdown}s
            </span>
          </div>
        </div>

        {/* Headshot */}
        <div className="flex justify-center">
          <motion.div
            className="rounded-xl overflow-hidden"
            animate={{
              boxShadow: iGotIt
                ? '0 0 0 3px #22c55e'
                : `0 0 0 2px ${COLOR}50`,
            }}
          >
            <ZoomedHeadshot
              playerId={careerState.player_id}
              sport={careerState.sport}
              zoomLevel={displayZoom}
            />
          </motion.div>
        </div>
      </div>

      {/* Scrollable middle */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {/* Points progress bars */}
        <div className="space-y-2">
          {[...players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).map(player => {
            const pts = player.points ?? 0;
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
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(to right, ${COLOR}, #67e8f9)` }}
                  />
                </div>
                <span className="retro-title text-sm w-8 text-right flex-shrink-0" style={{ color: COLOR }}>{pts}</span>
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

        {/* Skip-zoom vote indicator */}
        <AnimatePresence>
          {displayZoom < 3 && votedPlayers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-3 py-2 bg-[#06b6d4]/10 border border-[#06b6d4]/30 rounded-lg"
            >
              <span className="sports-font text-[10px] text-[#06b6d4]/70 tracking-wider flex-shrink-0">
                SKIP ZOOM
              </span>
              <div className="flex flex-wrap gap-1 flex-1">
                {votedPlayers.map(p => (
                  <span
                    key={p.player_id}
                    className="px-1.5 py-0.5 rounded bg-[#06b6d4]/20 sports-font text-[10px] text-[#06b6d4]"
                  >
                    {p.player_name}
                  </span>
                ))}
              </div>
              <span className="sports-font text-[10px] text-[#555] flex-shrink-0">
                {votedPlayers.length}/{eligibleForSkip.length}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback */}
        <AnimatePresence>
          {feedbackMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center sports-font text-sm ${feedbackType === 'correct' ? 'text-green-400' : 'text-red-400'}`}
            >
              {feedbackMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Done — waiting message */}
        <AnimatePresence>
          {localDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-lg text-center bg-[#1a1a1a] border border-[#333]"
            >
              <div className="sports-font text-sm text-[#888]">
                {iGotIt
                  ? isFirstCorrect
                    ? '🥇 First! +3 pts — waiting for others...'
                    : '✓ Got it! +1 pt — waiting for others...'
                  : 'Waiting for others...'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pinned bottom — input */}
      {!localDone && (
        <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-white/10 bg-[#111] space-y-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuess()}
              placeholder="Type the player's name..."
              className="flex-1 bg-[#1a1a1a] border-2 rounded-lg px-4 py-3 sports-font text-sm text-[var(--vintage-cream)] placeholder-[#555] focus:outline-none"
              style={{ borderColor: `${COLOR}60` }}
              onFocus={e => (e.currentTarget.style.borderColor = COLOR)}
              onBlur={e => (e.currentTarget.style.borderColor = `${COLOR}60`)}
            />
            <button
              onClick={handleGuess}
              disabled={!guessInput.trim()}
              className="px-6 py-3 rounded-lg sports-font text-sm text-[#111] disabled:opacity-50 transition-all"
              style={{ backgroundColor: COLOR }}
            >
              Guess
            </button>
          </div>
          <div className="flex gap-2">
            {displayZoom < 3 && (
              <button
                onClick={handleSkipZoom}
                disabled={iHaveVoted}
                className="flex-1 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 transition-all disabled:opacity-40 disabled:cursor-default border-[#3a3a3a] text-[#888] hover:border-[#06b6d4]/50 hover:text-[#06b6d4] disabled:hover:border-[#3a3a3a] disabled:hover:text-[#888]"
              >
                {iHaveVoted ? 'Voted ✓' : 'Skip zoom →'}
              </button>
            )}
            <button
              onClick={handleGiveUp}
              className={`py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-red-900/50 text-red-400 hover:border-red-700 transition-all ${displayZoom < 3 ? 'flex-1' : 'w-full'}`}
            >
              Give Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
