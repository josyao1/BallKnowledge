/**
 * MultiplayerCareerPage.tsx — Multiplayer "Guess the Career" gameplay.
 *
 * Each player independently guesses the mystery player from stat lines.
 * Years and bio hints are per-player local choices (no voting).
 * Round winner (highest score) earns a win; first to win_target wins the match.
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
import { getNextGame, startPrefetch } from '../services/careerPrefetch';
import { areSimilarNames } from '../utils/fuzzyDedup';
import { normalizeTeamAbbr } from '../utils/teamAbbr';
import type { Sport } from '../types';

// ─── Column definitions ──────────────────────────────────────────────────────

const NBA_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'min', label: 'MIN' },
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'fg_pct', label: 'FG%' },
  { key: 'fg3_pct', label: '3P%' },
];

const NFL_QB_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'completions', label: 'Comp' },
  { key: 'attempts', label: 'Att' },
  { key: 'passing_yards', label: 'Pass Yds' },
  { key: 'passing_tds', label: 'Pass TD' },
  { key: 'interceptions', label: 'INT' },
  { key: 'rushing_yards', label: 'Rush Yds' },
];

const NFL_RB_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'carries', label: 'Rush Att' },
  { key: 'rushing_yards', label: 'Rush Yds' },
  { key: 'rushing_tds', label: 'Rush TD' },
  { key: 'receptions', label: 'Rec' },
  { key: 'receiving_yards', label: 'Rec Yds' },
];

const NFL_WR_TE_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'targets', label: 'Targets' },
  { key: 'receptions', label: 'Rec' },
  { key: 'receiving_yards', label: 'Rec Yds' },
  { key: 'receiving_tds', label: 'Rec TD' },
];

function getColumns(sport: Sport, position: string) {
  if (sport === 'nba') return NBA_COLUMNS;
  switch (position) {
    case 'QB': return NFL_QB_COLUMNS;
    case 'RB': return NFL_RB_COLUMNS;
    default: return NFL_WR_TE_COLUMNS;
  }
}

function formatStat(key: string, value: any): string {
  if (key === 'fg_pct' || key === 'fg3_pct') {
    return (value * 100).toFixed(1);
  }
  return String(value ?? 0);
}

const POSITION_NAMES: Record<string, string> = {
  PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward',
  PF: 'Power Forward', C: 'Center',
  QB: 'Quarterback', RB: 'Running Back', WR: 'Wide Receiver', TE: 'Tight End',
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface CareerState {
  playerId: string | number;
  playerName: string;
  position: string;
  sport: 'nba' | 'nfl';
  seasons: any[];
  bio: any;
  round: number;
  win_target: number;
}

interface RoundSummary {
  answer: string;
  round: number;
  scores: Record<string, number>;
  finishedAt: Record<string, string | null>;
  timeBonuses: Record<string, number>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MultiplayerCareerPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers } = useLobbyStore();

  useLobbySubscription(lobby?.id || null);

  const careerState = lobby?.career_state as CareerState | null;

  // ── Per-player local round state (no shared DB sync for hints) ──
  const [localScore, setLocalScore] = useState(20);
  const [localGuesses, setLocalGuesses] = useState<string[]>([]);
  const [localStatus, setLocalStatus] = useState<'playing' | 'done'>('playing');
  const [yearsRevealed, setYearsRevealed] = useState(false);
  const [bioRevealed, setBioRevealed] = useState(false);
  const [initialsRevealed, setInitialsRevealed] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackType, setFeedbackType] = useState<'correct' | 'wrong' | ''>('');
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [pressureSecondsLeft, setPressureSecondsLeft] = useState<number | null>(null);

  // ── Refs ──
  const prevRoundRef = useRef(-1);
  const prevStatusRef = useRef<string | null>(null);
  const hasSubmittedRef = useRef(false);
  const hasAdvancedRef = useRef(false);
  // Ref mirror of roundHistory so navigate always gets the latest value
  const roundHistoryRef = useRef<RoundSummary[]>([]);
  // Guard: only advance once we've confirmed at least one player had finished_at===null
  // this round. Without this, stale finished_at values from the previous round can
  // trigger an immediate advance when status flips to 'playing'.
  const atLeastOnePlayerWasActiveRef = useRef(false);
  // Guard: 30s pressure timer fires only once per round
  const firstCorrectTimerStartedRef = useRef(false);
  const pressureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load lobby on mount (handles page refresh) ──
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

  // ── Handle lobby status transitions ──
  useEffect(() => {
    if (!lobby) return;

    const prev = prevStatusRef.current;
    prevStatusRef.current = lobby.status;

    // Capture round summary whenever a round ends (playing → waiting OR playing → finished)
    if (prev === 'playing' && (lobby.status === 'waiting' || lobby.status === 'finished') && careerState) {
      const scores: Record<string, number> = {};
      const finishedAt: Record<string, string | null> = {};
      players.forEach(p => {
        scores[p.player_id] = p.score || 0;
        finishedAt[p.player_id] = p.finished_at;
      });

      // Compute time bonus at capture time (same logic as advanceRound) so it's
      // stored explicitly rather than re-derived later from finishedAt timestamps.
      const timeBonuses: Record<string, number> = {};
      const topScoreNow = Math.max(0, ...players.map(p => p.score || 0));
      const topScorersNow = topScoreNow > 0 ? players.filter(p => (p.score || 0) === topScoreNow) : [];
      const isTieNow = topScorersNow.length >= 2 && topScorersNow.every(p => p.finished_at !== null);
      if (isTieNow) {
        const sortedNow = [...topScorersNow].sort((a, b) =>
          new Date(a.finished_at!).getTime() - new Date(b.finished_at!).getTime()
        );
        const diffMsNow = new Date(sortedNow[1].finished_at!).getTime() - new Date(sortedNow[0].finished_at!).getTime();
        const rawBonusNow = Math.max(1, Math.ceil(diffMsNow / 1000));
        timeBonuses[sortedNow[0].player_id] = Math.min(rawBonusNow, topScoreNow);
      }

      const newSummary: RoundSummary = {
        answer: careerState.playerName || '',
        round: careerState.round || 0,
        scores,
        finishedAt,
        timeBonuses,
      };
      setRoundSummary(newSummary);
      roundHistoryRef.current = [...roundHistoryRef.current, newSummary];
      hasAdvancedRef.current = false;
    }

    if (lobby.status === 'finished') {
      navigate(`/lobby/${code}/career/results`, { state: { roundHistory: roundHistoryRef.current } });
    }
  }, [lobby?.status]);

  // ── Detect new round — reset all local state ──
  const currentRound = careerState?.round ?? 0;
  useEffect(() => {
    if (currentRound > 0 && currentRound !== prevRoundRef.current) {
      prevRoundRef.current = currentRound;
      setLocalScore(20);
      setLocalGuesses([]);
      setLocalStatus('playing');
      setYearsRevealed(false);
      setBioRevealed(false);
      setInitialsRevealed(false);
      setGuessInput('');
      setFeedbackMsg('');
      setFeedbackType('');
      hasSubmittedRef.current = false;
      atLeastOnePlayerWasActiveRef.current = false;
      firstCorrectTimerStartedRef.current = false;
      if (pressureIntervalRef.current) {
        clearInterval(pressureIntervalRef.current);
        pressureIntervalRef.current = null;
      }
      setPressureSecondsLeft(null);
    }
  }, [currentRound]);

  // ── Track when players are active (finished_at === null) ──
  // This guards against the race condition where the lobby status event arrives
  // before the player reset events, causing stale finished_at to look like all done.
  useEffect(() => {
    if (players.some(p => p.finished_at === null)) {
      atLeastOnePlayerWasActiveRef.current = true;
    }
  }, [players]);

  // ── 30s pressure timer: fires when any player gets it correct ──
  useEffect(() => {
    if (lobby?.status !== 'playing') return;
    if (firstCorrectTimerStartedRef.current) return;
    // Guard against stale round-1 player data arriving before the players-reset event:
    // only start the timer once we've confirmed this round's player data is live.
    if (!atLeastOnePlayerWasActiveRef.current) return;

    const anyCorrect = players.some(p => p.finished_at !== null && (p.score || 0) > 0);
    if (!anyCorrect) return;

    firstCorrectTimerStartedRef.current = true;
    setPressureSecondsLeft(30);

    pressureIntervalRef.current = setInterval(() => {
      setPressureSecondsLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(pressureIntervalRef.current!);
          pressureIntervalRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (pressureIntervalRef.current) {
        clearInterval(pressureIntervalRef.current);
      }
    };
  }, [players, lobby?.status]);

  // ── Auto give-up when pressure timer expires ──
  useEffect(() => {
    if (pressureSecondsLeft === null && firstCorrectTimerStartedRef.current && localStatus === 'playing' && !hasSubmittedRef.current) {
      // Timer just hit zero: give up
      handleGiveUp();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressureSecondsLeft]);

  // ── HOST: Advance round when all players genuinely finish ──
  const allPlayersFinished = players.length > 0 && players.every(p => p.finished_at !== null);

  const advanceRound = useCallback(async () => {
    if (!lobby || !careerState) return;
    hasAdvancedRef.current = true;

    // Determine tiebreaker: find top score and whether multiple players tied
    const topScore = Math.max(0, ...players.map(p => p.score || 0));
    const topScorers = topScore > 0 ? players.filter(p => (p.score || 0) === topScore) : [];
    const isTiebreaker = topScorers.length >= 2 && topScorers.every(p => p.finished_at !== null);

    let tiebreakerWinnerId: string | null = null;
    let tiebreakerBonus = 0;

    if (isTiebreaker) {
      const sortedByTime = [...topScorers].sort((a, b) =>
        new Date(a.finished_at!).getTime() - new Date(b.finished_at!).getTime()
      );
      tiebreakerWinnerId = sortedByTime[0].player_id;
      const diffMs = new Date(sortedByTime[1].finished_at!).getTime() - new Date(sortedByTime[0].finished_at!).getTime();
      const rawBonus = Math.max(1, Math.ceil(diffMs / 1000));
      tiebreakerBonus = Math.min(rawBonus, topScore); // cap at winner's own score
    }

    // Award career points to every player (round score + tiebreaker bonus for fastest)
    await Promise.all(players.map(p => {
      const roundScore = p.score || 0;
      const bonus = p.player_id === tiebreakerWinnerId ? tiebreakerBonus : 0;
      return addCareerPoints(lobby.id, p.player_id, roundScore + bonus);
    }));

    // Check win condition with fresh data (race to 100)
    const freshResult = await getLobbyPlayers(lobby.id);
    const freshPlayers = freshResult.players || [];
    const pointsTarget = careerState.win_target || 100;
    const gameWinner = freshPlayers.find(p => (p.wins || 0) >= pointsTarget);

    if (gameWinner) {
      await updateLobbyStatus(lobby.id, 'finished');
    } else {
      await updateLobbyStatus(lobby.id, 'waiting');
    }
  }, [lobby, careerState, players]);

  useEffect(() => {
    if (!isHost || !allPlayersFinished || lobby?.status !== 'playing' || hasAdvancedRef.current) return;
    // Don't advance until we've seen at least one player with finished_at===null
    // (confirms the player resets have propagated)
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
        updatePlayerScore(lobby.id, localScore, 0, [], localGuesses, true);
      }
    } else {
      const newScore = Math.max(0, localScore - 1);
      const newGuesses = [...localGuesses, name];
      setLocalScore(newScore);
      setLocalGuesses(newGuesses);
      setFeedbackMsg(`"${name}" is wrong`);
      setFeedbackType('wrong');
      setTimeout(() => { setFeedbackMsg(''); setFeedbackType(''); }, 2000);

      if (newScore === 0) {
        setLocalStatus('done');
        if (!hasSubmittedRef.current) {
          hasSubmittedRef.current = true;
          updatePlayerScore(lobby.id, 0, 0, [], newGuesses, true);
        }
      }
    }
  }

  function handleGiveUp() {
    if (localStatus !== 'playing' || hasSubmittedRef.current || !lobby) return;
    hasSubmittedRef.current = true;
    setLocalScore(0);
    setLocalStatus('done');
    updatePlayerScore(lobby.id, 0, 0, [], localGuesses, true);
  }

  // ── Per-player hint reveals (local only) ──
  function handleRevealYears() {
    if (yearsRevealed || localStatus !== 'playing') return;
    setYearsRevealed(true);
    setLocalScore(prev => Math.max(0, prev - 3));
  }

  function handleRevealBio() {
    if (bioRevealed || localStatus !== 'playing') return;
    setBioRevealed(true);
    setLocalScore(prev => Math.max(0, prev - 3));
  }

  function handleRevealInitials() {
    if (initialsRevealed || localStatus !== 'playing') return;
    setInitialsRevealed(true);
    setLocalScore(prev => Math.max(0, prev - 10));
  }

  // Derive initials from playerName (first letter of first + last word)
  const playerInitials = (() => {
    if (!careerState?.playerName) return null;
    const parts = careerState.playerName.trim().split(/\s+/);
    const first = parts[0]?.[0]?.toUpperCase() ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() : '';
    return last ? `${first}. ${last}.` : `${first}.`;
  })();

  // ── HOST: Load and start next round ──
  async function handleNextRound() {
    if (!isHost || !lobby || isLoadingNext || !careerState) return;
    setIsLoadingNext(true);

    const sport = (careerState.sport || lobby.sport) as Sport;
    const careerFrom = (careerState as any).career_from || 0;
    const careerTo   = (careerState as any).career_to   || 0;
    try {
      const game = await getNextGame(sport, { careerFrom, careerTo });
      if (!game) { setIsLoadingNext(false); return; }

      const newState = {
        ...game.data,
        sport: game.sport,
        round: (careerState.round || 0) + 1,
        win_target: careerState.win_target || 100,
        career_from: careerFrom,
        career_to: careerTo,
      };

      await startCareerRound(lobby.id, newState);
      startPrefetch(sport);
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

  const sport = (careerState.sport || 'nba') as Sport;
  const accentColor = sport === 'nba' ? 'var(--nba-orange)' : '#013369';
  const columns = getColumns(sport, careerState.position || '');
  const winTarget = careerState.win_target || 100;

  // Career highs: max value per numeric column across all seasons.
  const careerHighs = useMemo(() => {
    const highs: Record<string, number> = {};
    const allSeasons: any[] = careerState.seasons || [];
    for (const col of columns) {
      if (col.key === 'season' || col.key === 'team') continue;
      const max = Math.max(0, ...allSeasons.map((s: any) => Number(s[col.key]) || 0));
      if (max > 0) highs[col.key] = max;
    }
    return highs;
  }, [careerState.seasons, columns]);

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
            {careerState.position && (
              <div className="sports-font text-xs text-[#888] mt-0.5">
                {sport.toUpperCase()} {POSITION_NAMES[careerState.position] ?? careerState.position}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="sports-font text-[8px] text-[#888] tracking-widest">RACE TO</div>
            <div className="retro-title text-2xl text-[#d4af37]">{winTarget}</div>
          </div>
        </header>

        {/* Answer reveal */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-6 bg-[#1a1a1a] border-2 border-[#d4af37]/50 rounded-lg text-center"
          >
            <div className="sports-font text-[10px] text-[#888] tracking-widest mb-2 uppercase">The Answer Was</div>
            <div className="retro-title text-3xl text-[#d4af37]">{summary.answer}</div>
          </motion.div>
        )}

        {/* Scores this round + round winner + tiebreaker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 bg-[#1a1a1a] border border-[#333] rounded-lg p-4"
        >
          <div className="sports-font text-[10px] text-[#888] tracking-widest mb-3 uppercase text-center">
            Round Scores
          </div>
          <div className="space-y-2">
            {(() => {
              const scores = summary?.scores ?? {};
              const finishedAt = summary?.finishedAt ?? {};
              const topScore = Math.max(0, ...players.map(p => scores[p.player_id] ?? 0));
              const topScorers = topScore > 0 ? players.filter(p => (scores[p.player_id] ?? 0) === topScore) : [];
              const isTiebreaker = topScorers.length > 1 && topScorers.every(p => finishedAt[p.player_id]);
              const roundWinnerId = isTiebreaker
                ? [...topScorers].sort((a, b) => {
                    const aT = new Date(finishedAt[a.player_id]!).getTime();
                    const bT = new Date(finishedAt[b.player_id]!).getTime();
                    return aT - bT;
                  })[0]?.player_id
                : topScorers[0]?.player_id;
              const timeDiffMs = isTiebreaker && topScorers.length >= 2
                ? (() => {
                    const sorted = [...topScorers].sort((a, b) =>
                      new Date(finishedAt[a.player_id]!).getTime() - new Date(finishedAt[b.player_id]!).getTime()
                    );
                    return new Date(finishedAt[sorted[1].player_id]!).getTime() - new Date(finishedAt[sorted[0].player_id]!).getTime();
                  })()
                : 0;
              const rawBonus = isTiebreaker && timeDiffMs > 0 ? Math.max(1, Math.ceil(timeDiffMs / 1000)) : 0;
              const tiebreakerBonus = rawBonus > 0 ? Math.min(rawBonus, topScore) : 0;

              return (
                <>
                  {[...players]
                    .sort((a, b) => (scores[b.player_id] ?? 0) - (scores[a.player_id] ?? 0))
                    .map(player => {
                      const score = scores[player.player_id] ?? 0;
                      const isMe = player.player_id === currentPlayerId;
                      const isRoundWinner = player.player_id === roundWinnerId;
                      return (
                        <div
                          key={player.player_id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            isMe ? 'bg-[#d4af37]/10 border border-[#d4af37]/30' : 'bg-black/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="sports-font text-sm text-white/80">{player.player_name}</span>
                            {isMe && <span className="text-[10px] text-white/40 sports-font">(you)</span>}
                            {isRoundWinner && topScore > 0 && (
                              <span className="text-[10px] sports-font text-[#d4af37] tracking-wider">
                                {isTiebreaker ? '⚡ FASTEST' : '★ WINNER'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            {(() => {
                              const tb = summary?.timeBonuses?.[player.player_id] ?? 0;
                              return tb > 0 ? (
                                <div className="text-right">
                                  <div className="sports-font text-[8px] text-[#888] tracking-wider">TIME BONUS</div>
                                  <div className="retro-title text-lg text-[#d4af37]">+{tb}</div>
                                </div>
                              ) : null;
                            })()}
                            <div className="text-right">
                              <div className="sports-font text-[8px] text-[#888] tracking-wider">ROUND</div>
                              <div className={`retro-title text-lg ${score > 0 ? 'text-white' : 'text-[#555]'}`}>{score}</div>
                            </div>
                            <div className="text-right">
                              <div className="sports-font text-[8px] text-[#888] tracking-wider">TOTAL PTS</div>
                              <div className="retro-title text-lg text-[#d4af37]">{player.wins || 0}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {isTiebreaker && timeDiffMs > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#333] text-center sports-font text-[10px] text-[#888]">
                      Tiebreaker — {players.find(p => p.player_id === roundWinnerId)?.player_name} was{' '}
                      <span className="text-[#d4af37]">
                        {timeDiffMs < 1000
                          ? `${timeDiffMs}ms`
                          : `${(timeDiffMs / 1000).toFixed(1)}s`} faster
                      </span>
                      {tiebreakerBonus > 0 && <span className="text-[#d4af37]"> (+{tiebreakerBonus} bonus pts)</span>}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </motion.div>

        {/* Points progress bars (race to 100) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 space-y-3"
        >
          {[...players].sort((a, b) => (b.wins || 0) - (a.wins || 0)).map(player => {
            const pts = player.wins || 0;
            const pct = Math.min(100, Math.round((pts / winTarget) * 100));
            return (
              <div key={player.player_id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="sports-font text-[10px] text-[#888] tracking-wider">{player.player_name}</span>
                  <span className="sports-font text-[10px] text-[#d4af37] tracking-wider">{pts} / {winTarget} PTS</span>
                </div>
                <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#d4af37] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
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
  const isDone = localStatus === 'done';
  const doneCount = players.filter(p => p.finished_at !== null).length;
  const totalCount = players.length;

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col p-4 md:p-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] sports-font tracking-wider text-white" style={{ backgroundColor: accentColor }}>
              {sport.toUpperCase()}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] sports-font tracking-wider bg-[#1a1a1a] text-[#888]">
              Round {careerState.round}
            </span>
          </div>
          {careerState.position && (
            <div className="sports-font text-sm text-white/70 tracking-wider">
              Guess the <span className="text-white font-bold">{POSITION_NAMES[careerState.position] ?? careerState.position}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-2 text-center">
            <div className="sports-font text-[8px] text-[#888] tracking-widest">SCORE</div>
            <div className="retro-title text-2xl" style={{ color: localScore > 10 ? '#22c55e' : localScore > 5 ? '#eab308' : '#ef4444' }}>
              {localScore}
            </div>
          </div>
          <div className="bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-2 text-center">
            <div className="sports-font text-[8px] text-[#888] tracking-widest">DONE</div>
            <div className="retro-title text-2xl text-white">{doneCount}/{totalCount}</div>
          </div>
        </div>
      </header>

      {/* Points progress bars (race to 100) */}
      <div className="mb-4 space-y-1.5">
        {[...players].sort((a, b) => (b.wins || 0) - (a.wins || 0)).map(player => {
          const pts = player.wins || 0;
          const pct = Math.min(100, Math.round((pts / winTarget) * 100));
          const isMe = player.player_id === currentPlayerId;
          return (
            <div key={player.player_id} className={`flex items-center gap-2 px-2 py-1 rounded ${isMe ? 'bg-[#d4af37]/10' : ''}`}>
              <span className="sports-font text-[10px] text-white/60 w-20 truncate">{player.player_name}</span>
              <div className="flex-1 h-1.5 bg-[#333] rounded-full overflow-hidden">
                <div className="h-full bg-[#d4af37] rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="sports-font text-[9px] text-[#d4af37] w-16 text-right">{pts}/{winTarget}</span>
            </div>
          );
        })}
      </div>

      {/* Pressure timer banner */}
      {pressureSecondsLeft !== null && (
        <div className={`mb-4 p-3 rounded-lg text-center sports-font text-sm tracking-wider border ${
          pressureSecondsLeft <= 10
            ? 'bg-red-900/30 border-red-700/60 text-red-300'
            : 'bg-yellow-900/20 border-yellow-700/40 text-yellow-300'
        }`}>
          ⚡ {pressureSecondsLeft}s — someone got it!
        </div>
      )}

      {/* Live player status panel */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {players.map(player => {
          const isMe = player.player_id === currentPlayerId;
          const finished = player.finished_at !== null;
          const score = player.score || 0;
          const gotIt = finished && score > 0;
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
              {gotIt && <span className="text-green-400">✓ {score}pts</span>}
              {finished && !gotIt && <span>✗</span>}
              {!finished && (
                <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin opacity-70" />
              )}
            </div>
          );
        })}
      </div>

      {/* Stat table */}
      <div className="flex-1 overflow-x-auto mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-[#333]">
              {columns.map(col => (
                <th key={col.key} className="px-3 py-2 text-left sports-font text-[10px] text-[#888] tracking-wider uppercase whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {(careerState.seasons || []).map((season: any, idx: number) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  className="border-b border-[#222] hover:bg-[#1a1a1a]"
                >
                  {columns.map(col => {
                    const isHigh = col.key !== 'season' && col.key !== 'team'
                      && careerHighs[col.key] !== undefined
                      && (Number(season[col.key]) || 0) === careerHighs[col.key];
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2 sports-font text-xs whitespace-nowrap ${
                          isHigh
                            ? 'text-[#d4af37] bg-[#d4af37]/10 font-bold'
                            : 'text-[var(--vintage-cream)]'
                        }`}
                      >
                        {col.key === 'season'
                          ? (yearsRevealed ? season.season : '???')
                          : col.key === 'team'
                            ? normalizeTeamAbbr(formatStat(col.key, season[col.key]), sport)
                            : formatStat(col.key, season[col.key])
                        }
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Bio panel */}
      <AnimatePresence>
        {bioRevealed && careerState.bio && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-[#1a1a1a] border border-[#333] rounded-lg p-4"
          >
            <div className="sports-font text-[10px] text-[#888] tracking-widest mb-2 uppercase">Player Bio</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {careerState.bio.height && (
                <div>
                  <div className="sports-font text-[8px] text-[#666] tracking-wider">HEIGHT</div>
                  <div className="sports-font text-sm text-[var(--vintage-cream)]">{careerState.bio.height}</div>
                </div>
              )}
              {careerState.bio.weight > 0 && (
                <div>
                  <div className="sports-font text-[8px] text-[#666] tracking-wider">WEIGHT</div>
                  <div className="sports-font text-sm text-[var(--vintage-cream)]">{careerState.bio.weight} lbs</div>
                </div>
              )}
              {(careerState.bio.school || careerState.bio.college) && (
                <div>
                  <div className="sports-font text-[8px] text-[#666] tracking-wider">SCHOOL</div>
                  <div className="sports-font text-sm text-[var(--vintage-cream)]">{careerState.bio.school || careerState.bio.college}</div>
                </div>
              )}
              {careerState.bio.draftYear ? (
                <div>
                  <div className="sports-font text-[8px] text-[#666] tracking-wider">DRAFT</div>
                  <div className="sports-font text-sm text-[var(--vintage-cream)]">{careerState.bio.draftYear}</div>
                </div>
              ) : careerState.bio.draftClub ? (
                <div>
                  <div className="sports-font text-[8px] text-[#666] tracking-wider">DRAFT</div>
                  <div className="sports-font text-sm text-[var(--vintage-cream)]">
                    {careerState.bio.draftClub} #{careerState.bio.draftNumber}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wrong guesses */}
      {localGuesses.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {localGuesses.map((g, i) => (
            <span key={i} className="px-2 py-1 bg-red-900/30 border border-red-800/50 rounded text-xs sports-font text-red-300">
              {g}
            </span>
          ))}
        </div>
      )}

      {/* Done message */}
      <AnimatePresence>
        {isDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 p-4 rounded-lg text-center bg-[#1a1a1a] border border-[#333]"
          >
            <div className="sports-font text-sm text-[#888]">
              {localScore > 0
                ? `Score: ${localScore} — waiting for ${doneCount}/${totalCount} players`
                : 'No points this round — waiting for others...'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Initials hint display */}
      <AnimatePresence>
        {initialsRevealed && playerInitials && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 flex items-center justify-center gap-3"
          >
            <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase">Initials</div>
            <div className="retro-title text-2xl text-[#d4af37] tracking-widest">{playerInitials}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      {!isDone && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuess()}
              placeholder="Type player name..."
              className="flex-1 bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-3 sports-font text-sm text-[var(--vintage-cream)] placeholder-[#555] focus:outline-none focus:border-[#555]"
              autoFocus
            />
            <button
              onClick={handleGuess}
              disabled={!guessInput.trim()}
              className="px-6 py-3 rounded-lg sports-font text-sm text-white disabled:opacity-50 transition-all"
              style={{ backgroundColor: accentColor }}
            >
              Guess
            </button>
          </div>

          {feedbackMsg && (
            <div className={`text-center sports-font text-sm ${feedbackType === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
              {feedbackMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={handleRevealYears}
              disabled={yearsRevealed}
              className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3d3d3d] text-[var(--vintage-cream)] hover:border-[#555] disabled:opacity-30 transition-all"
            >
              {yearsRevealed ? 'Years Shown' : 'Show Years (-3)'}
            </button>
            <button
              onClick={handleRevealBio}
              disabled={bioRevealed}
              className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3d3d3d] text-[var(--vintage-cream)] hover:border-[#555] disabled:opacity-30 transition-all"
            >
              {bioRevealed ? 'Bio Shown' : 'Show Bio (-3)'}
            </button>
            <button
              onClick={handleRevealInitials}
              disabled={initialsRevealed}
              className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3d3d3d] text-[var(--vintage-cream)] hover:border-[#555] disabled:opacity-30 transition-all"
            >
              {initialsRevealed ? 'Initials Shown' : 'Show Initials (-10)'}
            </button>
            <button
              onClick={handleGiveUp}
              className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-red-900/50 text-red-400 hover:border-red-700 transition-all"
            >
              Give Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
