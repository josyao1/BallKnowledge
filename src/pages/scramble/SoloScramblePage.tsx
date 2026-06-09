import { useState, useEffect, useMemo } from 'react';
import { useGuessInput } from '../../hooks/useGuessInput';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';
import { getRandomNBAScramblePlayer, getRandomNFLScramblePlayer } from '../../services/careerData';
import { scrambleName } from '../../utils/scramble';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import type { Sport } from '../../types';

const COLOR = '#3b82f6';
type GameStatus = 'loading' | 'playing' | 'correct' | 'gave-up';

export function SoloScramblePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sport, setSport } = useSettingsStore();

  const locState = location.state as { careerTo?: number; gpSport?: Sport } | null;
  const scrambleFilters = useMemo(() => (locState?.careerTo ? { careerTo: locState.careerTo } : undefined), []);

  const [scrambled, setScrambled] = useState('');
  const [answer, setAnswer]       = useState('');
  const { guessInput, setGuessInput, feedbackMsg, setFeedbackMsg, inputRef } = useGuessInput();
  const [status, setStatus]       = useState<GameStatus>('loading');
  const [streak, setStreak]       = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);

  async function loadPlayer(currentSport: Sport) {
    setStatus('loading');
    setGuessInput('');
    setFeedbackMsg('');
    setWrongGuesses([]);

    const player = currentSport === 'nba'
      ? await getRandomNBAScramblePlayer(scrambleFilters)
      : await getRandomNFLScramblePlayer(scrambleFilters);

    if (!player) { setStatus('loading'); return; }

    setAnswer(player.player_name);
    setScrambled(scrambleName(player.player_name));
    setStatus('playing');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  useEffect(() => { loadPlayer(sport); }, []);

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
      setFeedbackMsg('Not quite — try again');
      setTimeout(() => setFeedbackMsg(''), 1500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleGiveUp() {
    if (status !== 'playing') return;
    setStatus('gave-up');
    setStreak(0);
  }

  function handleNext() { loadPlayer(sport); }

  function handleBack() {
    navigate('/', { state: { openScramble: true, gpSport: sport } });
  }

  function handleSportSwitch(newSport: Sport) {
    setSport(newSport);
    loadPlayer(newSport);
  }

  useEffect(() => {
    if (status !== 'correct' && status !== 'gave-up') return;
    let handler: ((e: KeyboardEvent) => void) | null = null;
    const t = setTimeout(() => {
      handler = (e: KeyboardEvent) => { if (e.key === 'Enter') handleNext(); };
      window.addEventListener('keydown', handler);
    }, 400);
    return () => { clearTimeout(t); if (handler) window.removeEventListener('keydown', handler); };
  }, [status, sport]);

  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <header className="capcrunch-panel mb-5 p-3 flex items-center gap-3" style={{ borderColor: `${COLOR}33` }}>
        <button onClick={handleBack} className="text-white/40 hover:text-white transition-colors flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 text-center">
          <h1 className="capcrunch-title text-xl" style={{ color: COLOR }}>Name Scramble</h1>
          {streak > 0 ? (
            <p className="capcrunch-kicker text-[9px] text-[#d4af37] mt-0.5">{streak} in a row</p>
          ) : locState?.careerTo ? (
            <p className="capcrunch-kicker text-[9px] mt-0.5" style={{ color: `${COLOR}60` }}>{locState.careerTo}+ ERA</p>
          ) : null}
        </div>

        {/* Sport toggle */}
        <div className="flex gap-1 flex-shrink-0">
          {(['nba', 'nfl'] as const).map(s => (
            <button
              key={s}
              onClick={() => handleSportSwitch(s)}
              className="px-2.5 py-1 capcrunch-kicker text-[10px] border transition-all"
              style={sport === s ? { backgroundColor: COLOR, borderColor: COLOR, color: '#fff' } : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Loading */}
      {status === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: COLOR, borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Game area */}
      {status !== 'loading' && (
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-12 lg:items-center">

          {/* Left / Top: scrambled name display */}
          <motion.div
            key={scrambled}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center py-10 lg:py-0 lg:min-h-[40vh]"
          >
            <p className="capcrunch-kicker text-[9px] text-white/30 tracking-[0.4em] mb-4">
              UNSCRAMBLE THIS {sport.toUpperCase()} PLAYER
            </p>
            <div className="capcrunch-title text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-[#d4af37] leading-tight tracking-wider">
              {scrambled}
            </div>

            {/* Answer reveal — inside the left column on desktop */}
            <AnimatePresence>
              {(status === 'correct' || status === 'gave-up') && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8 w-full max-w-sm capcrunch-panel p-5 text-center"
                  style={{
                    borderColor: status === 'correct' ? `${COLOR}60` : 'rgba(255,255,255,0.1)',
                    backgroundColor: status === 'correct' ? `${COLOR}10` : 'rgba(0,0,0,0.3)',
                  }}
                >
                  <p className="capcrunch-kicker text-[9px] text-white/40 mb-2">
                    {status === 'correct' ? 'Correct!' : 'The Answer Was'}
                  </p>
                  <div className="capcrunch-title text-3xl text-[#d4af37]">{answer}</div>
                  {wrongGuesses.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1 justify-center">
                      {wrongGuesses.map((g, i) => (
                        <span key={i} className="capcrunch-kicker text-[9px] px-2 py-0.5 border border-red-800/50 text-red-400 bg-red-900/20">
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Right / Bottom: controls */}
          <div className="flex flex-col gap-3 lg:self-center">
            {/* Wrong guesses mid-game */}
            {status === 'playing' && wrongGuesses.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {wrongGuesses.map((g, i) => (
                  <span key={i} className="capcrunch-kicker text-[9px] px-2 py-0.5 border border-red-900/40 text-red-400 bg-red-900/15">
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
                  className="text-center capcrunch-kicker text-xs text-red-400"
                >
                  {feedbackMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input / Next */}
            {status === 'playing' ? (
              <>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={guessInput}
                    onChange={e => setGuessInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGuess()}
                    placeholder="Type the player's name…"
                    className="flex-1 bg-black/40 border border-white/15 px-4 py-3 capcrunch-title text-sm text-white placeholder-white/25 focus:outline-none"
                    style={{ borderColor: `${COLOR}30` }}
                    onFocus={e => { e.currentTarget.style.borderColor = `${COLOR}80`; }}
                    onBlur={e => { e.currentTarget.style.borderColor = `${COLOR}30`; }}
                  />
                  <button
                    onClick={handleGuess}
                    disabled={!guessInput.trim()}
                    className="px-6 py-3 capcrunch-title text-sm text-white disabled:opacity-40 transition-all"
                    style={{ backgroundColor: COLOR }}
                  >
                    Guess
                  </button>
                </div>
                <button
                  onClick={handleGiveUp}
                  className="w-full py-2 capcrunch-kicker text-xs border border-red-900/40 text-red-400 hover:border-red-700 transition-all bg-black/20"
                >
                  Give Up
                </button>
              </>
            ) : (
              <button
                onClick={handleNext}
                className="w-full py-4 capcrunch-title text-xl text-white transition-all active:translate-y-px"
                style={{ backgroundColor: COLOR, boxShadow: '0 3px 0 rgba(30,60,140,0.9)' }}
              >
                Next Player
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
