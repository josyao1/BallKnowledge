/**
 * ConferenceRoundCard.tsx — Displays a college conference + pro conference
 * combination round (e.g. "SEC | AFC") in Cap Crunch.
 *
 * Used in both the multiplayer header and the solo picking screen.
 * Clicking "see schools" opens a centered floating panel listing all qualifying
 * schools; clicking outside (or the button again) dismisses it.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { P4_CONFERENCES, CONFERENCE_LOGOS } from '../../services/capCrunch';

const PRO_CONF_STYLES: Record<string, string> = {
  AFC: 'bg-[#b91c1c]/80 border border-[#ef4444]',
  NFC: 'bg-[#1d4ed8]/80 border border-[#3b82f6]',
  East: 'bg-[#065f46]/80 border border-[#34d399]',
  West: 'bg-[#7c2d12]/80 border border-[#fb923c]',
};

interface Props {
  confName: string;
  nflConf: string | null;
  /** 'sm' used in the multiplayer sticky header; 'lg' used on the solo full-screen card */
  size?: 'sm' | 'lg';
}

export function ConferenceRoundCard({ confName, nflConf, size = 'sm' }: Props) {
  const [showPanel, setShowPanel] = useState(false);
  const logoH = size === 'lg' ? 'h-10 md:h-14' : 'h-8 md:h-10';
  const proTextSize = size === 'lg' ? 'text-xl md:text-2xl' : 'text-lg md:text-xl';
  const confTextSize = size === 'lg' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl';

  const schools = confName in P4_CONFERENCES
    ? (P4_CONFERENCES[confName] ?? [])
        .filter((s, i, a) => a.indexOf(s) === i)
        .filter(s => !s.includes('&amp;') && !s.includes('amp;'))
    : [];

  return (
    <div className="px-4 py-2 rounded border-2 bg-black border-[#3b82f6]/80 shadow-[0_0_12px_rgba(59,130,246,0.2)]">
      <p className="sports-font text-[8px] text-white/50 tracking-widest uppercase leading-none mb-1.5">Conference</p>

      {/* College + pro conf side by side */}
      <div className="flex items-center gap-3">
        {/* College logo or name */}
        {CONFERENCE_LOGOS[confName] ? (
          <div className={`rounded px-1 py-0.5 flex-shrink-0 ${confName === 'Big Ten' ? 'bg-white/15' : ''}`}>
            <img src={CONFERENCE_LOGOS[confName]} alt={confName} className={`${logoH} object-contain`} />
          </div>
        ) : (
          <p className={`retro-title font-bold text-[#3b82f6] leading-tight flex-shrink-0 ${confTextSize}`}>
            {confName}
          </p>
        )}

        {/* Pro conference pill */}
        {nflConf && (
          <div className="flex items-center gap-1.5">
            <span className="sports-font text-[9px] text-white/30">+</span>
            <div className={`px-3 py-1 rounded-sm ${PRO_CONF_STYLES[nflConf] ?? 'bg-white/10 border border-white/20'}`}>
              <span className={`retro-title leading-none text-white tracking-wider ${proTextSize}`}>{nflConf}</span>
            </div>
          </div>
        )}
      </div>

      {/* Schools trigger */}
      <div className="mt-1.5">
        {confName === 'Non-P4' ? (
          <p className="sports-font text-[7px] text-white/35 leading-none">
            any year — just need to have attended a non-P4 school
          </p>
        ) : (
          <button
            onClick={() => setShowPanel(v => !v)}
            className="sports-font text-[8px] text-[#3b82f6]/60 hover:text-[#3b82f6] transition-colors"
          >
            {showPanel ? 'hide schools ▲' : 'see schools ▼'}
          </button>
        )}
      </div>

      {/* Floating panel via portal */}
      {createPortal(
        <AnimatePresence>
          {showPanel && schools.length > 0 && (
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
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(520px,90vw)] bg-[#0d0d0d] border-2 border-[#3b82f6]/50 rounded-lg shadow-[0_0_40px_rgba(59,130,246,0.2)] p-5"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    {CONFERENCE_LOGOS[confName] && (
                      <div className={`rounded px-1 py-0.5 flex-shrink-0 ${confName === 'Big Ten' ? 'bg-white/15' : ''}`}>
                        <img src={CONFERENCE_LOGOS[confName]} alt={confName} className="h-7 object-contain" />
                      </div>
                    )}
                    <div>
                      <p className="sports-font text-[8px] text-white/40 tracking-widest uppercase leading-none mb-0.5">Qualifying Schools</p>
                      <p className="retro-title text-sm text-[#3b82f6]">{confName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>

                {/* School grid */}
                <div className="flex flex-wrap gap-1.5">
                  {schools.map(school => (
                    <span
                      key={school}
                      className="sports-font text-[9px] text-white/60 bg-white/5 border border-white/10 rounded px-2 py-1 leading-none"
                    >
                      {school}
                    </span>
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
