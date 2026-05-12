import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  pickIndex: number;
  size?: 'sm' | 'lg';
}

export function TeammateRoundCard({ pickIndex, size = 'sm' }: Props) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -90 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      style={{ perspective: 600 }}
      className={`relative rounded border-2 bg-black border-[#22c55e]/80 shadow-[0_0_12px_rgba(34,197,94,0.25)] ${
        size === 'lg' ? 'px-8 md:px-12 py-2 md:py-3' : 'px-5 py-2'
      }`}
    >
      <p className={`sports-font text-white/50 tracking-widest uppercase leading-none mb-0.5 ${size === 'lg' ? 'text-[8px] md:text-[10px]' : 'text-[8px]'}`}>Filter</p>
      <p className={`retro-title font-bold text-[#22c55e] leading-tight ${size === 'lg' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}>
        Teammate of Pick {pickIndex}
      </p>

      {/* Tooltip trigger */}
      <button
        onClick={e => { e.stopPropagation(); setTooltipOpen(o => !o); }}
        className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full border border-[#22c55e]/40 text-[#22c55e]/50 text-[8px] flex items-center justify-center hover:border-[#22c55e]/70 hover:text-[#22c55e]/80 transition-colors"
      >
        ?
      </button>

      <AnimatePresence>
        {tooltipOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-52 bg-black/95 border border-[#22c55e]/25 rounded px-2.5 py-2 text-[9px] text-white/60 leading-relaxed z-50 shadow-lg"
          >
            Pick any player who was ever a teammate of Pick {pickIndex} — even in a different year. The overlap just needs to have happened at some point.
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
