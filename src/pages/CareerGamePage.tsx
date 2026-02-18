/**
 * CareerGamePage.tsx — Main gameplay page for "Guess the Career" mode.
 *
 * Shows a mystery player's year-by-year stat lines revealed one at a time.
 * Players guess who it is. Supports NBA and NFL with position-specific columns.
 * Two hint tiers: (1) reveal teams, (2) reveal bio.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCareerStore } from '../stores/careerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getNextGame, startPrefetch } from '../services/careerPrefetch';
import { normalizeTeamAbbr } from '../utils/teamAbbr';
import type { Sport } from '../types';

type LoadingState = 'loading' | 'ready' | 'error';

/** Stat column definitions per sport/position */
const NBA_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'min', label: 'MIN' },
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'fg_pct', label: 'FG%' },
  { key: 'fg3_pct', label: '3P%' },
];

const NFL_QB_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'completions', label: 'Comp' },
  { key: 'attempts', label: 'Att' },
  { key: 'passing_yards', label: 'Pass Yds' },
  { key: 'passing_tds', label: 'Pass TD' },
  { key: 'interceptions', label: 'INT' },
  { key: 'rushing_yards', label: 'Rush Yds' },
];

const NFL_RB_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'carries', label: 'Rush Att' },
  { key: 'rushing_yards', label: 'Rush Yds' },
  { key: 'rushing_tds', label: 'Rush TD' },
  { key: 'receptions', label: 'Rec' },
  { key: 'receiving_yards', label: 'Rec Yds' },
];

const NFL_WR_TE_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'targets', label: 'Targets' },
  { key: 'receptions', label: 'Rec' },
  { key: 'receiving_yards', label: 'Rec Yds' },
  { key: 'receiving_tds', label: 'Rec TD' },
];

function getColumns(sport: Sport, position: string) {
  if (sport === 'nba') return NBA_COLUMNS;
  switch (position) {
    case 'QB': return NFL_QB_COLUMNS;
    case 'RB': return NFL_RB_COLUMNS;
    default: return NFL_WR_TE_COLUMNS;
  }
}

function formatStat(key: string, value: any): string {
  if (key === 'fg_pct' || key === 'fg3_pct') {
    return (value * 100).toFixed(1);
  }
  return String(value ?? 0);
}

