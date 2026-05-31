import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  getTopTen, getTopTenDivision, getTopTenTeam, pickRandomCategory,
  getAvailableYears, isValidGuess, getCategoryDef, formatStat,
  getPlayerSuggestions,
} from '../../services/topTen';
import { getNBADivisions, teams as nbaTeams } from '../../data/teams';
import { getNFLDivisions, nflTeams } from '../../data/nfl-teams';
import type { TopTenEntry } from '../../services/topTen';
import { PlayerHeadshot } from '../../components/capCrunch/PlayerHeadshot';
import { TeamLogo } from '../../components/TeamLogo';

const MAX_STRIKES = 3;
const NBA_MIN = 1996; const NBA_MAX = 2025;
const NFL_MIN = 1999; const NFL_MAX = 2025;

type Status = 'setup' | 'loading' | 'playing' | 'done';

export function SoloTopTenPage() {
  const navigate = useNavigate();
  const { sport: storeSport } = useSettingsStore();

  // Setup settings
  const [setupSport, setSetupSport] = useState<'nba' | 'nfl'>(
    (storeSport === 'nba' || storeSport === 'nfl') ? storeSport : 'nba'
  );
  const [roundType, setRoundType] = useState<'league' | 'division' | 'team'>('league');
  const [minYear, setMinYear]     = useState(NBA_MIN);
  const [maxYear, setMaxYear]     = useState(NBA_MAX);
  const [windowYears, setWindowYears] = useState(10);

  // Active game state
  const [sport, setSport]           = useState<'nba' | 'nfl'>('nba');
  const [entries, setEntries]       = useState<TopTenEntry[]>([]);
  const [category, setCategory]     = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [roundInfo, setRoundInfo]   = useState('');
  const [guessedIndices, setGuessedIndices] = useState<number[]>([]);
  const [strikes, setStrikes]       = useState(0);
  const [guess, setGuess]           = useState('');
  const [feedback, setFeedback]     = useState<{ msg: string; type: 'correct' | 'wrong' | '' }>({ msg: '', type: '' });
  const [status, setStatus]         = useState<Status>('setup');
  const [hintMode, setHintMode]     = useState(false);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [isDivisionRound, setIsDivisionRound] = useState(false);
  const [isTeamRound, setIsTeamRound]         = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);

  const inputRef      = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce timers on unmount
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (suggestTimer.current)  clearTimeout(suggestTimer.current);
  }, []);

  // Capture active settings in a ref so playAgain doesn't drift
  const activeConfig = useRef({ sport: 'nba' as 'nba' | 'nfl', roundType: 'league' as 'league' | 'division' | 'team', minYear: NBA_MIN, maxYear: NBA_MAX, windowYears: 10 });

  // Reset year bounds when sport changes in setup
  useEffect(() => {
    const sMin = setupSport === 'nba' ? NBA_MIN : NFL_MIN;
    const sMax = setupSport === 'nba' ? NBA_MAX : NFL_MAX;
    setMinYear(sMin);
    setMaxYear(sMax);
  }, [setupSport]);

  async function startGame() {
    activeConfig.current = { sport: setupSport, roundType, minYear, maxYear, windowYears };
    setSport(setupSport);
    setStatus('loading');
    try { await loadRound(); } catch { setStatus('setup'); }
  }

  async function playAgain() {
    setStatus('loading');
    try { await loadRound(); } catch { setStatus('setup'); }
  }

  async function loadRound() {
    const { sport: s, roundType: rt, minYear: mn, maxYear: mx, windowYears: wy } = activeConfig.current;
    const cat = pickRandomCategory(s, rt);
    const years = getAvailableYears(s, cat.key);
    let result: TopTenEntry[] = [];
    let info = '';
    let usedDivision = false;
    let usedTeam = false;

    if (rt === 'team') {
      const currentYear = s === 'nba' ? NBA_MAX : NFL_MAX;
      const fromYear = s === 'nba' ? currentYear - wy : currentYear - wy + 1;
      const allTeams = s === 'nba' ? nbaTeams : nflTeams;
      const picked = allTeams[Math.floor(Math.random() * allTeams.length)];
      const windowStep = (wy - 5) / 5;
      const passingKeys = ['passing_yards', 'passing_tds', 'interceptions'];
      const rushingKeys = ['rushing_yards', 'rushing_tds'];
      const receivingKeys = ['receiving_yards', 'receiving_tds', 'receptions'];
      const baseLimit = cat.key === 'fantasy_pts' ? 10
        : passingKeys.includes(cat.key) ? 4 + windowStep
        : rushingKeys.includes(cat.key) ? 6 + windowStep
        : receivingKeys.includes(cat.key) ? 8 + windowStep
        : 6 + windowStep;
      const limit = Math.min(10, baseLimit);
      result = await getTopTenTeam(s, cat.key, picked.abbreviation, fromYear, currentYear, limit);
      info = `${picked.name} · last ${wy} years`;
      usedTeam = true;
      usedDivision = s === 'nba';
    } else if (rt === 'division') {
      const currentYear = s === 'nba' ? NBA_MAX : NFL_MAX;
      const fromYear = s === 'nba' ? currentYear - wy : currentYear - wy + 1;
      const divisions = s === 'nba' ? getNBADivisions() : getNFLDivisions();
      const div = divisions[Math.floor(Math.random() * divisions.length)];
      result = await getTopTenDivision(s, cat.key, div.conference, div.division, fromYear, currentYear);
      info = `${div.conference} ${div.division} · last ${wy} yrs`;
      if (result.length >= 5) {
        usedDivision = true;
      } else {
        const year = years[Math.floor(Math.random() * years.length)];
        result = await getTopTen(s, cat.key, year);
        info = s === 'nba' ? `${year}-${String(year + 1).slice(-2)} season` : `${year} season`;
      }
    } else {
      const filtered = years.filter(y => y >= mn && y <= mx);
      const pool = filtered.length > 0 ? filtered : years;
      const year = pool[Math.floor(Math.random() * pool.length)];
      result = await getTopTen(s, cat.key, year);
      info = s === 'nba' ? `${year}-${String(year + 1).slice(-2)} season` : `${year} season`;
    }

    if (result.length < 5) {
      const year = years[years.length - 3 + Math.floor(Math.random() * 3)];
      result = await getTopTen(s, cat.key, year);
      info = s === 'nba' ? `${year}-${String(year + 1).slice(-2)} season` : `${year} season`;
      usedDivision = false;
      usedTeam = false;
    }

    const catLabel = usedDivision && s === 'nba' ? (cat.divisionLabel ?? cat.label) : cat.label;

    setCategory(cat.key);
    setCategoryLabel(catLabel);
    setEntries(result);
    setRoundInfo(info);
    setIsDivisionRound(usedDivision && !usedTeam);
    setIsTeamRound(usedTeam);
    setGuessedIndices([]);
    setStrikes(0);
    setGuess('');
    setFeedback({ msg: '', type: '' });
    setHintMode(false);
    setWrongGuesses([]);
    setStatus('playing');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function clearFeedback() {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback({ msg: '', type: '' }), 1800);
  }

  function submitGuess(value: string) {
    if (!value.trim() || status !== 'playing') return;
    setSuggestions([]);
    const matched = isValidGuess(value.trim(), entries, guessedIndices);
    if (matched.length > 0) {
      const newGuessed = [...guessedIndices, ...matched];
      setGuessedIndices(newGuessed);
      setGuess('');
      setFeedback({ msg: `✓ ${entries[matched[0]].playerName}`, type: 'correct' });
      clearFeedback();
      if (newGuessed.length === entries.length) setStatus('done');
    } else {
      const n = strikes + 1;
      setStrikes(n);
      setWrongGuesses(prev => [...prev, value.trim()]);
      setGuess('');
      setFeedback({ msg: n >= MAX_STRIKES ? 'Strike 3 — game over!' : '✗ Not in the top 10', type: 'wrong' });
      clearFeedback();
      if (n >= MAX_STRIKES) setStatus('done');
    }
    inputRef.current?.focus();
  }

  function handleInputChange(val: string) {
    setGuess(val);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (val.length < 4) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(() => {
      getPlayerSuggestions(sport, val)
        .then(s => setSuggestions(s))
        .catch(() => {});
    }, 120);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitGuess(guess);
  }

  const isDone           = status === 'done';
  const catDef           = getCategoryDef(sport, category);
  const isCumulativeRound = isDivisionRound || isTeamRound;
  const statShortLabel   = (isCumulativeRound && sport === 'nba' && catDef?.divisionShortLabel) ? catDef.divisionShortLabel : catDef?.shortLabel;
  const sportMin         = setupSport === 'nba' ? NBA_MIN : NFL_MIN;
  const sportMax         = setupSport === 'nba' ? NBA_MAX : NFL_MAX;
  const showTeamHint     = isDivisionRound || (hintMode && !isTeamRound);

  const btnActive   = 'bg-[#22c55e] text-black';
  const btnInactive = 'bg-[#0d0d0d] text-[#444] border border-[#1e1e1e] hover:border-[#333] hover:text-[#777]';
  const btnBase     = 'flex-1 py-2.5 rounded-sm retro-title text-base transition-all';

  // ── Setup screen ─────────────────────────────────────────────────────────────
  if (status === 'setup') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        <header className="px-4 py-3 border-b border-white/8 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-white/30 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="retro-title text-xl text-[#22c55e]">Top Ten</h1>
          <span className="ml-auto sports-font text-[9px] text-white/20 tracking-[0.25em] uppercase">Solo</span>
        </header>

        <div className="flex-1 flex flex-col items-center px-4 pt-8 pb-12">
          <div className="w-full max-w-sm space-y-3">
            <p className="sports-font text-[9px] text-white/20 tracking-[0.35em] uppercase text-center mb-5">
              Choose your round
            </p>

            {/* Sport */}
            <div className="bg-[#0d0d0d] border border-white/8 rounded-sm p-4 space-y-2.5">
              <p className="sports-font text-[9px] text-[#444] tracking-[0.25em] uppercase">Sport</p>
              <div className="flex gap-1.5">
                {(['nba', 'nfl'] as const).map(s => (
                  <button key={s} onClick={() => setSetupSport(s)} className={`${btnBase} ${setupSport === s ? btnActive : btnInactive}`}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Round type */}
            <div className="bg-[#0d0d0d] border border-white/8 rounded-sm p-4 space-y-2.5">
              <p className="sports-font text-[9px] text-[#444] tracking-[0.25em] uppercase">Round Type</p>
              <div className="flex gap-1.5">
                {(['league', 'division', 'team'] as const).map(t => (
                  <button key={t} onClick={() => setRoundType(t)}
                    className={`${btnBase} ${roundType === t ? 'bg-[#d4af37] text-black' : btnInactive}`}>
                    {t === 'league' ? 'League' : t === 'division' ? 'Division' : 'Team'}
                  </button>
                ))}
              </div>

              {roundType === 'league' ? (
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  {(['From', 'To'] as const).map((label, idx) => (
                    <div key={label}>
                      <p className="sports-font text-[9px] text-[#444] mb-1">{label}</p>
                      <select
                        value={idx === 0 ? minYear : maxYear}
                        onChange={e => idx === 0 ? setMinYear(+e.target.value) : setMaxYear(+e.target.value)}
                        className="w-full bg-[#0a0a0a] text-[#bbb] px-2 py-1.5 rounded-sm border border-[#1e1e1e] sports-font text-sm focus:outline-none focus:border-[#333] appearance-none"
                      >
                        {Array.from({ length: sportMax - sportMin + 1 }, (_, i) => sportMin + i).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pt-0.5">
                  <p className="sports-font text-[9px] text-[#444] mb-1.5">Year Window</p>
                  <div className="flex gap-1.5">
                    {[5, 10, 15, 20].map(n => (
                      <button key={n} onClick={() => setWindowYears(n)}
                        className={`flex-1 py-2 rounded-sm retro-title text-sm transition-all ${windowYears === n ? 'bg-[#d4af37] text-black' : btnInactive}`}>
                        {n}y
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={startGame}
              className="w-full py-4 bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-black shadow-[0_4px_0_#166534] active:shadow-none active:translate-y-1 rounded-sm retro-title text-lg transition-all"
            >
              Play
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="sports-font text-white/25 tracking-widest text-sm">Loading...</p>
      </div>
    );
  }

  // ── Game board ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="px-4 py-3 border-b border-white/8 flex items-center gap-3">
        <button onClick={() => setStatus('setup')} className="text-white/30 hover:text-white/70 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="retro-title text-base text-[#22c55e]">Top Ten</h1>
        <span className="sports-font text-[9px] text-white/20 tracking-[0.25em] uppercase">
          {sport.toUpperCase()} · {isTeamRound ? 'Team' : isDivisionRound ? 'Division' : 'League'}
        </span>
        {!isDone && !isDivisionRound && !isTeamRound && (
          <button
            onClick={() => setHintMode(h => !h)}
            className={`ml-auto px-2.5 py-1 rounded-sm sports-font text-[9px] tracking-widest uppercase border transition-colors ${
              hintMode
                ? 'border-[#d4af37]/60 text-[#d4af37] bg-[#d4af37]/8'
                : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
            }`}
          >
            Hint {hintMode ? 'On' : 'Off'}
          </button>
        )}
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-10 flex flex-col gap-4">
        {/* Category hero */}
        <div className="text-center pt-5 pb-1">
          <h2
            className="retro-title text-3xl md:text-4xl"
            style={{ color: '#22c55e', textShadow: '0 0 28px rgba(34,197,94,0.3)' }}
          >
            {categoryLabel}
          </h2>
          <p className="sports-font text-[10px] text-white/30 tracking-[0.35em] uppercase mt-1.5">{roundInfo}</p>
        </div>

        {/* Strikes */}
        <div className="flex justify-center gap-2.5">
          {Array.from({ length: MAX_STRIKES }).map((_, i) => (
            <motion.div
              key={i}
              animate={i === strikes - 1 ? { scale: [1, 1.35, 1] } : {}}
              transition={{ duration: 0.28 }}
              className={`w-9 h-9 rounded-sm flex items-center justify-center border transition-all ${
                i < strikes
                  ? 'bg-red-950/70 border-red-600/50'
                  : 'bg-white/4 border-white/8'
              }`}
            >
              <span className={`retro-title text-sm transition-colors ${i < strikes ? 'text-red-400' : 'text-white/15'}`}>✕</span>
            </motion.div>
          ))}
        </div>

        {/* Feedback */}
        <div className="h-5 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {feedback.type && (
              <motion.p
                key={feedback.msg}
                initial={{ opacity: 0, y: -5 }}
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
        {!isDone && (
          <div className="relative">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                value={guess}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setSuggestions([])}
                placeholder="Name a player..."
                autoComplete="off"
                className="flex-1 bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm px-4 py-2.5 text-white sports-font text-sm focus:outline-none focus:border-[#22c55e]/50 placeholder-white/12 transition-colors"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-black shadow-[0_3px_0_#166534] active:shadow-none active:translate-y-px rounded-sm retro-title text-sm transition-all"
              >
                Guess
              </button>
            </form>

            {/* Autocomplete dropdown — max 3, no scroll */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-12 mt-0.5 bg-[#111] border border-[#2a2a2a] rounded-sm z-30 overflow-hidden">
                {suggestions.map(name => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); submitGuess(name); }}
                    className="w-full text-left px-4 py-2.5 sports-font text-sm text-white/60 hover:bg-[#1a1a1a] hover:text-white border-b border-white/5 last:border-0 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Board */}
        <div className="space-y-1.5">
          {entries.map((entry, i) => {
            const isRevealed = guessedIndices.includes(i) || isDone;
            const wasGuessed = guessedIndices.includes(i);
            const justGuessed = wasGuessed && guessedIndices[guessedIndices.length - 1] === i;

            return (
              <motion.div
                key={i}
                initial={false}
                animate={justGuessed ? { x: [0, -3, 3, -2, 2, 0] } : {}}
                transition={{ duration: 0.35 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border transition-colors duration-400 ${
                  isRevealed
                    ? wasGuessed
                      ? 'bg-emerald-950/40 border-emerald-700/35'
                      : 'bg-[#0f0f0f] border-white/6'
                    : 'bg-[#0b0b0b] border-white/4'
                }`}
              >
                {/* Rank */}
                <span className="sports-font text-[10px] text-white/20 w-4 text-right shrink-0 tabular-nums">#{i + 1}</span>

                {/* Headshot — blurred + dim when unrevealed */}
                <div className={`w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 transition-all duration-500 ${
                  isRevealed
                    ? wasGuessed ? 'ring-emerald-500/40' : 'ring-white/8'
                    : 'ring-white/5'
                }`}
                  style={{ filter: isRevealed ? 'none' : 'blur(14px) saturate(0) brightness(0.45)', opacity: isRevealed ? 1 : 0.6 }}
                >
                  <PlayerHeadshot playerId={entry.playerId} sport={sport} className="w-9 h-9 object-cover" />
                </div>

                {/* Name / info */}
                <div className="flex-1 min-w-0">
                  {isRevealed ? (
                    <>
                      <p className={`retro-title text-sm leading-tight truncate ${wasGuessed ? 'text-emerald-300' : 'text-white/45'}`}>
                        {entry.playerName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <TeamLogo abbr={entry.team} sport={sport} size={18} />
                        <p className="sports-font text-[9px] text-white/40">{entry.year}</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      {showTeamHint && <TeamLogo abbr={entry.team} sport={sport} size={16} />}
                      <p className="sports-font text-[10px] text-white/20 tracking-[0.2em]">???</p>
                    </div>
                  )}
                </div>

                {/* Stat */}
                {isRevealed && catDef && (
                  <span className={`sports-font text-xs tabular-nums shrink-0 ${wasGuessed ? 'text-[#22c55e]' : 'text-white/25'}`}>
                    {formatStat(entry.stat, category)}{' '}
                    <span className="text-[9px] opacity-60">{statShortLabel}</span>
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Wrong guesses */}
        {wrongGuesses.length > 0 && (
          <div className="pt-1">
            <p className="sports-font text-[9px] text-white/20 tracking-widest uppercase mb-2">Not in top 10</p>
            <div className="flex flex-wrap gap-1.5">
              {wrongGuesses.map((name, i) => (
                <span key={i} className="sports-font text-[10px] text-red-400/50 bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded-sm">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Done state */}
        {isDone && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3 pt-3 pb-4"
          >
            <div>
              <p
                className="retro-title text-2xl"
                style={{ color: guessedIndices.length === entries.length ? '#d4af37' : '#22c55e' }}
              >
                {guessedIndices.length === entries.length ? '🎉 Perfect!' : `${guessedIndices.length} / ${entries.length} found`}
              </p>
            </div>
            <div className="flex gap-2.5 justify-center">
              <button
                onClick={playAgain}
                className="px-6 py-3 bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-black shadow-[0_3px_0_#166534] active:shadow-none active:translate-y-px rounded-sm retro-title text-base transition-all"
              >
                Play Again
              </button>
              <button
                onClick={() => setStatus('setup')}
                className="px-6 py-3 bg-[#0d0d0d] border border-white/12 hover:border-white/25 rounded-sm retro-title text-base transition-colors text-white/40"
              >
                Settings
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
