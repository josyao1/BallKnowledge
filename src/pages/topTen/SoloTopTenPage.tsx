import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  isValidGuess,
  getCategoryDef,
  getPlayerSuggestions,
  generateTopTenRound,
  getStatShortLabel,
} from '../../services/topTen';
import type { TopTenEntry } from '../../services/topTen';
import { TopTenEntryRow } from '../../components/topTen/TopTenEntryRow';
import { WrongGuessesList } from '../../components/topTen/WrongGuessesList';
import { TeamsReferencePanel } from '../../components/topTen/TeamsReferencePanel';
import { TopTenCategoryHeader } from '../../components/topTen/TopTenCategoryHeader';
import { FeedbackMessage } from '../../components/topTen/FeedbackMessage';
import { TopTenSettings } from '../../components/lobby/settings/TopTenSettings';

const MAX_STRIKES = 3;
const NBA_MIN = 1996;
const NBA_MAX = 2025;
const NFL_MIN = 1999;
const NFL_MAX = 2025;

type Status = 'setup' | 'loading' | 'playing' | 'done';

function decodeDivision(encoded: string): { conference: string; division: string } {
  const [conference, division] = encoded.split('|');
  return { conference, division };
}

type LocationState = {
  sport?: 'nba' | 'nfl';
  roundType?: 'league' | 'division' | 'team';
  divisionMode?: 'cumulative' | 'single_season';
  minYear?: number;
  maxYear?: number;
  windowYears?: number;
  pinnedDivision?: string | null;
  pinnedTeam?: string | null;
  strikeMode?: 'strikes' | 'infinite';
} | null;

