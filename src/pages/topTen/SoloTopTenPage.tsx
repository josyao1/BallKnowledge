import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  isValidGuess, getCategoryDef, getPlayerSuggestions,
  generateTopTenRound, getStatShortLabel,
} from '../../services/topTen';
import type { TopTenEntry } from '../../services/topTen';
import { TopTenEntryRow } from '../../components/topTen/TopTenEntryRow';
import { WrongGuessesList } from '../../components/topTen/WrongGuessesList';
import { TeamLogo } from '../../components/TeamLogo';
import { teams } from '../../data/teams';
import { nflTeams } from '../../data/nfl-teams';

const MAX_STRIKES = 3;
const NBA_MIN = 1996; const NBA_MAX = 2025;
const NFL_MIN = 1999; const NFL_MAX = 2025;

const NBA_BY_DIVISION = (['Eastern', 'Western'] as const).flatMap(conf =>
  (['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest'] as const)
    .map(div => ({ label: `${conf === 'Eastern' ? 'East' : 'West'} · ${div}`, divTeams: teams.filter(t => t.conference === conf && t.division === div) }))
    .filter(g => g.divTeams.length > 0)
);
const NFL_BY_DIVISION = (['AFC', 'NFC'] as const).flatMap(conf =>
  (['East', 'North', 'South', 'West'] as const).map(div => ({
    label: `${conf} ${div}`,
    divTeams: nflTeams.filter(t => t.conference === conf && t.division === div),
  }))
);

type Status = 'setup' | 'loading' | 'playing' | 'done';

