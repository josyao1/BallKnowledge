/**
 * CreateScrambleSettings.tsx — Name Scramble settings panel for lobby creation.
 * Points target and optional career era filter.
 */

import { motion } from 'framer-motion';

interface Props {
  winTarget: number;
  onWinTargetChange: (n: number) => void;
  careerTo: number;
  onCareerToChange: (n: number) => void;
}

export function CreateScrambleSettings({ winTarget, onWinTargetChange, careerTo, onCareerToChange }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-black/50 border border-[#3b82f6]/30 rounded-sm p-4 space-y-4"
    >
      <div className="sports-font text-[10px] text-white/40 text-center tracking-[0.3em] uppercase">
        Points Target
      </div>
      <div className="flex gap-2 justify-center flex-wrap">
        {([10, 20, 30, 40, 50] as const).map((n) => (
          <button
            key={n}
            onClick={() => onWinTargetChange(n)}
            className={`px-4 py-2 rounded-sm sports-font tracking-wider transition-all ${
              winTarget === n
                ? 'bg-[#3b82f6] text-white shadow-lg font-bold'
                : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="text-center text-white/30 text-[10px] sports-font tracking-wider">
        First to {winTarget} pts wins
      </div>

      <div>
        <div className="sports-font text-[10px] text-white/40 text-center mb-2 tracking-[0.3em] uppercase">
          Career Era (Optional)
        </div>
        <select
          value={careerTo}
          onChange={(e) => onCareerToChange(parseInt(e.target.value))}
          className="w-full bg-[#111] text-white px-3 py-2 rounded-sm border border-white/20 sports-font text-sm focus:outline-none focus:border-[#3b82f6]"
        >
          <option value={0}>Any Era</option>
          {Array.from({ length: 2024 - 2000 + 1 }, (_, i) => 2000 + i).map(y => (
            <option key={y} value={y}>Active into {y}+</option>
          ))}
        </select>
      </div>
    </motion.div>
  );
}
