import { motion, AnimatePresence } from 'framer-motion';

// Generic player type that works with both NBA and NFL
interface GenericPlayer {
  id: number | string;
  name: string;
}

interface GuessedPlayersListProps {
  guessedPlayers: GenericPlayer[];
  incorrectGuesses: string[];
  pendingGuesses?: string[];
  hideResults?: boolean;
}

export function GuessedPlayersList({
  guessedPlayers,
  incorrectGuesses,
  pendingGuesses = [],
  hideResults = false,
}: GuessedPlayersListProps) {
  // Casino chip styles
  const chipBase = "px-3 py-1.5 rounded-sm shadow-[2px_2px_0px_rgba(0,0,0,0.5)] sports-font text-[11px] font-bold uppercase tracking-wider";

  // Hidden results mode: show all guesses in neutral state
  if (hideResults) {
    return (
      <div className="space-y-4">
        {pendingGuesses.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {pendingGuesses.map((guess, index) => (
                <motion.div
                  key={`${guess}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`${chipBase} bg-[#ddd] text-black/70 border-b-2 border-gray-400`}
                >
                  {guess}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center text-white/30 py-8 sports-font tracking-widest">
            Place your bets...
          </div>
        )}
      </div>
    );
  }

  // Standard mode: show correct and incorrect separately
  return (
    <div className="space-y-6">
      {/* Correct guesses - Gold winning chips */}
      {guessedPlayers.length > 0 && (
        <div>
          <h3 className="retro-title text-[10px] text-white/40 mb-3 tracking-widest uppercase flex justify-between">
            Winners <span className="text-emerald-400">{guessedPlayers.length}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {guessedPlayers.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`${chipBase} bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black border-b-2 border-[#a89860]`}
                >
                  {player.name}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Incorrect guesses - Faded/busted chips */}
      {incorrectGuesses.length > 0 && (
        <div>
          <h3 className="retro-title text-[10px] text-white/40 mb-3 tracking-widest uppercase flex justify-between">
            Busted <span className="text-red-400/60">{incorrectGuesses.length}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {incorrectGuesses.map((guess, index) => (
                <motion.div
                  key={`${guess}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.6, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`${chipBase} bg-[#444] text-white/50 border-b-2 border-[#222] line-through decoration-red-500/50`}
                >
                  {guess}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty state */}
      {guessedPlayers.length === 0 && incorrectGuesses.length === 0 && (
        <div className="text-center text-white/30 py-8 sports-font tracking-widest">
          Place your bets...
        </div>
      )}
    </div>
  );
}
