/**
 * GuessPlayerSetup.tsx — Two-level setup panel for "Guess the Player".
 *
 * Level 1: choose between Career Arc, Name Scramble, or Face Reveal.
 * Level 2: the chosen game's own setup UI (existing CareerArcSetup /
 *           ScrambleSetup, or new FaceRevealSetup). Back → returns to level 1.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CareerArcSetup } from './CareerArcSetup';
import { ScrambleSetup } from './ScrambleSetup';
import { FaceRevealSetup } from './FaceRevealSetup';

type SubMode = 'career' | 'scramble' | 'face-reveal' | null;

interface Props {
  sport: 'nba' | 'nfl';
  onBack: () => void;
}

const COLOR = '#3b82f6';

const MODES: { id: SubMode; label: string; abbr: string; desc: string; color: string }[] = [
  { id: 'career',      label: 'Career Arc',    abbr: 'CA', desc: "Trace a player's career year by year", color: '#22c55e' },
  { id: 'scramble',    label: 'Name Scramble', abbr: 'NS', desc: 'Unscramble athlete names vs the clock', color: '#3b82f6' },
  { id: 'face-reveal', label: 'Face Reveal',   abbr: 'FR', desc: 'Identify a player from their zoomed headshot', color: '#06b6d4' },
];

export function GuessPlayerSetup({ sport, onBack }: Props) {
  const [subMode, setSubMode] = useState<SubMode>(null);
  const [careerActiveYear,   setCareerActiveYear]   = useState<number | null>(null);
  const [scrambleActiveYear, setScrambleActiveYear] = useState<number | null>(null);

  return (
    <AnimatePresence mode="wait">
      {subMode === null && (
        <motion.div
          key="gp-selector"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.22 }}
          className="z-10 w-full max-w-sm"
        >
          <div className="relative bg-[#141414] border-2 rounded-2xl overflow-hidden shadow-2xl" style={{ borderColor: COLOR }}>
            {/* Diagonal stripe texture */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{ backgroundImage: `repeating-linear-gradient(45deg, ${COLOR} 0, ${COLOR} 1px, transparent 0, transparent 50%)`, backgroundSize: '14px 14px' }}
            />

            <div className="relative z-10 p-5 flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center">
                <button
                  onClick={onBack}
                  className="sports-font text-[10px] tracking-widest uppercase transition"
                  style={{ color: `${COLOR}80` }}
                  onMouseEnter={e => (e.currentTarget.style.color = COLOR)}
                  onMouseLeave={e => (e.currentTarget.style.color = `${COLOR}80`)}
                >
                  ← Back
                </button>
                <div className="flex-1 text-center">
                  <div className="sports-font text-[9px] tracking-[0.3em] uppercase" style={{ color: `${COLOR}80` }}>GP</div>
                  <h2 className="retro-title text-2xl leading-tight" style={{ color: COLOR }}>Guess the Player</h2>
                  <p className="sports-font text-[9px] text-[#888] tracking-widest">{sport === 'nba' ? 'NBA' : 'NFL'} Edition</p>
                </div>
                <div className="w-12" />
              </div>

              <div className="border-t border-[#3b82f6]/20" />

              {/* Mode selector buttons */}
              <div className="flex flex-col gap-2">
                <div className="sports-font text-[9px] text-[#888] tracking-[0.25em] uppercase text-center mb-1">Choose a mode</div>
                {MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSubMode(m.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2a2a2a] bg-[#0e0e0e] hover:border-[#3a3a3a] transition-all group"
                  >
                    <span
                      className="retro-title text-sm w-8 shrink-0"
                      style={{ color: m.color }}
                    >
                      {m.abbr}
                    </span>
                    <div className="text-left flex-1">
                      <div className="retro-title text-base leading-tight" style={{ color: m.color }}>{m.label}</div>
                      <div className="sports-font text-[9px] text-[#555] tracking-wider mt-0.5">{m.desc}</div>
                    </div>
                    <span className="text-[#444] group-hover:text-[#888] transition-colors text-sm">→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {subMode === 'career' && (
        <CareerArcSetup
          key="career-setup"
          sport={sport}
          careerActiveYear={careerActiveYear}
          setCareerActiveYear={setCareerActiveYear}
          onBack={() => setSubMode(null)}
        />
      )}

      {subMode === 'scramble' && (
        <ScrambleSetup
          key="scramble-setup"
          sport={sport}
          scrambleActiveYear={scrambleActiveYear}
          setScrambleActiveYear={setScrambleActiveYear}
          onBack={() => setSubMode(null)}
        />
      )}

      {subMode === 'face-reveal' && (
        <FaceRevealSetup
          key="face-reveal-setup"
          sport={sport}
          onBack={() => setSubMode(null)}
        />
      )}
    </AnimatePresence>
  );
}
