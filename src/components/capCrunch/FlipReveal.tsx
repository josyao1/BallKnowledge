/**
 * FlipReveal.tsx — Family Feud-style letter-by-letter reveal animation.
 *
 * Each character flips up from below in sequence, like a split-flap board.
 * Re-triggers whenever `text` changes.
 */

import { motion } from 'framer-motion';

interface Props {
  text: string;
  className?: string;
  /** Stagger delay between each character in seconds (default 0.035) */
  stagger?: number;
}

export function FlipReveal({ text, className, stagger = 0.035 }: Props) {
  return (
    <span className={className} style={{ display: 'inline-block' }}>
      {text.split('').map((char, i) => (
        <motion.span
          key={`${text}-${i}`}
          initial={{ opacity: 0, scaleY: 0.2, y: '60%' }}
          animate={{ opacity: 1, scaleY: 1, y: '0%' }}
          transition={{ delay: i * stagger, duration: 0.1, ease: 'easeOut' }}
          style={{ display: 'inline-block', transformOrigin: 'bottom center' }}
        >
          {char === ' ' ? '\u00a0' : char}
        </motion.span>
      ))}
    </span>
  );
}
