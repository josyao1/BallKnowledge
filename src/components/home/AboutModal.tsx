/**
 * AboutModal.tsx — Simple about overlay shown from the header info button.
 * Links to the public GitHub repo.
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
        <a
          href="https://github.com/josyao1/BallKnowledge"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[#ccc] hover:border-[#555] hover:text-white transition-colors sports-font text-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          View on GitHub
        </a>
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