export function SoloTopTenPage() {
  const navigate = useNavigate();
  const { sport: storeSport } = useSettingsStore();

  // Setup settings
  const [setupSport, setSetupSport] = useState<'nba' | 'nfl'>(
    (storeSport === 'nba' || storeSport === 'nfl') ? storeSport : 'nba'
  );
  const [roundType, setRoundType]       = useState<'league' | 'division' | 'team'>('league');
  const [divisionMode, setDivisionMode] = useState<'cumulative' | 'single_season'>('cumulative');
  const [minYear, setMinYear]           = useState(NBA_MIN);
  const [maxYear, setMaxYear]           = useState(NBA_MAX);
  const [windowYears, setWindowYears]   = useState(10);

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
  const [isSingleSeason, setIsSingleSeason]   = useState(false);
  const [teamAbbr, setTeamAbbr]               = useState('');

  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [showTeamsPanel, setShowTeamsPanel] = useState(false);

  const inputRef      = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce timers on unmount
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (suggestTimer.current)  clearTimeout(suggestTimer.current);
  }, []);

  // Capture active settings in a ref so playAgain doesn't drift
  const activeConfig = useRef({ sport: 'nba' as 'nba' | 'nfl', roundType: 'league' as 'league' | 'division' | 'team', divisionMode: 'cumulative' as 'cumulative' | 'single_season', minYear: NBA_MIN, maxYear: NBA_MAX, windowYears: 10 });

  // Reset year bounds when sport changes in setup
  useEffect(() => {
    const sMin = setupSport === 'nba' ? NBA_MIN : NFL_MIN;
    const sMax = setupSport === 'nba' ? NBA_MAX : NFL_MAX;
    setMinYear(sMin);
    setMaxYear(sMax);
  }, [setupSport]);

  async function startGame() {
    activeConfig.current = { sport: setupSport, roundType, divisionMode, minYear, maxYear, windowYears };
    setSport(setupSport);
    setStatus('loading');
    try { await loadRound(); } catch { setStatus('setup'); }
  }

  async function playAgain() {
    setStatus('loading');
    try { await loadRound(); } catch { setStatus('setup'); }
  }

  async function loadRound() {
    const { sport: s, roundType: rt, divisionMode: dm, minYear: mn, maxYear: mx, windowYears: wy } = activeConfig.current;
    const { entries: result, cat, catLabel, roundInfo: info, isDivisionRound: div, isTeamRound: team, isSingleSeason: ss, teamAbbr: ta } =
      await generateTopTenRound({ sport: s, roundType: rt, divisionMode: dm, minYear: mn, maxYear: mx, windowYears: wy });
    setCategory(cat.key);
    setCategoryLabel(catLabel);
    setEntries(result);
    setRoundInfo(info);
    setIsDivisionRound(div);
    setIsTeamRound(team);
    setIsSingleSeason(ss);
    setTeamAbbr(ta);
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
      if (wrongGuesses.includes(value.trim())) {
        setGuess('');
        inputRef.current?.focus();
        return;
      }
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

  const isDone            = status === 'done';
  const catDef            = getCategoryDef(sport, category);
  const isCumulativeRound = isDivisionRound || isTeamRound;
  const statShortLabel    = getStatShortLabel(catDef, isCumulativeRound, sport);
  const sportMin         = setupSport === 'nba' ? NBA_MIN : NFL_MIN;
  const sportMax         = setupSport === 'nba' ? NBA_MAX : NFL_MAX;
  const showTeamHint     = isDivisionRound || isSingleSeason || (hintMode && !isTeamRound);

  const btnBase     = 'flex-1 py-2.5 rounded-sm retro-title text-base transition-all bg-[#0d0d0d] border border-[#1e1e1e] hover:border-[#333]';

  // ── Setup screen ─────────────────────────────────────────────────────────────
  if (status === 'setup') {
    const PURPLE = '#8b5cf6';
    const GOLD   = '#d4af37';
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        <header className="px-4 py-3 border-b border-white/8 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-white/30 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="retro-title text-xl" style={{ color: PURPLE }}>Top Ten</h1>
          <span className="ml-auto sports-font text-[9px] text-white/20 tracking-[0.25em] uppercase">Solo</span>
        </header>

        {/* Hero */}
        <div className="flex flex-col items-center pt-10 pb-6 px-4">
          <div className="flex items-end gap-px mb-3" aria-hidden>
            {['1','2','3','4','5'].map((n, i) => (
              <span
                key={n}
                className="retro-title font-black leading-none"
                style={{ fontSize: 28 - i * 3, color: PURPLE, opacity: 1 - i * 0.15 }}
              >
                {n}
              </span>
            ))}
          </div>
          <p className="sports-font text-[9px] tracking-[0.35em] uppercase" style={{ color: PURPLE, opacity: 0.5 }}>
            Choose your round
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center px-4 pb-12">
          <div className="w-full max-w-sm space-y-2.5">

            {/* Sport */}
            <div
              className="rounded-sm p-4 space-y-2.5 border"
              style={{ background: '#0d0d0d', borderColor: `${PURPLE}22` }}
            >
              <p className="sports-font text-[9px] tracking-[0.25em] uppercase" style={{ color: PURPLE, opacity: 0.5 }}>Sport</p>
              <div className="flex gap-1.5">
                {(['nba', 'nfl'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSetupSport(s)}
                    className={`${btnBase} transition-all`}
                    style={setupSport === s
                      ? { background: PURPLE, color: '#000', boxShadow: `0 0 12px ${PURPLE}55` }
                      : undefined}
                  >
                    <span className={setupSport === s ? '' : 'text-[#444]'}>{s.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Round type */}
            <div
              className="rounded-sm p-4 space-y-2.5 border"
              style={{ background: '#0d0d0d', borderColor: `${PURPLE}22` }}
            >
              <p className="sports-font text-[9px] tracking-[0.25em] uppercase" style={{ color: PURPLE, opacity: 0.5 }}>Round Type</p>
              <div className="flex gap-1.5">
                {(['league', 'division', 'team'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setRoundType(t)}
                    className={`${btnBase} transition-all`}
                    style={roundType === t
                      ? { background: GOLD, color: '#000', boxShadow: `0 0 12px ${GOLD}55` }
                      : undefined}
                  >
                    <span className={roundType === t ? '' : 'text-[#444]'}>
                      {t === 'league' ? 'League' : t === 'division' ? 'Division' : 'Team'}
                    </span>
                  </button>
                ))}
              </div>

              {roundType !== 'league' && (
                <div className="pt-0.5">
                  <p className="sports-font text-[9px] text-[#444] mb-1.5">Mode</p>
                  <div className="flex gap-1.5">
                    {(['cumulative', 'single_season'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setDivisionMode(m)}
                        className="flex-1 py-2 rounded-sm retro-title text-sm transition-all"
                        style={divisionMode === m
                          ? { background: GOLD, color: '#000', boxShadow: `0 0 10px ${GOLD}44` }
                          : undefined}
                      >
                        <span className={divisionMode === m ? '' : 'text-[#444]'}>
                          {m === 'cumulative' ? 'Cumulative' : 'Single Season'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                      <button
                        key={n}
                        onClick={() => setWindowYears(n)}
                        className={`flex-1 py-2 rounded-sm retro-title text-sm transition-all`}
                        style={windowYears === n
                          ? { background: GOLD, color: '#000', boxShadow: `0 0 10px ${GOLD}44` }
                          : undefined}
                      >
                        <span className={windowYears === n ? '' : 'text-[#444]'}>{n}y</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={startGame}
              className="w-full py-4 rounded-sm retro-title text-lg transition-all active:translate-y-0.5"
              style={{
                background: `linear-gradient(180deg, ${PURPLE} 0%, #7c3aed 100%)`,
                color: '#fff',
                boxShadow: `0 4px 0 #5b21b6, 0 0 20px ${PURPLE}44`,
              }}
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
        <div className="ml-auto flex items-center gap-2">
          {!isDone && (
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
          {!isDone && (
            <button
              onClick={() => setHintMode(h => !h)}
              className={`px-2.5 py-1 rounded-sm sports-font text-[9px] tracking-widest uppercase border transition-colors ${
                hintMode
                  ? 'border-[#d4af37]/60 text-[#d4af37] bg-[#d4af37]/8'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              Hint {hintMode ? 'On' : 'Off'}
            </button>
          )}
          {!isDone && (
            <button
              onClick={() => { setStatus('loading'); loadRound().catch(() => setStatus('setup')); }}
              className="px-2.5 py-1 rounded-sm sports-font text-[9px] tracking-widest uppercase border border-white/12 text-white/25 hover:border-blue-500/50 hover:text-blue-400 transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {showTeamsPanel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="border-b border-white/8 bg-[#0a0a0a]/98 z-10 px-4 py-3"
            onClick={() => setShowTeamsPanel(false)}
          >
            <div className="max-w-lg mx-auto grid grid-cols-2 gap-x-6 gap-y-2">
              {(sport === 'nfl' ? NFL_BY_DIVISION : NBA_BY_DIVISION).map(({ label, divTeams }) => (
                <div key={label}>
                  <p className="sports-font text-[8px] text-white/20 tracking-widest uppercase mb-1">{label}</p>
                  <div className="flex gap-2 flex-wrap">
                    {divTeams.map(t => (
                      <div key={t.abbreviation} className="flex items-center gap-1">
                        <TeamLogo abbr={t.abbreviation} sport={sport as 'nba' | 'nfl'} size={18} />
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

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-10 flex flex-col gap-4">
        {/* Category hero */}
        <div className="text-center pt-5 pb-1">
          <h2
            className="retro-title text-3xl md:text-4xl"
            style={{ color: '#22c55e', textShadow: '0 0 28px rgba(34,197,94,0.3)' }}
          >
            {categoryLabel}
          </h2>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            {isTeamRound && teamAbbr && (
              <TeamLogo abbr={teamAbbr} sport={sport} size={16} />
            )}
            <p className="sports-font text-[11px] text-white/60 tracking-[0.35em] uppercase">{roundInfo}</p>
          </div>
          {isCumulativeRound && (
            <p className="sports-font text-[9px] tracking-[0.2em] uppercase mt-1 inline-block px-2 py-0.5 rounded-sm border border-white/25 text-white/50">
              {isSingleSeason ? 'Single Season (No Repeats)' : 'Cumulative'}
            </p>
          )}
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
          {entries.map((entry, i) => (
            <TopTenEntryRow
              key={i}
              entry={entry}
              index={i}
              wasGuessed={guessedIndices.includes(i)}
              gameOver={isDone}
              showTeamHint={showTeamHint}
              showInitialsHint={(isDivisionRound || isTeamRound) && hintMode}
              sport={sport}
              categoryKey={category}
              catDef={catDef}
              statShortLabel={statShortLabel}
              justGuessed={guessedIndices.includes(i) && guessedIndices[guessedIndices.length - 1] === i}
            />
          ))}
        </div>

        {/* Wrong guesses */}
        <WrongGuessesList wrongGuesses={wrongGuesses} />

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
