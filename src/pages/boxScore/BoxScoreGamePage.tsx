/**
 * BoxScoreGamePage.tsx — Solo Box Score game.
 *
 * Single search bar → auto-fill with Family Feud flip animation.
 * Live correct-answer validation. Vibrant team-color UI.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getRandomBoxScoreGame,
  ALL_BOX_SCORE_YEARS,
  type BoxScoreGame,
} from '../../services/boxScoreData';
import { fetchStaticNFLSeasonPlayers } from '../../services/roster';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import {
  GAME_TYPE_LABELS, getTeamColor, cleanJersey, getInitials, scoreMatch, bk,
} from '../../components/boxScore/boxScoreHelpers';
import { FlipReveal }    from '../../components/boxScore/FlipReveal';
import { SectionHeader } from '../../components/boxScore/SectionHeader';
import { TeamLogo }      from '../../components/boxScore/TeamLogo';

// ─── Page-local helpers ───────────────────────────────────────────────────────

function buildYearRange(min: number, max: number): number[] {
  const out: number[] = [];
  for (let y = min; y <= max; y++) if (ALL_BOX_SCORE_YEARS.includes(y)) out.push(y);
  return out.length > 0 ? out : ALL_BOX_SCORE_YEARS;
}
function formatDate(s: string): string {
  try { return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return s; }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BoxFilters = { minYear: number; maxYear: number; team: string | null };
interface PlayerEntry {
  key: string; name: string; side: 'home' | 'away';
  category: 'passing' | 'rushing' | 'receiving'; index: number; number: string;
}

// ─── Player row ───────────────────────────────────────────────────────────────

interface RowProps {
  playerKey: string; playerName: string; number: string;
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
      {/* Jersey badge */}
      <div
        className="shrink-0 w-9 h-7 flex items-center justify-center rounded-md sports-font text-[11px] font-bold tabular-nums"
        style={{ background: `${teamColor}30`, color: teamColor, border: `1px solid ${teamColor}50` }}
      >
        {jersey ? `#${jersey}` : '–'}
      </div>

      {/* Name cell */}
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
                style={{ '--tw-ring-color': teamColor } as React.CSSProperties}
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

      {/* Stat line */}
      <div className="shrink-0 text-right" style={{ minWidth: 88 }}>
        {statLine}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function BoxScoreGamePage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const filters: BoxFilters = (location.state as BoxFilters | null) ?? { minYear: 2015, maxYear: 2024, team: null };

  const [loading,       setLoading]       = useState(true);
  const [game,          setGame]          = useState<BoxScoreGame | null>(null);
  const [seasonPlayers, setSeasonPlayers] = useState<{ id: string; name: string }[]>([]);
  const [guesses,       setGuesses]       = useState<Record<string, string>>({});
  const [spreadGuess,   setSpreadGuess]   = useState('');
  const [revealed,      setRevealed]      = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(false);
  const [globalInput,   setGlobalInput]   = useState('');
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [notInGame,     setNotInGame]     = useState<string | null>(null); // name that wasn't found

  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs   = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const years = buildYearRange(filters.minYear, filters.maxYear);
    getRandomBoxScoreGame({ years, team: filters.team ?? undefined })
      .then(async g => {
        setGame(g);
        // Load all players for that season for autocomplete (doesn't reveal who's in the game)
        try {
          const players = await fetchStaticNFLSeasonPlayers(g.season);
          setSeasonPlayers(players ?? []);
        } catch { /* autocomplete works even without this */ }
        setLoading(false);
        setTimeout(() => searchRef.current?.focus(), 120);
      })
      .catch(() => navigate('/'));
  }, []);

  // All players flat
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


  // Candidates from ALL season players — not just box score players (doesn't give away answers)
  const candidates = useMemo(() => {
    if (!globalInput.trim() || globalInput.length < 2) return [];
    const pool = seasonPlayers.length > 0 ? seasonPlayers : allPlayers;
    return pool
      .map(p => ({ name: p.name, score: scoreMatch(globalInput, p.name) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [globalInput, seasonPlayers, allPlayers]);

  // On confirm: find ALL rows in box score matching this name (any team, any category)
  function confirmCandidate(name: string) {
    const matches = allPlayers.filter(p => areSimilarNames(name, p.name));
    if (matches.length === 0) {
      // Not in this game
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
    // Scroll to first match
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

  function setGuess(key: string, v: string) { setGuesses(prev => ({ ...prev, [key]: v })); }

  // Score
  let totalRows = 0, correctCount = 0;
  if (game) {
    for (const side of ['home', 'away'] as const)
      for (const cat of ['passing', 'rushing', 'receiving'] as const) {
        const rows = game.box_score[side][cat] as any[];
        totalRows += rows.length;
        rows.forEach((p, i) => { if (isCorrect(side, cat, i, p.name)) correctCount++; });
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

  const homeColor = getTeamColor(game.home_team);
  const awayColor = getTeamColor(game.away_team);
  const gameLabel = GAME_TYPE_LABELS[game.game_type] ?? game.game_type;
  const spreadCorrect = game.spread_line != null && spreadGuess !== ''
    && Math.abs(parseFloat(spreadGuess) - game.spread_line) <= 0.5;
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
          {/* Live score pill */}
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

        {/* ── SCOREBOARD ── */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${awayColor}28 0%, #111 40%, #111 60%, ${homeColor}28 100%)`,
            border: `1px solid rgba(255,255,255,0.08)`,
          }}
        >
          {/* Team color glows */}
          <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-52 h-52 rounded-full blur-3xl pointer-events-none"
            style={{ background: awayColor, opacity: 0.18 }} />
          <div className="absolute -right-20 top-1/2 -translate-y-1/2 w-52 h-52 rounded-full blur-3xl pointer-events-none"
            style={{ background: homeColor, opacity: 0.18 }} />

          {/* Scores */}
          <div className="relative flex items-center justify-between px-6 sm:px-12 py-7">
            {/* Away */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <TeamLogo abbr={game.away_team} className="w-16 h-16 sm:w-24 sm:h-24 object-contain" imgStyle={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }} />
              <span className="retro-title text-2xl sm:text-4xl leading-none" style={{ color: awayColor, textShadow: `0 0 30px ${awayColor}80` }}>
                {game.away_team}
              </span>
              <span className="retro-title text-6xl sm:text-7xl text-white leading-none tabular-nums"
                style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>
                {game.away_score}
              </span>
              <span className="sports-font text-[10px] text-[#666] tracking-[0.3em] uppercase">Away</span>
            </div>

            {/* Center */}
            <div className="flex flex-col items-center gap-3 px-2 sm:px-6">
              {game.overtime && (
                <span className="px-2.5 py-1 rounded-full sports-font text-[10px] tracking-wider"
                  style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }}>
                  OT
                </span>
              )}
              <div className="sports-font text-[12px] text-[#444] tracking-[0.4em]">FINAL</div>
              <div className="flex items-center">
                <div className="w-px h-10 bg-white/10" />
              </div>
              <div className="text-center">
                <div className="sports-font text-[11px] text-[#666]">{gameLabel}</div>
                <div className="sports-font text-[11px] text-[#555] mt-0.5">WK {game.week}</div>
              </div>
            </div>

            {/* Home */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <TeamLogo abbr={game.home_team} className="w-16 h-16 sm:w-24 sm:h-24 object-contain" imgStyle={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }} />
              <span className="retro-title text-2xl sm:text-4xl leading-none" style={{ color: homeColor, textShadow: `0 0 30px ${homeColor}80` }}>
                {game.home_team}
              </span>
              <span className="retro-title text-6xl sm:text-7xl text-white leading-none tabular-nums"
                style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>
                {game.home_score}
              </span>
              <span className="sports-font text-[10px] text-[#666] tracking-[0.3em] uppercase">Home</span>
            </div>
          </div>

          {/* Game info chips */}
          <div className="relative border-t border-white/6 px-4 py-3 flex flex-wrap justify-center gap-2">
            {/* Season / Date */}
            <div className="flex flex-col items-center justify-center bg-white/4 rounded-lg py-1.5 px-3 min-w-[72px]">
              <span className="sports-font text-[8px] text-[#555] tracking-widest uppercase">Season</span>
              <span className="retro-title text-base text-white leading-tight">{game.season}</span>
              <span className="sports-font text-[9px] text-[#666]">{formatDate(game.gameday)}</span>
            </div>
            {/* Week / Type */}
            <div className="flex flex-col items-center justify-center bg-white/4 rounded-lg py-1.5 px-3 min-w-[60px]">
              <span className="sports-font text-[8px] text-[#555] tracking-widest uppercase">Week</span>
              <span className="retro-title text-base text-white leading-tight">{game.week}</span>
              <span className="sports-font text-[9px] text-[#666]">{gameLabel}</span>
            </div>
            {/* Stadium */}
            {game.stadium && (
              <div className="flex flex-col items-center justify-center bg-white/4 rounded-lg py-1.5 px-3 max-w-[140px]">
                <span className="sports-font text-[8px] text-[#555] tracking-widest uppercase">Stadium</span>
                <span className="sports-font text-[10px] text-[#bbb] text-center leading-snug mt-0.5 line-clamp-2">{game.stadium}</span>
              </div>
            )}
            {/* Conditions */}
            {(game.temp != null || game.roof) && (
              <div className="flex flex-col items-center justify-center bg-white/4 rounded-lg py-1.5 px-3 min-w-[60px]">
                <span className="sports-font text-[8px] text-[#555] tracking-widest uppercase">Conditions</span>
                {game.temp != null && <span className="retro-title text-base text-white leading-tight">{game.temp}°F</span>}
                {game.roof && <span className="sports-font text-[9px] text-[#666] capitalize">{game.roof}</span>}
              </div>
            )}
            {/* Wind */}
            {game.wind != null && (
              <div className="flex flex-col items-center justify-center bg-white/4 rounded-lg py-1.5 px-3 min-w-[52px]">
                <span className="sports-font text-[8px] text-[#555] tracking-widest uppercase">Wind</span>
                <span className="retro-title text-base text-white leading-tight">{game.wind}</span>
                <span className="sports-font text-[9px] text-[#666]">mph</span>
              </div>
            )}
          </div>
        </div>

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
              placeholder="Type a player name — hits Enter to fill the box score..."
              className="flex-1 bg-transparent sports-font text-base text-white placeholder-[#3a3a3a] focus:outline-none"
            />
            {globalInput ? (
              <button onClick={() => { setGlobalInput(''); searchRef.current?.focus(); }}
                className="text-[#555] hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <kbd className="hidden sm:flex sports-font text-[10px] text-[#555] px-2 py-1 rounded border border-[#2a2a2a] items-center">↵</kbd>
            )}
          </div>

          {/* Candidate dropdown */}
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
            const color = side === 'home' ? homeColor : awayColor;
            const abbr  = side === 'home' ? game.home_team : game.away_team;
            const data  = game.box_score[side];

            return (
              <div
                key={side}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: `linear-gradient(160deg, ${color}12 0%, #111 30%)`,
                  border: `1px solid ${color}30`,
                }}
              >
                {/* Team header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b"
                  style={{
                    background: `linear-gradient(90deg, ${color}25 0%, transparent 80%)`,
                    borderColor: `${color}20`,
                  }}
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
                          <div className="sports-font text-[7px] text-[#3a3a3a] uppercase tracking-wider">{cat.slice(0, 3)}</div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                <div className="p-4 space-y-5">
                  {/* Passing */}
                  {data.passing.length > 0 && (
                    <section>
                      <SectionHeader label="Passing" color={color} />
                      {data.passing.map((p, i) => {
                        const key = bk(side, 'passing', i);
                        return (
                          <PlayerRow
                            key={`${p.id}-p-${i}`}
                            playerKey={key}
                            playerName={p.name}
                            number={p.number}
                            correct={isCorrect(side, 'passing', i, p.name)}
                            revealed={revealed}
                            teamColor={color}
                            guess={guesses[key] ?? ''}
                            onGuessChange={v => setGuess(key, v)}
                            rowRef={el => { rowRefs.current[key] = el; }}
                            showHint={hintsRevealed && !isCorrect(side, 'passing', i, p.name) && !revealed}
                            statLine={
                              <span className="sports-font text-[11px] tabular-nums">
                                <span className="text-[#888] hidden sm:inline">{p.completions}/{p.attempts} </span>
                                <span className="text-[#ddd] font-semibold">{p.yards}yd</span>
                                {' '}<span className={p.tds > 0 ? 'text-green-400 font-bold' : 'text-[#666]'}>{p.tds}TD</span>
                                {p.ints > 0 && <span className="text-red-400"> {p.ints}INT</span>}
                              </span>
                            }
                          />
                        );
                      })}
                    </section>
                  )}

                  {/* Rushing */}
                  {data.rushing.length > 0 && (
                    <section>
                      <SectionHeader label="Rushing" color={color} />
                      {data.rushing.map((p, i) => {
                        const key = bk(side, 'rushing', i);
                        return (
                          <PlayerRow
                            key={`${p.id}-r-${i}`}
                            playerKey={key}
                            playerName={p.name}
                            number={p.number}
                            correct={isCorrect(side, 'rushing', i, p.name)}
                            revealed={revealed}
                            teamColor={color}
                            guess={guesses[key] ?? ''}
                            onGuessChange={v => setGuess(key, v)}
                            rowRef={el => { rowRefs.current[key] = el; }}
                            showHint={hintsRevealed && !isCorrect(side, 'rushing', i, p.name) && !revealed}
                            statLine={
                              <span className="sports-font text-[11px] tabular-nums">
                                <span className="text-[#888] hidden sm:inline">{p.carries}car </span>
                                <span className="text-[#ddd] font-semibold">{p.yards}yd</span>
                                {' '}<span className={p.tds > 0 ? 'text-green-400 font-bold' : 'text-[#666]'}>{p.tds}TD</span>
                              </span>
                            }
                          />
                        );
                      })}
                    </section>
                  )}

                  {/* Receiving */}
                  {data.receiving.length > 0 && (
                    <section>
                      <SectionHeader label="Receiving" color={color} />
                      {data.receiving.map((p, i) => {
                        const key = bk(side, 'receiving', i);
                        return (
                          <PlayerRow
                            key={`${p.id}-rec-${i}`}
                            playerKey={key}
                            playerName={p.name}
                            number={p.number}
                            correct={isCorrect(side, 'receiving', i, p.name)}
                            revealed={revealed}
                            teamColor={color}
                            guess={guesses[key] ?? ''}
                            onGuessChange={v => setGuess(key, v)}
                            rowRef={el => { rowRefs.current[key] = el; }}
                            showHint={hintsRevealed && !isCorrect(side, 'receiving', i, p.name) && !revealed}
                            statLine={
                              <span className="sports-font text-[11px] tabular-nums">
                                <span className="text-[#888] hidden sm:inline">{p.receptions}/{p.targets} </span>
                                <span className="text-[#ddd] font-semibold">{p.yards}yd</span>
                                {' '}<span className={p.tds > 0 ? 'text-green-400 font-bold' : 'text-[#666]'}>{p.tds}TD</span>
                              </span>
                            }
                          />
                        );
                      })}
                    </section>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── SPREAD ── */}
        {game.spread_line != null && (
          <div className="rounded-2xl p-5" style={{ background: '#111', border: '1px solid rgba(245,158,11,0.2)' }}>
            <SectionHeader label="Vegas Spread" color="#f59e0b" />
            <div className="flex items-center gap-4 flex-wrap mt-3">
              <input
                type="number" step="0.5"
                value={spreadGuess}
                onChange={e => setSpreadGuess(e.target.value)}
                placeholder="e.g. 3 or −3"
                disabled={revealed}
                className="w-36 bg-[#0d0d0d] border border-white/10 rounded-xl px-4 py-2.5 sports-font text-sm text-white placeholder-[#2a2a2a] focus:outline-none focus:border-[#f59e0b]/40 disabled:opacity-40 transition-colors"
              />
              <span className="sports-font text-xs text-[#666]">pts · + = home favored · − = away favored</span>
              {revealed && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`sports-font text-sm font-bold px-3 py-1 rounded-full ${
                    spreadCorrect
                      ? 'text-green-300 bg-green-900/30 border border-green-700/40'
                      : 'text-red-400 bg-red-950/30 border border-red-900/40'
                  }`}
                >
                  Answer: {game.spread_line > 0 ? '+' : ''}{game.spread_line} {spreadCorrect ? '✓' : '✗'}
                </motion.span>
              )}
            </div>
          </div>
        )}

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
              title="Show player initials as a hint"
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
            onClick={() => navigate('/box-score/results', { state: { game, guesses, spreadGuess, filters, revealed } })}
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
