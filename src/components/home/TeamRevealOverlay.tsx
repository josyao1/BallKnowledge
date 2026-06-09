import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamLogo } from '../TeamLogo';

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

const TEASE_MS   = 2600; // how long the blurred tease lasts
const FLASH_MS   = 180;  // white flash duration
const TICK_MS    = 850;  // countdown tick speed

export function TeamRevealOverlay({
  winningTeam, winningYear, winningLabel = 'TEAM',
  sport, winningTeamData, skipAnimation,
  canSkip = true, onComplete, onReroll,
}: Props) {
  const [phase, setPhase] = useState<'tease' | 'revealed'>('tease');
  const [flash, setFlash] = useState(false);
  const [count, setCount] = useState(3);
  const hasCompleted = useRef(false);

  const complete = () => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    onComplete();
  };

  // Tease → flash → reveal
  useEffect(() => {
    if (skipAnimation) { complete(); return; }
    const t = setTimeout(() => {
      setFlash(true);
      setTimeout(() => setFlash(false), FLASH_MS);
      setTimeout(() => setPhase('revealed'), FLASH_MS / 2);
    }, TEASE_MS);
    return () => clearTimeout(t);
  }, [skipAnimation]);

  // Solo countdown after reveal
  useEffect(() => {
    if (skipAnimation || phase !== 'revealed' || onReroll) return;
    if (count > 0) {
      const t = setTimeout(() => setCount(c => c - 1), TICK_MS);
      return () => clearTimeout(t);
    }
    complete();
  }, [phase, count, skipAnimation, onReroll]);

  if (skipAnimation) return null;

  const abbr      = winningTeamData?.abbreviation;
  const isDivision = winningLabel === 'DIVISION';
  const isTeasing  = phase === 'tease';

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
          style={{ background: 'radial-gradient(circle, rgba(253,241,0,0.12) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Main content — blurred in tease, sharp on reveal */}
      <motion.div
        className="flex flex-col items-center gap-5 relative z-[5]"
        animate={isTeasing
          ? { filter: 'blur(18px)', scale: 0.87, opacity: 0.65 }
          : { filter: 'blur(0px)',  scale: 1,    opacity: 1    }
        }
        transition={isTeasing
          ? { duration: 0 }
          : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
        }
      >
        <div className="capcrunch-kicker text-[10px] text-white/30 tracking-[0.5em]">
          {winningLabel}
        </div>

        {!isDivision && abbr ? (
          <TeamLogo sport={sport} abbr={abbr} size={124} />
        ) : (
          <div className="capcrunch-title text-4xl sm:text-5xl text-white text-center px-6 leading-tight">
            {winningTeam}
          </div>
        )}

        {!isDivision && abbr && (
          <div className="capcrunch-title text-2xl sm:text-3xl text-white text-center">
            {winningTeam}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="h-px w-10 bg-white/15" />
          <span className="capcrunch-kicker text-[11px] text-[#FDF100] tracking-[0.4em]">
            {winningYear}
          </span>
          <div className="h-px w-10 bg-white/15" />
        </div>
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
                    onClick={() => { hasCompleted.current = false; onReroll(); }}
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
                <span className="capcrunch-kicker text-[9px] text-white/25 tracking-[0.5em]">GET READY</span>
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
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
