/**
 * CreateStartingLineupSettings.tsx — Starting Lineup settings panel for lobby creation.
 * Win target selector (first to N points takes the match).
 */

import { motion } from 'framer-motion';

interface Props {
  winTarget: number;
  onWinTargetChange: (n: number) => void;
}

export function CreateStartingLineupSettings({ winTarget, onWinTargetChange }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-black/50 border border-[#16a34a]/30 rounded-sm p-4"
    >
      <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
        Win Target
      </div>
      <div className="flex gap-2 justify-center">
        {([10, 20, 30] as const).map((n) => (
          <button
            key={n}
            onClick={() => onWinTargetChange(n)}
            className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
              winTarget === n
                ? 'bg-[#16a34a] text-white shadow-lg font-bold'
                : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
            }`}
          >
            {n} pts
          </button>
        ))}
      </div>
      <div className="text-center text-white/30 text-[10px] sports-font tracking-wider mt-2">
        First player to {winTarget} pts takes the match
      </div>
    </motion.div>
  );
}
