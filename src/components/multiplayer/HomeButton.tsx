/**
 * HomeButton.tsx — Small in-game button for multiplayer screens.
 *
 * Tapping shows an inline confirmation so players can't accidentally leave.
 * For hosts, also offers "Send to Lobby" which resets the lobby so
 * everyone is returned to the waiting room without scoring.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  /** When true, shows the "End Game for All" option in the confirmation */
  isHost?: boolean;
  /** Called when the host confirms ending the game for everyone */
  onEndGame?: () => void;
}

export function HomeButton({ isHost = false, onEndGame }: Props) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-1.5 flex-wrap"
        >
          <span className="sports-font text-[10px] text-white/50 tracking-widest">Leave?</span>
          {isHost && onEndGame && (
            <button
              onClick={() => { setConfirming(false); onEndGame(); }}
              className="px-2.5 py-1 rounded-sm retro-title text-xs text-white bg-orange-700/80 hover:bg-orange-600 border border-orange-500 transition-colors whitespace-nowrap"
            >
              Send to Lobby
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-2.5 py-1 rounded-sm retro-title text-xs text-white bg-red-600/80 hover:bg-red-500 border border-red-500 transition-colors"
          >
            Leave
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-2.5 py-1 rounded-sm retro-title text-xs text-white/60 bg-black/40 hover:text-white border border-white/20 transition-colors"
          >
            No
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-2.5 py-1 rounded-sm sports-font text-[10px] tracking-widest text-white/30 hover:text-white/70 border border-white/10 hover:border-white/30 transition-colors"
      title="Go home"
    >
      ⌂ Home
    </button>
  );
}
