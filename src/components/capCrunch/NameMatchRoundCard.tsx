import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const CONF_BORDER: Record<string, string> = {
  AFC:  'border-[#ef4444]/80 shadow-[0_0_12px_rgba(239,68,68,0.25)]',
  NFC:  'border-[#3b82f6]/80 shadow-[0_0_12px_rgba(59,130,246,0.25)]',
  East: 'border-[#34d399]/80 shadow-[0_0_12px_rgba(52,211,153,0.25)]',
  West: 'border-[#fb923c]/80 shadow-[0_0_12px_rgba(251,146,60,0.25)]',
};

const CONF_TEXT: Record<string, string> = {
  AFC:  '#ef4444',
  NFC:  '#3b82f6',
  East: '#34d399',
  West: '#fb923c',
};

const CONF_PILL: Record<string, string> = {
  AFC:  'bg-[#b91c1c]/80 border border-[#ef4444]',
  NFC:  'bg-[#1d4ed8]/80 border border-[#3b82f6]',
  East: 'bg-[#065f46]/80 border border-[#34d399]',
  West: 'bg-[#7c2d12]/80 border border-[#fb923c]',
};

interface Props {
  nameType: 'first' | 'last';
  pickIndex: number;
  proConf?: string;
  size?: 'sm' | 'lg';
}

export function NameMatchRoundCard({ nameType, pickIndex, proConf, size = 'sm' }: Props) {
  const [showPanel, setShowPanel] = useState(false);

  const borderClass = proConf
    ? CONF_BORDER[proConf] ?? 'border-[#06b6d4]/80 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
    : 'border-[#06b6d4]/80 shadow-[0_0_12px_rgba(6,182,212,0.25)]';
  const textColor = proConf ? (CONF_TEXT[proConf] ?? '#06b6d4') : '#06b6d4';

  const label = nameType === 'first' ? 'First Initial' : 'Last Initial';
  const tooltipBody = nameType === 'first'
    ? `Pick any player whose first name starts with the same letter as Pick ${pickIndex}'s first name.${proConf ? ` They must also have played for ${proConf} at some point in their career.` : ''}`
    : `Pick any player whose last name starts with the same letter as Pick ${pickIndex}'s last name.${proConf ? ` They must also have played for ${proConf} at some point in their career.` : ''}`;

  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -90 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      style={{ perspective: 600 }}
      className={`relative rounded border-2 bg-black ${borderClass} ${
        size === 'lg' ? 'px-8 md:px-12 py-2 md:py-3' : 'px-5 py-2'
      }`}
    >
      <p style={{ color: textColor }} className={`sports-font tracking-widest uppercase leading-none mb-0.5 opacity-60 ${size === 'lg' ? 'text-[8px] md:text-[10px]' : 'text-[8px]'}`}>
        Same
      </p>
      <p style={{ color: textColor }} className={`retro-title font-bold leading-none ${size === 'lg' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}>
        {label}: Pick {pickIndex}
      </p>
      {proConf && (
        <div className="mt-0.5">
          <div className={`inline-flex px-2 py-0.5 rounded-sm ${CONF_PILL[proConf] ?? 'bg-white/10 border border-white/20'}`}>
            <span className="retro-title text-[9px] leading-none text-white tracking-wider">{proConf}</span>
          </div>
        </div>
      )}

      <button
        onClick={e => { e.stopPropagation(); setShowPanel(v => !v); }}
        className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full border border-[#06b6d4]/40 text-[#06b6d4]/50 text-[8px] flex items-center justify-center hover:border-[#06b6d4]/70 hover:text-[#06b6d4]/80 transition-colors"
      >
        ?
      </button>

      {createPortal(
        <AnimatePresence>
          {showPanel && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-40 bg-black/50"
                onClick={() => setShowPanel(false)}
              />
              <motion.div
                key="panel"
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(400px,90vw)] bg-[#0d0d0d] border-2 border-[#06b6d4]/50 rounded-lg shadow-[0_0_40px_rgba(6,182,212,0.2)] p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="sports-font text-[8px] text-white/40 tracking-widest uppercase leading-none mb-0.5">Same</p>
                    <p className="retro-title text-sm text-[#06b6d4]">{label}: Pick {pickIndex}{proConf ? ` + ${proConf}` : ''}</p>
                  </div>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>
                <p className="sports-font text-[10px] text-white/60 leading-relaxed">
                  {tooltipBody}
                </p>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  );
}
