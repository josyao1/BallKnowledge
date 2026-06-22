import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamLogo } from '../TeamLogo';
import { teams } from '../../data/teams';
import { nflTeams } from '../../data/nfl-teams';

interface Props {
  winningTeam: string;
  winningYear: string;
  winningLabel?: string;
  sport: 'nba' | 'nfl';
  winningTeamData?: any;
  skipAnimation?: boolean;
  canSkip?: boolean;
  onComplete: () => void;
  onReroll?: () => void;
}

const TEASE_MS = 3600; // how long the ticker scrolls before landing
const FLASH_MS = 180; // white flash duration
const TICK_MS = 850; // countdown tick speed
const SOLO_REVEAL_HOLD_MS = 500;

export function TeamRevealOverlay({
  winningTeam,
  winningYear,
  winningLabel = 'TEAM',
  sport,
  winningTeamData,
  skipAnimation,
  canSkip = true,
  onComplete,
  onReroll,
}: Props) {
  const [phase, setPhase] = useState<'tease' | 'revealed'>('tease');
  const [flash, setFlash] = useState(false);
  const [count, setCount] = useState(3);
  const [displayTeamIndex, setDisplayTeamIndex] = useState(0);
  const [displayYearIndex, setDisplayYearIndex] = useState(0);
  const [countdownReady, setCountdownReady] = useState(false);
  const hasCompleted = useRef(false);

  const complete = () => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    onComplete();
  };

  // Tease → flash → reveal
  useEffect(() => {
    if (skipAnimation) {
      complete();
      return;
    }
    const t = setTimeout(() => {
      setFlash(true);
      setTimeout(() => setFlash(false), FLASH_MS);
      setTimeout(() => setPhase('revealed'), FLASH_MS / 2);
    }, TEASE_MS);
    return () => clearTimeout(t);
  }, [skipAnimation]);

  // Solo countdown after reveal
  useEffect(() => {
    if (skipAnimation || phase !== 'revealed' || onReroll || !countdownReady) return;
    if (count > 0) {
      const t = setTimeout(() => setCount((c) => c - 1), TICK_MS);
      return () => clearTimeout(t);
    }
    complete();
  }, [phase, count, skipAnimation, onReroll, countdownReady]);

  const abbr = winningTeamData?.abbreviation;
  const isDivision = winningLabel === 'DIVISION';
  const isTeasing = phase === 'tease';
  const allTeams = (sport === 'nba' ? teams : nflTeams).map((team) => ({
    abbr: team.abbreviation,
    label: team.name,
  }));
  const allYears = Array.from({ length: 26 }, (_, index) => {
    const year = 2000 + index;
    return sport === 'nba' ? `${year}-${String(year + 1).slice(-2)}` : String(year);
  });
  const teamIndex = Math.max(
    allTeams.findIndex((team) => team.abbr === abbr || team.label === winningTeam),
    0,
  );
  const yearIndex = Math.max(
    allYears.findIndex((year) => year === winningYear),
    0,
  );

  useEffect(() => {
    if (skipAnimation || phase !== 'tease') return;
    let tick = 0;
    const delays = [65, 72, 78, 85, 92, 100, 110, 125, 150, 210, 300, 430, 580];
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const runTick = () => {
      tick += 1;
      const nextTeam =
        tick < 10
          ? Math.floor(Math.random() * allTeams.length)
          : tick < 13
            ? (teamIndex - (13 - tick) + allTeams.length) % allTeams.length
            : teamIndex;
      const nextYear =
        tick < 10
          ? Math.floor(Math.random() * allYears.length)
          : tick < 13
            ? (yearIndex - (13 - tick) + allYears.length) % allYears.length
            : yearIndex;
      setDisplayTeamIndex(nextTeam);
      setDisplayYearIndex(nextYear);
      if (tick < delays.length) {
        timeoutId = setTimeout(runTick, delays[tick]);
      }
    };
    timeoutId = setTimeout(runTick, delays[0]);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [skipAnimation, phase, allTeams.length, allYears.length, teamIndex, yearIndex]);

  useEffect(() => {
    if (skipAnimation || phase !== 'revealed' || onReroll) {
      setCountdownReady(false);
      return;
    }
    const timer = setTimeout(() => setCountdownReady(true), SOLO_REVEAL_HOLD_MS);
    return () => clearTimeout(timer);
  }, [skipAnimation, phase, onReroll]);

  if (skipAnimation) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            className="absolute inset-0 bg-white z-10 pointer-events-none"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: FLASH_MS / 1000, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Skip — tease phase only */}
      {canSkip && isTeasing && (
        <button
          onClick={complete}
          className="absolute top-4 right-4 z-20 capcrunch-kicker text-[10px] text-white/25 hover:text-white/50 transition-colors"
        >
          Skip →
        </button>
      )}

      {/* Scanning glow behind content during tease */}
      {isTeasing && (
        <motion.div
          className="absolute w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(253,241,0,0.12) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Main content */}
      <motion.div
        className="flex flex-col items-center gap-5 relative z-[5] w-full max-w-4xl px-4"
        animate={isTeasing ? { opacity: 0.82 } : { opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        <div className="w-full max-w-xl flex flex-col gap-4">
          <FlashBox label={winningLabel} accent="#FDF100" active={isTeasing}>
            {!isDivision ? (
              <>
                <TeamLogo
                  sport={sport}
                  abbr={allTeams[displayTeamIndex]?.abbr ?? abbr}
                  size={72}
                  className="md:!w-20 md:!h-20"
                />
                <span className="capcrunch-title text-lg md:text-2xl text-white text-center leading-none">
                  {allTeams[displayTeamIndex]?.label ?? winningTeam}
                </span>
              </>
            ) : (
              <span className="capcrunch-title text-2xl md:text-4xl text-white text-center leading-tight">
                {winningTeam}
              </span>
            )}
          </FlashBox>

          <FlashBox label="Season" accent="#68BBE5" active={isTeasing}>
            <span className="capcrunch-title text-2xl md:text-4xl text-white text-center leading-none">
              {allYears[displayYearIndex] ?? winningYear}
            </span>
          </FlashBox>
        </div>

        {!isTeasing && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="flex flex-col items-center gap-2"
          >
            {!isDivision && abbr ? (
              <div className="capcrunch-title text-2xl sm:text-3xl text-white text-center">
                {winningTeam}
              </div>
            ) : null}
          </motion.div>
        )}
      </motion.div>

      {/* After-reveal layer: countdown (solo) or host buttons (multi) */}
      <AnimatePresence>
        {phase === 'revealed' && (
          <motion.div
            key="after"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
            className="absolute bottom-16 flex flex-col items-center gap-4 z-[5]"
          >
            {onReroll ? (
              /* Multiplayer */
              canSkip ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      hasCompleted.current = false;
                      onReroll();
                    }}
                    className="capcrunch-btn-secondary capcrunch-kicker px-5 py-2.5 text-xs"
                  >
                    Reroll
                  </button>
                  <button
                    onClick={complete}
                    className="capcrunch-btn-primary capcrunch-title text-sm px-6 py-2.5"
                  >
                    Start Game
                  </button>
                </div>
              ) : (
                <motion.span
                  className="capcrunch-kicker text-[11px] text-white/30 tracking-[0.3em]"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                >
                  WAITING FOR HOST
                </motion.span>
              )
            ) : (
              /* Solo countdown */
              <div className="flex flex-col items-center gap-1">
                <span className="capcrunch-kicker text-[9px] text-white/25 tracking-[0.5em]">
                  GET READY
                </span>
                {countdownReady ? (
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={count}
                      initial={{ opacity: 0, scale: 1.5, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.5, y: 10 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="capcrunch-title text-7xl leading-none text-[#FDF100] tabular-nums"
                    >
                      {count === 0 ? 'GO' : count}
                    </motion.span>
                  </AnimatePresence>
                ) : (
                  <div className="h-[76px] flex items-center justify-center">
                    <motion.span
                      className="capcrunch-kicker text-[11px] text-white/35 tracking-[0.35em]"
                      animate={{ opacity: [0.35, 0.8, 0.35] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                    >
                      LOCKED IN
                    </motion.span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FlashBox({
  label,
  accent,
  active,
  children,
}: {
  label: string;
  accent: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="capcrunch-kicker text-[8px] md:text-[10px] tracking-[0.3em] uppercase text-white/40">
          {label}
        </span>
        <span className="w-12 h-px" style={{ backgroundColor: accent, opacity: 0.45 }} />
      </div>
      <motion.div
        className="relative overflow-hidden border border-white/10 bg-black/30 py-5 md:py-6 px-4 flex flex-col items-center justify-center min-h-[132px] md:min-h-[152px]"
        animate={
          active ? { scale: [1, 1.015, 1], opacity: [0.82, 1, 0.82] } : { scale: 1, opacity: 1 }
        }
        transition={
          active ? { duration: 0.35, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }
        }
        style={{ boxShadow: active ? `0 0 28px ${accent}22` : undefined }}
      >
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={active ? { opacity: [0.05, 0.14, 0.05] } : { opacity: 0.06 }}
          transition={{ duration: 0.3, repeat: Infinity }}
          style={{
            background: `linear-gradient(135deg, ${accent}22, transparent 40%, ${accent}12)`,
          }}
        />
        <div className="relative z-[1] flex flex-col items-center gap-3">{children}</div>
      </motion.div>
    </div>
  );
}
