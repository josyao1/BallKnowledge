import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  pickIndex: number;
  size?: 'sm' | 'lg';
}

export function TeammateRoundCard({ pickIndex, size = 'sm' }: Props) {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -90 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      style={{ perspective: 600 }}
      className={`relative border bg-black/60 border-[#70BE5B]/70 shadow-[0_0_16px_rgba(112,190,91,0.18)] ${
        size === 'lg' ? 'px-8 md:px-12 py-2 md:py-3' : 'px-5 py-2'
      }`}
    >
      <p className={`capcrunch-kicker text-white/40 leading-none mb-0.5 ${size === 'lg' ? 'text-[8px] md:text-[10px]' : 'text-[8px]'}`}>Filter</p>
      <p className={`capcrunch-title text-[#70BE5B] leading-tight ${size === 'lg' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}>
        Played with Pick {pickIndex}
      </p>

      <button
        onClick={e => { e.stopPropagation(); setShowPanel(v => !v); }}
        className="absolute bottom-1.5 right-1.5 w-4 h-4 border border-[#70BE5B]/40 text-[#70BE5B]/50 text-[8px] flex items-center justify-center hover:border-[#70BE5B]/70 hover:text-[#70BE5B]/80 transition-colors"
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
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(400px,90vw)] bg-[#0d0d0d] border border-[#70BE5B]/50 shadow-[0_0_40px_rgba(112,190,91,0.2)] p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="sports-font text-[8px] text-white/40 tracking-widest uppercase leading-none mb-0.5">Rule</p>
                    <p className="capcrunch-title text-sm text-[#70BE5B]">Played with Pick {pickIndex}</p>
                  </div>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>
                <p className="sports-font text-[10px] text-white/60 leading-relaxed">
                  Pick any player who was ever on the same team as Pick {pickIndex} — even in a different year. The overlap just needs to have happened at some point in their careers.
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
