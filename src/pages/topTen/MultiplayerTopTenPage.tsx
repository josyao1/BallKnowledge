import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus, updateCareerState } from '../../services/lobby';
import { isValidGuess, findPlayerInPool, getCategoryDef, generateTopTenRound, parseRoundFlags, getStatShortLabel } from '../../services/topTen';
import type { TopTenEntry, StatCategoryDef } from '../../services/topTen';
import { TopTenEntryRow } from '../../components/topTen/TopTenEntryRow';
import { WrongGuessesList } from '../../components/topTen/WrongGuessesList';
import { TeamsReferencePanel } from '../../components/topTen/TeamsReferencePanel';
import { TopTenCategoryHeader } from '../../components/topTen/TopTenCategoryHeader';
import { FeedbackMessage } from '../../components/topTen/FeedbackMessage';
import { PlayerHeadshot } from '../../components/capCrunch/PlayerHeadshot';
import { HomeButton } from '../../components/multiplayer/HomeButton';
import { EmoteOverlay } from '../../components/multiplayer/EmoteOverlay';

const ANIM_MS = 2500;
const SUSPENSE_MS = 1200;

function RevealOverlay({ guessedName, isCorrect, playerId, sport }: { guessedName: string; isCorrect: boolean; playerId?: string; sport: 'nba' | 'nfl' }) {
  const [phase, setPhase] = useState<'suspense' | 'reveal'>('suspense');

  const particles = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      color: ['#70BE5B', '#70BE5B', '#68BBE5', '#E2008A', '#fb923c', '#f472b6', '#34d399', '#fbbf24'][i % 8],
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/96"
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
            className="text-center px-8 py-10 bg-black/80 border border-white/10 max-w-xs w-full mx-6"
          >
            <motion.p
              className="capcrunch-title text-3xl text-white leading-tight"
              animate={{ textShadow: ['0 0 0px rgba(112,190,91,0)', '0 0 24px rgba(112,190,91,0.5)', '0 0 0px rgba(112,190,91,0)'] }}
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
          <motion.div key="correct" className="relative flex items-center justify-center">
            {particles.map(p => (
              <motion.div
                key={p.id}
                className="absolute pointer-events-none"
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
              className="text-center px-8 py-10 bg-[#70BE5B]/10 border border-[#70BE5B]/50 max-w-xs w-full mx-6 relative z-10"
              style={{ boxShadow: '0 0 40px rgba(112,190,91,0.2)' }}
            >
              <div className="flex justify-center mb-4">
                <PlayerHeadshot
                  playerId={playerId}
                  sport={sport}
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-[#70BE5B]/50"
                />
              </div>
              <p className="capcrunch-title text-3xl text-[#70BE5B] leading-tight">{guessedName}</p>
              <motion.p
                className="capcrunch-title text-5xl mt-4 text-[#70BE5B]"
                initial={{ opacity: 0, scale: 0.3, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 14 }}
                style={{ textShadow: '0 0 24px rgba(112,190,91,0.6)' }}
              >✓</motion.p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="wrong"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, x: [0, -14, 12, -10, 8, -5, 3, 0] }}
            transition={{ duration: 0.55, times: [0, 0.12, 0.26, 0.4, 0.54, 0.68, 0.84, 1] }}
            className="text-center px-8 py-10 bg-red-950/60 border border-red-800/50 max-w-xs w-full mx-6"
            style={{ boxShadow: '0 0 40px rgba(185,28,28,0.3)' }}
          >
            <div className="flex justify-center mb-4">
              <div className="relative">
                <PlayerHeadshot
                  playerId={playerId}
                  sport={sport}
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-red-700/60"
                />
                <div className="absolute inset-0 rounded-full bg-red-900/50" />
              </div>
            </div>
            <motion.p
              className="capcrunch-title text-3xl text-red-400 leading-tight"
              animate={{ y: [0, 0, 2, 5, 8], opacity: [1, 1, 1, 0.85, 0.7] }}
              transition={{ duration: 1.1, delay: 0.4, ease: 'easeIn' }}
            >
              {guessedName}
            </motion.p>
            <motion.p
              className="capcrunch-title text-6xl mt-3 text-red-600"
              initial={{ opacity: 0, scale: 3, rotate: 15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.18, duration: 0.35, ease: 'easeOut' }}
              style={{ textShadow: '0 0 28px rgba(239,68,68,0.7)' }}
            >✗</motion.p>
            <motion.p
              className="capcrunch-kicker text-[10px] text-red-500/55 tracking-[0.3em] mt-3"
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
  const [revealOverlay, setRevealOverlay] = useState<{ guessedName: string; isCorrect: boolean; playerId?: string; sport: 'nba' | 'nfl' } | null>(null);
  const [showMyTurnFlash, setShowMyTurnFlash] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);
  const hasAdvancedRef        = useRef(false);
  const isWritingRef          = useRef(false);
  const zeroSinceRef          = useRef<number | null>(null);
  const prevTurnIdRef         = useRef<string>('');
  const advanceTurnRef        = useRef<typeof advanceTurn>(() => Promise.resolve());
  const recentCategoryKeysRef = useRef<string[]>([]);
  const recentTeamAbbrsRef    = useRef<string[]>([]);

  useLobbySubscription(lobby?.id || null);

  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby) return;
    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      if (result.lobby.status !== 'playing') { navigate(`/lobby/${code}`); return; }
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
  const { isDivisionRound, isTeamRound, isCumulativeRound, isSingleSeason } = parseRoundFlags(cs);
  const hintMode: boolean                         = cs.hint_mode || false;
  const showTeamHint: boolean                     = isDivisionRound || isSingleSeason || (hintMode && !isTeamRound);
  const currentTurnIndex: number                  = cs.current_turn_index ?? 0;
  const turnDeadline: string | null               = cs.turn_deadline || null;
  const categoryKey: string                       = cs.category || '';
  const categoryLabel: string                     = cs.category_label || '';
  const roundInfo: string                         = cs.round_info || '';
  const teamAbbr: string                          = cs.top_ten_team || '';
  const wrongGuesses: string[]                    = cs.wrong_guesses || [];
  const sport: string                             = cs.sport || 'nba';
  const raceMode: boolean                         = cs.top_ten_game_mode === 'race';
  const raceTarget: number                        = cs.race_target || 3;
  const rebuttalTriggerIndex: number | null       = cs.rebuttal_trigger_index ?? null;
  const giveUpVotes: string[]                     = cs.give_up_votes || [];

  const activePlayers   = raceMode ? turnOrder : turnOrder.filter(id => !eliminated.includes(id));
  const currentTurnId   = raceMode
    ? (turnOrder[currentTurnIndex % Math.max(turnOrder.length, 1)] || '')
    : (activePlayers[currentTurnIndex % Math.max(activePlayers.length, 1)] || '');
  const isMyTurn        = currentTurnId === currentPlayerId;

  const playersInTurnOrder = [
    ...turnOrder.map(id => players.find(p => p.player_id === id)).filter(Boolean),
    ...players.filter(p => !turnOrder.includes(p.player_id)),
  ] as typeof players;
  const catDef: StatCategoryDef | undefined = getCategoryDef(cs.sport || 'nba', categoryKey);
  const statShortLabel  = getStatShortLabel(catDef);

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
    const anim = cs.reveal_anim as { guessedName: string; isCorrect: boolean; endsAt: string; playerId?: string } | null | undefined;
    if (!anim?.endsAt) { setRevealOverlay(null); return; }
    const msLeft = new Date(anim.endsAt).getTime() - Date.now();
    if (msLeft <= 0) { setRevealOverlay(null); return; }
    setRevealOverlay({ guessedName: anim.guessedName, isCorrect: anim.isCorrect, playerId: anim.playerId, sport: (cs.sport || 'nba') as 'nba' | 'nfl' });
    const t = setTimeout(() => setRevealOverlay(null), msLeft);
    return () => clearTimeout(t);
  }, [cs.reveal_anim?.endsAt]);

  const advanceTurn = useCallback(async (
    correct: boolean,
    newGuessedIndices?: number[],
    extras: Record<string, unknown> = {},
    guessedName?: string,
    playerId?: string,
  ) => {
    if (!lobby || isWritingRef.current) return;
    isWritingRef.current = true;

    try {
      const finalGuessed = newGuessedIndices ?? guessedIndices;
      const allSlotsFilled = finalGuessed.length >= entries.length;

      if (raceMode) {
        // ── Race mode: no strikes/elimination, race to raceTarget correct guesses ──
        const mergedAttribution: Record<string, number> =
          (extras.guess_attribution as Record<string, number>) ?? (cs.guess_attribution || {});

        // Check if this correct guess crosses the target and triggers rebuttal
        let newRebuttalTriggerIdx: number | null = rebuttalTriggerIndex;
        if (correct && newRebuttalTriggerIdx === null) {
          const myGuesses = mergedAttribution[currentTurnId] || 0;
          if (myGuesses >= raceTarget) {
            newRebuttalTriggerIdx = currentTurnIndex;
          }
        }

        const nextIndex = (currentTurnIndex + 1) % turnOrder.length;
        // Rebuttal is complete when the rotation would return to the triggering player
        const rebuttalComplete = newRebuttalTriggerIdx !== null && nextIndex === newRebuttalTriggerIdx;
        const roundOver = allSlotsFilled || rebuttalComplete;

        const buildAnim = (name: string, pid?: string) => {
          const endsAt = new Date(Date.now() + ANIM_MS).toISOString();
          return { anim: { guessedName: name, isCorrect: correct, endsAt, playerId: pid }, deadline: new Date(new Date(endsAt).getTime() + turnTimerSecs * 1000).toISOString() };
        };

        if (roundOver) {
          const winnerIds = determineWinners(turnOrder, mergedAttribution, {}, 1, false, '');
          const newState = {
            ...cs, ...extras,
            guessed_indices:        finalGuessed,
            rebuttal_trigger_index: newRebuttalTriggerIdx,
            winner_ids:             winnerIds,
            winner_id:              winnerIds[0] || '',
            guess_attribution:      mergedAttribution,
            reveal_anim:            null,
          };
          await updateCareerState(lobby.id, newState);
          await updateLobbyStatus(lobby.id, 'finished');
          setLobby({ ...lobby, career_state: newState, status: 'finished' });
        } else {
          let revealAnim: { guessedName: string; isCorrect: boolean; endsAt: string; playerId?: string } | null = null;
          let newDeadline = new Date(Date.now() + turnTimerSecs * 1000).toISOString();
          if (guessedName) {
            const { anim, deadline } = buildAnim(guessedName, playerId);
            revealAnim = anim;
            newDeadline = deadline;
          }
          const newState = {
            ...cs, ...extras,
            guessed_indices:        finalGuessed,
            rebuttal_trigger_index: newRebuttalTriggerIdx,
            current_turn_index:     nextIndex,
            turn_deadline:          newDeadline,
            reveal_anim:            revealAnim,
          };
          await updateCareerState(lobby.id, newState);
          setLobby({ ...lobby, career_state: newState });
        }
      } else {
        // ── Strike mode (original logic) ──────────────────────────────────────
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
        const allOut            = newActivePlayers.length === 0;
        const allRemainingOnLastStrike = maxStrikes > 1
          && newActivePlayers.length > 0
          && newActivePlayers.every(id => (currentStrikes[id] || 0) >= maxStrikes - 1);
        const isOneOnOne   = turnOrder.length === 2;
        const lastStanding = !isOneOnOne && newActivePlayers.length === 1 && !allRemainingOnLastStrike;

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
          let revealAnim: { guessedName: string; isCorrect: boolean; endsAt: string; playerId?: string } | null = null;
          let newDeadline: string;
          if (guessedName) {
            const animEndsAt = new Date(Date.now() + ANIM_MS).toISOString();
            newDeadline = new Date(new Date(animEndsAt).getTime() + turnTimerSecs * 1000).toISOString();
            revealAnim = { guessedName, isCorrect: correct, endsAt: animEndsAt, playerId };
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
      }
    } catch (err) {
      console.error('[TopTen] advanceTurn failed:', err);
      setFeedback({ msg: 'Connection error — try again', type: 'wrong' });
    } finally {
      isWritingRef.current = false;
    }
  }, [lobby, cs, currentTurnId, currentTurnIndex, guessedIndices, entries.length,
      playerStrikes, eliminated, maxStrikes, turnOrder, turnTimerSecs,
      raceMode, raceTarget, rebuttalTriggerIndex]);

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
      await advanceTurn(true, newGuessedIndices, { guess_attribution: newAttribution }, entries[matched[0]].playerName, String(entries[matched[0]].playerId));
    } else {
      if (wrongGuesses.includes(trimmed)) {
        setGuess('');
        inputRef.current?.focus();
        return;
      }
      hasAdvancedRef.current = true;
      const playerMatch = await findPlayerInPool(trimmed, sport as 'nba' | 'nfl');
      await advanceTurn(
        false,
        undefined,
        { wrong_guesses: [...wrongGuesses, trimmed] },
        playerMatch?.playerName,
        playerMatch ? String(playerMatch.playerId) : undefined,
      );
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

  async function handleGiveUp() {
    if (!lobby || isWritingRef.current || giveUpVotes.includes(currentPlayerId)) return;
    isWritingRef.current = true;
    try {
      const newVotes = [...giveUpVotes, currentPlayerId];
      if (newVotes.length >= turnOrder.length) {
        const attribution: Record<string, number> = cs.guess_attribution || {};
        const winnerIds = determineWinners(turnOrder, attribution, {}, 1, false, '');
        const newState = { ...cs, give_up_votes: newVotes, winner_ids: winnerIds, winner_id: winnerIds[0] || '', reveal_anim: null };
        await updateCareerState(lobby.id, newState);
        await updateLobbyStatus(lobby.id, 'finished');
        setLobby({ ...lobby, career_state: newState, status: 'finished' });
      } else {
        const newState = { ...cs, give_up_votes: newVotes };
        await updateCareerState(lobby.id, newState);
        setLobby({ ...lobby, career_state: newState });
      }
    } catch (err) {
      console.error('[TopTen] handleGiveUp failed:', err);
    } finally {
      isWritingRef.current = false;
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

  async function generateRound() {
    const roundSport = (cs.top_ten_sport || cs.sport || 'nba') as 'nba' | 'nfl';
    const result = await generateTopTenRound({
      sport:              roundSport,
      roundType:          cs.top_ten_round_type || 'league',
      minYear:            cs.top_ten_min_year   || (roundSport === 'nba' ? 1996 : 1999),
      maxYear:            cs.top_ten_max_year   || 2025,
      windowYears:        cs.top_ten_window_years || 10,
      divisionMode:       (cs.top_ten_division_mode as 'cumulative' | 'single_season') || 'cumulative',
      recentCategoryKeys: recentCategoryKeysRef.current,
      recentTeamAbbrs:    recentTeamAbbrsRef.current,
    });
    // Track recently used categories and teams to avoid immediate repeats
    recentCategoryKeysRef.current = [result.cat.key, ...recentCategoryKeysRef.current].slice(0, 3);
    if (result.teamAbbr) {
      recentTeamAbbrsRef.current = [result.teamAbbr, ...recentTeamAbbrsRef.current].slice(0, 3);
    }
    return result;
  }

  async function handleSkipCategory() {
    if (!lobby || !isHost || isWritingRef.current) return;
    isWritingRef.current = true;
    try {
      const { entries: newEntries, cat, catLabel, roundInfo: newRoundInfo, isDivisionRound: newDiv, isTeamRound: newTeam, isSingleSeason: newSingleSeason, teamAbbr: newTeamAbbr } = await generateRound();
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
        is_single_season:   newSingleSeason,
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
      <div className="min-h-screen home-chalkboard flex items-center justify-center">
        <p className="capcrunch-kicker text-white/30 tracking-[0.3em]">Loading...</p>
      </div>
    );
  }

  const currentTurnPlayer   = players.find(p => p.player_id === currentTurnId);
  const displayTimeLeft     = revealOverlay ? turnTimerSecs : timeLeft;
  const displayTimerFraction = revealOverlay ? 1 : displayTimeLeft / turnTimerSecs;
  const timerColor          = displayTimerFraction > 0.5 ? '#70BE5B' : displayTimerFraction > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-white/10 flex items-center gap-3 bg-black/20 relative z-20">
        <HomeButton isHost={isHost} onEndGame={handleSendToLobby} />
        <h1 className="capcrunch-title text-base text-[#70BE5B]">Top Ten</h1>
        <span className="capcrunch-kicker text-[9px] text-white/25 tracking-[0.25em]">{sport.toUpperCase()}</span>
        <div className="ml-auto flex items-center gap-2">
          {(sport === 'nfl' || sport === 'nba') && (
            <button
              onClick={() => setShowTeamsPanel(v => !v)}
              className={`px-2.5 py-1 capcrunch-kicker text-[9px] tracking-[0.25em] border transition-colors ${
                showTeamsPanel
                  ? 'border-[#70BE5B]/60 text-[#70BE5B] bg-[#70BE5B]/8'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              Teams
            </button>
          )}
          {isHost && (
            <button
              onClick={handleToggleHint}
              className={`px-2.5 py-1 capcrunch-kicker text-[9px] tracking-[0.25em] border transition-colors ${
                hintMode
                  ? 'border-[#70BE5B]/60 text-[#70BE5B] bg-[#70BE5B]/8'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              Hint {hintMode ? 'On' : 'Off'}
            </button>
          )}
          {isHost && !isMyTurn && (
            <button
              onClick={handleSkipTurn}
              className="capcrunch-kicker text-[9px] text-white/30 border border-white/15 hover:border-white/30 hover:text-white/50 px-2.5 py-1 tracking-[0.25em] transition-colors"
            >
              Skip
            </button>
          )}
          {isHost && (
            <button
              onClick={handleSkipCategory}
              className="capcrunch-kicker text-[9px] text-white/30 border border-white/15 hover:border-[#68BBE5]/50 hover:text-[#68BBE5] px-2.5 py-1 tracking-[0.25em] transition-colors"
            >
              Skip Cat
            </button>
          )}
          {isHost && (
            <button
              onClick={handleForceEnd}
              className="capcrunch-kicker text-[9px] text-white/30 border border-white/15 hover:border-red-500/50 hover:text-red-400 px-2.5 py-1 tracking-[0.25em] transition-colors"
            >
              End
            </button>
          )}
        </div>
      </header>

      <TeamsReferencePanel sport={sport as 'nba' | 'nfl'} show={showTeamsPanel} onClose={() => setShowTeamsPanel(false)} />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-8 flex flex-col gap-4">
        <TopTenCategoryHeader
          categoryLabel={categoryLabel}
          roundInfo={roundInfo}
          isTeamRound={isTeamRound}
          teamAbbr={teamAbbr}
          isCumulativeRound={isCumulativeRound}
          isSingleSeason={isSingleSeason}
          sport={sport as 'nba' | 'nfl'}
        />

        {/* Compact player strip */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {playersInTurnOrder.map(p => {
            const pStrikes  = playerStrikes[p.player_id] || 0;
            const pGuesses  = (cs.guess_attribution || {})[p.player_id] || 0;
            const isElim    = !raceMode && eliminated.includes(p.player_id);
            const isMe      = p.player_id === currentPlayerId;
            const isCurrent = p.player_id === currentTurnId && !isElim;
            return (
              <div
                key={p.player_id}
                className={`flex items-center gap-1.5 px-2 py-1 border transition-colors ${
                  isElim    ? 'opacity-20 border-white/5 bg-transparent' :
                  isCurrent ? 'border-[#70BE5B]/40 bg-[#70BE5B]/5' :
                  isMe      ? 'border-white/20 bg-white/5' :
                              'border-white/8 bg-transparent'
                }`}
              >
                {isCurrent && !isElim && (
                  <motion.span
                    className="block w-1.5 h-1.5 rounded-full bg-[#70BE5B] shrink-0"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
                <span className={`capcrunch-kicker text-[9px] max-w-[56px] truncate ${
                  isCurrent ? 'text-[#70BE5B]' : isMe ? 'text-white' : 'text-white/40'
                }`}>
                  {p.player_name.split(' ')[0]}
                </span>
                {raceMode ? (
                  <span className={`capcrunch-title text-[10px] tabular-nums ${pGuesses >= raceTarget ? 'text-[#E2008A]' : 'text-white/50'}`}>
                    {pGuesses}/{raceTarget}
                  </span>
                ) : (
                  <span className="capcrunch-title text-[10px] tracking-tight">
                    {Array.from({ length: maxStrikes }).map((_, i) => (
                      <span key={i} className={i < pStrikes ? 'text-red-400' : 'text-white/12'}>✕</span>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Rebuttal banner */}
        {raceMode && rebuttalTriggerIndex !== null && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-3 py-2 border border-[#E2008A]/50 bg-[#E2008A]/8 text-center"
          >
            <p className="capcrunch-kicker text-[10px] text-[#E2008A] tracking-[0.25em]">REBUTTAL — everyone gets one last turn</p>
          </motion.div>
        )}

        {/* Turn indicator + timer */}
        <motion.div
          className={`flex items-center gap-3 px-3 py-2.5 border transition-colors ${
            isMyTurn ? 'border-[#70BE5B]/50 bg-[#70BE5B]/6' : 'border-white/8 bg-black/30'
          }`}
          animate={isMyTurn ? {
            boxShadow: ['0 0 0px rgba(112,190,91,0)', '0 0 18px rgba(112,190,91,0.15)', '0 0 0px rgba(112,190,91,0)'],
          } : { boxShadow: '0 0 0px rgba(0,0,0,0)' }}
          transition={isMyTurn ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        >
          <div className="flex-1">
            <p className={`capcrunch-kicker tracking-[0.25em] mb-1 transition-all ${
              isMyTurn ? 'text-[#70BE5B] text-sm' : 'text-white/35 text-[10px]'
            }`}>
              {isMyTurn ? 'Your turn' : `${currentTurnPlayer?.player_name ?? '...'}'s turn`}
            </p>
            <div className="h-1 bg-white/8 overflow-hidden">
              <motion.div
                className="h-full"
                style={{ backgroundColor: timerColor }}
                animate={{ width: `${displayTimerFraction * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
          <span className="capcrunch-title text-2xl tabular-nums" style={{ color: timerColor }}>{displayTimeLeft}</span>
        </motion.div>

        <FeedbackMessage feedback={feedback} />

        {/* Guess input */}
        {isMyTurn && !revealOverlay && (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={guess}
              onChange={e => setGuess(e.target.value)}
              placeholder="Type a player name..."
              autoComplete="off"
              className="flex-1 bg-black/40 border border-[#70BE5B]/30 px-4 py-2.5 text-white capcrunch-kicker text-sm focus:outline-none focus:border-[#70BE5B]/60 placeholder-white/20 transition-colors"
            />
            <button
              type="submit"
              className="capcrunch-btn-primary capcrunch-title text-sm px-4 py-2.5"
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

        <WrongGuessesList wrongGuesses={wrongGuesses} />

        {/* Player scoreboard */}
        <div className="capcrunch-panel p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="capcrunch-kicker text-[9px] text-white/25 tracking-[0.3em]">Players</p>
            {raceMode && (
              <p className="capcrunch-kicker text-[9px] text-[#E2008A]/60 tracking-[0.2em]">First to {raceTarget}</p>
            )}
          </div>
          <div className="space-y-1">
            {playersInTurnOrder.map(p => {
              const strikes   = playerStrikes[p.player_id] || 0;
              const isElim    = !raceMode && eliminated.includes(p.player_id);
              const guesses   = (cs.guess_attribution || {})[p.player_id] || 0;
              const isCurrent = p.player_id === currentTurnId && !isElim;
              const isMe      = p.player_id === currentPlayerId;
              const hasGivenUp = giveUpVotes.includes(p.player_id);
              return (
                <div
                  key={p.player_id}
                  className={`flex items-center gap-2 px-2 py-1.5 transition-colors ${
                    isElim ? 'opacity-25' : isCurrent ? 'bg-[#70BE5B]/6' : ''
                  }`}
                >
                  <div className="w-3 h-3 shrink-0 flex items-center justify-center">
                    {isCurrent ? (
                      <motion.span
                        className="block w-2.5 h-2.5 rounded-full bg-[#70BE5B]"
                        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    ) : (
                      <span className="block w-1.5 h-1.5 rounded-full bg-white/10" />
                    )}
                  </div>
                  <span className={`capcrunch-kicker text-sm flex-1 truncate ${
                    isCurrent ? 'text-[#70BE5B]' : isMe ? 'text-white' : 'text-white/50'
                  }`}>
                    {p.player_name}{isElim ? ' ✕' : ''}{hasGivenUp ? ' 🏳' : ''}
                  </span>
                  {raceMode ? (
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: raceTarget }).map((_, i) => (
                        <span key={i} className={`block w-2 h-2 rounded-full ${i < guesses ? 'bg-[#E2008A]' : 'bg-white/10'}`} />
                      ))}
                    </div>
                  ) : (
                    <span className="capcrunch-title text-[10px]">
                      {Array.from({ length: maxStrikes }).map((_, i) => (
                        <span key={i} className={i < strikes ? 'text-red-400' : 'text-white/12 opacity-20'}>✕</span>
                      ))}
                    </span>
                  )}
                  <span className="capcrunch-kicker text-[10px] text-[#70BE5B] w-8 text-right tabular-nums">{guesses} pts</span>
                </div>
              );
            })}
          </div>

          {/* Give Up button — race mode only */}
          {raceMode && !giveUpVotes.includes(currentPlayerId) && (
            <button
              onClick={handleGiveUp}
              className="mt-3 w-full py-1.5 capcrunch-kicker text-[9px] tracking-[0.25em] border border-white/12 text-white/30 hover:border-red-500/40 hover:text-red-400 transition-colors"
            >
              Give Up ({giveUpVotes.length}/{turnOrder.length})
            </button>
          )}
          {raceMode && giveUpVotes.includes(currentPlayerId) && (
            <p className="mt-3 text-center capcrunch-kicker text-[9px] text-white/20 tracking-[0.2em]">
              Waiting for others… ({giveUpVotes.length}/{turnOrder.length} gave up)
            </p>
          )}
        </div>
      </main>

      <AnimatePresence>
        {revealOverlay && (
          <RevealOverlay
            guessedName={revealOverlay.guessedName}
            isCorrect={revealOverlay.isCorrect}
            playerId={revealOverlay.playerId}
            sport={revealOverlay.sport}
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
              className="px-5 py-2 capcrunch-title text-base text-black"
              style={{
                background: '#70BE5B',
                boxShadow: '0 0 24px rgba(112,190,91,0.55), 0 3px 0 rgba(70,130,55,0.8)',
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
