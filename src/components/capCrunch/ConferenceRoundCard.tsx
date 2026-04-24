/**
 * ConferenceRoundCard.tsx — Displays a college conference + pro conference
 * combination round (e.g. "SEC | AFC") in Cap Crunch.
 *
 * Used in both the multiplayer header and the solo picking screen.
 * College logo and pro conf pill sit side by side so the card stays
 * compact on mobile.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
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
  const [showSchools, setShowSchools] = useState(false);
  const logoH = size === 'lg' ? 'h-10 md:h-14' : 'h-8 md:h-10';
  const proTextSize = size === 'lg' ? 'text-xl md:text-2xl' : 'text-lg md:text-xl';
  const confTextSize = size === 'lg' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl';

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

      {/* Schools toggle */}
      <div className="mt-1.5">
        {confName === 'Non-P4' ? (
          <p className="sports-font text-[7px] text-white/35 leading-none">
            any year — just need to have attended a non-P4 school
          </p>
        ) : (
          <button
            onClick={() => setShowSchools(v => !v)}
            className="sports-font text-[8px] text-[#3b82f6]/60 hover:text-[#3b82f6] transition-colors"
          >
            {showSchools ? 'hide schools ▲' : 'see schools ▼'}
          </button>
        )}
        {showSchools && confName in P4_CONFERENCES && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-1.5 pt-1.5 border-t border-[#3b82f6]/20"
          >
            <p className="sports-font text-[7px] text-white/35 leading-relaxed">
              {(P4_CONFERENCES[confName] ?? [])
                .filter((s, i, a) => a.indexOf(s) === i)
                .filter(s => !s.includes('&amp;') && !s.includes('amp;'))
                .join(' · ')}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
