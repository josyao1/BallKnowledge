/**
 * FlipReveal.tsx — Family Feud-style letter flip animation for Box Score.
 * Shared by BoxScoreGamePage (solo) and MultiplayerBoxScorePage.
 */

import { motion } from 'framer-motion';

export function FlipReveal({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center" style={{ perspective: 600 }}>
      {name.split('').map((ch, i) => (
        <motion.span
          key={i}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{ delay: i * 0.035, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'inline-block', transformOrigin: '50% 100%', whiteSpace: 'pre' }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}