export function SoloTopTenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state as LocationState) ?? null;
  const { sport: storeSport } = useSettingsStore();

  const defaultSport: 'nba' | 'nfl' =
    locState?.sport ?? (storeSport === 'nba' || storeSport === 'nfl' ? storeSport : 'nba');

  const [setupSport, setSetupSport] = useState<'nba' | 'nfl'>(defaultSport);
  const [strikeMode, setStrikeMode] = useState<'strikes' | 'infinite'>(
    locState?.strikeMode ?? 'strikes',
  );
  const [roundType, setRoundType] = useState<'league' | 'division' | 'team'>(
    locState?.roundType ?? 'league',
  );
  const [divisionMode, setDivisionMode] = useState<'cumulative' | 'single_season'>(
    locState?.divisionMode ?? 'cumulative',
  );
  const [minYear, setMinYear] = useState(locState?.minYear ?? NBA_MIN);
  const [maxYear, setMaxYear] = useState(locState?.maxYear ?? NBA_MAX);
  const [windowYears, setWindowYears] = useState(locState?.windowYears ?? 10);
  const [pinnedDivision, setPinnedDivision] = useState<string | null>(
    locState?.pinnedDivision ?? null,
  );
  const [pinnedTeam, setPinnedTeam] = useState<string | null>(locState?.pinnedTeam ?? null);

  const [sport, setSport] = useState<'nba' | 'nfl'>(defaultSport);
  const [entries, setEntries] = useState<TopTenEntry[]>([]);
  const [category, setCategory] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [roundInfo, setRoundInfo] = useState('');
  const [guessedIndices, setGuessedIndices] = useState<number[]>([]);
  const [strikes, setStrikes] = useState(0);
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState<{ msg: string; type: 'correct' | 'wrong' | '' }>({
    msg: '',
    type: '',
  });
  const [status, setStatus] = useState<Status>(locState ? 'loading' : 'setup');
  const [hintLevel, setHintLevel] = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [isDivisionRound, setIsDivisionRound] = useState(false);
  const [isTeamRound, setIsTeamRound] = useState(false);
  const [isSingleSeason, setIsSingleSeason] = useState(false);
  const [teamAbbr, setTeamAbbr] = useState('');

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showTeamsPanel, setShowTeamsPanel] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    },
    [],
  );

  const activeConfig = useRef({
    sport: defaultSport as 'nba' | 'nfl',
    roundType: (locState?.roundType ?? 'league') as 'league' | 'division' | 'team',
    divisionMode: (locState?.divisionMode ?? 'cumulative') as 'cumulative' | 'single_season',
    minYear: locState?.minYear ?? NBA_MIN,
    maxYear: locState?.maxYear ?? NBA_MAX,
    windowYears: locState?.windowYears ?? 10,
  });

  // Auto-start when settings arrive from home screen
  useEffect(() => {
    if (!locState) return;
    const pinned = {
      division: locState.pinnedDivision ? decodeDivision(locState.pinnedDivision) : undefined,
      team: locState.pinnedTeam ?? undefined,
    };
    loadRound(pinned).catch(() => setStatus('setup'));
  }, []);

  useEffect(() => {
    if (locState) return; // sport synced from locState already
    const sMin = setupSport === 'nba' ? NBA_MIN : NFL_MIN;
    const sMax = setupSport === 'nba' ? NBA_MAX : NFL_MAX;
    setMinYear(sMin);
    setMaxYear(sMax);
  }, [setupSport]);

  async function startGame() {
    activeConfig.current = {
      sport: setupSport,
      roundType,
      divisionMode,
      minYear,
      maxYear,
      windowYears,
    };
    setSport(setupSport);
    setStatus('loading');
    const pinned = {
      division: pinnedDivision ? decodeDivision(pinnedDivision) : undefined,
      team: pinnedTeam ?? undefined,
    };
    try {
      await loadRound(pinned);
    } catch {
      setStatus('setup');
    }
  }

  async function playAgain() {
    setStatus('loading');
    try {
      await loadRound();
    } catch {
      setStatus('setup');
    }
  }

  async function loadRound(pinned?: {
    division?: { conference: string; division: string };
    team?: string;
  }) {
    const {
      sport: s,
      roundType: rt,
      divisionMode: dm,
      minYear: mn,
      maxYear: mx,
      windowYears: wy,
    } = activeConfig.current;
    const {
      entries: result,
      cat,
      catLabel,
      roundInfo: info,
      isDivisionRound: div,
      isTeamRound: team,
      isSingleSeason: ss,
      teamAbbr: ta,
    } = await generateTopTenRound({
      sport: s,
      roundType: rt,
      divisionMode: dm,
      minYear: mn,
      maxYear: mx,
      windowYears: wy,
      pinnedDivision: pinned?.division,
      pinnedTeam: pinned?.team,
    });
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
    setHintLevel(0);
    setWrongGuesses([]);
    setStatus('playing');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleBackToSetup() {
    if (locState) navigate('/', { state: { openTopTen: true, topTenSport: sport } });
    else setStatus('setup');
  }

  function clearFeedback() {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback({ msg: '', type: '' }), 1800);
  }

  function submitGuess(value: string) {
    if (!value.trim() || status !== 'playing') return;
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
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
        setFeedback({ msg: 'Already guessed!', type: 'wrong' });
        clearFeedback();
        inputRef.current?.focus();
        return;
      }
      const n = strikes + 1;
      setStrikes(n);
      setWrongGuesses((prev) => [...prev, value.trim()]);
      setGuess('');
      const hitStrikeLimit = strikeMode === 'strikes' && n >= MAX_STRIKES;
      setFeedback({
        msg: hitStrikeLimit ? 'Strike 3 — game over!' : '✗ Not in the top 10',
        type: 'wrong',
      });
      clearFeedback();
      if (hitStrikeLimit) setStatus('done');
    }
    inputRef.current?.focus();
  }

  function handleInputChange(val: string) {
    setGuess(val);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (val.length < 4) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(() => {
      getPlayerSuggestions(sport, val)
        .then((s) => setSuggestions(s))
        .catch(() => {});
    }, 120);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitGuess(guess);
  }

  const isDone = status === 'done';
  const catDef = getCategoryDef(sport, category);
  const isCumulativeRound = isDivisionRound || isTeamRound;
  const statShortLabel = getStatShortLabel(catDef);
  const maxHintLevel = isDivisionRound || isTeamRound ? 1 : 2;
  const showTeamHint = isDivisionRound || isSingleSeason || hintLevel >= 1;
  const showInitialsHint = isDivisionRound || isTeamRound ? hintLevel >= 1 : hintLevel >= 2;

  // ── Setup screen (modal style) ────────────────────────────────────────────────
  if (status === 'setup') {
    return (
      <div className="min-h-screen home-chalkboard text-white flex flex-col">
        <header className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <h1 className="capcrunch-title text-xl text-[#70BE5B]">Top Ten</h1>
          <span className="ml-auto capcrunch-kicker text-[9px] text-white/20 tracking-[0.25em]">
            Solo
          </span>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="flex items-end gap-px mb-6 justify-center" aria-hidden>
              {['1', '2', '3', '4', '5'].map((n, i) => (
                <span
                  key={n}
                  className="capcrunch-title leading-none"
                  style={{ fontSize: 34 - i * 4, color: '#70BE5B', opacity: 1 - i * 0.18 }}
                >
                  {n}
                </span>
              ))}
            </div>

            <div
              className="capcrunch-panel p-5 space-y-5"
              style={{ borderColor: 'rgba(112,190,91,0.3)' }}
            >
              <TopTenSettings
                sport={setupSport}
                onSportChange={setSetupSport}
                roundType={roundType}
                onRoundTypeChange={setRoundType}
                divisionMode={divisionMode}
                onDivisionModeChange={setDivisionMode}
                minYear={minYear}
                onMinYearChange={setMinYear}
                maxYear={maxYear}
                onMaxYearChange={setMaxYear}
                windowYears={windowYears}
                onWindowYearsChange={setWindowYears}
                pinnedDivision={pinnedDivision}
                onPinnedDivisionChange={setPinnedDivision}
                pinnedTeam={pinnedTeam}
                onPinnedTeamChange={setPinnedTeam}
              />
              <div className="border-t border-white/8 pt-4">
                <p className="capcrunch-kicker text-[9px] text-white/30 tracking-[0.25em] mb-2">
                  Mode
                </p>
                <div className="flex gap-2">
                  {(['strikes', 'infinite'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setStrikeMode(m)}
                      className={`flex-1 py-1.5 capcrunch-kicker text-[10px] tracking-[0.2em] border transition-colors ${
                        strikeMode === m
                          ? 'border-[#70BE5B]/60 text-[#70BE5B] bg-[#70BE5B]/8'
                          : 'border-white/12 text-white/35 hover:border-white/25 hover:text-white/60'
                      }`}
                    >
                      {m === 'strikes' ? '3 Strikes' : 'Infinite'}
                    </button>
                  ))}
                </div>
                {strikeMode === 'infinite' && (
                  <p className="capcrunch-kicker text-[9px] text-white/25 mt-1.5">
                    Guess until you clear the board or give up.
                  </p>
                )}
              </div>
              <button
                onClick={startGame}
                className="capcrunch-title text-lg w-full py-3 text-black transition-all active:translate-y-px"
                style={{ background: '#70BE5B', boxShadow: '0 3px 0 rgba(60,130,45,0.9)' }}
              >
                Play
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen home-chalkboard flex items-center justify-center">
        <p className="capcrunch-kicker text-white/25 tracking-[0.3em]">Loading...</p>
      </div>
    );
  }

  // ── Game board ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col">
      <header className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
        <button
          onClick={handleBackToSetup}
          className="text-white/30 hover:text-white/70 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <h1 className="capcrunch-title text-base text-[#70BE5B]">Top Ten</h1>
        <span className="capcrunch-kicker text-[9px] text-white/20 tracking-[0.25em]">
          {sport.toUpperCase()} · {isTeamRound ? 'Team' : isDivisionRound ? 'Division' : 'League'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!isDone && (
            <button
              onClick={() => setShowTeamsPanel((v) => !v)}
              className={`px-2.5 py-1 capcrunch-kicker text-[9px] tracking-[0.25em] border transition-colors ${
                showTeamsPanel
                  ? 'border-[#70BE5B]/60 text-[#70BE5B] bg-[#70BE5B]/8'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              Teams
            </button>
          )}
          {!isDone && (
            <button
              onClick={() => setHintLevel((l) => (l >= maxHintLevel ? 0 : l + 1))}
              className={`px-2.5 py-1 capcrunch-kicker text-[9px] tracking-[0.25em] border transition-colors ${
                hintLevel > 0
                  ? 'border-[#70BE5B]/60 text-[#70BE5B] bg-[#70BE5B]/8'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              {hintLevel === 0 ? 'Hint Off' : hintLevel === 1 ? 'Hint 1' : 'Hint 2'}
            </button>
          )}
          {!isDone && (
            <button
              onClick={() => {
                setStatus('loading');
                loadRound().catch(() => setStatus('setup'));
              }}
              className="px-2.5 py-1 capcrunch-kicker text-[9px] tracking-[0.25em] border border-white/12 text-white/25 hover:border-white/30 hover:text-white/50 transition-colors"
            >
              Skip
            </button>
          )}
          {!isDone && strikeMode === 'infinite' && (
            <button
              onClick={() => setStatus('done')}
              className="px-2.5 py-1 capcrunch-kicker text-[9px] tracking-[0.25em] border border-white/12 text-white/25 hover:border-red-500/40 hover:text-red-400/60 transition-colors"
            >
              Give Up
            </button>
          )}
        </div>
      </header>

      <TeamsReferencePanel
        sport={sport}
        show={showTeamsPanel}
        onClose={() => setShowTeamsPanel(false)}
      />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-10 flex flex-col gap-4">
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
        {strikeMode === 'strikes' && (
          <div className="flex justify-center gap-2.5">
            {Array.from({ length: MAX_STRIKES }).map((_, i) => (
              <motion.div
                key={i}
                animate={i === strikes - 1 ? { scale: [1, 1.35, 1] } : {}}
                transition={{ duration: 0.28 }}
                className={`w-9 h-9 flex items-center justify-center border transition-all ${
                  i < strikes ? 'bg-red-950/70 border-red-600/50' : 'bg-black/40 border-white/8'
                }`}
              >
                <span
                  className={`capcrunch-title text-sm transition-colors ${i < strikes ? 'text-red-400' : 'text-white/15'}`}
                >
                  ✕
                </span>
              </motion.div>
            ))}
          </div>
        )}

        <FeedbackMessage feedback={feedback} />

        {/* Guess input */}
        {!isDone && (
          <div className="relative">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                value={guess}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setSuggestions([])}
                placeholder="Name a player..."
                autoComplete="off"
                className="flex-1 bg-black/40 border border-white/15 px-4 py-2.5 text-white capcrunch-kicker text-sm focus:outline-none focus:border-[#70BE5B]/50 placeholder-white/20 transition-colors"
              />
              <button type="submit" className="capcrunch-btn-primary capcrunch-title text-sm px-5">
                Guess
              </button>
            </form>

            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-[88px] mt-0.5 bg-black/90 border border-white/10 z-30 overflow-hidden">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      submitGuess(name);
                    }}
                    className="w-full text-left px-4 py-2.5 capcrunch-kicker text-sm text-white/60 hover:bg-white/5 hover:text-white border-b border-white/5 last:border-0 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <WrongGuessesList wrongGuesses={wrongGuesses} />

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
              showInitialsHint={showInitialsHint}
              sport={sport}
              categoryKey={category}
              catDef={catDef}
              statShortLabel={statShortLabel}
              justGuessed={
                guessedIndices.includes(i) && guessedIndices[guessedIndices.length - 1] === i
              }
            />
          ))}
        </div>

        {/* Done state */}
        {isDone && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="capcrunch-panel p-5 text-center space-y-3"
          >
            <p
              className="capcrunch-title text-2xl"
              style={{ color: guessedIndices.length === entries.length ? '#70BE5B' : '#70BE5B' }}
            >
              {guessedIndices.length === entries.length
                ? 'Perfect!'
                : `${guessedIndices.length} / ${entries.length} found`}
            </p>
            <div className="flex gap-2.5 justify-center">
              <button
                onClick={playAgain}
                className="capcrunch-btn-primary capcrunch-title text-base px-6 py-3"
              >
                Play Again
              </button>
              <button
                onClick={handleBackToSetup}
                className="capcrunch-btn-secondary capcrunch-kicker px-6 py-3"
              >
                {locState ? 'Home' : 'Settings'}
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
