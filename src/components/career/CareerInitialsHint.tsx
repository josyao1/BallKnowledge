/**
 * CareerInitialsHint.tsx — Animated initials reveal for Career Arc.
 * Shared by CareerGamePage (solo) and MultiplayerCareerPage.
 */

import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  revealed: boolean;
  initials: string | null;
}

export function CareerInitialsHint({ revealed, initials }: Props) {
  return (
    <AnimatePresence>
      {revealed && initials && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-center justify-center gap-3"
        >
          <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase">Initials</div>
          <div className="retro-title text-2xl text-[#d4af37] tracking-widest">{initials}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
