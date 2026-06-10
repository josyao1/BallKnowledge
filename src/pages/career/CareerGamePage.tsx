import { useState, useEffect, useRef, useMemo } from 'react';
import { useGuessInput } from '../../hooks/useGuessInput';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCareerStore } from '../../stores/careerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getNextGame, startPrefetch } from '../../services/careerPrefetch';
import { getColumns } from '../../components/career/careerColumns';
import { CareerStatsTable }   from '../../components/career/CareerStatsTable';
import { CareerBioPanel }     from '../../components/career/CareerBioPanel';
import { CareerWrongGuesses } from '../../components/career/CareerWrongGuesses';
import { CareerInitialsHint } from '../../components/career/CareerInitialsHint';
import { CareerControls }     from '../../components/career/CareerControls';
import { PlayerHeadshot }     from '../../components/capCrunch/PlayerHeadshot';
import type { Sport } from '../../types';

const COLOR = '#22c55e';
type LoadingState = 'loading' | 'ready' | 'error';

export function CareerGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sport } = useSettingsStore();
  const store = useCareerStore();

  const locState = location.state as { careerTo?: number; minMpg?: number; minYards?: number } | null;
  const careerFilters = useMemo(() => {
    const f: { careerTo?: number; minMpg?: number; minYards?: number } = {};
    if (locState?.careerTo) f.careerTo = locState.careerTo;
    if (locState?.minMpg)   f.minMpg   = locState.minMpg;
    if (locState?.minYards) f.minYards  = locState.minYards;
    return Object.keys(f).length ? f : undefined;
  }, []);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const { guessInput, setGuessInput, feedbackMsg: feedbackMessage, setFeedbackMsg: setFeedbackMessage, feedbackType, setFeedbackType, inputRef } = useGuessInput();

  const playerInitials = (() => {
    if (!store.playerName) return null;
    const parts = store.playerName.trim().split(/\s+/);
    const first = parts[0]?.[0]?.toUpperCase() ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() : '';
    return last ? `${first}. ${last}.` : `${first}.`;
  })();

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadNewGame(sport);
  }, []);

  async function loadNewGame(selectedSport: Sport) {
    setLoadingState('loading');
    store.resetGame();
    try {
      const game = await getNextGame(selectedSport, careerFilters);
      if (!game) { setLoadingState('error'); return; }
      store.initGame(game.data, game.sport);
      setLoadingState('ready');
      startPrefetch(selectedSport);
    } catch {
      setLoadingState('error');
    }
  }

  function handleGuess() {
    const name = guessInput.trim();
    if (!name) return;
    const result = store.makeGuess(name);
    setGuessInput('');
    if (result.correct) {
      setFeedbackMessage('Correct!');
      setFeedbackType('correct');
    } else {
      setFeedbackMessage(`"${name}" is wrong`);
      setFeedbackType('wrong');
      setTimeout(() => { setFeedbackMessage(''); setFeedbackType(''); }, 2000);
    }
  }

  function handleBack() {
    navigate('/', { state: { openCareer: true, gpSport: store.sport } });
  }

  useEffect(() => {
    if (store.status === 'won' || store.status === 'lost') {
      const timer = setTimeout(() => navigate('/career/results', { state: locState }), 2000);
      return () => clearTimeout(timer);
    }
  }, [store.status, navigate]);

  const columns = getColumns(store.sport, store.position);
  const visibleSeasons = store.seasons;

  const careerHighs = useMemo(() => {
    const highs: Record<string, number> = {};
    for (const col of columns) {
      if (col.key === 'season' || col.key === 'team') continue;
      const max = Math.max(0, ...visibleSeasons.map(s => Number(s[col.key]) || 0));
      if (max > 0) highs[col.key] = max;
    }
    return highs;
  }, [visibleSeasons, columns]);

  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen home-chalkboard flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: COLOR, borderTopColor: 'transparent' }} />
        <span className="capcrunch-kicker text-sm text-white/50">Loading career data…</span>
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div className="min-h-screen home-chalkboard flex flex-col items-center justify-center gap-4">
        <span className="capcrunch-kicker text-sm text-red-400">Failed to load career data.</span>
        <div className="flex gap-3">
          <button
            onClick={() => loadNewGame(sport)}
            className="capcrunch-title px-6 py-2 text-sm text-black"
            style={{ background: COLOR }}
          >
            Retry
          </button>
          <button onClick={() => navigate('/')} className="capcrunch-btn-secondary capcrunch-kicker px-6 py-2 text-xs">
            Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col p-4 md:p-6">
      {/* Header */}
      <header className="capcrunch-panel mb-4 p-3 md:p-4 flex items-center gap-3" style={{ borderColor: `${COLOR}33` }}>
        <button onClick={handleBack} className="text-white/40 hover:text-white transition-colors flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="capcrunch-kicker text-[9px] px-2 py-0.5 border" style={{ color: COLOR, borderColor: `${COLOR}60`, backgroundColor: `${COLOR}15` }}>
            {store.sport.toUpperCase()}
          </span>
          {store.position && (
            <span className="capcrunch-kicker text-[9px] px-2 py-0.5 border border-white/15 text-white/50">
              {store.position}
            </span>
          )}
          <h1 className="capcrunch-title text-xl md:text-2xl text-white">Career Arc</h1>
        </div>

        <div className="capcrunch-panel px-4 py-2 text-center flex-shrink-0" style={{ borderColor: `${COLOR}33` }}>
          <div className="capcrunch-kicker text-[8px] text-white/40">SCORE</div>
          <div className="capcrunch-title text-2xl" style={{ color: store.score > 10 ? COLOR : store.score > 5 ? '#eab308' : '#ef4444' }}>
            {store.score}
          </div>
        </div>
      </header>

      <CareerStatsTable
        columns={columns}
        seasons={visibleSeasons}
        careerHighs={careerHighs}
        yearsRevealed={store.yearsRevealed}
        sport={store.sport}
      />

      <CareerBioPanel bio={store.bio} revealed={store.bioRevealed} />
      <CareerWrongGuesses guesses={store.guesses} />
      <CareerInitialsHint revealed={store.initialsRevealed} initials={playerInitials} />

      {/* Game Over Banner */}
      <AnimatePresence>
        {(store.status === 'won' || store.status === 'lost') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 capcrunch-panel p-4 text-center"
            style={{ borderColor: store.status === 'won' ? `${COLOR}60` : '#ef444460', backgroundColor: store.status === 'won' ? `${COLOR}10` : '#ef444410' }}
          >
            <div className="capcrunch-kicker text-[9px] text-white/40 mb-3">
              {store.status === 'won' ? 'You Got It!' : 'Game Over'}
            </div>
            <div className="flex items-center justify-center gap-3 mb-2">
              <PlayerHeadshot
                playerId={store.playerId ?? undefined}
                sport={store.sport}
                className="w-14 h-14 rounded-full object-cover shrink-0 border-2 border-white/10"
              />
              <div className="capcrunch-title text-2xl" style={{ color: store.status === 'won' ? COLOR : '#ef4444' }}>
                {store.playerName}
              </div>
            </div>
            <div className="capcrunch-kicker text-xs text-white/50">
              {store.status === 'won' ? `Final Score: ${store.score}` : 'Score: 0'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {store.status === 'playing' && (
        <CareerControls
          guessInput={guessInput}
          onGuessChange={setGuessInput}
          onGuess={handleGuess}
          feedbackMessage={feedbackMessage}
          feedbackType={feedbackType}
          accentColor={COLOR}
          yearsRevealed={store.yearsRevealed}
          bioRevealed={store.bioRevealed}
          initialsRevealed={store.initialsRevealed}
          onRevealYears={() => store.revealYears()}
          onRevealBio={() => store.revealBio()}
          onRevealInitials={() => store.revealInitials()}
          onGiveUp={() => store.giveUp()}
          inputRef={inputRef}
        />
      )}
    </div>
  );
}
