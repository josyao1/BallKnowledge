/**
 * SoloFaceRevealPage.tsx — Solo "Face Reveal" game.
 *
 * Shows a player's headshot heavily zoomed in (level 1). Every `timer` seconds
 * it zooms out one level (2 then 3). Guess the player at any time — correct
 * guesses increment the streak and show a celebration. After level 3 times out
 * the answer is revealed automatically, then the next player loads after 3s.
 * "Skip" reveals the answer immediately and resets the streak.
 *
 * Settings read from location.state: { sport, careerTo, timer, minYards }.
 * minYards (NFL only): offensive positions must have a peak single-season
 * yards total >= minYards; defensive starters (48+ career gp) are kept;
 * K/P/LS are dropped.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomedHeadshot } from '../../components/faceReveal/ZoomedHeadshot';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import { loadNBALineupPool, loadNFLLineupPool } from '../../services/careerData';
import type { NBACareerPlayer, NFLCareerPlayer } from '../../services/careerData';
import { DEFENSE_ALLOWLIST } from '../../data/faceRevealDefenseAllowlist';

type GameStatus = 'loading' | 'active' | 'correct' | 'revealed';

interface PlayerEntry {
  player_id: string | number;
  player_name: string;
  position?: string; // NFL only; used for pick weighting
}

// NFL offensive positions get 3× weight; everyone else gets 1×.
function pickWeight(entry: PlayerEntry): number {
  return entry.position && NFL_OFF_POSITIONS.has(entry.position) ? 3 : 1;
}

function weightedRandom(candidates: PlayerEntry[]): PlayerEntry {
  const total = candidates.reduce((sum, p) => sum + pickWeight(p), 0);
  let r = Math.random() * total;
  for (const p of candidates) {
    r -= pickWeight(p);
    if (r <= 0) return p;
  }
  return candidates[candidates.length - 1];
}

// ── NFL yards filter ──────────────────────────────────────────────────────────

const NFL_OFF_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'FB']);
const NFL_ST_POSITIONS  = new Set(['K', 'P', 'LS']);

/**
 * Returns true if this NFL player should be included in the Face Reveal pool.
 * - K / P / LS: always excluded.
 * - Offense (QB, RB, WR, TE, FB): included when peak single-season yards >= minYards (0 = any).
 * - Defense: 'known' = curated DEFENSE_ALLOWLIST only; 'all' = all non-ST defensive players.
 */
function nflInPool(p: NFLCareerPlayer, minYards: number, defenseMode: 'known' | 'all'): boolean {
  if (NFL_ST_POSITIONS.has(p.position)) return false;
  if (NFL_OFF_POSITIONS.has(p.position)) {
    if (minYards === 0) return true;
    return p.seasons.some(
      s => (s.passing_yards || 0) + (s.rushing_yards || 0) + (s.receiving_yards || 0) >= minYards
    );
  }
  return defenseMode === 'all' || DEFENSE_ALLOWLIST.has(String(p.player_id));
}

// Derive the last season year from a player's seasons array.
function nbaEndYear(p: NBACareerPlayer): number {
  const years = p.seasons.map(s => parseInt(s.season)).filter(Boolean);
  return years.length ? Math.max(...years) : 0;
}

function nflEndYear(p: NFLCareerPlayer): number {
  const years = p.seasons.map(s => parseInt(s.season)).filter(Boolean);
  return years.length ? Math.max(...years) : 0;
}

