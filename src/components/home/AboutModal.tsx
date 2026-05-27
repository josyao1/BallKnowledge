/**
 * AboutModal.tsx — Simple about overlay shown from the header info button.
 */

import { motion } from 'framer-motion';

interface Props {
  onClose: () => void;
}

export function AboutModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-xl p-8 max-w-sm w-full mx-4 text-center"
      >
        <h2 className="retro-title text-2xl text-white mb-2">BallKnowledge</h2>
        <p className="sports-font text-[#666] text-sm mb-6 leading-relaxed">
          A collection of sports trivia games. Built for fans, by fans.
        </p>
        <button
          onClick={onClose}
          className="block mx-auto mt-4 sports-font text-[#444] hover:text-[#666] text-xs transition-colors"
        >
          close
        </button>
      </motion.div>
    </div>
  );
}
