import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus, updateCareerState } from '../../services/lobby';
import { isValidGuess, getCategoryDef, formatStat } from '../../services/topTen';
import type { TopTenEntry, StatCategoryDef } from '../../services/topTen';
import { TeamLogo } from '../../components/TeamLogo';

const TURN_SECONDS = 45;

export function MultiplayerTopTenPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const {
    lobby, players, isHost, currentPlayerId,
    setLobby, setPlayers,
  } = useLobbyStore();

  const [guess, setGuess]     = useState('');
  const [feedback, setFeedback] = useState<{ msg: string; type: 'correct' | 'wrong' | '' }>({ msg: '', type: '' });
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAdvancedRef = useRef(false);
  const isWritingRef = useRef(false);

  useLobbySubscription(lobby?.id || null);

  // Load lobby on mount / refresh
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

  const cs = (lobby?.career_state as any) || {};
  const entries: TopTenEntry[] = cs.top10_entries || [];
  const guessedIndices: number[] = cs.guessed_indices || [];
  const turnOrder: string[] = cs.turn_order || [];
  const eliminated: string[] = cs.eliminated || [];
  const playerStrikes: Record<string, number> = cs.player_strikes || {};
  const maxStrikes: number = cs.max_strikes || 2;
  const winTarget: number = cs.win_target || 3;
  const currentTurnIndex: number = cs.current_turn_index ?? 0;
  const turnDeadline: string | null = cs.turn_deadline || null;
  const round: number = cs.round || 1;
  const categoryKey: string = cs.category || '';
  const categoryLabel: string = cs.category_label || '';
  const roundInfo: string = cs.round_info || '';

  const activePlayers = turnOrder.filter(id => !eliminated.includes(id));
  const currentTurnId = activePlayers[currentTurnIndex % Math.max(activePlayers.length, 1)] || '';
  const isMyTurn = currentTurnId === currentPlayerId;
  const catDef: StatCategoryDef | undefined = getCategoryDef(cs.sport || 'nba', categoryKey);
  const sport: string = cs.sport || 'nba';

  // Timer
  useEffect(() => {
    if (!turnDeadline) return;
    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(turnDeadline).getTime() - Date.now()) / 1000));
      setTimeLeft(secs);
      if (secs === 0 && isMyTurn && !hasAdvancedRef.current && !isWritingRef.current) {
        hasAdvancedRef.current = true;
        advanceTurn(false);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [turnDeadline, isMyTurn]);

  // Reset advance guard when turn changes
  useEffect(() => {
    hasAdvancedRef.current = false;
    if (isMyTurn) setTimeout(() => inputRef.current?.focus(), 100);
  }, [currentTurnId, round]);

  // Navigate to results when finished
  useEffect(() => {
    if (lobby?.status === 'finished') {
      navigate(`/lobby/${code}/top-ten/results`);
    }
    if (lobby?.status === 'waiting') {
      navigate(`/lobby/${code}`);
    }
  }, [lobby?.status]);

  const advanceTurn = useCallback(async (correct: boolean, newGuessedIndices?: number[]) => {
    if (!lobby || isWritingRef.current) return;
    isWritingRef.current = true;

    const currentStrikes = { ...playerStrikes };
    const currentEliminated = [...eliminated];

    if (!correct) {
      const newStrikes = (currentStrikes[currentTurnId] || 0) + 1;
      currentStrikes[currentTurnId] = newStrikes;
      if (newStrikes >= maxStrikes && !currentEliminated.includes(currentTurnId)) {
        currentEliminated.push(currentTurnId);
      }
    }

    const newActivePlayers = turnOrder.filter(id => !currentEliminated.includes(id));
    const nextIndex = newActivePlayers.length > 0
      ? (currentTurnIndex + 1) % newActivePlayers.length
      : 0;

    const finalGuessedIndices = newGuessedIndices ?? guessedIndices;
    const allRevealed = finalGuessedIndices.length >= entries.length;
    const allEliminated = newActivePlayers.length <= 1 && currentEliminated.length >= turnOrder.length - 1;
    const roundOver = allRevealed || allEliminated;

    const newDeadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString();

    // Tally correct guesses per player from the guessed_indices vs player attribution
    const guessAttribution: Record<string, number> = cs.guess_attribution || {};
    const playerScores = Object.fromEntries(
      turnOrder.map(id => [id, guessAttribution[id] || 0])
    );

    if (roundOver) {
      // Round winner: player with most guesses this round
      const roundWinnerId = Object.entries(playerScores).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      const existingRoundWins: Record<string, number> = cs.round_wins || {};
      existingRoundWins[roundWinnerId] = (existingRoundWins[roundWinnerId] || 0) + 1;

      const matchWinner = Object.entries(existingRoundWins).find(([, w]) => w >= winTarget)?.[0];

      if (matchWinner) {
        const newState = { ...cs, guessed_indices: finalGuessedIndices, player_strikes: currentStrikes, eliminated: currentEliminated, round_wins: existingRoundWins };
        await updateCareerState(lobby.id, newState);
        await updateLobbyStatus(lobby.id, 'finished');
        setLobby({ ...lobby, career_state: newState, status: 'finished' });
      } else {
        // New round — reset per-round state but keep wins + settings
        const newState = {
          ...cs,
          round: round + 1,
          guessed_indices: [],
          player_strikes: {},
          eliminated: [],
          guess_attribution: {},
          current_turn_index: 0,
          turn_deadline: newDeadline,
          round_wins: existingRoundWins,
          // top10_entries, category, etc. are re-rolled by the host below
        };
        await updateCareerState(lobby.id, newState);
        setLobby({ ...lobby, career_state: newState });
      }
    } else {
      const newState = {
        ...cs,
        guessed_indices: finalGuessedIndices,
        player_strikes: currentStrikes,
        eliminated: currentEliminated,
        current_turn_index: nextIndex,
        turn_deadline: newDeadline,
      };
      await updateCareerState(lobby.id, newState);
      setLobby({ ...lobby, career_state: newState });
    }

    isWritingRef.current = false;
  }, [lobby, cs, currentTurnId, currentTurnIndex, guessedIndices, entries.length, playerStrikes, eliminated, maxStrikes, turnOrder, round, winTarget]);

  function clearFeedback() {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback({ msg: '', type: '' }), 1800);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim() || !isMyTurn || isWritingRef.current) return;

    const matched = isValidGuess(guess.trim(), entries, guessedIndices);
    setGuess('');

    if (matched.length > 0) {
      const newGuessedIndices = [...guessedIndices, ...matched];
      setFeedback({ msg: `✓ ${entries[matched[0]].playerName}`, type: 'correct' });
      clearFeedback();

      // Track attribution
      const newAttribution = { ...(cs.guess_attribution || {}), [currentTurnId!]: ((cs.guess_attribution || {})[currentTurnId!] || 0) + matched.length };

      if (!lobby) return;
      // Optimistic update attribution before advancing
      const stateWithAttribution = { ...cs, guess_attribution: newAttribution };
      await updateCareerState(lobby.id, stateWithAttribution);
      setLobby({ ...lobby, career_state: stateWithAttribution });

      hasAdvancedRef.current = true;
      await advanceTurn(true, newGuessedIndices);
    } else {
      setFeedback({ msg: '✗ Not in the top 10', type: 'wrong' });
      clearFeedback();
      hasAdvancedRef.current = true;
      await advanceTurn(false);
    }
    inputRef.current?.focus();
  }

  async function handleEndGame() {
    if (!lobby || !isHost) return;
    const newState = { ...cs, abandoned: true };
    await updateCareerState(lobby.id, newState);
    await updateLobbyStatus(lobby.id, 'waiting');
    window.location.href = `/lobby/${code}`;
  }

  // Non-host: detect abandoned flag
  useEffect(() => {
    if (isHost) return;
    if (cs.abandoned) window.location.href = `/lobby/${code}`;
  }, [cs.abandoned]);

  if (!lobby || entries.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-white/30 sports-font tracking-widest">Loading...</p>
      </div>
    );
  }

  const currentTurnPlayer = players.find(p => p.player_id === currentTurnId);
  const timerFraction = timeLeft / TURN_SECONDS;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-white/10 flex items-center gap-3 bg-black/60">
        {isHost && (
          <button
            onClick={handleEndGame}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        )}
        <h1 className="retro-title text-xl text-[#22c55e]">Top Ten</h1>
        <span className="sports-font text-[9px] text-white/30 tracking-widest uppercase">Round {round}</span>
        <span className="ml-auto sports-font text-[9px] text-white/30 tracking-widest uppercase">{sport.toUpperCase()}</span>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full p-4 flex flex-col gap-4">
        {/* Category + round info */}
        <div className="text-center pt-1">
          <p className="retro-title text-2xl text-[#22c55e]">{categoryLabel}</p>
          <p className="sports-font text-[10px] text-white/30 tracking-widest uppercase mt-0.5">{roundInfo}</p>
        </div>

        {/* Turn indicator */}
        <div className={`flex items-center gap-3 p-3 rounded-sm border transition-colors ${
          isMyTurn ? 'border-[#22c55e]/60 bg-[#22c55e]/10' : 'border-white/10 bg-[#111]'
        }`}>
          <div className="flex-1">
            <p className="sports-font text-[10px] text-white/40 tracking-widest uppercase mb-0.5">
              {isMyTurn ? 'Your turn' : `${currentTurnPlayer?.player_name ?? '...'}'s turn`}
            </p>
            <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: timerColor }}
                animate={{ width: `${timerFraction * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
          <span
            className="retro-title text-2xl"
            style={{ color: timerColor }}
          >
            {timeLeft}
          </span>
        </div>

        {/* Feedback */}
        <div className="h-5">
          <AnimatePresence mode="wait">
            {feedback.type && (
              <motion.p
                key={feedback.msg}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-center sports-font text-sm ${feedback.type === 'correct' ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {feedback.msg}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Guess input */}
        {isMyTurn && (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={guess}
              onChange={e => setGuess(e.target.value)}
              placeholder="Type a player name..."
              className="flex-1 bg-[#111] border border-[#22c55e]/40 rounded-sm px-4 py-3 text-white sports-font text-sm focus:outline-none focus:border-[#22c55e] placeholder-white/20"
              autoComplete="off"
            />
            <button
              type="submit"
              className="px-4 py-3 bg-[#22c55e] hover:bg-[#16a34a] rounded-sm retro-title text-sm transition-colors"
            >
              Guess
            </button>
          </form>
        )}

        {/* Board */}
        <div className="space-y-1.5">
          {entries.map((entry, i) => {
            const isRevealed = guessedIndices.includes(i);
            return (
              <motion.div
                key={i}
                className={`flex items-center gap-3 p-2.5 rounded-sm border ${
                  isRevealed ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-[#111] border-[#1a1a1a]'
                }`}
              >
                <span className="sports-font text-[10px] text-white/25 w-5 text-right shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  {isRevealed ? (
                    <div className="flex items-center gap-2">
                      <TeamLogo abbr={entry.team} sport={sport as 'nba' | 'nfl'} size={20} />
                      <div>
                        <p className="retro-title text-sm text-emerald-300 leading-tight">{entry.playerName}</p>
                        <p className="sports-font text-[9px] text-white/30">{entry.team} · {entry.year}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <TeamLogo abbr={entry.team} sport={sport as 'nba' | 'nfl'} size={20} />
                      <p className="sports-font text-white/15">???</p>
                    </div>
                  )}
                </div>
                {isRevealed && catDef && (
                  <span className="sports-font text-xs text-[#22c55e] shrink-0">
                    {formatStat(entry.stat, categoryKey)} {catDef.shortLabel}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Player scoreboard */}
        <div className="bg-[#0d0d0d] border border-white/10 rounded-sm p-3">
          <p className="sports-font text-[9px] text-white/30 tracking-widest uppercase mb-2">Players</p>
          <div className="space-y-1.5">
            {players.map(p => {
              const strikes = playerStrikes[p.player_id] || 0;
              const isElim = eliminated.includes(p.player_id);
              const guesses = (cs.guess_attribution || {})[p.player_id] || 0;
              const roundWins = (cs.round_wins || {})[p.player_id] || 0;
              const isCurrent = p.player_id === currentTurnId;
              return (
                <div
                  key={p.player_id}
                  className={`flex items-center gap-2 text-sm ${isElim ? 'opacity-30' : ''}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${isCurrent && !isElim ? 'bg-[#22c55e]' : 'bg-white/10'}`}
                  />
                  <span className={`sports-font flex-1 truncate ${p.player_id === currentPlayerId ? 'text-white' : 'text-white/60'}`}>
                    {p.player_name}{isElim ? ' ✕' : ''}
                  </span>
                  <span className="sports-font text-[10px] text-white/30">
                    {Array.from({ length: maxStrikes }).map((_, i) => (
                      <span key={i} className={i < strikes ? 'text-red-400' : 'opacity-20'}>✕</span>
                    ))}
                  </span>
                  <span className="sports-font text-[10px] text-emerald-400 w-8 text-right">{guesses} pts</span>
                  <span className="sports-font text-[10px] text-[#d4af37] w-10 text-right">{roundWins}/{winTarget} W</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
