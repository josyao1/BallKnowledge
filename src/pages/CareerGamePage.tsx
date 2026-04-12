/**
 * CareerGamePage.tsx — Main gameplay page for "Guess the Career" mode.
 *
 * Shows a mystery player's year-by-year stat lines revealed one at a time.
 * Players guess who it is. Supports NBA and NFL with position-specific columns.
 * Two hint tiers: (1) reveal teams, (2) reveal bio.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCareerStore } from '../stores/careerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getNextGame, startPrefetch } from '../services/careerPrefetch';
import { getColumns } from '../components/career/careerColumns';
import { CareerStatsTable }   from '../components/career/CareerStatsTable';
import { CareerBioPanel }     from '../components/career/CareerBioPanel';
import { CareerWrongGuesses } from '../components/career/CareerWrongGuesses';
import { CareerInitialsHint } from '../components/career/CareerInitialsHint';
import { CareerControls }     from '../components/career/CareerControls';
import type { Sport } from '../types';

type LoadingState = 'loading' | 'ready' | 'error';

export function CareerGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sport } = useSettingsStore();
  const store = useCareerStore();

  // Preserve filters passed from home setup panel
  const careerFilters = useMemo(() => {
    const state = location.state as { careerTo?: number } | null;
    return state?.careerTo ? { careerTo: state.careerTo } : undefined;
  }, []);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [guessInput, setGuessInput] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'correct' | 'wrong' | ''>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const accentColor = sport === 'nba' ? 'var(--nba-orange)' : '#013369';

  // Derive initials from playerName (first letter of first + last word)
  const playerInitials = (() => {
    if (!store.playerName) return null;
    const parts = store.playerName.trim().split(/\s+/);
    const first = parts[0]?.[0]?.toUpperCase() ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() : '';
    return last ? `${first}. ${last}.` : `${first}.`;
  })();

  // Load a random player on mount — use a ref to prevent the Strict Mode
  // double-invoke from loading two different players in sequence.
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

      // Kick off background prefetch for next games
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
      setTimeout(() => {
        setFeedbackMessage('');
        setFeedbackType('');
      }, 2000);
    }
  }

  // Game over — navigate to results
  useEffect(() => {
    if (store.status === 'won' || store.status === 'lost') {
      const timer = setTimeout(() => navigate('/career/results', { state: location.state }), 2000);
      return () => clearTimeout(timer);
    }
  }, [store.status, navigate]);

  const columns = getColumns(store.sport, store.position);
  const visibleSeasons = store.seasons;

  // Career highs: max value per numeric column across all seasons.
  // Computed from the full season list so the highlight is stable as rows appear.
  const careerHighs = useMemo(() => {
    const highs: Record<string, number> = {};
    for (const col of columns) {
      if (col.key === 'season' || col.key === 'team') continue;
      const max = Math.max(0, ...visibleSeasons.map(s => Number(s[col.key]) || 0));
      if (max > 0) highs[col.key] = max;
    }
    return highs;
  }, [visibleSeasons, columns]);

  // Loading screen
  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center gap-4">
        <div className={`w-10 h-10 border-4 rounded-full animate-spin`} style={{ borderColor: accentColor, borderTopColor: 'transparent' }} />
        <span className="sports-font text-sm text-[var(--vintage-cream)]">Loading career data...</span>
      </div>
    );
  }

  // Error screen
  if (loadingState === 'error') {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center gap-4">
        <span className="sports-font text-sm text-red-400">Failed to load career data. Is the API server running?</span>
        <div className="flex gap-3">
          <button onClick={() => loadNewGame(sport)} className="retro-btn retro-btn-gold px-6 py-2">Retry</button>
          <button onClick={() => navigate('/')} className="px-6 py-2 rounded-lg sports-font border-2 border-[#3d3d3d] text-[#888] hover:border-[#555] text-sm">Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col p-4 md:p-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-[#666] hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] sports-font tracking-wider text-white" style={{ backgroundColor: accentColor }}>
                {store.sport.toUpperCase()}
              </span>
              {store.position && (
                <span className="px-2 py-0.5 rounded text-[10px] sports-font tracking-wider bg-[#333] text-white">
                  {store.position}
                </span>
              )}
            </div>
            <h1 className="retro-title text-2xl md:text-3xl text-[var(--vintage-cream)] mt-1">Guess the Career</h1>
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center gap-4">
          <div className="bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-2 text-center">
            <div className="sports-font text-[8px] text-[#888] tracking-widest">SCORE</div>
            <div className="retro-title text-2xl" style={{ color: store.score > 10 ? '#22c55e' : store.score > 5 ? '#eab308' : '#ef4444' }}>
              {store.score}
            </div>
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
            className={`mb-4 p-4 rounded-lg text-center ${
              store.status === 'won' ? 'bg-green-900/30 border border-green-600' : 'bg-red-900/30 border border-red-600'
            }`}
          >
            <div className="retro-title text-2xl">
              {store.status === 'won' ? 'You Got It!' : 'Game Over'}
            </div>
            <div className="sports-font text-lg text-[var(--vintage-cream)] mt-1">{store.playerName}</div>
            <div className="sports-font text-sm text-[#888] mt-1">
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
          accentColor={accentColor}
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
