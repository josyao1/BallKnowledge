import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  getTopTen, getTopTenDivision, pickRandomCategory,
  getAvailableYears, isValidGuess, getCategoryDef, formatStat,
} from '../../services/topTen';
import { getNBADivisions } from '../../data/teams';
import { getNFLDivisions } from '../../data/nfl-teams';
import type { TopTenEntry } from '../../services/topTen';

const MAX_STRIKES = 3;

export function SoloTopTenPage() {
  const navigate = useNavigate();
  const { sport } = useSettingsStore();

  const [entries, setEntries]           = useState<TopTenEntry[]>([]);
  const [category, setCategory]         = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [roundInfo, setRoundInfo]       = useState('');
  const [guessedIndices, setGuessedIndices] = useState<number[]>([]);
  const [strikes, setStrikes]           = useState(0);
  const [guess, setGuess]               = useState('');
  const [feedback, setFeedback]         = useState<{ msg: string; type: 'correct' | 'wrong' | '' }>({ msg: '', type: '' });
  const [status, setStatus]             = useState<'loading' | 'playing' | 'done'>('loading');
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRound();
  }, []);

  async function loadRound() {
    setStatus('loading');
    const cat = pickRandomCategory(sport);
    setCategory(cat.key);
    setCategoryLabel(cat.label);

    const years = getAvailableYears(sport);
    const isDivision = Math.random() < 0.4;

    let result: TopTenEntry[] = [];
    let info = '';

    if (isDivision) {
      const divisions = sport === 'nba' ? getNBADivisions() : getNFLDivisions();
      const div = divisions[Math.floor(Math.random() * divisions.length)];
      const windowYears = [5, 10, 15][Math.floor(Math.random() * 3)];
      const currentYear = sport === 'nba' ? 2025 : 2024;
      const fromYear = currentYear - windowYears;
      result = await getTopTenDivision(sport, cat.key, div.conference, div.division, fromYear, currentYear);
      info = `${div.conference} ${div.division} · last ${windowYears} years`;
    } else {
      const year = years[Math.floor(Math.random() * years.length)];
      result = await getTopTen(sport, cat.key, year);
      info = sport === 'nba' ? `${year}-${String(year + 1).slice(-2)} season` : `${year} season`;
    }

    if (result.length < 5) {
      // Retry with a simple league round if division returned too few results
      const year = years[years.length - 3 + Math.floor(Math.random() * 3)];
      result = await getTopTen(sport, cat.key, year);
      info = sport === 'nba' ? `${year}-${String(year + 1).slice(-2)} season` : `${year} season`;
    }

    setEntries(result);
    setRoundInfo(info);
    setGuessedIndices([]);
    setStrikes(0);
    setGuess('');
    setStatus('playing');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function clearFeedback() {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback({ msg: '', type: '' }), 1800);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim() || status !== 'playing') return;

    const matched = isValidGuess(guess.trim(), entries, guessedIndices);
    if (matched.length > 0) {
      const newGuessed = [...guessedIndices, ...matched];
      setGuessedIndices(newGuessed);
      setGuess('');
      setFeedback({ msg: `✓ ${entries[matched[0]].playerName}`, type: 'correct' });
      clearFeedback();
      if (newGuessed.length === entries.length) {
        setStatus('done');
      }
    } else {
      const newStrikes = strikes + 1;
      setStrikes(newStrikes);
      setGuess('');
      setFeedback({ msg: newStrikes >= MAX_STRIKES ? 'Strike 3 — game over!' : `✗ Not in the top 10`, type: 'wrong' });
      clearFeedback();
      if (newStrikes >= MAX_STRIKES) {
        setStatus('done');
      }
    }
    inputRef.current?.focus();
  }

  const isDone = status === 'done';
  const catDef = getCategoryDef(sport, category);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-white/10 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="retro-title text-xl text-[#22c55e]">Top Ten</h1>
        <span className="sports-font text-[10px] text-white/30 tracking-widest uppercase ml-auto">
          {sport.toUpperCase()} · Solo
        </span>
      </header>

      {status === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <p className="sports-font text-white/40 tracking-widest text-sm">Loading...</p>
        </div>
      )}

      {status !== 'loading' && (
        <main className="flex-1 max-w-lg mx-auto w-full p-4 flex flex-col gap-4">
          {/* Round info */}
          <div className="text-center pt-2">
            <p className="retro-title text-2xl text-[#22c55e]">{categoryLabel}</p>
            <p className="sports-font text-[11px] text-white/40 tracking-widest uppercase mt-1">{roundInfo}</p>
          </div>

          {/* Strikes */}
          <div className="flex justify-center gap-2">
            {Array.from({ length: MAX_STRIKES }).map((_, i) => (
              <span
                key={i}
                className={`text-2xl transition-all ${i < strikes ? 'opacity-100' : 'opacity-20'}`}
              >
                ✕
              </span>
            ))}
          </div>

          {/* Feedback */}
          <div className="h-6 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {feedback.type && (
                <motion.p
                  key={feedback.msg}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`sports-font text-sm tracking-wider ${feedback.type === 'correct' ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {feedback.msg}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Guess input */}
          {!isDone && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                value={guess}
                onChange={e => setGuess(e.target.value)}
                placeholder="Type a player name..."
                className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-sm px-4 py-3 text-white sports-font text-sm focus:outline-none focus:border-[#22c55e] placeholder-white/20"
                autoComplete="off"
              />
              <button
                type="submit"
                className="px-4 py-3 bg-[#22c55e] hover:bg-[#16a34a] rounded-sm retro-title text-sm transition-colors"
              >
                Guess
              </button>
            </form>
          )}

          {/* Board */}
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const isRevealed = guessedIndices.includes(i) || isDone;
              const wasGuessed = guessedIndices.includes(i);
              return (
                <motion.div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-sm border transition-all ${
                    isRevealed
                      ? wasGuessed
                        ? 'bg-emerald-900/30 border-emerald-600/50'
                        : 'bg-[#1a1a1a] border-white/10'
                      : 'bg-[#111] border-[#1a1a1a]'
                  }`}
                >
                  <span className="sports-font text-[11px] text-white/30 w-5 text-right shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {isRevealed ? (
                      <div>
                        <p className={`retro-title text-base ${wasGuessed ? 'text-emerald-300' : 'text-white/60'}`}>
                          {entry.playerName}
                        </p>
                        <p className="sports-font text-[10px] text-white/30 mt-0.5">
                          {entry.team} · {entry.year}
                        </p>
                      </div>
                    ) : (
                      <p className="sports-font text-white/20">???</p>
                    )}
                  </div>
                  {isRevealed && catDef && (
                    <span className="sports-font text-sm text-[#22c55e] shrink-0">
                      {formatStat(entry.stat, category)} {catDef.shortLabel}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Done state */}
          {isDone && (
            <div className="text-center space-y-3 pt-2 pb-8">
              <p className="retro-title text-xl text-[#d4af37]">
                {guessedIndices.length === entries.length
                  ? '🎉 Perfect!'
                  : `${guessedIndices.length} / ${entries.length} found`}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={loadRound}
                  className="px-6 py-3 bg-[#22c55e] hover:bg-[#16a34a] rounded-sm retro-title text-base transition-colors"
                >
                  Play Again
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-[#1a1a1a] border border-white/20 hover:border-white/40 rounded-sm retro-title text-base transition-colors text-white/60"
                >
                  Home
                </button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
