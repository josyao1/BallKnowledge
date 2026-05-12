import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getRandomNBABoxScoreGame,
  getNBASeasonPlayerPool,
  ALL_NBA_BOX_SCORE_YEARS,
  type NBABoxScoreGame,
} from '../../services/nbaBoxScoreData';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import { getNBATeamColor, cleanJersey, getInitials, scoreMatch, nbk } from '../../components/boxScore/boxScoreHelpers';
import { FlipReveal } from '../../components/boxScore/FlipReveal';
import { SectionHeader } from '../../components/boxScore/SectionHeader';
import { NBATeamLogo } from '../../components/boxScore/NBATeamLogo';
import { NBAStatLine, computeLeaders } from '../../components/boxScore/NBAStatLine';
import { NBAScoreboard } from '../../components/boxScore/NBAScoreboard';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NBABoxFilters = { minYear: number; maxYear: number; team: string | null };

interface PlayerEntry {
  key: string; name: string; side: 'home' | 'away'; index: number; number: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildYearRange(min: number, max: number): number[] {
  const out: number[] = [];
  for (let y = min; y <= max; y++) if (ALL_NBA_BOX_SCORE_YEARS.includes(y)) out.push(y);
  return out.length > 0 ? out : ALL_NBA_BOX_SCORE_YEARS;
}

// ─── Player row ───────────────────────────────────────────────────────────────

interface RowProps {
  playerName: string; number: string;
  correct: boolean; revealed: boolean; teamColor: string;
  guess: string; onGuessChange: (v: string) => void;
  rowRef: (el: HTMLDivElement | null) => void;
  statLine: React.ReactNode;
  showHint?: boolean;
}

function PlayerRow({ playerName, number, correct, revealed, teamColor, guess, onGuessChange, rowRef, statLine, showHint }: RowProps) {
  const jersey = cleanJersey(number);
  return (
    <div ref={rowRef} className="flex items-center gap-2 py-1 rounded-lg">
      <div
        className="shrink-0 w-9 h-7 flex items-center justify-center rounded-md sports-font text-[11px] font-bold tabular-nums"
        style={{ background: `${teamColor}30`, color: teamColor, border: `1px solid ${teamColor}50` }}
      >
        {jersey ? `#${jersey}` : '–'}
      </div>

      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {correct ? (
            <motion.div
              key="correct"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{
                background: 'linear-gradient(90deg, rgba(22,163,74,0.25) 0%, rgba(22,163,74,0.08) 100%)',
                border: '1px solid rgba(22,163,74,0.5)',
                boxShadow: '0 0 12px rgba(22,163,74,0.2)',
              }}
            >
              <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="sports-font text-sm font-semibold text-green-300">
                <FlipReveal name={playerName} />
              </span>
            </motion.div>
          ) : revealed ? (
            <motion.div
              key="revealed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-3 py-1.5 rounded-lg border border-red-900/40 bg-red-950/20"
            >
              <span className="sports-font text-sm text-red-400/80">{playerName}</span>
            </motion.div>
          ) : (
            <div key="input" className="flex flex-col gap-0.5">
              <input
                type="text"
                value={guess}
                onChange={e => onGuessChange(e.target.value)}
                placeholder="Player name..."
                className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-1.5 sports-font text-sm text-white placeholder-[#2a2a2a] focus:outline-none transition-colors"
                onFocus={e => (e.currentTarget.style.borderColor = `${teamColor}60`)}
                onBlur={e => (e.currentTarget.style.borderColor = '')}
              />
              {showHint && (
                <div className="pl-1 sports-font text-[11px] tracking-widest font-mono" style={{ color: `${teamColor}90` }}>
                  {getInitials(playerName)}
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 text-right" style={{ minWidth: 96 }}>
        {statLine}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function NBABoxScoreGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const filters: NBABoxFilters = (location.state as NBABoxFilters | null) ?? { minYear: 2014, maxYear: 2025, team: null };

  const [loading,       setLoading]       = useState(true);
  const [game,          setGame]          = useState<NBABoxScoreGame | null>(null);
  const [seasonPlayers, setSeasonPlayers] = useState<{ name: string }[]>([]);
  const [guesses,       setGuesses]       = useState<Record<string, string>>({});
  const [revealed,      setRevealed]      = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(false);
  const [globalInput,   setGlobalInput]   = useState('');
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [notInGame,     setNotInGame]     = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs   = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const years = buildYearRange(filters.minYear, filters.maxYear);
    getRandomNBABoxScoreGame({ years, team: filters.team ?? undefined })
      .then(g => {
        setGame(g);
        getNBASeasonPlayerPool(g.season).then(setSeasonPlayers).catch(() => {});
        setLoading(false);
        setTimeout(() => searchRef.current?.focus(), 120);
      })
      .catch(() => navigate('/'));
  }, []);

  const allPlayers = useMemo((): PlayerEntry[] => {
    if (!game) return [];
    const out: PlayerEntry[] = [];
    for (const side of ['home', 'away'] as const)
      game.box_score[side].forEach((p, i) =>
        out.push({ key: nbk(side, i), name: p.name, side, index: i, number: p.number || '' })
      );
    return out;
  }, [game]);

  function isCorrect(side: 'home' | 'away', i: number, name: string): boolean {
    const g = guesses[nbk(side, i)] ?? '';
    return !!g && areSimilarNames(g, name);
  }

  const candidates = useMemo(() => {
    if (!globalInput.trim() || globalInput.length < 2) return [];
    const pool = seasonPlayers.length > 0 ? seasonPlayers : allPlayers;
    return pool
      .map(p => ({ name: p.name, score: scoreMatch(globalInput, p.name) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [globalInput, seasonPlayers, allPlayers]);

  function confirmCandidate(name: string) {
    const matches = allPlayers.filter(p => areSimilarNames(name, p.name));
    if (matches.length === 0) {
      setNotInGame(name);
      setGlobalInput('');
      setTimeout(() => { setNotInGame(null); searchRef.current?.focus(); }, 1800);
      return;
    }
    setGuesses(prev => {
      const next = { ...prev };
      matches.forEach(m => { next[m.key] = m.name; });
      return next;
    });
    setGlobalInput('');
    setShowDropdown(false);
    setTimeout(() => rowRefs.current[matches[0].key]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    searchRef.current?.focus();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmCandidate(candidates.length > 0 ? candidates[0].name : globalInput.trim());
    }
    if (e.key === 'Escape') { setGlobalInput(''); setShowDropdown(false); }
  }

  let totalRows = 0, correctCount = 0;
  if (game) {
    for (const side of ['home', 'away'] as const) {
      totalRows += game.box_score[side].length;
      game.box_score[side].forEach((p, i) => { if (isCorrect(side, i, p.name)) correctCount++; });
    }
  }

  if (loading || !game) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#f59e0b] border-t-transparent rounded-full animate-spin" />
          <span className="sports-font text-[#666] tracking-[0.4em] text-xs">LOADING GAME</span>
        </div>
      </div>
    );
  }

  const homeColor = getNBATeamColor(game.home_team);
  const awayColor = getNBATeamColor(game.away_team);
  const pct = totalRows > 0 ? Math.round(correctCount / totalRows * 100) : 0;

  return (
    <div className="min-h-screen text-white" style={{ background: '#080808' }}>

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-30 border-b border-white/6" style={{ background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 text-[#555] hover:text-white rounded-lg hover:bg-white/5 transition-all shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <span className="retro-title text-xl tracking-widest" style={{ color: '#f59e0b' }}>BOX SCORE</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border shrink-0"
            style={{ background: `${homeColor}18`, borderColor: `${homeColor}50` }}
          >
            <span className="retro-title text-lg tabular-nums" style={{ color: '#f59e0b' }}>{correctCount}</span>
            <span className="sports-font text-xs text-[#444]">/</span>
            <span className="retro-title text-lg tabular-nums text-[#555]">{totalRows}</span>
            {totalRows > 0 && (
              <span className="sports-font text-[10px] ml-1" style={{ color: pct === 100 ? '#4ade80' : '#888' }}>{pct}%</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4 space-y-4">

        <NBAScoreboard game={game} />

        {/* ── GLOBAL SEARCH ── */}
        <div className="relative z-20">
          <div
            className="flex items-center gap-3 rounded-2xl px-5 py-4 transition-all"
            style={{
              background: 'linear-gradient(135deg, #1a1a1a, #141414)',
              border: '1px solid rgba(245,158,11,0.3)',
              boxShadow: '0 0 0 1px rgba(245,158,11,0.08), 0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="#f59e0b" strokeWidth={2} viewBox="0 0 24 24">
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
              placeholder="Type a player name — press Enter to fill the box score..."
              className="flex-1 bg-transparent sports-font text-base text-white placeholder-[#3a3a3a] focus:outline-none"
            />
            {globalInput ? (
              <button onClick={() => { setGlobalInput(''); searchRef.current?.focus(); }} className="text-[#555] hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <kbd className="hidden sm:flex sports-font text-[10px] text-[#555] px-2 py-1 rounded border border-[#2a2a2a] items-center">↵</kbd>
            )}
          </div>

          <AnimatePresence>
            {showDropdown && candidates.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden shadow-2xl z-30"
                style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {candidates.map((c, i) => (
                  <button
                    key={c.name + i}
                    onMouseDown={() => confirmCandidate(c.name)}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/5 ${i > 0 ? 'border-t border-white/5' : ''}`}
                  >
                    <svg className="w-4 h-4 text-[#555] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="sports-font text-sm text-white font-semibold flex-1">{c.name}</span>
                    <svg className="w-4 h-4 text-[#444] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Not-in-game toast */}
        <AnimatePresence>
          {notInGame && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-900/40 bg-red-950/25"
            >
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="sports-font text-sm text-red-400">
                <span className="font-semibold">{notInGame}</span> didn't play in this game
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── BOX SCORE COLUMNS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['away', 'home'] as const).map(side => {
            const color   = side === 'home' ? homeColor : awayColor;
            const abbr    = side === 'home' ? game.home_team : game.away_team;
            const players = game.box_score[side];
            const doneCount = players.filter((p, i) => isCorrect(side, i, p.name)).length;
            const leaders = computeLeaders(players);

            return (
              <div
                key={side}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: `linear-gradient(160deg, ${color}12 0%, #111 30%)`,
                  border: `1px solid ${color}30`,
                }}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b"
                  style={{ background: `linear-gradient(90deg, ${color}25 0%, transparent 80%)`, borderColor: `${color}20` }}
                >
                  <NBATeamLogo abbr={abbr} className="w-9 h-9 object-contain shrink-0" />
                  <div>
                    <div className="retro-title text-xl leading-none" style={{ color }}>{abbr}</div>
                    <div className="sports-font text-[9px] text-[#555] tracking-widest uppercase mt-0.5">{side}</div>
                  </div>
                  <div className="ml-auto">
                    <div className="sports-font text-[10px] tracking-wider" style={{ color: doneCount === players.length ? '#4ade80' : '#555' }}>
                      {doneCount}/{players.length}
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <SectionHeader label="Players" color={color} />
                  {players.map((p, i) => {
                    const key = nbk(side, i);
                    return (
                      <PlayerRow
                        key={`${p.id}-${i}`}
                        playerName={p.name}
                        number={p.number}
                        correct={isCorrect(side, i, p.name)}
                        revealed={revealed}
                        teamColor={color}
                        guess={guesses[key] ?? ''}
                        onGuessChange={v => setGuesses(prev => ({ ...prev, [key]: v }))}
                        rowRef={el => { rowRefs.current[key] = el; }}
                        showHint={hintsRevealed && !isCorrect(side, i, p.name) && !revealed}
                        statLine={<NBAStatLine player={p} leaders={leaders} />}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── ACTIONS ── */}
        <div className="flex gap-3 pb-14">
          {!revealed && (
            <button
              onClick={() => setHintsRevealed(h => !h)}
              className={`px-5 py-4 rounded-2xl sports-font text-sm border transition-all ${
                hintsRevealed
                  ? 'border-amber-500/60 text-amber-400 bg-amber-900/15'
                  : 'border-white/8 text-[#666] hover:border-white/20 hover:text-[#aaa]'
              }`}
            >
              {hintsRevealed ? 'Hide Hints' : 'Hints'}
            </button>
          )}
          {!revealed && (
            <button
              onClick={() => setRevealed(true)}
              className="px-6 py-4 rounded-2xl sports-font text-sm border border-white/8 text-[#666] hover:border-white/20 hover:text-[#aaa] transition-all"
            >
              Reveal All
            </button>
          )}
          <button
            onClick={() => navigate('/nba-box-score/results', { state: { game, guesses, filters, revealed } })}
            className="flex-1 py-4 rounded-2xl retro-title text-2xl text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${homeColor}, ${homeColor}88)`,
              boxShadow: `0 4px 24px ${homeColor}50, 0 0 0 1px ${homeColor}30`,
            }}
          >
            Submit → Results
          </button>
        </div>
      </div>
    </div>
  );
}
