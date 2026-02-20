/**
 * SoloScramblePage.tsx — Solo "Name Scramble" game.
 *
 * Shows a scrambled player name (NBA or NFL based on current sport setting).
 * Player types guesses until correct or gives up, then sees the answer.
 * Press "Next Player" to keep playing.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../stores/settingsStore';
import { getRandomNBAScramblePlayer, getRandomNFLScramblePlayer } from '../services/careerData';
import { scrambleName } from '../utils/scramble';
import { areSimilarNames } from '../utils/fuzzyDedup';
import type { Sport } from '../types';

type GameStatus = 'loading' | 'playing' | 'correct' | 'gave-up';

export function SoloScramblePage() {
  const navigate = useNavigate();
  const { sport, setSport } = useSettingsStore();

  const [scrambled, setScrambled] = useState('');
  const [answer, setAnswer] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [status, setStatus] = useState<GameStatus>('loading');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [streak, setStreak] = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadPlayer(currentSport: Sport) {
    setStatus('loading');
    setGuessInput('');
    setFeedbackMsg('');
    setWrongGuesses([]);

    const player = currentSport === 'nba'
      ? await getRandomNBAScramblePlayer()
      : await getRandomNFLScramblePlayer();

    if (!player) {
      setStatus('loading');
      return;
    }

    setAnswer(player.player_name);
    setScrambled(scrambleName(player.player_name));
    setStatus('playing');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  useEffect(() => {
    loadPlayer(sport);
  }, []);

  function handleGuess() {
    if (status !== 'playing' || !guessInput.trim()) return;
    const name = guessInput.trim();
    setGuessInput('');

    if (areSimilarNames(name, answer)) {
      setStatus('correct');
      setStreak(s => s + 1);
      setFeedbackMsg('');
    } else {
      setWrongGuesses(prev => [...prev, name]);
      setFeedbackMsg(`Not quite — try again`);
      setTimeout(() => setFeedbackMsg(''), 1500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleGiveUp() {
    if (status !== 'playing') return;
    setStatus('gave-up');
    setStreak(0);
  }

  function handleNext() {
    loadPlayer(sport);
  }

  function handleSportSwitch(newSport: Sport) {
    setSport(newSport);
    loadPlayer(newSport);
  }

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col p-4 md:p-6 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="retro-title text-2xl text-[#3b82f6]">Name Scramble</h1>
          {streak > 0 && (
            <div className="sports-font text-[10px] text-[#d4af37] tracking-widest">
              🔥 {streak} in a row
            </div>
          )}
        </div>

        {/* Sport toggle */}
        <div className="flex gap-1">
          {(['nba', 'nfl'] as const).map(s => (
            <button
              key={s}
              onClick={() => handleSportSwitch(s)}
              className={`px-2.5 py-1 rounded text-[11px] sports-font uppercase tracking-wider transition-all ${
                sport === s
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#1a1a1a] text-white/40 border border-[#333] hover:border-[#555]'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Loading */}
      {status === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/30 sports-font tracking-widest">Loading...</div>
        </div>
      )}

      {/* Game area */}
      {status !== 'loading' && (
        <div className="flex flex-col flex-1">
          {/* Scrambled name */}
          <motion.div
            key={scrambled}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center text-center py-10"
          >
            <div className="sports-font text-[10px] text-[#888] tracking-[0.4em] uppercase mb-4">
              Unscramble This {sport.toUpperCase()} Player
            </div>
            <div className="retro-title text-5xl md:text-6xl text-[#d4af37] leading-tight tracking-wider">
              {scrambled}
            </div>
          </motion.div>

          {/* Answer reveal */}
          <AnimatePresence>
            {(status === 'correct' || status === 'gave-up') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`mb-6 p-5 rounded-lg text-center border-2 ${
                  status === 'correct'
                    ? 'bg-green-900/20 border-green-600'
                    : 'bg-[#1a1a1a] border-[#555]'
                }`}
              >
                <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase mb-1">
                  {status === 'correct' ? 'Correct!' : 'The Answer Was'}
                </div>
                <div className="retro-title text-3xl text-[#d4af37]">{answer}</div>
                {wrongGuesses.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 justify-center">
                    {wrongGuesses.map((g, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-900/30 border border-red-800/50 rounded text-xs sports-font text-red-400">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wrong guesses mid-game */}
          {status === 'playing' && wrongGuesses.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1">
              {wrongGuesses.map((g, i) => (
                <span key={i} className="px-2 py-0.5 bg-red-900/20 border border-red-900/40 rounded text-xs sports-font text-red-400">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Feedback */}
          <AnimatePresence>
            {feedbackMsg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-3 text-center sports-font text-sm text-red-400"
              >
                {feedbackMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          {status === 'playing' ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={guessInput}
                  onChange={e => setGuessInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGuess()}
                  placeholder="Type the player's name..."
                  className="flex-1 bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-3 sports-font text-sm text-[var(--vintage-cream)] placeholder-[#555] focus:outline-none focus:border-[#3b82f6]"
                />
                <button
                  onClick={handleGuess}
                  disabled={!guessInput.trim()}
                  className="px-6 py-3 rounded-lg sports-font text-sm text-white bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 transition-all"
                >
                  Guess
                </button>
              </div>
              <button
                onClick={handleGiveUp}
                className="w-full py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-red-900/50 text-red-400 hover:border-red-700 transition-all"
              >
                Give Up
              </button>
            </div>
          ) : (
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-lg retro-title text-xl tracking-wider transition-all bg-gradient-to-b from-[#3b82f6] to-[#2563eb] text-white shadow-[0_4px_0_#1d4ed8] active:shadow-none active:translate-y-1"
            >
              Next Player
            </button>
          )}
        </div>
      )}
    </div>
  );
}
