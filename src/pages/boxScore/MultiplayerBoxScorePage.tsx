/**
 * MultiplayerBoxScorePage.tsx — Multiplayer Box Score gameplay.
 *
 * All players see the same game (game_id from career_state), fill in names
 * simultaneously within the timer. Per-box dots show teammate progress.
 * Score = correct player names + (1 if spread correct). Timer expiry auto-submits.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { EmoteOverlay } from '../../components/multiplayer/EmoteOverlay';
import { HomeButton } from '../../components/multiplayer/HomeButton';
import {
  findLobbyByCode,
  getLobbyPlayers,
  updateLobbyStatus,
  updateCareerState,
  updatePlayerScore,
} from '../../services/lobby';
import { loadBoxScoreYear, type BoxScoreGame } from '../../services/boxScoreData';
import { fetchStaticNFLSeasonPlayers } from '../../services/roster';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import {
  GAME_TYPE_LABELS, getTeamColor, cleanJersey, getInitials, scoreMatch, bk,
} from '../../components/boxScore/boxScoreHelpers';
import { FlipReveal }    from '../../components/boxScore/FlipReveal';
import { SectionHeader } from '../../components/boxScore/SectionHeader';
import { TeamLogo }      from '../../components/boxScore/TeamLogo';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerEntry {
  key: string; name: string; side: 'home' | 'away';
  category: 'passing' | 'rushing' | 'receiving'; index: number; number: string;
}

interface BoxScoreCareerState {
  type: 'box_score';
  game_id: string;
  season: number;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MultiplayerBoxScorePage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers } = useLobbyStore();

  useLobbySubscription(lobby?.id || null);

  const careerState = lobby?.career_state as BoxScoreCareerState | null;

  // Game state
  const [game, setGame] = useState<BoxScoreGame | null>(null);
  const [seasonPlayers, setSeasonPlayers] = useState<{ id: string; name: string }[]>([]);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [spreadGuess, setSpreadGuess] = useState('');
  const [globalInput, setGlobalInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [notInGame, setNotInGame] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  // Hint state — local flag + ref for write path
  const [myHintRequestedLocal, setMyHintRequestedLocal] = useState(false);
  const myHintRequestedRef = useRef(false);

  // Refs
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasFinishedRef = useRef(false);
  const hasAdvancedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameRef = useRef<BoxScoreGame | null>(null);
  const guessesRef = useRef<Record<string, string>>({});
  const spreadGuessRef = useRef('');

  // Keep refs in sync
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { guessesRef.current = guesses; }, [guesses]);
  useEffect(() => { spreadGuessRef.current = spreadGuess; }, [spreadGuess]);

  // Sync hint request from DB (handles page refresh)
  useEffect(() => {
    const myPlayer = players.find(p => p.player_id === currentPlayerId);
    if (myPlayer && (myPlayer.guessed_players || []).includes('HINT_REQUEST')) {
      myHintRequestedRef.current = true;
      setMyHintRequestedLocal(true);
    }
  }, [players, currentPlayerId]);

  // Load lobby on mount (refresh recovery)
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

  // Load game when career_state is available
  useEffect(() => {
    if (!careerState?.game_id || !careerState?.season) return;
    loadBoxScoreYear(careerState.season)
      .then(games => {
        const g = games.find(g => g.game_id === careerState.game_id);
        if (!g) { navigate('/'); return; }
        setGame(g);
        fetchStaticNFLSeasonPlayers(g.season)
          .then(p => setSeasonPlayers(p ?? []))
          .catch(() => {});
        setTimeout(() => searchRef.current?.focus(), 200);
      })
      .catch(() => navigate('/'));
  }, [careerState?.game_id]);

  // Countdown timer
  useEffect(() => {
    if (!lobby?.started_at || !lobby?.timer_duration || finished) return;
    const endMs = new Date(lobby.started_at).getTime() + lobby.timer_duration * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && !hasFinishedRef.current) {
        handleFinish();
      }
    };
    tick();
    timerRef.current = setInterval(tick, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lobby?.started_at, lobby?.timer_duration]);

  // Host: when all players finish, set lobby to finished
  const allPlayersFinished = players.length > 0 && players.every(p => p.finished_at !== null);
  useEffect(() => {
    if (allPlayersFinished && isHost && lobby?.status === 'playing' && !hasAdvancedRef.current) {
      hasAdvancedRef.current = true;
      updateLobbyStatus(lobby.id, 'finished');
    }
  }, [allPlayersFinished, isHost, lobby?.status]);

  // Navigate when lobby finishes
  useEffect(() => {
    if (lobby?.status === 'finished' && gameRef.current) {
      navigate(`/lobby/${code}/box-score/results`, {
        state: {
          game: gameRef.current,
          myGuesses: guessesRef.current,
          mySpreadGuess: spreadGuessRef.current,
        },
      });
    }
  }, [lobby?.status]);

  // ── Abandoned by host — return everyone to home ──
  useEffect(() => {
    if ((lobby?.career_state as { abandoned?: boolean } | null)?.abandoned) navigate('/');
  }, [(lobby?.career_state as { abandoned?: boolean } | null)?.abandoned]);

  async function handleEndGame() {
    if (!lobby) return;
    await updateCareerState(lobby.id, { abandoned: true });
    await updateLobbyStatus(lobby.id, 'waiting');
  }

  // Build guessed_players entries from guesses
  function buildGuessedEntries(g: BoxScoreGame | null, gs: Record<string, string>): string[] {
    if (!g) return [];
    const entries: string[] = [];
    for (const side of ['home', 'away'] as const) {
      for (const cat of ['passing', 'rushing', 'receiving'] as const) {
        (g.box_score[side][cat] as any[]).forEach((p, i) => {
          const key = bk(side, cat, i);
          if ((gs[key] ?? '') && areSimilarNames(gs[key], p.name)) {
            entries.push(`BOX:${key}:${p.name}`);
          }
        });
      }
    }
    return entries;
  }

  const handleFinish = useCallback(() => {
    if (hasFinishedRef.current || !lobby) return;
    hasFinishedRef.current = true;
    setFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const g = gameRef.current;
    const gs = guessesRef.current;
    const sg = spreadGuessRef.current;
    const entries = buildGuessedEntries(g, gs);
    const boxCount = entries.length;
    const spreadOk = g?.spread_line != null && sg !== ''
      && Math.abs(parseFloat(sg) - (g?.spread_line ?? 0)) <= 0.5;
    const score = boxCount + (spreadOk ? 3 : 0);
    const guessedArr: string[] = myHintRequestedRef.current ? [...entries, 'HINT_REQUEST'] : [...entries];
    if (sg !== '') guessedArr.push(`SPREAD:${sg}`);

    updatePlayerScore(lobby.id, score, boxCount, guessedArr, [], true);
  }, [lobby]);

  // Flat player list
  const allPlayers = useMemo((): PlayerEntry[] => {
    if (!game) return [];
    const out: PlayerEntry[] = [];
    for (const side of ['home', 'away'] as const)
      for (const cat of ['passing', 'rushing', 'receiving'] as const)
        (game.box_score[side][cat] as any[]).forEach((p, i) =>
          out.push({ key: bk(side, cat, i), name: p.name, side, category: cat, index: i, number: p.number || '' })
        );
    return out;
  }, [game]);

  function isCorrect(side: 'home' | 'away', cat: string, i: number, name: string): boolean {
    const g = guesses[bk(side, cat, i)] ?? '';
    return !!g && areSimilarNames(g, name);
  }

  // Candidates from season players (don't reveal who's in game)
  const candidates = useMemo(() => {
    if (!globalInput.trim() || globalInput.length < 2) return [];
    const pool = seasonPlayers.length > 0 ? seasonPlayers : allPlayers;
    return pool
      .map(p => ({ name: p.name, score: scoreMatch(globalInput, p.name) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [globalInput, seasonPlayers, allPlayers]);

  // Confirm candidate — fills ALL matching rows
  function confirmCandidate(name: string) {
    const matches = allPlayers.filter(p => areSimilarNames(name, p.name));
    if (matches.length === 0) {
      setNotInGame(name);
      setGlobalInput('');
      setTimeout(() => { setNotInGame(null); searchRef.current?.focus(); }, 1800);
      return;
    }

    const newGuesses = { ...guessesRef.current };
    matches.forEach(m => { newGuesses[m.key] = m.name; });
    setGuesses(newGuesses);
    setGlobalInput('');
    setShowDropdown(false);
    setTimeout(() => rowRefs.current[matches[0].key]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    searchRef.current?.focus();

    // Sync score to Supabase
    if (!lobby || hasFinishedRef.current) return;
    const entries = buildGuessedEntries(gameRef.current, newGuesses);
    const boxCount = entries.length;
    const sg = spreadGuessRef.current;
    const spreadOk = gameRef.current?.spread_line != null && sg !== ''
      && Math.abs(parseFloat(sg) - (gameRef.current?.spread_line ?? 0)) <= 0.5;
    const score = boxCount + (spreadOk ? 3 : 0);
    const guessedArr = myHintRequestedRef.current ? [...entries, 'HINT_REQUEST'] : entries;
    updatePlayerScore(lobby.id, score, boxCount, guessedArr, [], false);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmCandidate(candidates.length > 0 ? candidates[0].name : globalInput.trim());
    }
    if (e.key === 'Escape') { setGlobalInput(''); setShowDropdown(false); }
  }

  // ── Hints system ──────────────────────────────────────────────────────────
  // Hints are granted when ALL players have requested them.
  const myHintRequested = myHintRequestedLocal
    || (players.find(p => p.player_id === currentPlayerId)?.guessed_players || []).includes('HINT_REQUEST');
  const hintVotes = players.filter(p => (p.guessed_players || []).includes('HINT_REQUEST')).length;
  const hintsGranted = players.length > 0 && hintVotes === players.length;

  function requestHints() {
    if (myHintRequestedRef.current || !lobby || hasFinishedRef.current || finished) return;
    myHintRequestedRef.current = true;
    setMyHintRequestedLocal(true);
    const entries = buildGuessedEntries(gameRef.current, guessesRef.current);
    const boxCount = entries.length;
    const sg = spreadGuessRef.current;
    const spreadOk = gameRef.current?.spread_line != null && sg !== ''
      && Math.abs(parseFloat(sg) - (gameRef.current?.spread_line ?? 0)) <= 0.5;
    const score = boxCount + (spreadOk ? 3 : 0);
    updatePlayerScore(lobby.id, score, boxCount, [...entries, 'HINT_REQUEST'], [], false);
  }

  // Count teammates who solved a given box key
  function teammateCount(key: string): number {
    return players.filter(p =>
      p.player_id !== currentPlayerId &&
      (p.guessed_players || []).some((e: string) => e.startsWith(`BOX:${key}:`))
    ).length;
  }

  // Score tally
  let totalRows = 0, correctCount = 0;
  if (game) {
    for (const side of ['home', 'away'] as const)
      for (const cat of ['passing', 'rushing', 'receiving'] as const) {
        const rows = game.box_score[side][cat] as any[];
        totalRows += rows.length;
        rows.forEach((p, i) => { if (isCorrect(side, cat, i, p.name)) correctCount++; });
      }
  }
  const spreadOk = game?.spread_line != null && spreadGuess !== ''
    && Math.abs(parseFloat(spreadGuess) - (game?.spread_line ?? 0)) <= 0.5;

  const homeColor = game ? getTeamColor(game.home_team) : '#4a4a4a';
  const awayColor = game ? getTeamColor(game.away_team) : '#4a4a4a';
  const currentPlayerName = players.find(p => p.player_id === currentPlayerId)?.player_name;
  const doneCount = players.filter(p => p.finished_at !== null).length;

  const timerColor = timeLeft === null ? '#f59e0b'
    : timeLeft > 60 ? '#4ade80'
    : timeLeft > 30 ? '#f59e0b'
    : '#ef4444';

  if (!game) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#f59e0b] border-t-transparent rounded-full animate-spin" />
          <span className="sports-font text-[#666] tracking-[0.4em] text-xs">LOADING GAME</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: '#080808' }}>
      {lobby && (
        <EmoteOverlay lobbyId={lobby.id} currentPlayerId={currentPlayerId} currentPlayerName={currentPlayerName} />
      )}

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-30 border-b border-white/6" style={{ background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-5xl mx-auto px-3 py-2.5 flex items-center gap-2">
          {/* Timer */}
          <div className="shrink-0 min-w-[56px] text-center">
            <div className="retro-title text-2xl tabular-nums leading-none" style={{ color: timerColor }}>
              {timeLeft === null ? '--'
                : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
            </div>
          </div>

          <div className="flex-1 text-center">
            <span className="retro-title text-lg tracking-widest" style={{ color: '#f59e0b' }}>BOX SCORE</span>
          </div>

          {/* Score pill */}
          <div className="flex items-center gap-2 shrink-0">
            <HomeButton isHost={isHost} onEndGame={handleEndGame} />
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/10">
              <span className="retro-title text-xl tabular-nums" style={{ color: '#f59e0b' }}>{correctCount}</span>
              <span className="sports-font text-xs text-[#444]">/{totalRows}</span>
              {finished && spreadOk && <span className="sports-font text-[10px] text-green-400 ml-0.5">+S</span>}
            </div>
          </div>
        </div>

        {/* Player status strip */}
        <div className="border-t border-white/4 px-3 py-1.5 flex gap-1.5 overflow-x-auto">
          {players.map(p => {
            const isMe = p.player_id === currentPlayerId;
            const done = p.finished_at !== null;
            const score = p.score || 0;
            return (
              <div
                key={p.player_id}
                className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded sports-font text-[10px] ${
                  done && score > 0
                    ? 'bg-green-900/20 border border-green-700/30 text-green-400'
                    : done
                    ? 'bg-red-900/15 border border-red-900/30 text-red-400/80'
                    : isMe
                    ? 'bg-white/5 border border-white/10 text-white'
                    : 'text-[#555]'
                }`}
              >
                {p.player_name}{isMe ? ' (you)' : ''}
                {done && (
                  <span className="text-[10px] ml-0.5">{score > 0 ? `✓${score}` : '✗'}</span>
                )}
                {!done && !isMe && (
                  <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin opacity-50 ml-0.5" />
                )}
              </div>
            );
          })}
          <div className="shrink-0 sports-font text-[10px] text-[#444] self-center ml-auto whitespace-nowrap">
            {doneCount}/{players.length} done
          </div>
        </div>

        {/* Row 3: Search bar */}
        {!finished && (
          <div className="border-t border-white/4 px-3 py-2 relative">
            <div
              className="flex items-center gap-2.5 rounded-xl px-3 py-2"
              style={{ background: '#111', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="#f59e0b" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={globalInput}
                onChange={e => { setGlobalInput(e.target.value); setShowDropdown(true); }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
                placeholder="Type a player name..."
                className="flex-1 min-w-0 bg-transparent sports-font text-sm text-white placeholder-[#3a3a3a] focus:outline-none"
              />
              {globalInput && (
                <button
                  onClick={() => { setGlobalInput(''); searchRef.current?.focus(); }}
                  className="text-[#555] hover:text-white transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <AnimatePresence>
              {showDropdown && candidates.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  className="absolute left-3 right-3 top-full mt-0.5 rounded-xl overflow-hidden shadow-2xl z-50"
                  style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {candidates.map((c, i) => (
                    <button
                      key={c.name + i}
                      onMouseDown={() => confirmCandidate(c.name)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5 ${i > 0 ? 'border-t border-white/5' : ''}`}
                    >
                      <span className="sports-font text-sm text-white font-semibold flex-1 min-w-0 truncate">{c.name}</span>
                      <svg className="w-3.5 h-3.5 text-[#444] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4 space-y-4">

        {/* ── Scoreboard ── */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${awayColor}28 0%, #111 40%, #111 60%, ${homeColor}28 100%)`,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: awayColor, opacity: 0.18 }} />
          <div className="absolute -right-16 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: homeColor, opacity: 0.18 }} />
          <div className="relative flex items-center justify-between px-4 sm:px-8 py-5">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <TeamLogo abbr={game.away_team} className="w-14 h-14 sm:w-20 sm:h-20 object-contain" />
              <span className="retro-title text-xl sm:text-3xl leading-none" style={{ color: awayColor }}>{game.away_team}</span>
              <span className="retro-title text-5xl sm:text-6xl text-white leading-none tabular-nums">{game.away_score}</span>
              <span className="sports-font text-[9px] text-[#666] tracking-widest uppercase">Away</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 px-2">
              {game.overtime && (
                <span className="px-2 py-0.5 rounded-full sports-font text-[10px]"
                  style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }}>OT</span>
              )}
              <div className="sports-font text-[11px] text-[#444] tracking-[0.4em]">FINAL</div>
              <div className="sports-font text-[10px] text-[#555] text-center leading-snug">
                {GAME_TYPE_LABELS[game.game_type] ?? game.game_type}<br />WK {game.week}
              </div>
              <div className="sports-font text-[9px] text-[#444]">{game.season}</div>
            </div>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <TeamLogo abbr={game.home_team} className="w-14 h-14 sm:w-20 sm:h-20 object-contain" />
              <span className="retro-title text-xl sm:text-3xl leading-none" style={{ color: homeColor }}>{game.home_team}</span>
              <span className="retro-title text-5xl sm:text-6xl text-white leading-none tabular-nums">{game.home_score}</span>
              <span className="sports-font text-[9px] text-[#666] tracking-widest uppercase">Home</span>
            </div>
          </div>
        </div>


        {/* Not-in-game toast */}
        <AnimatePresence>
          {notInGame && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-900/40 bg-red-950/25"
            >
              <span className="sports-font text-sm text-red-400">
                <span className="font-semibold">{notInGame}</span> didn't play in this game
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Hints bar ── */}
        {!finished && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl"
            style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {hintsGranted ? (
              <span className="sports-font text-xs text-amber-400 font-semibold">
                💡 Hints active — player initials shown
              </span>
            ) : (
              <>
                <span className="sports-font text-xs text-[#555]">
                  💡 Reveal initials? ({hintVotes}/{players.length} agreed)
                </span>
                <button
                  onClick={requestHints}
                  disabled={myHintRequested}
                  className={`px-4 py-1.5 rounded-lg sports-font text-xs transition-all ${
                    myHintRequested
                      ? 'bg-amber-900/20 border border-amber-700/30 text-amber-400/60 cursor-default'
                      : 'border border-amber-600/40 text-amber-500 hover:bg-amber-900/20 hover:border-amber-500/60'
                  }`}
                >
                  {myHintRequested ? 'Requested' : 'Request Hints'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Time's up banner */}
        {finished && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-700/40 bg-amber-900/15"
          >
            <span className="sports-font text-sm text-amber-400 font-semibold">
              ⏱ Time's up! Score: {correctCount + (spreadOk ? 3 : 0)} — waiting for others...
            </span>
          </motion.div>
        )}

        {/* ── Box score columns ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['away', 'home'] as const).map(side => {
            const color = side === 'home' ? homeColor : awayColor;
            const abbr = side === 'home' ? game.home_team : game.away_team;
            const data = game.box_score[side];

            return (
              <div
                key={side}
                className="rounded-2xl overflow-hidden"
                style={{ background: `linear-gradient(160deg, ${color}12 0%, #111 30%)`, border: `1px solid ${color}30` }}
              >
                {/* Team header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b"
                  style={{ background: `linear-gradient(90deg, ${color}25 0%, transparent 80%)`, borderColor: `${color}20` }}
                >
                  <TeamLogo abbr={abbr} className="w-9 h-9 object-contain shrink-0" />
                  <div>
                    <div className="retro-title text-xl leading-none" style={{ color }}>{abbr}</div>
                    <div className="sports-font text-[9px] text-[#555] tracking-widest uppercase mt-0.5">{side}</div>
                  </div>
                  {/* Mini progress */}
                  <div className="ml-auto flex items-center gap-1.5">
                    {(['passing', 'rushing', 'receiving'] as const).map(cat => {
                      const rows = data[cat] as any[];
                      const done = rows.filter((p, i) => isCorrect(side, cat, i, p.name)).length;
                      return rows.length > 0 ? (
                        <div key={cat} className="text-center">
                          <div className="sports-font text-[8px] tracking-wider" style={{ color: done === rows.length ? '#4ade80' : '#555' }}>
                            {done}/{rows.length}
                          </div>
                          <div className="sports-font text-[7px] text-[#3a3a3a] uppercase">{cat.slice(0, 3)}</div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                <div className="p-3 space-y-4">
                  {(['passing', 'rushing', 'receiving'] as const).map(cat => {
                    const rows = data[cat] as any[];
                    if (rows.length === 0) return null;
                    return (
                      <section key={cat}>
                        <SectionHeader label={cat.charAt(0).toUpperCase() + cat.slice(1)} color={color} />
                        {rows.map((p, i) => {
                          const key = bk(side, cat, i);
                          const correct = isCorrect(side, cat, i, p.name);
                          const jersey = cleanJersey(p.number);
                          const tmCount = teammateCount(key);
                          return (
                            <div
                              key={`${p.id}-${cat}-${i}`}
                              ref={el => { rowRefs.current[key] = el; }}
                              className="flex items-center gap-2 py-1 rounded-lg"
                            >
                              {/* Jersey badge with teammate indicator */}
                              <div
                                className="relative shrink-0 w-9 h-7 flex items-center justify-center rounded-md sports-font text-[11px] font-bold tabular-nums"
                                style={{ background: `${color}30`, color, border: `1px solid ${color}50` }}
                              >
                                {jersey ? `#${jersey}` : '–'}
                                {tmCount > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-500 border border-[#080808] flex items-center justify-center sports-font text-[8px] text-white font-bold">
                                    {tmCount}
                                  </span>
                                )}
                              </div>

                              {/* Name cell */}
                              <div className="flex-1 min-w-0">
                                <AnimatePresence mode="wait">
                                  {correct ? (
                                    <motion.div
                                      key="correct"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg truncate"
                                      style={{
                                        background: 'linear-gradient(90deg, rgba(22,163,74,0.25) 0%, rgba(22,163,74,0.08) 100%)',
                                        border: '1px solid rgba(22,163,74,0.5)',
                                        boxShadow: '0 0 12px rgba(22,163,74,0.2)',
                                      }}
                                    >
                                      <svg className="w-3 h-3 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                      <span className="sports-font text-sm font-semibold text-green-300 truncate">
                                        <FlipReveal name={p.name} />
                                      </span>
                                    </motion.div>
                                  ) : finished ? (
                                    <motion.div
                                      key="revealed"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      className="px-2.5 py-1.5 rounded-lg border border-red-900/40 bg-red-950/20 truncate"
                                    >
                                      <span className="sports-font text-sm text-red-400/80">{p.name}</span>
                                    </motion.div>
                                  ) : (
                                    <div className="flex flex-col gap-0.5">
                                      <div className="px-2.5 py-1.5 rounded-lg border border-white/6 bg-black/30">
                                        <span className="sports-font text-sm text-[#2a2a2a] select-none">████████</span>
                                      </div>
                                      {hintsGranted && (
                                        <div className="pl-1 sports-font text-[11px] tracking-widest font-mono" style={{ color: `${color}90` }}>
                                          {getInitials(p.name)}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </AnimatePresence>
                              </div>

                              {/* Stat line */}
                              <div className="shrink-0 text-right" style={{ minWidth: 72 }}>
                                {cat === 'passing' && (
                                  <span className="sports-font text-[11px] tabular-nums">
                                    <span className="text-[#ccc] font-semibold">{p.yards}yd</span>
                                    {' '}<span className={p.tds > 0 ? 'text-green-400 font-bold' : 'text-[#666]'}>{p.tds}TD</span>
                                    {p.ints > 0 && <span className="text-red-400"> {p.ints}INT</span>}
                                  </span>
                                )}
                                {cat === 'rushing' && (
                                  <span className="sports-font text-[11px] tabular-nums">
                                    <span className="text-[#ccc] font-semibold">{p.yards}yd</span>
                                    {' '}<span className={p.tds > 0 ? 'text-green-400 font-bold' : 'text-[#666]'}>{p.tds}TD</span>
                                  </span>
                                )}
                                {cat === 'receiving' && (
                                  <span className="sports-font text-[11px] tabular-nums">
                                    <span className="text-[#ccc] font-semibold">{p.yards}yd</span>
                                    {' '}<span className={p.tds > 0 ? 'text-green-400 font-bold' : 'text-[#666]'}>{p.tds}TD</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </section>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Spread ── */}
        {game.spread_line != null && (
          <div className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid rgba(245,158,11,0.2)' }}>
            <SectionHeader label="Vegas Spread" color="#f59e0b" />
            <div className="flex items-center gap-3 flex-wrap mt-2">
              <input
                type="number" step="0.5"
                value={spreadGuess}
                onChange={e => {
                  const v = e.target.value;
                  setSpreadGuess(v);
                  if (!lobby || hasFinishedRef.current) return;
                  const sg = v;
                  const entries = buildGuessedEntries(gameRef.current, guessesRef.current);
                  const boxCount = entries.length;
                  const sok = gameRef.current?.spread_line != null && sg !== ''
                    && Math.abs(parseFloat(sg) - (gameRef.current?.spread_line ?? 0)) <= 0.5;
                  const score = boxCount + (sok ? 3 : 0);
                  const guessedArr = myHintRequestedRef.current ? [...entries, 'HINT_REQUEST'] : entries;
                  updatePlayerScore(lobby.id, score, boxCount, guessedArr, [], false);
                }}
                disabled={finished}
                placeholder="e.g. 3 or −3"
                className="w-32 bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2 sports-font text-sm text-white placeholder-[#2a2a2a] focus:outline-none focus:border-[#f59e0b]/40 disabled:opacity-40 transition-colors"
              />
              <span className="sports-font text-xs text-[#555]">+ = home favored</span>
              {finished && spreadOk && <span className="sports-font text-xs text-green-400 font-semibold">✓ correct!</span>}
            </div>
          </div>
        )}

        {/* ── Submit early / status ── */}
        <div className="pb-14">
          {!finished ? (
            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-2xl retro-title text-2xl text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${homeColor}, ${homeColor}88)`,
                boxShadow: `0 4px 24px ${homeColor}50, 0 0 0 1px ${homeColor}30`,
              }}
            >
              Submit Early
            </button>
          ) : (
            <div className="text-center sports-font text-sm text-[#555] tracking-widest">
              Waiting for {players.length - doneCount} more player{players.length - doneCount !== 1 ? 's' : ''}...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
