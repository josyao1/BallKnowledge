/**
 * GuessedPlayersList.tsx — Displays guessed players as casino-themed chips.
 *
 * In standard mode, shows correct guesses as gold "winning" chips and
 * incorrect guesses as faded "busted" chips. In hidden-results mode
 * (multiplayer), all guesses appear as neutral chips until the game ends.
 */

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
  uniqueGuessNames?: Set<string>;
}

export function GuessedPlayersList({
  guessedPlayers,
  incorrectGuesses,
  pendingGuesses = [],
  hideResults = false,
  uniqueGuessNames,
}: GuessedPlayersListProps) {
  const chipBase = 'px-3 py-1.5 capcrunch-kicker text-[11px] font-bold uppercase tracking-wider';

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
                  className={`${chipBase} bg-white/8 border border-white/15 text-white/70`}
                >
                  {guess}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center text-white/25 py-8 capcrunch-kicker text-[10px] tracking-[0.4em]">
            Start naming players...
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
          <h3 className="capcrunch-kicker text-[9px] text-white/40 mb-3 flex justify-between">
            Hit <span className="text-emerald-400">{guessedPlayers.length}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {guessedPlayers.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`${chipBase} bg-[#FDF100]/10 border border-[#FDF100]/30 text-[#FDF100] relative`}
                >
                  {player.name}
                  {uniqueGuessNames && uniqueGuessNames.has(player.name) && (
                    <span className="absolute -top-2 -right-2 bg-[#FDF100] text-black text-[8px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      +1
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Incorrect guesses - Faded/busted chips */}
      {incorrectGuesses.length > 0 && (
        <div>
          <h3 className="capcrunch-kicker text-[9px] text-white/40 mb-3 flex justify-between">
            Miss <span className="text-red-400/60">{incorrectGuesses.length}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {incorrectGuesses.map((guess, index) => (
                <motion.div
                  key={`${guess}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.6, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`${chipBase} bg-white/5 border border-white/10 text-white/25 line-through decoration-red-500/40`}
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
        <div className="text-center text-white/25 py-8 capcrunch-kicker text-[10px] tracking-[0.4em]">
          Start naming players...
        </div>
      )}
    </div>
  );
}
