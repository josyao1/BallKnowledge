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
import { TeamLogo } from '../../components/TeamLogo';
import { areSimilarNames, normalize } from '../../utils/fuzzyDedup';
import { loadNBALineupPool, loadNFLLineupPool } from '../../services/careerData';
import type { NBACareerPlayer, NFLCareerPlayer } from '../../services/careerData';
import { DEFENSE_ALLOWLIST } from '../../data/faceRevealDefenseAllowlist';

type GameStatus = 'loading' | 'active' | 'correct' | 'revealed';

interface PlayerEntry {
  player_id: string | number;
  player_name: string;
  position?: string;    // NFL only; used for pick weighting
  longestTeam?: string; // most-season team abbreviation; shown at zoom level 4
}

/** Compute the team abbreviation a player spent the most seasons with. */
function longestTenuredTeam(seasons: Array<{ team: string }>): string {
  const counts: Record<string, number> = {};
  for (const s of seasons) {
    // Handle slash seasons (e.g. "LAL/MIA" for traded players) — use first team.
    const team = (s.team || '').split('/')[0].trim();
    if (team) counts[team] = (counts[team] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/** Player initials — first letter of each space-separated word. */
function getInitials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase();
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

// ── Autocomplete suggestions ─────────────────────────────────────────────────
// Returns up to `limit` pool entries whose names are "decently close" to the
// input without being overly aggressive. Requires at least 3 characters and
// matches on: full-name prefix, every input word matching a name-word prefix,
// or a single long-enough first token matching a name's first token.

function getSuggestions(input: string, pool: PlayerEntry[], limit = 5): PlayerEntry[] {
  if (input.length < 3) return [];
  const norm = normalize(input);
  const normWords = norm.split(' ').filter(Boolean);

  const scored: { entry: PlayerEntry; score: number }[] = [];
  for (const p of pool) {
    const pNorm = normalize(p.player_name);
    const pWords = pNorm.split(' ');

    if (pNorm.startsWith(norm)) {
      // Full input is a prefix of the full name — highest confidence
      scored.push({ entry: p, score: 100 });
    } else if (normWords.every(iw => pWords.some(pw => pw.startsWith(iw)))) {
      // Every typed word matches the start of some name word (e.g. "le ja" → "LeBron James")
      scored.push({ entry: p, score: 80 });
    } else if (normWords[0]?.length >= 3 && pWords[0]?.startsWith(normWords[0])) {
      // First typed token is a prefix of the first name token (3+ chars to avoid noise)
      scored.push({ entry: p, score: 60 });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.entry);
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
  const { sport: initSport = 'nba', careerTo = 0, timer: timerSecs = 60, minYards = 0, minMpg = 0, defenseMode = 'known' } =
    (location.state as { sport?: 'nba' | 'nfl'; careerTo?: number; timer?: number; minYards?: number; minMpg?: number; defenseMode?: 'known' | 'all' } | null) ?? {};

  const [sport] = useState<'nba' | 'nfl'>(initSport);

  // Player pool (loaded once).
  const [pool, setPool] = useState<PlayerEntry[]>([]);
  const usedIdsRef = useRef<Set<string | number>>(new Set());

  // Game state.
  const [status, setStatus]         = useState<GameStatus>('loading');
  const [player, setPlayer]         = useState<PlayerEntry | null>(null);
  const [zoomLevel, setZoomLevel]   = useState<1 | 2 | 3 | 4>(1);
  const [countdown, setCountdown]   = useState(timerSecs);
  const [streak, setStreak]         = useState(0);
  const [guessInput, setGuessInput] = useState('');
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [feedbackMsg, setFeedbackMsg]   = useState('');
  const [showFlash, setShowFlash]       = useState(false);
  // Randomised zoom focal point per player so the zoomed-in spot varies each round.
  const [focalPoint, setFocalPoint] = useState<{ x: number; y: number }>({ x: 50, y: 28 });

  const [suggestions, setSuggestions] = useState<PlayerEntry[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Separate ref for the level-1 correct flash so it doesn't overwrite autoAdvanceRef.
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce guard — prevents two code paths from calling pickNext within 800ms.
  const lastPickTimeRef = useRef<number>(0);

  // ── Pool loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadPool() {
      if (sport === 'nba') {
        const all = await loadNBALineupPool();
        let filtered = all.filter(p => p.player_id != null);
        if (careerTo) filtered = filtered.filter(p => nbaEndYear(p) >= careerTo);
        if (minMpg) filtered = filtered.filter(p =>
          p.seasons.some(s => (s.min ?? 0) >= minMpg)
        );
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

  // ── Pick next player ──────────────────────────────────────────────────────

  const pickNext = useCallback((currentPool: PlayerEntry[]) => {
    if (!currentPool.length) return;

    // Debounce: suppress if called again within 800ms (race-condition guard).
    const now = Date.now();
    if (now - lastPickTimeRef.current < 800) {
      console.warn('[FaceReveal] pickNext suppressed — called again within 800ms');
      return;
    }
    lastPickTimeRef.current = now;
    console.log('[FaceReveal] pickNext at', now);

    // Avoid repeating recently seen players; reset if we've exhausted the pool.
    let candidates = currentPool.filter(p => !usedIdsRef.current.has(p.player_id));
    if (!candidates.length) {
      usedIdsRef.current.clear();
      candidates = currentPool;
    }

    const chosen = weightedRandom(candidates);
    usedIdsRef.current.add(chosen.player_id);

    // Randomise the zoom focal point so it's not always both eyes.
    // X: ±12% from center (38–62%). Y: ±8% from face baseline (20–36%).
    const fx = Math.round(38 + Math.random() * 24);
    const fy = Math.round(20 + Math.random() * 16);
    setFocalPoint({ x: fx, y: fy });

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

  // Start first player once pool is loaded.
  useEffect(() => {
    if (pool.length && status === 'loading') {
      pickNext(pool);
    }
  }, [pool]);

  // ── Countdown timer — only ticks; zoom advance is handled separately ─────
  // Restarted whenever zoomLevel changes (skip or auto-advance) so the old
  // interval is always cleared before it can double-fire a zoom advance.

  useEffect(() => {
    if (status !== 'active') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown(c => (c > 0 ? c - 1 : 0));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, timerSecs, zoomLevel]);

  // ── Zoom advance / reveal when countdown hits 0 ───────────────────────────
  // Separated from the interval so that handleSkipZoom's setCountdown(timerSecs)
  // and this effect can't both queue a setZoomLevel update in the same batch.
  // Levels 1–4: each gets `timer` seconds. After level 4 expires → reveal.

  useEffect(() => {
    if (status !== 'active' || countdown > 0) return;
    if (zoomLevel < 4) {
      setZoomLevel(z => (z + 1) as 1 | 2 | 3 | 4);
      setCountdown(timerSecs);
    } else {
      setStatus('revealed');
      setStreak(0);
    }
  }, [countdown, status]);

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
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
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
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      setStatus('correct');
      setStreak(s => s + 1);
      setFeedbackMsg('');
      setSuggestions([]);

      // Level 1 correct → big flash; others → smaller celebration via border.
      if (zoomLevel === 1) {
        setShowFlash(true);
        // Use a dedicated ref so the auto-advance ref isn't clobbered.
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setShowFlash(false), 600);
      }

      // Auto-advance after a short delay (can be cancelled if user clicks Next Player).
      autoAdvanceRef.current = setTimeout(() => pickNext(pool), 2500);
    } else {
      setWrongGuesses(prev => [...prev, name]);
      setFeedbackMsg('Not quite — try again');
      setTimeout(() => setFeedbackMsg(''), 1500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // Advance to the next zoom level immediately and reset the per-level timer.
  // Only available for levels 1–3; at level 4 (initials/team hint) the next
  // step is the answer reveal — use "Reveal answer" instead.
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
              <span>Zoom {zoomLevel}/4</span>
              <span style={{ color: timerColor }}>{countdown}s</span>
            </div>

            {/* Headshot + optional Level-4 hint strip below */}
            <div className="flex flex-col items-center gap-2">
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
                {player && (status === 'correct' || status === 'revealed') && (
                  // Reveal: always show the full face (zoom 3) so it animates smoothly
                  // from whatever level the player was on when the round ended.
                  <ZoomedHeadshot
                    playerId={player.player_id}
                    sport={sport}
                    zoomLevel={3}
                    originX={50}
                    originY={28}
                  />
                )}
                {player && status === 'active' && (
                  // At zoom 4, still show the face (at level 3, fully zoomed out);
                  // the initials + team hint appears as a strip below the image.
                  <ZoomedHeadshot
                    playerId={player.player_id}
                    sport={sport}
                    zoomLevel={zoomLevel >= 4 ? 3 : zoomLevel as 1 | 2 | 3}
                    originX={zoomLevel >= 4 ? 50 : focalPoint.x}
                    originY={zoomLevel >= 4 ? 28 : focalPoint.y}
                  />
                )}
              </motion.div>

              {/* Level-4 hint strip: initials + longest-tenured team logo */}
              <AnimatePresence>
                {player && status === 'active' && zoomLevel === 4 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-4 px-4 py-2.5 rounded-lg border"
                    style={{ width: 320, backgroundColor: '#1a1a1a', borderColor: 'rgba(6,182,212,0.3)' }}
                  >
                    <div className="retro-title text-4xl tracking-widest" style={{ color: COLOR }}>
                      {getInitials(player.player_name)}
                    </div>
                    {player.longestTeam && (
                      <>
                        <div className="w-px self-stretch bg-[#333]" />
                        <div className="flex flex-col items-center gap-1">
                          <TeamLogo sport={sport} abbr={player.longestTeam} size={48} />
                          <div className="sports-font text-[8px] text-[#555] tracking-[0.2em] uppercase">
                            Longest Team
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
                  <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={guessInput}
                    onChange={e => {
                      const val = e.target.value;
                      setGuessInput(val);
                      setSuggestions(getSuggestions(val, pool));
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleGuess();
                      if (e.key === 'Escape') setSuggestions([]);
                    }}
                    placeholder="Type the player's name..."
                    className="w-full bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-3 sports-font text-sm text-[var(--vintage-cream)] placeholder-[#555] focus:outline-none"
                    style={{ borderColor: `${COLOR}60` }}
                    onFocus={e => (e.currentTarget.style.borderColor = COLOR)}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = `${COLOR}60`;
                      // Delay so suggestion onMouseDown fires before the dropdown disappears
                      setTimeout(() => setSuggestions([]), 150);
                    }}
                  />
                  {/* Autocomplete dropdown */}
                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[#1a1a1a] border border-[#06b6d4]/40 rounded-lg overflow-hidden shadow-xl">
                      {suggestions.map(s => (
                        <button
                          key={s.player_id}
                          // mouseDown fires before blur; preventDefault keeps input focused
                          onMouseDown={e => {
                            e.preventDefault();
                            setGuessInput(s.player_name);
                            setSuggestions([]);
                            // Submit the guess immediately
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
                              // Slight delay so the input value settles before focus
                              setTimeout(() => inputRef.current?.focus(), 10);
                            }
                          }}
                          className="w-full text-left px-4 py-2.5 sports-font text-sm text-[var(--vintage-cream)] hover:bg-[#06b6d4]/10 border-b border-[#2a2a2a] last:border-0 transition-colors"
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
                    className="px-6 py-3 rounded-lg sports-font text-sm text-[#111] disabled:opacity-50 transition-all"
                    style={{ backgroundColor: COLOR }}
                  >
                    Guess
                  </button>
                </div>
                <div className="flex gap-2">
                  {zoomLevel < 4 && (
                    <button
                      onClick={handleSkipZoom}
                      className="flex-1 py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-[#3a3a3a] text-[#888] hover:border-[#06b6d4]/50 hover:text-[#06b6d4] transition-all"
                    >
                      Skip zoom →
                    </button>
                  )}
                  <button
                    onClick={handleSkip}
                    className={`py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-red-900/50 text-red-400 hover:border-red-700 transition-all ${zoomLevel < 4 ? 'flex-1' : 'w-full'}`}
                  >
                    Reveal answer
                  </button>
                </div>
              </div>
            )}

            {/* Manual next when correct */}
            {status === 'correct' && (
              <button
                onClick={() => {
                  // Cancel the auto-advance timer so it doesn't also fire later.
                  if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
                  pickNext(pool);
                }}
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
