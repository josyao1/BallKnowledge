/**
 * RouletteOverlay.tsx — Pre-game team/year draw animation before gameplay starts.
 *
 * Animation phases:
 *   0–4.8s  "scrolling"  — team logos and years scroll sideways
 *   4.8–6s  "landed"     — both lanes settle on the chosen team/year
 *   6s+     "paused"     — multiplayer host review state, or
 *   6s+     "countdown"  — solo / auto-advance countdown
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { TeamLogo } from '../TeamLogo';
import { teams } from '../../data/teams';
import { nflTeams } from '../../data/nfl-teams';

interface RouletteOverlayProps {
  winningTeam: string;
  winningYear: string;
  winningLabel?: string; // Label for the team/division card (default: "TEAM")
  onComplete: () => void;
  sport: 'nba' | 'nfl';
  winningTeamData?: any;
  skipAnimation?: boolean; // If true, skip animation entirely
  canSkip?: boolean; // If false, hide skip button (default: true for solo, set to isHost for multiplayer)
  onReroll?: () => void; // Called when host clicks Reroll (multiplayer only)
}

export function RouletteOverlay({ winningTeam, winningYear, winningLabel = 'TEAM', onComplete, sport, winningTeamData, skipAnimation, canSkip = true, onReroll }: RouletteOverlayProps) {
  const [phase, setPhase] = useState<'scrolling' | 'landed' | 'paused' | 'countdown'>('scrolling');
  const [count, setCount] = useState(5);
  const hasSkipped = useRef(false);

  // Skip animation immediately if skipAnimation prop is true
  useEffect(() => {
    if (skipAnimation && !hasSkipped.current) {
      hasSkipped.current = true;
      onComplete();
    }
  }, [skipAnimation, onComplete]);

  const allTeams = (sport === 'nba' ? teams : nflTeams).map(team => ({
    abbr: team.abbreviation,
    label: team.name,
  }));
  const yearStart = sport === 'nba' ? 2000 : 2000;
  const yearEnd = sport === 'nba' ? 2025 : 2025;
  const allYears = Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => {
    const year = yearStart + index;
    return sport === 'nba' ? `${year}-${String(year + 1).slice(-2)}` : String(year);
  });

  const winningTeamAbbr = winningTeamData?.abbreviation;
  const teamLoop = [...allTeams, ...allTeams, ...allTeams];
  const yearLoop = [...allYears, ...allYears, ...allYears];
  const teamStopIndex = Math.max(
    allTeams.findIndex(team => team.abbr === winningTeamAbbr || team.label === winningTeam),
    0,
  ) + allTeams.length;
  const yearStopIndex = Math.max(allYears.findIndex(year => year === winningYear), 0) + allYears.length;

  useEffect(() => {
    if (skipAnimation) return; // Don't set timers if skipping

    const LANDING_START = 4800;
    const FINAL_HOLD = 6000;

    const landTimer = setTimeout(() => setPhase('landed'), LANDING_START);
    const nextTimer = setTimeout(() => {
      setPhase(onReroll ? 'paused' : 'countdown');
    }, FINAL_HOLD);

    return () => {
      [landTimer, nextTimer].forEach(clearTimeout);
    };
  }, [skipAnimation, onReroll]);

  useEffect(() => {
    if (skipAnimation) return; // Don't run countdown if skipping

    if (phase === 'countdown' && count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    } else if (phase === 'countdown' && count === 0) {
      onComplete();
    }
  }, [phase, count, onComplete, skipAnimation]);

  // Handle skip button click
  const handleSkip = () => {
    if (hasSkipped.current) return;
    hasSkipped.current = true;
    onComplete();
  };

  // If skipping, render nothing
  if (skipAnimation) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen w-full relative overflow-hidden bg-[#0d2a0b] pt-10 md:pt-20">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
          background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)`
        }}
      />

      {/* Skip Button - only shown in single player */}
      {canSkip && (
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 z-50 px-4 py-2 bg-black/50 border border-white/20 rounded-lg text-white/60 hover:text-white hover:border-white/40 transition-all sports-font text-sm tracking-wider"
        >
          Skip →
        </button>
      )}

      <AnimatePresence mode="wait">
        {phase !== 'countdown' ? (
          <motion.div
            key="table"
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center w-full relative z-10 px-4"
          >
            <h2 className="retro-title text-lg md:text-2xl mb-8 md:mb-12 text-white uppercase tracking-[0.4em] text-center opacity-80">
              {phase === 'scrolling' ? 'Drawing Matchup' : phase === 'paused' ? 'The Draw' : 'The Draw'}
            </h2>

            <div className="w-full max-w-4xl flex flex-col gap-5 md:gap-6">
              <ScrollLane
                label={winningLabel}
                accent="#FDF100"
                phase={phase}
                stopIndex={teamStopIndex}
                itemWidth={136}
                itemCount={teamLoop.length}
                renderItem={(index) => {
                  const team = teamLoop[index];
                  const isWinner = index === teamStopIndex;
                  return (
                    <div
                      className={`w-[120px] md:w-[136px] h-[108px] md:h-[120px] border bg-black/55 flex flex-col items-center justify-center gap-2 px-2 transition-all ${
                        isWinner ? 'border-[#FDF100] shadow-[0_0_30px_rgba(253,241,0,0.24)]' : 'border-white/10'
                      }`}
                    >
                      <TeamLogo sport={sport} abbr={team.abbr} size={52} className="md:!w-16 md:!h-16" />
                      <span className="capcrunch-title text-xs md:text-sm text-white text-center leading-none">{team.abbr}</span>
                    </div>
                  );
                }}
              />

              <ScrollLane
                label="Season"
                accent="#68BBE5"
                phase={phase}
                stopIndex={yearStopIndex}
                itemWidth={160}
                itemCount={yearLoop.length}
                renderItem={(index) => {
                  const year = yearLoop[index];
                  const isWinner = index === yearStopIndex;
                  return (
                    <div
                      className={`w-[140px] md:w-[160px] h-[84px] md:h-[92px] border bg-black/55 flex items-center justify-center px-3 transition-all ${
                        isWinner ? 'border-[#68BBE5] shadow-[0_0_30px_rgba(104,187,229,0.24)]' : 'border-white/10'
                      }`}
                    >
                      <span className="capcrunch-title text-xl md:text-2xl text-white text-center leading-none">{year}</span>
                    </div>
                  );
                }}
              />
            </div>

            {/* Paused phase: host sees Reroll + Start, non-host sees waiting message */}
            {phase === 'paused' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-48 md:mt-64 flex flex-col items-center gap-4 z-50"
              >
                {canSkip ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onReroll?.()}
                      className="px-6 py-3 bg-black/60 border border-white/20 rounded-lg text-white/80 hover:text-white hover:border-[#d4af37] transition-all sports-font text-sm tracking-wider"
                    >
                      Reroll
                    </button>
                    <button
                      onClick={handleSkip}
                      className="px-6 py-3 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-lg text-white shadow-[0_3px_0_#166534] active:shadow-none active:translate-y-[3px] transition-all sports-font text-sm tracking-wider"
                    >
                      Start Game
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-white/40 sports-font text-sm tracking-wider">
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      Waiting for host...
                    </motion.span>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : (
          /* Responsive Countdown Ring */
          <motion.div 
            key="countdown" 
            initial={{ opacity: 0, scale: 0.8 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="flex flex-col items-center justify-center relative w-64 h-64 md:w-72 md:h-72 z-10 my-auto"
          >
            <svg className="absolute inset-0 w-full h-full rotate-[-90deg]" viewBox="0 0 288 288">
              <circle cx="144" cy="144" r="130" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
              <motion.circle 
                cx="144" cy="144" r="130" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"
                strokeDasharray="816"
                animate={{ strokeDashoffset: 816 - (816 * (count / 5)) }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </svg>
            <div className="flex flex-col items-center justify-center relative z-20">
              <span className="sports-font text-[8px] md:text-[10px] text-white/40 tracking-[0.4em] uppercase mb-2">Game Starting In</span>
              <AnimatePresence mode="popLayout">
                <motion.span key={count} className="retro-title text-7xl md:text-9xl text-white select-none leading-none">
                  {count}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScrollLane({
  label,
  accent,
  phase,
  stopIndex,
  itemWidth,
  itemCount,
  renderItem,
}: {
  label: string;
  accent: string;
  phase: 'scrolling' | 'landed' | 'paused' | 'countdown';
  stopIndex: number;
  itemWidth: number;
  itemCount: number;
  renderItem: (index: number) => React.ReactNode;
}) {
  const trackWidth = itemWidth * itemCount;
  const targetX = -(stopIndex * itemWidth) + itemWidth;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="sports-font text-[8px] md:text-[10px] tracking-[0.3em] uppercase text-white/40">{label}</span>
        <span className="w-12 h-px" style={{ backgroundColor: accent, opacity: 0.45 }} />
      </div>
      <div className="relative overflow-hidden border border-white/10 bg-black/30 py-3 md:py-4">
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px]" style={{ backgroundColor: accent, boxShadow: `0 0 20px ${accent}` }} />
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0d2a0b] to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0d2a0b] to-transparent z-10" />
        <motion.div
          className="flex gap-4"
          animate={{ x: phase === 'scrolling' ? [-itemWidth, -trackWidth + itemWidth * 2] : targetX }}
          transition={
            phase === 'scrolling'
              ? { duration: 2.2, ease: 'linear', repeat: Infinity }
              : { type: 'spring', stiffness: 80, damping: 18 }
          }
          style={{ width: trackWidth + itemCount * 16 }}
        >
          {Array.from({ length: itemCount }).map((_, index) => (
            <div key={index} className="shrink-0">
              {renderItem(index)}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
