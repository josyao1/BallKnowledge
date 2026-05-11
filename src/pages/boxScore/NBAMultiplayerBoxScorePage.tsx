import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { EmoteOverlay } from '../../components/multiplayer/EmoteOverlay';
import { HomeButton } from '../../components/multiplayer/HomeButton';
import { updateLobbyStatus, updateCareerState, updatePlayerScore } from '../../services/lobby';
import { loadNBABoxScoreYear, getNBASeasonPlayerPool, type NBABoxScoreGame } from '../../services/nbaBoxScoreData';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import { getNBATeamColor, cleanJersey, getInitials, scoreMatch, nbk } from '../../components/boxScore/boxScoreHelpers';
import { FlipReveal } from '../../components/boxScore/FlipReveal';
import { SectionHeader } from '../../components/boxScore/SectionHeader';
import { NBATeamLogo } from '../../components/boxScore/NBATeamLogo';
import { NBAStatLine, computeLeaders } from '../../components/boxScore/NBAStatLine';
import { NBAScoreboard } from '../../components/boxScore/NBAScoreboard';

interface NBABoxScoreCareerState {
  type: 'nba_box_score';
  game_id: string;
  season: number;
}

export function NBAMultiplayerBoxScorePage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, isHost, currentPlayerId } = useMultiplayerGame({ code });

  const careerState = lobby?.career_state as NBABoxScoreCareerState | null;

  const [game,          setGame]          = useState<NBABoxScoreGame | null>(null);
  const [seasonPlayers, setSeasonPlayers] = useState<{ name: string }[]>([]);
  const [guesses,       setGuesses]       = useState<Record<string, string>>({});
  const [globalInput,   setGlobalInput]   = useState('');
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [notInGame,     setNotInGame]     = useState<string | null>(null);
  const [timeLeft,      setTimeLeft]      = useState<number | null>(null);
  const [finished,      setFinished]      = useState(false);

  const [myHintRequestedLocal, setMyHintRequestedLocal] = useState(false);
  const myHintRequestedRef = useRef(false);

  const searchRef       = useRef<HTMLInputElement>(null);
  const rowRefs         = useRef<Record<string, HTMLDivElement | null>>({});
  const hasFinishedRef  = useRef(false);
  const hasAdvancedRef  = useRef(false);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameRef         = useRef<NBABoxScoreGame | null>(null);
  const guessesRef      = useRef<Record<string, string>>({});

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { guessesRef.current = guesses; }, [guesses]);

  useEffect(() => {
    const myPlayer = players.find(p => p.player_id === currentPlayerId);
    if (myPlayer && (myPlayer.guessed_players || []).includes('HINT_REQUEST')) {
      myHintRequestedRef.current = true;
      setMyHintRequestedLocal(true);
    }
  }, [players, currentPlayerId]);

  useEffect(() => {
    if (!careerState?.game_id || !careerState?.season) return;
    loadNBABoxScoreYear(careerState.season)
      .then(games => {
        const g = games.find(g => g.game_id === careerState.game_id);
        if (!g) { navigate('/'); return; }
        setGame(g);
        getNBASeasonPlayerPool(g.season).then(setSeasonPlayers).catch(() => {});
        setTimeout(() => searchRef.current?.focus(), 200);
      })
      .catch(() => navigate('/'));
  }, [careerState?.game_id]);

  useEffect(() => {
    if (!lobby?.started_at || !lobby?.timer_duration || finished) return;
    const endMs = new Date(lobby.started_at).getTime() + lobby.timer_duration * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && !hasFinishedRef.current) handleFinish();
    };
    tick();
    timerRef.current = setInterval(tick, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lobby?.started_at, lobby?.timer_duration]);

  const allPlayersFinished = players.length > 0 && players.every(p => p.finished_at !== null);
  useEffect(() => {
    if (allPlayersFinished && isHost && lobby?.status === 'playing' && !hasAdvancedRef.current) {
      hasAdvancedRef.current = true;
      updateLobbyStatus(lobby.id, 'finished');
    }
  }, [allPlayersFinished, isHost, lobby?.status]);

  useEffect(() => {
    if (lobby?.status === 'finished' && gameRef.current) {
      navigate(`/lobby/${code}/nba-box-score/results`, { state: { game: gameRef.current, myGuesses: guessesRef.current } });
    }
  }, [lobby?.status]);

  useEffect(() => {
    if ((lobby?.career_state as { abandoned?: boolean } | null)?.abandoned) navigate('/');
  }, [(lobby?.career_state as { abandoned?: boolean } | null)?.abandoned]);

  async function handleEndGame() {
    if (!lobby) return;
    await updateCareerState(lobby.id, { abandoned: true });
    await updateLobbyStatus(lobby.id, 'waiting');
  }

  function buildGuessedEntries(g: NBABoxScoreGame | null, gs: Record<string, string>): string[] {
    if (!g) return [];
    const entries: string[] = [];
    for (const side of ['home', 'away'] as const)
      g.box_score[side].forEach((p, i) => {
        const key = nbk(side, i);
        if (gs[key] && areSimilarNames(gs[key], p.name)) entries.push(`BOX:${key}:${p.name}`);
      });
    return entries;
  }

  const handleFinish = useCallback(() => {
    if (hasFinishedRef.current || !lobby) return;
    hasFinishedRef.current = true;
    setFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const entries  = buildGuessedEntries(gameRef.current, guessesRef.current);
    const score    = entries.length;
    const guessedArr = myHintRequestedRef.current ? [...entries, 'HINT_REQUEST'] : [...entries];
    updatePlayerScore(lobby.id, score, score, guessedArr, [], true);
  }, [lobby]);

  const allPlayers = useMemo(() => {
    if (!game) return [] as { key: string; name: string; side: 'home' | 'away'; index: number; number: string }[];
    const out: { key: string; name: string; side: 'home' | 'away'; index: number; number: string }[] = [];
    for (const side of ['home', 'away'] as const)
      game.box_score[side].forEach((p, i) => out.push({ key: nbk(side, i), name: p.name, side, index: i, number: p.number || '' }));
    return out;
  }, [game]);

  function isCorrect(side: 'home' | 'away', i: number, name: string) {
    const g = guesses[nbk(side, i)] ?? '';
    return !!g && areSimilarNames(g, name);
  }

  const candidates = useMemo(() => {
    if (!globalInput.trim() || globalInput.length < 2) return [];
    const pool = seasonPlayers.length > 0 ? seasonPlayers : allPlayers;
    return pool.map(p => ({ name: p.name, score: scoreMatch(globalInput, p.name) }))
      .filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  }, [globalInput, seasonPlayers, allPlayers]);

  function confirmCandidate(name: string) {
    const matches = allPlayers.filter(p => areSimilarNames(name, p.name));
    if (matches.length === 0) {
      setNotInGame(name); setGlobalInput('');
      setTimeout(() => { setNotInGame(null); searchRef.current?.focus(); }, 1800);
      return;
    }
    const newGuesses = { ...guessesRef.current };
    matches.forEach(m => { newGuesses[m.key] = m.name; });
    setGuesses(newGuesses); setGlobalInput(''); setShowDropdown(false);
    setTimeout(() => rowRefs.current[matches[0].key]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    searchRef.current?.focus();

    if (!lobby || hasFinishedRef.current) return;
    const entries = buildGuessedEntries(gameRef.current, newGuesses);
    const guessedArr = myHintRequestedRef.current ? [...entries, 'HINT_REQUEST'] : entries;
    updatePlayerScore(lobby.id, entries.length, entries.length, guessedArr, [], false);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); confirmCandidate(candidates.length > 0 ? candidates[0].name : globalInput.trim()); }
    if (e.key === 'Escape') { setGlobalInput(''); setShowDropdown(false); }
  }

  const myHintRequested = myHintRequestedLocal
    || (players.find(p => p.player_id === currentPlayerId)?.guessed_players || []).includes('HINT_REQUEST');
  const hintVotes    = players.filter(p => (p.guessed_players || []).includes('HINT_REQUEST')).length;
  const hintsGranted = players.length > 0 && hintVotes === players.length;

  function requestHints() {
    if (myHintRequestedRef.current || !lobby || hasFinishedRef.current || finished) return;
    myHintRequestedRef.current = true; setMyHintRequestedLocal(true);
    const entries = buildGuessedEntries(gameRef.current, guessesRef.current);
    updatePlayerScore(lobby.id, entries.length, entries.length, [...entries, 'HINT_REQUEST'], [], false);
  }

  function teammateCount(key: string) {
    return players.filter(p =>
      p.player_id !== currentPlayerId &&
      (p.guessed_players || []).some((e: string) => e.startsWith(`BOX:${key}:`))
    ).length;
  }

  let totalRows = 0, correctCount = 0;
  if (game) {
    for (const side of ['home', 'away'] as const) {
      totalRows += game.box_score[side].length;
      game.box_score[side].forEach((p, i) => { if (isCorrect(side, i, p.name)) correctCount++; });
    }
  }

  const homeColor = game ? getNBATeamColor(game.home_team) : '#4a4a4a';
  const awayColor = game ? getNBATeamColor(game.away_team) : '#4a4a4a';
  const currentPlayerName = players.find(p => p.player_id === currentPlayerId)?.player_name;
  const doneCount = players.filter(p => p.finished_at !== null).length;
  const timerColor = timeLeft === null ? '#f59e0b' : timeLeft > 60 ? '#4ade80' : timeLeft > 30 ? '#f59e0b' : '#ef4444';

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
      {lobby && <EmoteOverlay lobbyId={lobby.id} currentPlayerId={currentPlayerId} currentPlayerName={currentPlayerName} />}

      <header className="sticky top-0 z-30 border-b border-white/6" style={{ background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-5xl mx-auto px-3 py-2.5 flex items-center gap-2">
          <div className="shrink-0 min-w-[56px] text-center">
            <div className="retro-title text-2xl tabular-nums leading-none" style={{ color: timerColor }}>
              {timeLeft === null ? '--' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
            </div>
          </div>
          <div className="flex-1 text-center">
            <span className="retro-title text-lg tracking-widest" style={{ color: '#f59e0b' }}>BOX SCORE</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HomeButton isHost={isHost} onEndGame={handleEndGame} />
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/10">
              <span className="retro-title text-xl tabular-nums" style={{ color: '#f59e0b' }}>{correctCount}</span>
              <span className="sports-font text-xs text-[#444]">/{totalRows}</span>
            </div>
          </div>
        </div>

        {/* Player status strip */}
        <div className="border-t border-white/4 px-3 py-1.5 flex gap-1.5 overflow-x-auto">
          {players.map(p => {
            const isMe = p.player_id === currentPlayerId;
            const done = p.finished_at !== null;
            return (
              <div key={p.player_id} className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded sports-font text-[10px] ${
                done && (p.score || 0) > 0 ? 'bg-green-900/20 border border-green-700/30 text-green-400'
                : done ? 'bg-red-900/15 border border-red-900/30 text-red-400/80'
                : isMe ? 'bg-white/5 border border-white/10 text-white'
                : 'text-[#555]'
              }`}>
                {p.player_name}{isMe ? ' (you)' : ''}
                {done && <span className="text-[10px] ml-0.5">{(p.score || 0) > 0 ? `✓${p.score}` : '✗'}</span>}
                {!done && !isMe && <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin opacity-50 ml-0.5" />}
              </div>
            );
          })}
          <div className="shrink-0 sports-font text-[10px] text-[#444] self-center ml-auto whitespace-nowrap">{doneCount}/{players.length} done</div>
        </div>

        {/* Search bar */}
        {!finished && (
          <div className="border-t border-white/4 px-3 py-2 relative">
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: '#111', border: '1px solid rgba(245,158,11,0.2)' }}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="#f59e0b" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input ref={searchRef} type="text" value={globalInput}
                onChange={e => { setGlobalInput(e.target.value); setShowDropdown(true); }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
                placeholder="Type a player name..."
                className="flex-1 min-w-0 bg-transparent sports-font text-sm text-white placeholder-[#3a3a3a] focus:outline-none"
              />
              {globalInput && (
                <button onClick={() => { setGlobalInput(''); searchRef.current?.focus(); }} className="text-[#555] hover:text-white transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <AnimatePresence>
              {showDropdown && candidates.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.14 }}
                  className="absolute left-3 right-3 top-full mt-0.5 rounded-xl overflow-hidden shadow-2xl z-50"
                  style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {candidates.map((c, i) => (
                    <button key={c.name + i} onMouseDown={() => confirmCandidate(c.name)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5 ${i > 0 ? 'border-t border-white/5' : ''}`}>
                      <span className="sports-font text-sm text-white font-semibold flex-1 min-w-0 truncate">{c.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4 space-y-4">

        <NBAScoreboard game={game} compact />

        <AnimatePresence>
          {notInGame && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-900/40 bg-red-950/25">
              <span className="sports-font text-sm text-red-400"><span className="font-semibold">{notInGame}</span> didn't play in this game</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hints bar */}
        {!finished && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)' }}>
            {hintsGranted ? (
              <span className="sports-font text-xs text-amber-400 font-semibold">💡 Hints active — player initials shown</span>
            ) : (
              <>
                <span className="sports-font text-xs text-[#555]">💡 Reveal initials? ({hintVotes}/{players.length} agreed)</span>
                <button onClick={requestHints} disabled={myHintRequested}
                  className={`px-4 py-1.5 rounded-lg sports-font text-xs transition-all ${myHintRequested ? 'bg-amber-900/20 border border-amber-700/30 text-amber-400/60 cursor-default' : 'border border-amber-600/40 text-amber-500 hover:bg-amber-900/20'}`}>
                  {myHintRequested ? 'Requested' : 'Request Hints'}
                </button>
              </>
            )}
          </div>
        )}

        {finished && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-700/40 bg-amber-900/15">
            <span className="sports-font text-sm text-amber-400 font-semibold">⏱ Time's up! Score: {correctCount} — waiting for others...</span>
          </motion.div>
        )}

        {/* Box score columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['away', 'home'] as const).map(side => {
            const color        = side === 'home' ? homeColor : awayColor;
            const abbr         = side === 'home' ? game.home_team : game.away_team;
            const players_list = game.box_score[side];
            const sideDone     = players_list.filter((p, i) => isCorrect(side, i, p.name)).length;
            const leaders      = computeLeaders(players_list);

            return (
              <div key={side} className="rounded-2xl overflow-hidden"
                style={{ background: `linear-gradient(160deg, ${color}12 0%, #111 30%)`, border: `1px solid ${color}30` }}>
                <div className="flex items-center gap-3 px-4 py-3 border-b"
                  style={{ background: `linear-gradient(90deg, ${color}25 0%, transparent 80%)`, borderColor: `${color}20` }}>
                  <NBATeamLogo abbr={abbr} className="w-9 h-9 object-contain shrink-0" />
                  <div>
                    <div className="retro-title text-xl leading-none" style={{ color }}>{abbr}</div>
                    <div className="sports-font text-[9px] text-[#555] tracking-widest uppercase mt-0.5">{side}</div>
                  </div>
                  <div className="ml-auto">
                    <div className="sports-font text-[10px] tracking-wider" style={{ color: sideDone === players_list.length ? '#4ade80' : '#555' }}>
                      {sideDone}/{players_list.length}
                    </div>
                  </div>
                </div>

                <div className="p-3">
                  <SectionHeader label="Players" color={color} />
                  {players_list.map((p, i) => {
                    const key     = nbk(side, i);
                    const correct = isCorrect(side, i, p.name);
                    const jersey  = cleanJersey(p.number);
                    const tmCount = teammateCount(key);
                    return (
                      <div key={`${p.id}-${i}`} ref={el => { rowRefs.current[key] = el; }}
                        className="flex items-center gap-2 py-1 rounded-lg">
                        <div className="relative shrink-0 w-9 h-7 flex items-center justify-center rounded-md sports-font text-[11px] font-bold tabular-nums"
                          style={{ background: `${color}30`, color, border: `1px solid ${color}50` }}>
                          {jersey ? `#${jersey}` : '–'}
                          {tmCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-500 border border-[#080808] flex items-center justify-center sports-font text-[8px] text-white font-bold">{tmCount}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <AnimatePresence mode="wait">
                            {correct ? (
                              <motion.div key="correct" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                                style={{ background: 'linear-gradient(90deg, rgba(22,163,74,0.25) 0%, rgba(22,163,74,0.08) 100%)', border: '1px solid rgba(22,163,74,0.5)' }}>
                                <svg className="w-3 h-3 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span className="sports-font text-sm font-semibold text-green-300 truncate"><FlipReveal name={p.name} /></span>
                              </motion.div>
                            ) : finished ? (
                              <motion.div key="revealed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="px-2.5 py-1.5 rounded-lg border border-red-900/40 bg-red-950/20 truncate">
                                <span className="sports-font text-sm text-red-400/80">{p.name}</span>
                              </motion.div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <div className="px-2.5 py-1.5 rounded-lg border border-white/6 bg-black/30">
                                  <span className="sports-font text-sm text-[#2a2a2a] select-none">████████</span>
                                </div>
                                {hintsGranted && (
                                  <div className="pl-1 sports-font text-[11px] tracking-widest font-mono" style={{ color: `${color}90` }}>{getInitials(p.name)}</div>
                                )}
                              </div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="shrink-0 text-right" style={{ minWidth: 88 }}>
                          <NBAStatLine player={p} leaders={leaders} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pb-14">
          {!finished ? (
            <button onClick={handleFinish}
              className="w-full py-4 rounded-2xl retro-title text-2xl text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${homeColor}, ${homeColor}88)`, boxShadow: `0 4px 24px ${homeColor}50, 0 0 0 1px ${homeColor}30` }}>
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
