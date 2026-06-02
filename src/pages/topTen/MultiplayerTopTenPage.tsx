import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus, updateCareerState } from '../../services/lobby';
import { isValidGuess, getCategoryDef, generateTopTenRound, parseRoundFlags, getStatShortLabel } from '../../services/topTen';
import { nflTeams } from '../../data/nfl-teams';
import type { TopTenEntry, StatCategoryDef } from '../../services/topTen';
import { TopTenEntryRow } from '../../components/topTen/TopTenEntryRow';
import { WrongGuessesList } from '../../components/topTen/WrongGuessesList';
import { TeamLogo } from '../../components/TeamLogo';
import { HomeButton } from '../../components/multiplayer/HomeButton';
import { EmoteOverlay } from '../../components/multiplayer/EmoteOverlay';

const ANIM_MS = 2500;
const SUSPENSE_MS = 1200;

function RevealOverlay({ guessedName, isCorrect }: { guessedName: string; isCorrect: boolean }) {
  const [phase, setPhase] = useState<'suspense' | 'reveal'>('suspense');

  // Deterministic confetti particles — avoids re-generating on each render
  const particles = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      color: ['#22c55e', '#d4af37', '#60a5fa', '#a78bfa', '#fb923c', '#f472b6', '#34d399', '#fbbf24'][i % 8],
      xStart: ((i * 37) % 80) - 40,
      xDrift: ((i * 53) % 160) - 80,
      yHeight: 100 + (i * 17) % 120,
      rotation: (i * 97) % 720 - 360,
      delay: i * 0.018,
      w: 5 + (i % 5) * 2,
      h: 5 + (i % 4) * 2,
    })), []
  );

  useEffect(() => {
    const t = setTimeout(() => setPhase('reveal'), SUSPENSE_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/98"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <AnimatePresence mode="wait">
        {phase === 'suspense' ? (
          <motion.div
            key="suspense"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="text-center px-8 py-10 bg-[#111] border border-white/10 rounded-sm max-w-xs w-full mx-6"
          >
            <motion.p
              className="retro-title text-3xl text-white leading-tight"
              animate={{ textShadow: ['0 0 0px rgba(255,255,255,0)', '0 0 24px rgba(255,255,255,0.7)', '0 0 0px rgba(255,255,255,0)'] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            >
              {guessedName}
            </motion.p>
            <div className="flex justify-center gap-2 mt-5">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/40"
                  animate={{ opacity: [0.15, 1, 0.15] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}
            </div>
          </motion.div>
        ) : isCorrect ? (
          // Correct — confetti burst + bounce
          <motion.div key="correct" className="relative flex items-center justify-center">
            {/* Confetti particles */}
            {particles.map(p => (
              <motion.div
                key={p.id}
                className="absolute rounded-sm pointer-events-none"
                style={{ backgroundColor: p.color, width: p.w, height: p.h }}
                initial={{ x: p.xStart, y: 0, opacity: 1, rotate: 0 }}
                animate={{ x: p.xStart + p.xDrift, y: -p.yHeight, opacity: [1, 1, 0], rotate: p.rotation }}
                transition={{ duration: 1.1 + p.delay * 3, delay: p.delay, ease: 'easeOut' }}
              />
            ))}
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: [0.88, 1.08, 0.97, 1.02, 1], opacity: 1 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="text-center px-8 py-10 bg-emerald-950/60 border border-emerald-500/60 rounded-sm max-w-xs w-full mx-6 relative z-10"
              style={{ boxShadow: '0 0 40px rgba(34,197,94,0.25)' }}
            >
              <p className="retro-title text-3xl text-emerald-300 leading-tight">{guessedName}</p>
              <motion.p
                className="retro-title text-5xl mt-4 text-emerald-400"
                initial={{ opacity: 0, scale: 0.3, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 14 }}
                style={{ textShadow: '0 0 24px rgba(34,197,94,0.7)' }}
              >✓</motion.p>
            </motion.div>
          </motion.div>
        ) : (
          // Wrong — heavy thud shake, name droops, big ✗ stamps in
          <motion.div
            key="wrong"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, x: [0, -14, 12, -10, 8, -5, 3, 0] }}
            transition={{ duration: 0.55, times: [0, 0.12, 0.26, 0.4, 0.54, 0.68, 0.84, 1] }}
            className="text-center px-8 py-10 bg-red-950/60 border border-red-800/50 rounded-sm max-w-xs w-full mx-6"
            style={{ boxShadow: '0 0 40px rgba(185,28,28,0.3)' }}
          >
            <motion.p
              className="retro-title text-3xl text-red-400 leading-tight"
              animate={{ y: [0, 0, 2, 5, 8], opacity: [1, 1, 1, 0.85, 0.7] }}
              transition={{ duration: 1.1, delay: 0.4, ease: 'easeIn' }}
            >
              {guessedName}
            </motion.p>
            <motion.p
              className="retro-title text-6xl mt-3 text-red-600"
              initial={{ opacity: 0, scale: 3, rotate: 15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.18, duration: 0.35, ease: 'easeOut' }}
              style={{ textShadow: '0 0 28px rgba(239,68,68,0.7)' }}
            >✗</motion.p>
            <motion.p
              className="sports-font text-[10px] text-red-500/55 tracking-[0.3em] uppercase mt-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >Not in top 10</motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Returns winner IDs: primary = most correct guesses, tiebreaker = most strikes left
function determineWinners(
  allIds: string[],
  attribution: Record<string, number>,
  strikes: Record<string, number>,
  maxStrikes: number,
  lastStanding: boolean,
  lastActiveId: string,
): string[] {
  if (lastStanding) return [lastActiveId];
  const sorted = [...allIds].sort((a, b) => {
    const ga = attribution[a] || 0, gb = attribution[b] || 0;
    if (gb !== ga) return gb - ga;
    return (maxStrikes - (strikes[b] || 0)) - (maxStrikes - (strikes[a] || 0));
  });
  if (!sorted.length) return [];
  const topG  = attribution[sorted[0]] || 0;
  const topSL = maxStrikes - (strikes[sorted[0]] || 0);
  return sorted.filter(id =>
    (attribution[id] || 0) === topG &&
    (maxStrikes - (strikes[id]  || 0)) === topSL
  );
}

// NFL teams grouped for the reference panel
const NFL_BY_DIVISION = (['AFC', 'NFC'] as const).flatMap(conf =>
  (['East', 'North', 'South', 'West'] as const).map(div => ({
    label: `${conf} ${div}`,
    teams: nflTeams.filter(t => t.conference === conf && t.division === div),
  }))
);

export function MultiplayerTopTenPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const {
    lobby, players, isHost, currentPlayerId,
    setLobby, setPlayers,
  } = useLobbyStore();

  const [guess, setGuess]             = useState('');
  const [feedback, setFeedback]       = useState<{ msg: string; type: 'correct' | 'wrong' | '' }>({ msg: '', type: '' });
  const [timeLeft, setTimeLeft]       = useState(45);
  const [showTeamsPanel, setShowTeamsPanel] = useState(false);
  const [revealOverlay, setRevealOverlay] = useState<{ guessedName: string; isCorrect: boolean } | null>(null);
  const [showMyTurnFlash, setShowMyTurnFlash] = useState(false);
  const inputRef          = useRef<HTMLInputElement>(null);
  const hasAdvancedRef    = useRef(false);
  const isWritingRef      = useRef(false);
  const zeroSinceRef      = useRef<number | null>(null);
  const prevTurnIdRef     = useRef<string>('');
  // Always-current reference so the timer effect never captures a stale advanceTurn
  const advanceTurnRef    = useRef<typeof advanceTurn>(() => Promise.resolve());

  useLobbySubscription(lobby?.id || null);

  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby) return;
    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => {
        if (pr.players) setPlayers(pr.players);
      }).catch(err => console.error('[TopTen] getLobbyPlayers failed:', err));
    }).catch(err => {
      console.error('[TopTen] findLobbyByCode failed:', err);
      navigate('/');
    });
  }, []);

  const cs = (lobby?.career_state as any) || {};
  const entries: TopTenEntry[]                    = cs.top10_entries || [];
  const guessedIndices: number[]                  = cs.guessed_indices || [];
  const turnOrder: string[]                       = cs.turn_order || [];
  const eliminated: string[]                      = cs.eliminated || [];
  const playerStrikes: Record<string, number>     = cs.player_strikes || {};
  const maxStrikes: number                        = cs.max_strikes || 2;
  const turnTimerSecs: number                     = cs.turn_timer || 45;
  const { isDivisionRound, isTeamRound, isCumulativeRound } = parseRoundFlags(cs);
  const hintMode: boolean                         = cs.hint_mode || false;
  // Division round shows team logos as hints; team round doesn't (team is already known)
  const showTeamHint: boolean                     = isDivisionRound || (hintMode && !isTeamRound);
  const currentTurnIndex: number                  = cs.current_turn_index ?? 0;
  const turnDeadline: string | null               = cs.turn_deadline || null;
  const categoryKey: string                       = cs.category || '';
  const categoryLabel: string                     = cs.category_label || '';
  const roundInfo: string                         = cs.round_info || '';
  const wrongGuesses: string[]                    = cs.wrong_guesses || [];
  const sport: string                             = cs.sport || 'nba';

  const activePlayers   = turnOrder.filter(id => !eliminated.includes(id));
  const currentTurnId   = activePlayers[currentTurnIndex % Math.max(activePlayers.length, 1)] || '';
  const isMyTurn        = currentTurnId === currentPlayerId;
  const catDef: StatCategoryDef | undefined = getCategoryDef(cs.sport || 'nba', categoryKey);
  const statShortLabel  = getStatShortLabel(catDef, isCumulativeRound, sport);

  // Timer — active player fires immediately; host fallback after 500ms grace
  useEffect(() => {
    if (!turnDeadline) return;

    function tryAdvance() {
      if (hasAdvancedRef.current || isWritingRef.current) return;
      if (isMyTurn || isHost) {
        hasAdvancedRef.current = true;
        zeroSinceRef.current = null;
        advanceTurnRef.current(false);
      }
    }

    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(turnDeadline).getTime() - Date.now()) / 1000));
      setTimeLeft(secs);
      if (secs === 0) {
        if (zeroSinceRef.current === null) zeroSinceRef.current = Date.now();
        if (!hasAdvancedRef.current && !isWritingRef.current) {
          if (isMyTurn) {
            hasAdvancedRef.current = true;
            zeroSinceRef.current = null;
            advanceTurnRef.current(false);
          } else if (isHost && Date.now() - (zeroSinceRef.current ?? Date.now()) >= 500) {
            hasAdvancedRef.current = true;
            zeroSinceRef.current = null;
            advanceTurnRef.current(false);
          }
        }
      } else {
        zeroSinceRef.current = null;
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const secs = Math.round((new Date(turnDeadline).getTime() - Date.now()) / 1000);
      if (secs <= 0) tryAdvance();
    };

    tick();
    const id = setInterval(tick, 500);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [turnDeadline, isMyTurn, isHost]);

  useEffect(() => {
    hasAdvancedRef.current = false;
    if (isMyTurn) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Flash whenever the turn switches to me — guard against initial mount (prevTurnIdRef empty)
      // and against the same player getting consecutive turns without the ID changing.
      if (prevTurnIdRef.current && prevTurnIdRef.current !== currentTurnId) {
        setShowMyTurnFlash(true);
        const t = setTimeout(() => setShowMyTurnFlash(false), 1400);
        prevTurnIdRef.current = currentTurnId;
        return () => clearTimeout(t);
      }
    }
    prevTurnIdRef.current = currentTurnId;
  }, [currentTurnId]);

  useEffect(() => {
    if (lobby?.status === 'finished') navigate(`/lobby/${code}/top-ten/results`);
    if (lobby?.status === 'waiting')  window.location.href = `/lobby/${code}`;
  }, [lobby?.status]);

  useEffect(() => {
    if (isHost) return;
    if (cs.abandoned) window.location.href = `/lobby/${code}`;
  }, [cs.abandoned]);

  useEffect(() => {
    const anim = cs.reveal_anim as { guessedName: string; isCorrect: boolean; endsAt: string } | null | undefined;
    if (!anim?.endsAt) { setRevealOverlay(null); return; }
    const msLeft = new Date(anim.endsAt).getTime() - Date.now();
    if (msLeft <= 0) { setRevealOverlay(null); return; }
    setRevealOverlay({ guessedName: anim.guessedName, isCorrect: anim.isCorrect });
    const t = setTimeout(() => setRevealOverlay(null), msLeft);
    return () => clearTimeout(t);
  }, [cs.reveal_anim?.endsAt]);

  const advanceTurn = useCallback(async (
    correct: boolean,
    newGuessedIndices?: number[],
    extras: Record<string, unknown> = {},
    guessedName?: string,
  ) => {
    if (!lobby || isWritingRef.current) return;
    isWritingRef.current = true;

    try {
      const currentStrikes    = { ...playerStrikes };
      const currentEliminated = [...eliminated];

      if (!correct) {
        const n = (currentStrikes[currentTurnId] || 0) + 1;
        currentStrikes[currentTurnId] = n;
        if (n >= maxStrikes && !currentEliminated.includes(currentTurnId)) {
          currentEliminated.push(currentTurnId);
        }
      }

      const newActivePlayers  = turnOrder.filter(id => !currentEliminated.includes(id));
      const finalGuessed      = newGuessedIndices ?? guessedIndices;
      const allSlotsFilled    = finalGuessed.length >= entries.length;
      const allOut            = newActivePlayers.length === 0;
      const allRemainingOnLastStrike = maxStrikes > 1
        && newActivePlayers.length > 0
        && newActivePlayers.every(id => (currentStrikes[id] || 0) >= maxStrikes - 1);
      const lastStanding      = newActivePlayers.length === 1 && !allRemainingOnLastStrike;

      const roundOver = allSlotsFilled || lastStanding || allOut;

      const currentWasEliminated = !eliminated.includes(currentTurnId) && currentEliminated.includes(currentTurnId);
      const nextIndex = newActivePlayers.length > 0
        ? (currentWasEliminated ? currentTurnIndex : currentTurnIndex + 1) % newActivePlayers.length
        : 0;

      if (roundOver) {
        const mergedAttribution: Record<string, number> =
          (extras.guess_attribution as Record<string, number>) ?? (cs.guess_attribution || {});
        const winnerIds = determineWinners(
          turnOrder, mergedAttribution, currentStrikes, maxStrikes,
          lastStanding && !allOut, newActivePlayers[0] || '',
        );
        const newState = {
          ...cs, ...extras,
          guessed_indices:    finalGuessed,
          player_strikes:     currentStrikes,
          eliminated:         currentEliminated,
          missed_in_rotation: [],
          winner_ids:         winnerIds,
          winner_id:          winnerIds[0] || '',
          guess_attribution:  mergedAttribution,
          reveal_anim:        null,
        };
        await updateCareerState(lobby.id, newState);
        await updateLobbyStatus(lobby.id, 'finished');
        setLobby({ ...lobby, career_state: newState, status: 'finished' });
      } else {
        // If a player submitted a guess, show animation and push deadline past it
        let revealAnim: { guessedName: string; isCorrect: boolean; endsAt: string } | null = null;
        let newDeadline: string;
        if (guessedName) {
          const animEndsAt = new Date(Date.now() + ANIM_MS).toISOString();
          newDeadline = new Date(new Date(animEndsAt).getTime() + turnTimerSecs * 1000).toISOString();
          revealAnim = { guessedName, isCorrect: correct, endsAt: animEndsAt };
        } else {
          newDeadline = new Date(Date.now() + turnTimerSecs * 1000).toISOString();
        }
        const newState = {
          ...cs, ...extras,
          guessed_indices:    finalGuessed,
          player_strikes:     currentStrikes,
          eliminated:         currentEliminated,
          current_turn_index: nextIndex,
          turn_deadline:      newDeadline,
          reveal_anim:        revealAnim,
        };
        await updateCareerState(lobby.id, newState);
        setLobby({ ...lobby, career_state: newState });
      }
    } catch (err) {
      console.error('[TopTen] advanceTurn failed:', err);
      setFeedback({ msg: 'Connection error — try again', type: 'wrong' });
    } finally {
      isWritingRef.current = false;
    }
  }, [lobby, cs, currentTurnId, currentTurnIndex, guessedIndices, entries.length,
      playerStrikes, eliminated, maxStrikes, turnOrder, turnTimerSecs]);

  useEffect(() => { advanceTurnRef.current = advanceTurn; }, [advanceTurn]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = guess.trim();
    if (!trimmed || !isMyTurn || isWritingRef.current) return;

    const matched = isValidGuess(trimmed, entries, guessedIndices);
    setGuess('');

    if (matched.length > 0) {
      const newGuessedIndices = [...guessedIndices, ...matched];
      const newAttribution = {
        ...(cs.guess_attribution || {}),
        [currentTurnId]: ((cs.guess_attribution || {})[currentTurnId] || 0) + matched.length,
      };
      hasAdvancedRef.current = true;
      await advanceTurn(true, newGuessedIndices, { guess_attribution: newAttribution }, trimmed);
    } else {
      if (wrongGuesses.includes(trimmed)) {
        setGuess('');
        inputRef.current?.focus();
        return;
      }
      hasAdvancedRef.current = true;
      await advanceTurn(false, undefined, { wrong_guesses: [...wrongGuesses, trimmed] }, trimmed);
    }
    inputRef.current?.focus();
  }

  async function handleForceEnd() {
    if (!lobby || !isHost) return;
    try {
      const attribution: Record<string, number> = cs.guess_attribution || {};
      const winnerIds = determineWinners(
        turnOrder, attribution, playerStrikes, maxStrikes,
        activePlayers.length === 1, activePlayers[0] || '',
      );
      const newState = { ...cs, winner_ids: winnerIds, winner_id: winnerIds[0] || '' };
      await updateCareerState(lobby.id, newState);
      await updateLobbyStatus(lobby.id, 'finished');
    } catch (err) {
      console.error('[TopTen] handleForceEnd failed:', err);
    }
  }

  async function handleToggleHint() {
    if (!lobby || !isHost) return;
    try {
      const newState = { ...cs, hint_mode: !hintMode };
      await updateCareerState(lobby.id, newState);
      setLobby({ ...lobby, career_state: newState });
    } catch (err) {
      console.error('[TopTen] handleToggleHint failed:', err);
    }
  }

  async function handleSkipTurn() {
    if (!lobby || !isHost || hasAdvancedRef.current || isWritingRef.current) return;
    hasAdvancedRef.current = true;
    await advanceTurn(false);
  }

  // Generate a fresh round using the same settings currently in career_state
  async function generateRound() {
    const roundSport = (cs.top_ten_sport || cs.sport || 'nba') as 'nba' | 'nfl';
    return generateTopTenRound({
      sport:       roundSport,
      roundType:   cs.top_ten_round_type || 'league',
      minYear:     cs.top_ten_min_year   || (roundSport === 'nba' ? 1996 : 1999),
      maxYear:     cs.top_ten_max_year   || 2025,
      windowYears: cs.top_ten_window_years || 10,
    });
  }

  async function handleSkipCategory() {
    if (!lobby || !isHost || isWritingRef.current) return;
    isWritingRef.current = true;
    try {
      const { entries: newEntries, cat, catLabel, roundInfo: newRoundInfo, isDivisionRound: newDiv, isTeamRound: newTeam, teamAbbr: newTeamAbbr } = await generateRound();
      if (newEntries.length === 0) return;
      const deadline = new Date(Date.now() + turnTimerSecs * 1000).toISOString();
      const newState = {
        ...cs,
        category:           cat.key,
        category_label:     catLabel,
        round_info:         newRoundInfo,
        top10_entries:      newEntries,
        is_division_round:  newDiv,
        is_team_round:      newTeam,
        top_ten_team:       newTeamAbbr,
        guessed_indices:    [],
        wrong_guesses:      [],
        hint_mode:          false,
        guess_attribution:  {},
        current_turn_index: 0,
        turn_deadline:      deadline,
        reveal_anim:        null,
      };
      await updateCareerState(lobby.id, newState);
      setLobby({ ...lobby, career_state: newState });
      hasAdvancedRef.current = false;
    } catch (err) {
      console.error('[TopTen] handleSkipCategory failed:', err);
    } finally {
      isWritingRef.current = false;
    }
  }

  async function handleSendToLobby() {
    if (!lobby || !isHost) return;
    try {
      const newState = { ...cs, abandoned: true, reveal_anim: null };
      await updateCareerState(lobby.id, newState);
      await updateLobbyStatus(lobby.id, 'waiting');
      window.location.href = `/lobby/${code}`;
    } catch (err) {
      console.error('[TopTen] handleSendToLobby failed:', err);
      window.location.href = `/lobby/${code}`;
    }
  }

  if (!lobby || entries.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-white/30 sports-font tracking-widest">Loading...</p>
      </div>
    );
  }

  const currentTurnPlayer   = players.find(p => p.player_id === currentTurnId);
  const displayTimeLeft     = revealOverlay ? turnTimerSecs : timeLeft;
  const displayTimerFraction = revealOverlay ? 1 : displayTimeLeft / turnTimerSecs;
  const timerColor          = displayTimerFraction > 0.5 ? '#22c55e' : displayTimerFraction > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-white/8 flex items-center gap-3 bg-black/60 relative z-20">
        <HomeButton isHost={isHost} onEndGame={handleSendToLobby} />
        <h1 className="retro-title text-base text-[#22c55e]">Top Ten</h1>
        <span className="sports-font text-[9px] text-white/25 tracking-[0.25em] uppercase">{sport.toUpperCase()}</span>
        <div className="ml-auto flex items-center gap-2">
          {/* Teams reference panel — NFL only, visible to all */}
          {sport === 'nfl' && (
            <button
              onClick={() => setShowTeamsPanel(v => !v)}
              className={`px-2.5 py-1 rounded-sm sports-font text-[9px] tracking-widest uppercase border transition-colors ${
                showTeamsPanel
                  ? 'border-[#22c55e]/60 text-[#22c55e] bg-[#22c55e]/8'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              Teams
            </button>
          )}
          {isHost && (
            <button
              onClick={handleToggleHint}
              className={`px-2.5 py-1 rounded-sm sports-font text-[9px] tracking-widest uppercase border transition-colors ${
                hintMode
                  ? 'border-[#d4af37]/60 text-[#d4af37] bg-[#d4af37]/8'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              Hint {hintMode ? 'On' : 'Off'}
            </button>
          )}
          {isHost && !isMyTurn && (
            <button
              onClick={handleSkipTurn}
              className="sports-font text-[9px] text-white/30 border border-white/15 hover:border-yellow-500/50 hover:text-yellow-400 px-2.5 py-1 rounded-sm tracking-widest uppercase transition-colors"
            >
              Skip
            </button>
          )}
          {isHost && (
            <button
              onClick={handleSkipCategory}
              className="sports-font text-[9px] text-white/30 border border-white/15 hover:border-blue-500/50 hover:text-blue-400 px-2.5 py-1 rounded-sm tracking-widest uppercase transition-colors"
            >
              Skip Cat
            </button>
          )}
          {isHost && (
            <button
              onClick={handleForceEnd}
              className="sports-font text-[9px] text-white/30 border border-white/15 hover:border-red-500/50 hover:text-red-400 px-2.5 py-1 rounded-sm tracking-widest uppercase transition-colors"
            >
              End
            </button>
          )}
        </div>
      </header>

      {/* NFL Teams reference panel */}
      <AnimatePresence>
        {showTeamsPanel && sport === 'nfl' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="border-b border-white/8 bg-[#0a0a0a]/98 z-10 px-4 py-3"
            onClick={() => setShowTeamsPanel(false)}
          >
            <div className="max-w-lg mx-auto grid grid-cols-2 gap-x-6 gap-y-2">
              {NFL_BY_DIVISION.map(({ label, teams }) => (
                <div key={label}>
                  <p className="sports-font text-[8px] text-white/20 tracking-widest uppercase mb-1">{label}</p>
                  <div className="flex gap-2">
                    {teams.map(t => (
                      <div key={t.abbreviation} className="flex items-center gap-1">
                        <TeamLogo abbr={t.abbreviation} sport="nfl" size={18} />
                        <span className="sports-font text-[9px] text-white/40">{t.abbreviation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-8 flex flex-col gap-4">
        {/* Category + round info */}
        <div className="text-center pt-5 pb-1">
          <h2
            className="retro-title text-3xl md:text-4xl"
            style={{ color: '#22c55e', textShadow: '0 0 28px rgba(34,197,94,0.3)' }}
          >
            {categoryLabel}
          </h2>
          <p className="sports-font text-[10px] text-white/30 tracking-[0.35em] uppercase mt-1.5">{roundInfo}</p>
        </div>

        {/* Compact player strikes strip */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {players.map(p => {
            const pStrikes  = playerStrikes[p.player_id] || 0;
            const isElim    = eliminated.includes(p.player_id);
            const isMe      = p.player_id === currentPlayerId;
            const isCurrent = p.player_id === currentTurnId && !isElim;
            return (
              <div
                key={p.player_id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border transition-colors ${
                  isElim   ? 'opacity-20 border-white/5 bg-transparent' :
                  isMe     ? 'border-white/25 bg-white/5' :
                             'border-white/8 bg-transparent'
                }`}
              >
                {isCurrent && !isElim && (
                  <motion.span
                    className="block w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
                <span className={`sports-font text-[9px] max-w-[56px] truncate ${
                  isMe ? 'text-white' : 'text-white/40'
                }`}>
                  {p.player_name.split(' ')[0]}
                </span>
                <span className="sports-font text-[10px] tracking-tight">
                  {Array.from({ length: maxStrikes }).map((_, i) => (
                    <span key={i} className={i < pStrikes ? 'text-red-400' : 'text-white/12'}>✕</span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>

        {/* Turn indicator + timer */}
        <motion.div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border transition-colors ${
            isMyTurn ? 'border-[#22c55e]/60 bg-[#22c55e]/10' : 'border-white/8 bg-[#0d0d0d]'
          }`}
          animate={isMyTurn ? {
            boxShadow: ['0 0 0px rgba(34,197,94,0)', '0 0 18px rgba(34,197,94,0.22)', '0 0 0px rgba(34,197,94,0)'],
          } : { boxShadow: '0 0 0px rgba(0,0,0,0)' }}
          transition={isMyTurn ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        >
          <div className="flex-1">
            <p className={`sports-font tracking-widest uppercase mb-1 transition-all ${
              isMyTurn ? 'text-[#22c55e] text-sm' : 'text-white/35 text-[10px]'
            }`}>
              {isMyTurn ? 'Your turn' : `${currentTurnPlayer?.player_name ?? '...'}'s turn`}
            </p>
            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: timerColor }}
                animate={{ width: `${displayTimerFraction * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
          <span className="retro-title text-2xl tabular-nums" style={{ color: timerColor }}>{displayTimeLeft}</span>
        </motion.div>

        {/* Feedback */}
        <div className="h-5 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {feedback.type && (
              <motion.p
                key={feedback.msg}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`sports-font text-xs tracking-wider ${feedback.type === 'correct' ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {feedback.msg}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Guess input */}
        {isMyTurn && !revealOverlay && (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={guess}
              onChange={e => setGuess(e.target.value)}
              placeholder="Type a player name..."
              autoComplete="off"
              className="flex-1 bg-[#0d0d0d] border border-[#22c55e]/40 rounded-sm px-4 py-2.5 text-white sports-font text-sm focus:outline-none focus:border-[#22c55e] placeholder-white/15 transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-black shadow-[0_3px_0_#166534] active:shadow-none active:translate-y-px rounded-sm retro-title text-sm transition-all"
            >
              Guess
            </button>
          </form>
        )}

        {/* Board */}
        <div className="space-y-1.5">
          {entries.map((entry, i) => (
            <TopTenEntryRow
              key={i}
              entry={entry}
              index={i}
              wasGuessed={guessedIndices.includes(i)}
              showTeamHint={showTeamHint}
              showInitialsHint={(isDivisionRound || isTeamRound) && hintMode}
              sport={sport as 'nba' | 'nfl'}
              categoryKey={categoryKey}
              catDef={catDef}
              statShortLabel={statShortLabel}
            />
          ))}
        </div>

        {/* Wrong guesses */}
        <WrongGuessesList wrongGuesses={wrongGuesses} />

        {/* Player scoreboard */}
        <div className="bg-[#0d0d0d] border border-white/8 rounded-sm p-3">
          <p className="sports-font text-[9px] text-white/25 tracking-widest uppercase mb-2">Players</p>
          <div className="space-y-1">
            {players.map(p => {
              const strikes   = playerStrikes[p.player_id] || 0;
              const isElim    = eliminated.includes(p.player_id);
              const guesses   = (cs.guess_attribution || {})[p.player_id] || 0;
              const isCurrent = p.player_id === currentTurnId && !isElim;
              const isMe      = p.player_id === currentPlayerId;
              return (
                <div
                  key={p.player_id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-sm transition-colors ${
                    isElim ? 'opacity-25' : isCurrent ? 'bg-[#22c55e]/10' : ''
                  }`}
                >
                  <div className="w-3 h-3 shrink-0 flex items-center justify-center">
                    {isCurrent ? (
                      <motion.span
                        className="block w-2.5 h-2.5 rounded-full bg-[#22c55e]"
                        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    ) : (
                      <span className="block w-1.5 h-1.5 rounded-full bg-white/10" />
                    )}
                  </div>
                  <span className={`sports-font text-sm flex-1 truncate ${
                    isCurrent ? 'text-[#22c55e]' : isMe ? 'text-white' : 'text-white/50'
                  }`}>
                    {p.player_name}{isElim ? ' ✕' : ''}
                  </span>
                  <span className="sports-font text-[10px] text-white/25">
                    {Array.from({ length: maxStrikes }).map((_, i) => (
                      <span key={i} className={i < strikes ? 'text-red-400' : 'opacity-20'}>✕</span>
                    ))}
                  </span>
                  <span className="sports-font text-[10px] text-emerald-400 w-8 text-right tabular-nums">{guesses} pts</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {revealOverlay && (
          <RevealOverlay
            guessedName={revealOverlay.guessedName}
            isCorrect={revealOverlay.isCorrect}
          />
        )}
      </AnimatePresence>

      {/* "YOUR TURN" flash toast */}
      <AnimatePresence>
        {showMyTurnFlash && (
          <motion.div
            className="fixed top-16 inset-x-0 flex justify-center z-40 pointer-events-none"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <div
              className="px-5 py-2 rounded-sm retro-title text-base text-black"
              style={{
                background: '#22c55e',
                boxShadow: '0 0 24px rgba(34,197,94,0.55), 0 3px 0 #166534',
              }}
            >
              YOUR TURN
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <EmoteOverlay
        lobbyId={lobby?.id}
        currentPlayerId={currentPlayerId}
        currentPlayerName={players.find(p => p.player_id === currentPlayerId)?.player_name ?? ''}
      />
    </div>
  );
}