export function CareerGamePage() {
  const navigate = useNavigate();
  const { sport } = useSettingsStore();
  const store = useCareerStore();
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
      const game = await getNextGame(selectedSport);
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleGuess();
  }

  // Game over — navigate to results
  useEffect(() => {
    if (store.status === 'won' || store.status === 'lost') {
      const timer = setTimeout(() => navigate('/career/results'), 2000);
      return () => clearTimeout(timer);
    }
  }, [store.status, navigate]);

  const columns = getColumns(store.sport, store.position);
  const visibleSeasons = store.seasons;

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

      {/* Stat Table */}
      <div className="flex-1 overflow-x-auto mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-[#333]">
              {columns.map(col => (
                <th key={col.key} className="px-3 py-2 text-left sports-font text-[10px] text-[#888] tracking-wider uppercase whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {visibleSeasons.map((season, idx) => (
                <motion.tr
                  key={season.season + idx}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-b border-[#222] hover:bg-[#1a1a1a]"
                >
                  {columns.map(col => (
                    <td key={col.key} className="px-3 py-2 sports-font text-xs text-[var(--vintage-cream)] whitespace-nowrap">
                      {col.key === 'season'
                        ? (store.yearsRevealed ? season.season : '???')
                        : col.key === 'team'
                          ? normalizeTeamAbbr(formatStat(col.key, season[col.key]), store.sport)
                          : formatStat(col.key, season[col.key])
                      }
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Bio Panel (shown when hint 2 used) */}
      <AnimatePresence>
        {store.bioRevealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-[#1a1a1a] border border-[#333] rounded-lg p-4"
          >
            <div className="sports-font text-[10px] text-[#888] tracking-widest mb-2 uppercase">Player Bio</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {store.bio.height && (
                <div>
                  <div className="sports-font text-[8px] text-[#666] tracking-wider">HEIGHT</div>
                  <div className="sports-font text-sm text-[var(--vintage-cream)]">{store.bio.height}</div>
                </div>
              )}
              {store.bio.weight > 0 && (
                <div>
                  <div className="sports-font text-[8px] text-[#666] tracking-wider">WEIGHT</div>
                  <div className="sports-font text-sm text-[var(--vintage-cream)]">{store.bio.weight} lbs</div>
                </div>
              )}
              {(store.bio.school || store.bio.college) && (
                <div>
                  <div className="sports-font text-[8px] text-[#666] tracking-wider">SCHOOL</div>
                  <div className="sports-font text-sm text-[var(--vintage-cream)]">{store.bio.school || store.bio.college}</div>
                </div>
              )}
              {store.bio.draftYear ? (
                <div>
                  <div className="sports-font text-[8px] text-[#666] tracking-wider">DRAFT</div>
                  <div className="sports-font text-sm text-[var(--vintage-cream)]">{store.bio.draftYear}</div>
                </div>
              ) : store.bio.draftClub ? (
                <div>
                  <div className="sports-font text-[8px] text-[#666] tracking-wider">DRAFT</div>
                  <div className="sports-font text-sm text-[var(--vintage-cream)]">
                    {store.bio.draftClub} #{store.bio.draftNumber}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wrong Guesses */}
      {store.guesses.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {store.guesses.map((g, i) => (
            <span key={i} className="px-2 py-1 bg-red-900/30 border border-red-800/50 rounded text-xs sports-font text-red-300">
              {g}
            </span>
          ))}
        </div>
      )}

      {/* Initials hint display */}
      <AnimatePresence>
        {store.initialsRevealed && playerInitials && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 flex items-center justify-center gap-3"
          >
            <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase">Initials</div>
            <div className="retro-title text-2xl text-[#d4af37] tracking-widest">{playerInitials}</div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Controls (only while playing) */}
      {store.status === 'playing' && (
        <div className="flex flex-col gap-3">
          {/* Guess Input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type player name..."
              className="flex-1 bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-3 sports-font text-sm text-[var(--vintage-cream)] placeholder-[#555] focus:outline-none focus:border-[#555]"
              autoFocus
            />
            <button
              onClick={handleGuess}
              disabled={!guessInput.trim()}
              className="px-6 py-3 rounded-lg sports-font text-sm text-white disabled:opacity-50 transition-all"
              style={{ backgroundColor: accentColor }}
            >
              Guess
            </button>
          </div>

          {/* Feedback */}
          {feedbackMessage && (
            <div className={`text-center sports-font text-sm ${feedbackType === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
              {feedbackMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => store.revealYears()}
              disabled={store.yearsRevealed}
              className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3d3d3d] text-[var(--vintage-cream)] hover:border-[#555] disabled:opacity-30 transition-all"
            >
              {store.yearsRevealed ? 'Years Shown' : 'Hint: Show Years (-3)'}
            </button>
            <button
              onClick={() => store.revealBio()}
              disabled={store.bioRevealed}
              className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3d3d3d] text-[var(--vintage-cream)] hover:border-[#555] disabled:opacity-30 transition-all"
            >
              {store.bioRevealed ? 'Bio Shown' : 'Hint: Show Bio (-3)'}
            </button>
            <button
              onClick={() => store.revealInitials()}
              disabled={store.initialsRevealed}
              className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3d3d3d] text-[var(--vintage-cream)] hover:border-[#555] disabled:opacity-30 transition-all"
            >
              {store.initialsRevealed ? 'Initials Shown' : 'Hint: Show Initials (-10)'}
            </button>
            <button
              onClick={() => store.giveUp()}
              className="px-4 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-red-900/50 text-red-400 hover:border-red-700 transition-all"
            >
              Give Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
