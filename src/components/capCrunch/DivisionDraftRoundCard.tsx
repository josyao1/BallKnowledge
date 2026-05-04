/**
 * DivisionDraftRoundCard.tsx — Displays a division + draft round category in Cap Crunch.
 *
 * e.g. "AFC North | R47" → "AFC North" in gold, "4th–7th Round" in purple.
 * Clicking "see teams" opens a centered floating panel with team logos;
 * clicking outside dismisses it.
 *
 * Used in both the multiplayer header and the solo picking screen.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { NFL_DIVISIONS, NBA_DIVISIONS } from '../../services/capCrunch';
import { TeamLogo } from '../TeamLogo';

function draftLabel(code: string): string {
  if (code === 'R1')  return '1st Round';
  if (code === 'R2')  return '2nd Round';
  if (code === 'R23') return '2nd–3rd Round';
  if (code === 'R47') return '4th–7th Round';
  return code;
}

interface Props {
  division: string;
  draftRound: string;
  sport: 'nba' | 'nfl';
  /** 'sm' used in the multiplayer sticky header; 'lg' used on the solo full-screen card */
  size?: 'sm' | 'lg';
}

export function DivisionDraftRoundCard({ division, draftRound, sport, size = 'sm' }: Props) {
  const [showPanel, setShowPanel] = useState(false);

  const divTeams = sport === 'nfl'
    ? (NFL_DIVISIONS[division] ?? [])
    : (NBA_DIVISIONS[division] ?? []);

  const divisionSize = size === 'lg' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl';
  const roundSize    = size === 'lg' ? 'text-base md:text-lg' : 'text-sm md:text-base';

  return (
    <div className="px-5 py-2 rounded border-2 bg-black border-[#a855f7]/80 shadow-[0_0_12px_rgba(168,85,247,0.25)]">
      {/* Division name + draft round side by side */}
      <div className="flex items-center gap-3 flex-wrap">
        <p className={`retro-title font-bold text-[#d4af37] leading-tight ${divisionSize}`}>
          {division}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="sports-font text-[9px] text-white/30">+</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#a855f7]/20 border border-[#a855f7]/50">
            <img src="/draftlogo.png" alt="Draft" className={size === 'lg' ? 'h-5 object-contain' : 'h-4 object-contain'} />
            <span className={`retro-title text-[#a855f7] leading-none tracking-wide ${roundSize}`}>
              {draftLabel(draftRound)}
            </span>
          </div>
        </div>
      </div>

      {/* See teams trigger */}
      <button
        onClick={() => setShowPanel(v => !v)}
        className="mt-1.5 sports-font text-[8px] text-[#a855f7]/60 hover:text-[#a855f7] transition-colors"
      >
        {showPanel ? 'hide teams ▲' : 'see teams ▼'}
      </button>

      {/* Floating panel via portal */}
      {createPortal(
        <AnimatePresence>
          {showPanel && divTeams.length > 0 && (
            <>
              {/* Backdrop */}
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-40 bg-black/50"
                onClick={() => setShowPanel(false)}
              />

              {/* Panel */}
              <motion.div
                key="panel"
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(420px,90vw)] bg-[#0d0d0d] border-2 border-[#a855f7]/50 rounded-lg shadow-[0_0_40px_rgba(168,85,247,0.2)] p-5"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="sports-font text-[8px] text-white/40 tracking-widest uppercase leading-none mb-0.5">Division Teams</p>
                    <p className="retro-title text-sm text-[#d4af37]">{division}</p>
                  </div>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>

                {/* Team logos grid */}
                <div className="flex justify-center gap-6 flex-wrap">
                  {divTeams.map(abbr => (
                    <div key={abbr} className="flex flex-col items-center gap-1.5">
                      <TeamLogo sport={sport} abbr={abbr} size={52} />
                      <span className="sports-font text-[9px] text-white/40">{abbr}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