export function SoloFaceRevealPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Read settings from navigation state (set by FaceRevealSetup).
  const { sport: initSport = 'nba', careerTo = 0, timer: timerSecs = 60, minYards = 0, defenseMode = 'known' } =
    (location.state as { sport?: 'nba' | 'nfl'; careerTo?: number; timer?: number; minYards?: number; defenseMode?: 'known' | 'all' } | null) ?? {};

  const [sport] = useState<'nba' | 'nfl'>(initSport);

  // Player pool (loaded once).
  const [pool, setPool] = useState<PlayerEntry[]>([]);
  const usedIdsRef = useRef<Set<string | number>>(new Set());

  // Game state.
  const [status, setStatus]         = useState<GameStatus>('loading');
  const [player, setPlayer]         = useState<PlayerEntry | null>(null);
  const [zoomLevel, setZoomLevel]   = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown]   = useState(timerSecs);
  const [streak, setStreak]         = useState(0);
  const [guessInput, setGuessInput] = useState('');
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [feedbackMsg, setFeedbackMsg]   = useState('');
  const [showFlash, setShowFlash]       = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Pool loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadPool() {
      if (sport === 'nba') {
        const all = await loadNBALineupPool();
        let filtered = all.filter(p => p.player_id != null);
        if (careerTo) filtered = filtered.filter(p => nbaEndYear(p) >= careerTo);
        setPool(filtered.map(p => ({ player_id: p.player_id, player_name: p.player_name })));
      } else {
        const all = await loadNFLLineupPool();
        let filtered = all.filter(p => p.player_id != null);
        if (careerTo) filtered = filtered.filter(p => nflEndYear(p) >= careerTo);
        filtered = filtered.filter(p => nflInPool(p, minYards, defenseMode));
        setPool(filtered.map(p => ({ player_id: p.player_id, player_name: p.player_name, position: p.position })));
      }
    }
    loadPool();
  }, [sport, careerTo, minYards, defenseMode]);

  // ── Pick next player ──────────────────────────────────────────────────────

  const pickNext = useCallback((currentPool: PlayerEntry[]) => {
    if (!currentPool.length) return;

    // Avoid repeating recently seen players; reset if we've exhausted the pool.
    let candidates = currentPool.filter(p => !usedIdsRef.current.has(p.player_id));
    if (!candidates.length) {
      usedIdsRef.current.clear();
      candidates = currentPool;
    }

    const chosen = weightedRandom(candidates);
    usedIdsRef.current.add(chosen.player_id);

    setPlayer(chosen);
    setZoomLevel(1);
    setCountdown(timerSecs);
    setGuessInput('');
    setWrongGuesses([]);
    setFeedbackMsg('');
    setStatus('active');

    setTimeout(() => inputRef.current?.focus(), 50);
  }, [timerSecs]);

  // Start first player once pool is loaded.
  useEffect(() => {
    if (pool.length && status === 'loading') {
      pickNext(pool);
    }
  }, [pool]);

  // ── Countdown timer ───────────────────────────────────────────────────────

  useEffect(() => {
    if (status !== 'active') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          // Advance zoom level or reveal after level 3.
          setZoomLevel(z => {
            if (z < 3) {
              return (z + 1) as 1 | 2 | 3;
            }
            // Level 3 expired — reveal answer.
            setStatus('revealed');
            setStreak(0);
            return z;
          });
          return timerSecs;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, timerSecs]);

  // ── Auto-advance after revealed ───────────────────────────────────────────

  useEffect(() => {
    if (status !== 'revealed') return;
    autoAdvanceRef.current = setTimeout(() => pickNext(pool), 3000);
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [status, pool]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  // ── Guess submission ──────────────────────────────────────────────────────

  function handleGuess() {
    if (status !== 'active' || !guessInput.trim() || !player) return;
    const name = guessInput.trim();
    setGuessInput('');

    if (areSimilarNames(name, player.player_name)) {
      // Correct!
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus('correct');
      setStreak(s => s + 1);
      setFeedbackMsg('');

      // Level 1 correct → big flash; others → smaller celebration via border.
      if (zoomLevel === 1) {
        setShowFlash(true);
        autoAdvanceRef.current = setTimeout(() => setShowFlash(false), 600);
      }

      // Auto-advance after a short delay (tracked so it can be cleared on unmount).
      autoAdvanceRef.current = setTimeout(() => pickNext(pool), 2500);
    } else {
      setWrongGuesses(prev => [...prev, name]);
      setFeedbackMsg('Not quite — try again');
      setTimeout(() => setFeedbackMsg(''), 1500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // Advance to the next zoom level immediately and reset the per-level timer.
  function handleSkipZoom() {
    if (status !== 'active' || zoomLevel >= 3) return;
    setZoomLevel(z => (z + 1) as 1 | 2 | 3);
    setCountdown(timerSecs);
  }

  function handleSkip() {
    if (status !== 'active') return;
    if (timerRef.current) clearInterval(timerRef.current);
    setStreak(0);
    setStatus('revealed');
  }

  // Timer color: green → yellow → orange → red.
  const timerFraction = countdown / timerSecs;
  const timerColor = timerFraction > 0.6 ? '#22c55e'
    : timerFraction > 0.35 ? '#eab308'
    : timerFraction > 0.15 ? '#f97316'
    : '#ef4444';

  const COLOR = '#06b6d4';

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col">
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
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="retro-title text-2xl" style={{ color: COLOR }}>Face Reveal</h1>
          {streak > 0 && (
            <div className="sports-font text-[10px] text-[#d4af37] tracking-widest">
              🔥 {streak} in a row
            </div>
          )}
        </div>

        <div className="sports-font text-[10px] text-[#555] tracking-widest uppercase">
          {sport.toUpperCase()}
          {careerTo ? ` ${careerTo}+` : ''}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 pb-6 gap-4 pt-2">

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-white/30 sports-font tracking-widest">Loading...</div>
          </div>
        )}

        {status !== 'loading' && (
          <>
            {/* Timer bar */}
            <div className="w-full max-w-sm h-1 bg-[#222] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: timerColor }}
                animate={{ width: `${(countdown / timerSecs) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Zoom level + countdown */}
            <div className="flex items-center gap-4 sports-font text-[10px] text-[#555] tracking-widest uppercase">
              <span>Zoom {zoomLevel}/3</span>
              <span style={{ color: timerColor }}>{countdown}s</span>
            </div>

            {/* Headshot */}
            <motion.div
              key={player?.player_id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: 1,
                scale: 1,
                boxShadow: status === 'correct'
                  ? '0 0 0 4px #22c55e'
                  : '0 0 0 2px rgba(6,182,212,0.3)',
              }}
              transition={{ duration: 0.3 }}
              className="rounded-xl overflow-hidden"
            >
              {player && (
                <ZoomedHeadshot
                  playerId={player.player_id}
                  sport={sport}
                  zoomLevel={zoomLevel}
                />
              )}
            </motion.div>

            {/* Answer revealed / correct */}
            <AnimatePresence>
              {(status === 'correct' || status === 'revealed') && player && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`w-full max-w-sm p-4 rounded-xl border-2 text-center ${
                    status === 'correct'
                      ? 'bg-green-900/20 border-green-600'
                      : 'bg-[#1a1a1a] border-[#444]'
                  }`}
                >
                  <div className="sports-font text-[9px] text-[#888] tracking-widest uppercase mb-1">
                    {status === 'correct' ? 'Correct!' : 'The Answer Was'}
                  </div>
                  <div className="retro-title text-3xl text-[#d4af37]">{player.player_name}</div>
                  {status === 'revealed' && (
                    <div className="sports-font text-[9px] text-[#555] mt-1 tracking-wider">
                      Next player in a moment...
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Wrong guesses */}
            {status === 'active' && wrongGuesses.length > 0 && (
              <div className="w-full max-w-sm flex flex-wrap gap-1">
                {wrongGuesses.map((g, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-red-900/20 border border-red-900/40 rounded text-xs sports-font text-red-400"
                  >
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
                  className="sports-font text-sm text-red-400"
                >
                  {feedbackMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls */}
            {status === 'active' && (
              <div className="w-full max-w-sm flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={guessInput}
                    onChange={e => setGuessInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGuess()}
                    placeholder="Type the player's name..."
                    className="flex-1 bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-3 sports-font text-sm text-[var(--vintage-cream)] placeholder-[#555] focus:outline-none"
                    style={{ borderColor: `${COLOR}60` }}
                    onFocus={e => (e.currentTarget.style.borderColor = COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = `${COLOR}60`)}
                  />
                  <button
                    onClick={handleGuess}
                    disabled={!guessInput.trim()}
                    className="px-6 py-3 rounded-lg sports-font text-sm text-[#111] disabled:opacity-50 transition-all"
                    style={{ backgroundColor: COLOR }}
                  >
                    Guess
                  </button>
                </div>
                <div className="flex gap-2">
                  {zoomLevel < 3 && (
                    <button
                      onClick={handleSkipZoom}
                      className="flex-1 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3a3a3a] text-[#888] hover:border-[#06b6d4]/50 hover:text-[#06b6d4] transition-all"
                    >
                      Skip zoom →
                    </button>
                  )}
                  <button
                    onClick={handleSkip}
                    className={`py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-red-900/50 text-red-400 hover:border-red-700 transition-all ${zoomLevel < 3 ? 'flex-1' : 'w-full'}`}
                  >
                    Reveal answer
                  </button>
                </div>
              </div>
            )}

            {/* Manual next when correct */}
            {status === 'correct' && (
              <button
                onClick={() => pickNext(pool)}
                className="w-full max-w-sm py-4 rounded-lg retro-title text-xl tracking-wider transition-all bg-gradient-to-b from-[#06b6d4] to-[#0891b2] text-[#111] shadow-[0_4px_0_#0e7490] active:shadow-none active:translate-y-1"
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
