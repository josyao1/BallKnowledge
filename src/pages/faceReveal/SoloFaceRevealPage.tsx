import { useState, useEffect, useRef, useCallback } from 'react';
import { useGuessInput } from '../../hooks/useGuessInput';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomedHeadshot } from '../../components/faceReveal/ZoomedHeadshot';
import { TeamLogo } from '../../components/TeamLogo';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import { loadNBALineupPool, loadNFLLineupPool } from '../../services/careerData';
import {
  type PlayerEntry,
  longestTenuredTeam,
  getInitials,
  weightedRandom,
  getSuggestions,
  nbaEndYear,
  nflEndYear,
  nflInPool,
  timerColor,
} from './faceRevealUtils';

const COLOR = '#06b6d4';
type GameStatus = 'loading' | 'active' | 'correct' | 'revealed';

export function SoloFaceRevealPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { sport: initSport = 'nba', careerTo = 0, timer: timerSecs = 60, minYards = 0, minMpg = 0, defenseMode = 'known' } =
    (location.state as { sport?: 'nba' | 'nfl'; careerTo?: number; timer?: number; minYards?: number; minMpg?: number; defenseMode?: 'known' | 'all' } | null) ?? {};

  const [sport] = useState<'nba' | 'nfl'>(initSport);
  const [pool, setPool] = useState<PlayerEntry[]>([]);
  const usedIdsRef = useRef<Set<string | number>>(new Set());

  const [status,     setStatus]     = useState<GameStatus>('loading');
  const [player,     setPlayer]     = useState<PlayerEntry | null>(null);
  const [zoomLevel,  setZoomLevel]  = useState<1 | 2 | 3 | 4>(1);
  const [countdown,  setCountdown]  = useState(timerSecs);
  const [streak,     setStreak]     = useState(0);
  const { guessInput, setGuessInput, feedbackMsg, setFeedbackMsg, inputRef } = useGuessInput();
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [showFlash,    setShowFlash]    = useState(false);
  const [focalPoint,   setFocalPoint]   = useState<{ x: number; y: number }>({ x: 50, y: 28 });
  const [suggestions,  setSuggestions]  = useState<PlayerEntry[]>([]);

  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPickTimeRef = useRef<number>(0);

  // Pool loading
  useEffect(() => {
    async function loadPool() {
      if (sport === 'nba') {
        const all = await loadNBALineupPool();
        let filtered = all.filter(p => p.player_id != null);
        if (careerTo) filtered = filtered.filter(p => nbaEndYear(p) >= careerTo);
        if (minMpg)   filtered = filtered.filter(p => p.seasons.some(s => (s.min ?? 0) >= minMpg));
        setPool(filtered.map(p => ({ player_id: p.player_id, player_name: p.player_name, longestTeam: longestTenuredTeam(p.seasons) })));
      } else {
        const all = await loadNFLLineupPool();
        let filtered = all.filter(p => p.player_id != null);
        if (careerTo) filtered = filtered.filter(p => nflEndYear(p) >= careerTo);
        filtered = filtered.filter(p => nflInPool(p, minYards, defenseMode));
        setPool(filtered.map(p => ({ player_id: p.player_id, player_name: p.player_name, position: p.position, longestTeam: longestTenuredTeam(p.seasons) })));
      }
    }
    loadPool();
  }, [sport, careerTo, minYards, minMpg, defenseMode]);

  const pickNext = useCallback((currentPool: PlayerEntry[]) => {
    if (!currentPool.length) return;
    const now = Date.now();
    if (now - lastPickTimeRef.current < 800) return;
    lastPickTimeRef.current = now;

    let candidates = currentPool.filter(p => !usedIdsRef.current.has(p.player_id));
    if (!candidates.length) { usedIdsRef.current.clear(); candidates = currentPool; }

    const chosen = weightedRandom(candidates);
    usedIdsRef.current.add(chosen.player_id);

    setFocalPoint({ x: Math.round(38 + Math.random() * 24), y: Math.round(20 + Math.random() * 16) });
    setPlayer(chosen);
    setZoomLevel(1 as 1 | 2 | 3 | 4);
    setCountdown(timerSecs);
    setGuessInput('');
    setWrongGuesses([]);
    setFeedbackMsg('');
    setSuggestions([]);
    setStatus('active');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [timerSecs]);

  useEffect(() => {
    if (pool.length && status === 'loading') pickNext(pool);
  }, [pool]);

  useEffect(() => {
    if (status !== 'active') { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => { setCountdown(c => (c > 0 ? c - 1 : 0)); }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, timerSecs, zoomLevel]);

  useEffect(() => {
    if (status !== 'active' || countdown > 0) return;
    if (zoomLevel < 4) { setZoomLevel(z => (z + 1) as 1 | 2 | 3 | 4); setCountdown(timerSecs); }
    else { setStatus('revealed'); setStreak(0); }
  }, [countdown, status]);

  useEffect(() => {
    if (status !== 'revealed') return;
    autoAdvanceRef.current = setTimeout(() => pickNext(pool), 3000);
    return () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); };
  }, [status, pool]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  function handleGuess() {
    if (status !== 'active' || !guessInput.trim() || !player) return;
    const name = guessInput.trim();
    setGuessInput('');
    if (areSimilarNames(name, player.player_name)) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      setStatus('correct');
      setStreak(s => s + 1);
      setFeedbackMsg('');
      setSuggestions([]);
      if (zoomLevel === 1) {
        setShowFlash(true);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setShowFlash(false), 600);
      }
      autoAdvanceRef.current = setTimeout(() => pickNext(pool), 2500);
    } else {
      setWrongGuesses(prev => [...prev, name]);
      setFeedbackMsg('Not quite — try again');
      setTimeout(() => setFeedbackMsg(''), 1500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleSkipZoom() {
    if (status !== 'active' || zoomLevel >= 4) return;
    setZoomLevel(z => (z + 1) as 1 | 2 | 3 | 4);
    setCountdown(timerSecs);
  }

  function handleSkip() {
    if (status !== 'active') return;
    if (timerRef.current) clearInterval(timerRef.current);
    setStreak(0);
    setStatus('revealed');
  }

  function handleBack() {
    navigate('/', { state: { openFaceReveal: true, gpSport: sport } });
  }

  const timerFraction = countdown / timerSecs;
  const color = timerColor(timerFraction);

  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col">
      {/* Full-screen correct flash */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 bg-green-500 pointer-events-none z-50"
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="capcrunch-panel m-4 mb-2 p-3 flex items-center gap-3" style={{ borderColor: `${COLOR}33` }}>
        <button onClick={handleBack} className="text-white/40 hover:text-white transition-colors flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 text-center">
          <h1 className="capcrunch-title text-xl" style={{ color: COLOR }}>Face Reveal</h1>
          {streak > 0 ? (
            <p className="capcrunch-kicker text-[9px] text-[#d4af37] mt-0.5">{streak} in a row</p>
          ) : (
            <p className="capcrunch-kicker text-[9px] text-white/30 mt-0.5">
              {sport.toUpperCase()}{careerTo ? ` · ${careerTo}+` : ''}
            </p>
          )}
        </div>

        <div className="capcrunch-kicker text-[9px] text-white/25 flex-shrink-0">
          Zoom {zoomLevel}/4
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center px-4 pb-6 gap-4">
        {status === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: COLOR, borderTopColor: 'transparent' }} />
          </div>
        )}

        {status !== 'loading' && (
          <>
            {/* Timer bar */}
            <div className="w-full max-w-sm">
              <div className="w-full h-1 bg-black/30 overflow-hidden">
                <motion.div
                  className="h-full"
                  style={{ backgroundColor: color }}
                  animate={{ width: `${(countdown / timerSecs) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="capcrunch-kicker text-[9px] text-white/25">Timer per level</span>
                <span className="capcrunch-kicker text-[9px]" style={{ color }}>{countdown}s</span>
              </div>
            </div>

            {/* Headshot + Level-4 hint strip */}
            <div className="flex flex-col items-center gap-2">
              <motion.div
                key={player?.player_id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  boxShadow: status === 'correct'
                    ? '0 0 0 4px #22c55e'
                    : `0 0 0 2px ${COLOR}4d`,
                }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                {player && (status === 'correct' || status === 'revealed') && (
                  <ZoomedHeadshot playerId={player.player_id} sport={sport} zoomLevel={0} originX={50} originY={28} />
                )}
                {player && status === 'active' && (
                  <ZoomedHeadshot
                    playerId={player.player_id}
                    sport={sport}
                    zoomLevel={zoomLevel >= 4 ? 3 : zoomLevel as 1 | 2 | 3}
                    originX={zoomLevel >= 4 ? 50 : focalPoint.x}
                    originY={zoomLevel >= 4 ? 28 : focalPoint.y}
                  />
                )}
              </motion.div>

              {/* Level-4 hint strip */}
              <AnimatePresence>
                {player && status === 'active' && zoomLevel === 4 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="capcrunch-panel flex items-center justify-center gap-4 px-4 py-2.5"
                    style={{ width: 320, borderColor: `${COLOR}4d` }}
                  >
                    <div className="capcrunch-title text-4xl tracking-widest" style={{ color: COLOR }}>
                      {getInitials(player.player_name)}
                    </div>
                    {player.longestTeam && (
                      <>
                        <div className="w-px self-stretch bg-white/10" />
                        <div className="flex flex-col items-center gap-1">
                          <TeamLogo sport={sport} abbr={player.longestTeam} size={48} />
                          <div className="capcrunch-kicker text-[8px] text-white/30 tracking-[0.2em]">LONGEST TEAM</div>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Answer card */}
            <AnimatePresence>
              {(status === 'correct' || status === 'revealed') && player && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-sm capcrunch-panel p-4 text-center"
                  style={{
                    borderColor: status === 'correct' ? '#22c55e60' : 'rgba(255,255,255,0.12)',
                    backgroundColor: status === 'correct' ? '#22c55e10' : 'rgba(0,0,0,0.3)',
                  }}
                >
                  <p className="capcrunch-kicker text-[9px] text-white/40 mb-2">
                    {status === 'correct' ? 'Correct!' : 'The Answer Was'}
                  </p>
                  <div className="capcrunch-title text-3xl text-[#d4af37]">{player.player_name}</div>
                  {status === 'revealed' && (
                    <p className="capcrunch-kicker text-[9px] text-white/30 mt-2">Next player in a moment…</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Wrong guesses */}
            {status === 'active' && wrongGuesses.length > 0 && (
              <div className="w-full max-w-sm flex flex-wrap gap-1">
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="capcrunch-kicker text-xs text-red-400">
                  {feedbackMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls */}
            {status === 'active' && (
              <div className="w-full max-w-sm flex flex-col gap-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={guessInput}
                      onChange={e => { setGuessInput(e.target.value); setSuggestions(getSuggestions(e.target.value, pool)); }}
                      onKeyDown={e => { if (e.key === 'Enter') handleGuess(); if (e.key === 'Escape') setSuggestions([]); }}
                      placeholder="Type the player's name…"
                      className="w-full bg-black/40 border border-white/15 px-4 py-3 capcrunch-title text-sm text-white placeholder-white/25 focus:outline-none"
                      style={{ borderColor: `${COLOR}40` }}
                      onFocus={e => { e.currentTarget.style.borderColor = `${COLOR}90`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = `${COLOR}40`; setTimeout(() => setSuggestions([]), 150); }}
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-black/95 border overflow-hidden shadow-xl" style={{ borderColor: `${COLOR}40` }}>
                        {suggestions.map(s => (
                          <button
                            key={s.player_id}
                            onMouseDown={e => {
                              e.preventDefault();
                              setGuessInput(s.player_name);
                              setSuggestions([]);
                              if (player && areSimilarNames(s.player_name, player.player_name)) {
                                if (timerRef.current) clearInterval(timerRef.current);
                                if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
                                setStatus('correct');
                                setStreak(st => st + 1);
                                setFeedbackMsg('');
                                setGuessInput('');
                                if (zoomLevel === 1) {
                                  setShowFlash(true);
                                  if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
                                  flashTimeoutRef.current = setTimeout(() => setShowFlash(false), 600);
                                }
                                autoAdvanceRef.current = setTimeout(() => pickNext(pool), 2500);
                              } else {
                                setTimeout(() => inputRef.current?.focus(), 10);
                              }
                            }}
                            className="w-full text-left px-4 py-2.5 capcrunch-title text-sm text-white hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                          >
                            {s.player_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleGuess}
                    disabled={!guessInput.trim()}
                    className="px-6 py-3 capcrunch-title text-sm text-black disabled:opacity-40 transition-all"
                    style={{ backgroundColor: COLOR }}
                  >
                    Guess
                  </button>
                </div>
                <div className="flex gap-2">
                  {zoomLevel < 4 && (
                    <button
                      onClick={handleSkipZoom}
                      className="flex-1 py-2 capcrunch-kicker text-xs border border-white/10 text-white/40 hover:border-white/25 hover:text-white/60 transition-all bg-black/20"
                    >
                      Skip zoom →
                    </button>
                  )}
                  <button
                    onClick={handleSkip}
                    className={`py-2 capcrunch-kicker text-xs border border-red-900/40 text-red-400 hover:border-red-700 transition-all bg-black/20 ${zoomLevel < 4 ? 'flex-1' : 'w-full'}`}
                  >
                    Reveal answer
                  </button>
                </div>
              </div>
            )}

            {status === 'correct' && (
              <button
                onClick={() => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); pickNext(pool); }}
                className="w-full max-w-sm py-4 capcrunch-title text-xl text-black transition-all active:translate-y-px"
                style={{ backgroundColor: COLOR, boxShadow: '0 3px 0 rgba(5,85,100,0.9)' }}
              >
                Next Player
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
