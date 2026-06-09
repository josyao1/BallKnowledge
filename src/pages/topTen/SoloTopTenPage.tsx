import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  isValidGuess, getCategoryDef, getPlayerSuggestions,
  generateTopTenRound, getStatShortLabel,
} from '../../services/topTen';
import type { TopTenEntry } from '../../services/topTen';
import { TopTenEntryRow } from '../../components/topTen/TopTenEntryRow';
import { WrongGuessesList } from '../../components/topTen/WrongGuessesList';
import { TeamsReferencePanel } from '../../components/topTen/TeamsReferencePanel';
import { TopTenCategoryHeader } from '../../components/topTen/TopTenCategoryHeader';
import { FeedbackMessage } from '../../components/topTen/FeedbackMessage';
import { TopTenSettings } from '../../components/lobby/settings/TopTenSettings';

const MAX_STRIKES = 3;
const NBA_MIN = 1996; const NBA_MAX = 2025;
const NFL_MIN = 1999; const NFL_MAX = 2025;

type Status = 'setup' | 'loading' | 'playing' | 'done';

function decodeDivision(encoded: string): { conference: string; division: string } {
  const [conference, division] = encoded.split('|');
  return { conference, division };
}

export function SoloTopTenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sport: storeSport } = useSettingsStore();
  const consumedAutoStartRef = useRef(false);

  // Setup settings
  const [setupSport, setSetupSport] = useState<'nba' | 'nfl'>(
    (storeSport === 'nba' || storeSport === 'nfl') ? storeSport : 'nba'
  );
  const [roundType, setRoundType]       = useState<'league' | 'division' | 'team'>('league');
  const [divisionMode, setDivisionMode] = useState<'cumulative' | 'single_season'>('cumulative');
  const [minYear, setMinYear]           = useState(NBA_MIN);
  const [maxYear, setMaxYear]           = useState(NBA_MAX);
  const [windowYears, setWindowYears]   = useState(10);
  const [pinnedDivision, setPinnedDivision] = useState<string | null>(null);
  const [pinnedTeam, setPinnedTeam]         = useState<string | null>(null);

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

  useEffect(() => {
    const autoStartState = location.state as ({
      autoStart?: boolean;
      setupSport?: 'nba' | 'nfl';
      roundType?: 'league' | 'division' | 'team';
      divisionMode?: 'cumulative' | 'single_season';
      minYear?: number;
      maxYear?: number;
      windowYears?: number;
      pinnedDivision?: string | null;
      pinnedTeam?: string | null;
    } | null);

    if (!autoStartState?.autoStart || status !== 'setup' || consumedAutoStartRef.current) return;

    consumedAutoStartRef.current = true;

    const nextSport = autoStartState.setupSport ?? ((storeSport === 'nba' || storeSport === 'nfl') ? storeSport : 'nba');
    const nextRoundType = autoStartState.roundType ?? 'league';
    const nextDivisionMode = autoStartState.divisionMode ?? 'cumulative';
    const defaultMin = nextSport === 'nba' ? NBA_MIN : NFL_MIN;
    const defaultMax = nextSport === 'nba' ? NBA_MAX : NFL_MAX;
    const nextMinYear = autoStartState.minYear ?? defaultMin;
    const nextMaxYear = autoStartState.maxYear ?? defaultMax;
    const nextWindowYears = autoStartState.windowYears ?? 10;
    const nextPinnedDivision = autoStartState.pinnedDivision ?? null;
    const nextPinnedTeam = autoStartState.pinnedTeam ?? null;

    setSetupSport(nextSport);
    setRoundType(nextRoundType);
    setDivisionMode(nextDivisionMode);
    setMinYear(nextMinYear);
    setMaxYear(nextMaxYear);
    setWindowYears(nextWindowYears);
    setPinnedDivision(nextPinnedDivision);
    setPinnedTeam(nextPinnedTeam);

    activeConfig.current = {
      sport: nextSport,
      roundType: nextRoundType,
      divisionMode: nextDivisionMode,
      minYear: nextMinYear,
      maxYear: nextMaxYear,
      windowYears: nextWindowYears,
    };
    setSport(nextSport);
    setStatus('loading');

    const pinned = {
      division: nextPinnedDivision ? decodeDivision(nextPinnedDivision) : undefined,
      team: nextPinnedTeam ?? undefined,
    };

    void loadRound(pinned).catch(() => setStatus('setup'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, status, storeSport]);

  async function startGame() {
    activeConfig.current = { sport: setupSport, roundType, divisionMode, minYear, maxYear, windowYears };
    setSport(setupSport);
    setStatus('loading');
    const pinned = {
      division: pinnedDivision ? decodeDivision(pinnedDivision) : undefined,
      team: pinnedTeam ?? undefined,
    };
    try { await loadRound(pinned); } catch { setStatus('setup'); }
  }

  async function playAgain() {
    setStatus('loading');
    try { await loadRound(); } catch { setStatus('setup'); }
  }

  async function loadRound(pinned?: { division?: { conference: string; division: string }; team?: string }) {
    const { sport: s, roundType: rt, divisionMode: dm, minYear: mn, maxYear: mx, windowYears: wy } = activeConfig.current;
    const { entries: result, cat, catLabel, roundInfo: info, isDivisionRound: div, isTeamRound: team, isSingleSeason: ss, teamAbbr: ta } =
      await generateTopTenRound({ sport: s, roundType: rt, divisionMode: dm, minYear: mn, maxYear: mx, windowYears: wy, pinnedDivision: pinned?.division, pinnedTeam: pinned?.team });
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
  const statShortLabel    = getStatShortLabel(catDef);
  const showTeamHint     = isDivisionRound || isSingleSeason || (hintMode && !isTeamRound);

  // ── Setup screen ─────────────────────────────────────────────────────────────
  if (status === 'setup') {
    return (
      <div className="min-h-screen home-chalkboard text-white flex flex-col">
        <header className="px-4 py-3 border-b border-white/10 flex items-center gap-3 capcrunch-panel">
          <button onClick={() => navigate('/')} className="text-white/30 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="capcrunch-title text-xl text-[#FDF100]">Top Ten</h1>
          <span className="ml-auto capcrunch-kicker text-[9px] text-white/20 tracking-[0.25em] uppercase">Solo</span>
        </header>

        <div className="flex flex-col items-center pt-10 pb-6 px-4">
          <div className="flex items-end gap-px mb-3" aria-hidden>
            {['1','2','3','4','5'].map((n, i) => (
              <span key={n} className="capcrunch-title font-black leading-none" style={{ fontSize: 28 - i * 3, color: '#FDF100', opacity: 1 - i * 0.15 }}>
                {n}
              </span>
            ))}
          </div>
          <p className="capcrunch-kicker text-[9px] tracking-[0.35em] uppercase text-white/45">
            Choose your round
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center px-4 pb-12">
          <div className="w-full max-w-sm space-y-2.5">
            <div className="capcrunch-panel p-4">
              <TopTenSettings
                sport={setupSport} onSportChange={setSetupSport}
                roundType={roundType} onRoundTypeChange={setRoundType}
                divisionMode={divisionMode} onDivisionModeChange={setDivisionMode}
                minYear={minYear} onMinYearChange={setMinYear}
                maxYear={maxYear} onMaxYearChange={setMaxYear}
                windowYears={windowYears} onWindowYearsChange={setWindowYears}
                pinnedDivision={pinnedDivision} onPinnedDivisionChange={setPinnedDivision}
                pinnedTeam={pinnedTeam} onPinnedTeamChange={setPinnedTeam}
              />
            </div>

            <button
              onClick={startGame}
              className="w-full py-4 capcrunch-title text-lg capcrunch-btn-primary text-black transition-all active:translate-y-0.5"
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
      <div className="min-h-screen home-chalkboard flex items-center justify-center">
        <p className="capcrunch-kicker text-white/25 tracking-widest text-sm">Loading...</p>
      </div>
    );
  }

  // ── Game board ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col">
      <header className="px-4 py-3 border-b border-white/10 flex items-center gap-3 capcrunch-panel">
        <button onClick={() => setStatus('setup')} className="text-white/30 hover:text-white/70 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="capcrunch-title text-base text-[#FDF100]">Top Ten</h1>
        <span className="capcrunch-kicker text-[9px] text-white/20 tracking-[0.25em] uppercase">
          {sport.toUpperCase()} · {isTeamRound ? 'Team' : isDivisionRound ? 'Division' : 'League'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!isDone && (
            <button
              onClick={() => setShowTeamsPanel(v => !v)}
              className={`px-2.5 py-1 capcrunch-kicker text-[9px] tracking-widest uppercase border transition-colors ${
                showTeamsPanel
                  ? 'border-[#68BBE5]/60 text-[#68BBE5] bg-[#68BBE5]/10'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              Teams
            </button>
          )}
          {!isDone && (
            <button
              onClick={() => setHintMode(h => !h)}
              className={`px-2.5 py-1 capcrunch-kicker text-[9px] tracking-widest uppercase border transition-colors ${
                hintMode
                  ? 'border-[#FDF100]/60 text-[#FDF100] bg-[#FDF100]/10'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              Hint {hintMode ? 'On' : 'Off'}
            </button>
          )}
          {!isDone && (
            <button
              onClick={() => { setStatus('loading'); loadRound().catch(() => setStatus('setup')); }}
              className="px-2.5 py-1 capcrunch-kicker text-[9px] tracking-widest uppercase border border-white/12 text-white/25 hover:border-[#68BBE5]/50 hover:text-[#68BBE5] transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      </header>

      <TeamsReferencePanel sport={sport} show={showTeamsPanel} onClose={() => setShowTeamsPanel(false)} />

      <main className="relative z-10 flex-1 max-w-lg mx-auto w-full px-4 pb-10 flex flex-col gap-4">
        <TopTenCategoryHeader
          categoryLabel={categoryLabel}
          roundInfo={roundInfo}
          isTeamRound={isTeamRound}
          teamAbbr={teamAbbr}
          isCumulativeRound={isCumulativeRound}
          isSingleSeason={isSingleSeason}
          sport={sport}
        />

        {/* Strikes */}
        <div className="flex justify-center gap-2.5">
          {Array.from({ length: MAX_STRIKES }).map((_, i) => (
            <motion.div
              key={i}
              animate={i === strikes - 1 ? { scale: [1, 1.35, 1] } : {}}
              transition={{ duration: 0.28 }}
              className={`w-9 h-9 flex items-center justify-center border transition-all ${
                i < strikes
                  ? 'bg-[#E2008A]/14 border-[#E2008A]/45'
                  : 'bg-white/4 border-white/8'
              }`}
            >
              <span className={`capcrunch-title text-sm transition-colors ${i < strikes ? 'text-[#E2008A]' : 'text-white/15'}`}>✕</span>
            </motion.div>
          ))}
        </div>

        <FeedbackMessage feedback={feedback} />

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
                className="flex-1 bg-black/35 border border-[#68BBE5]/30 px-4 py-2.5 text-white capcrunch-body text-sm focus:outline-none focus:border-[#68BBE5] placeholder-white/12 transition-colors"
              />
              <button
                type="submit"
                className="px-5 py-2.5 capcrunch-btn-primary text-black shadow-[0_3px_0_rgba(253,241,0,0.18)] active:shadow-none active:translate-y-px capcrunch-title text-sm transition-all"
              >
                Guess
              </button>
            </form>

            {/* Autocomplete dropdown — max 3, no scroll */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-12 mt-0.5 bg-black/95 border border-white/10 z-30 overflow-hidden">
                {suggestions.map(name => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); submitGuess(name); }}
                    className="w-full text-left px-4 py-2.5 capcrunch-body text-sm text-white/60 hover:bg-white/5 hover:text-white border-b border-white/5 last:border-0 transition-colors"
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
                className="capcrunch-title text-2xl"
                style={{ color: guessedIndices.length === entries.length ? '#FDF100' : '#70BE5B' }}
              >
                {guessedIndices.length === entries.length ? '🎉 Perfect!' : `${guessedIndices.length} / ${entries.length} found`}
              </p>
            </div>
            <div className="flex gap-2.5 justify-center">
              <button
                onClick={playAgain}
                className="px-6 py-3 capcrunch-btn-primary text-black shadow-[0_3px_0_rgba(253,241,0,0.18)] active:shadow-none active:translate-y-px capcrunch-title text-base transition-all"
              >
                Play Again
              </button>
              <button
                onClick={() => setStatus('setup')}
                className="px-6 py-3 bg-black/35 border border-white/12 hover:border-[#68BBE5]/35 capcrunch-title text-base transition-colors text-white/40"
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
