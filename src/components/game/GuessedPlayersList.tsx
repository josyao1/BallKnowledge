import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '../../types';

interface GuessedPlayersListProps {
  guessedPlayers: Player[];
  incorrectGuesses: string[];
}

export function GuessedPlayersList({ guessedPlayers, incorrectGuesses }: GuessedPlayersListProps) {
  return (
    <div className="space-y-4">
      {/* Correct guesses */}
      {guessedPlayers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">
            Correct ({guessedPlayers.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {guessedPlayers.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="px-3 py-1.5 bg-green-900/40 border border-green-700 rounded-lg flex items-center gap-2"
                >
                  <span className="text-green-400 font-medium">{player.name}</span>
                  {player.isLowScorer && (
                    <span className="text-xs text-yellow-500 bg-yellow-900/30 px-1.5 py-0.5 rounded">
                      +1
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Incorrect guesses */}
      {incorrectGuesses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">
            Incorrect ({incorrectGuesses.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {incorrectGuesses.map((guess, index) => (
                <motion.div
                  key={`${guess}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="px-3 py-1.5 bg-red-900/30 border border-red-800 rounded-lg"
                >
                  <span className="text-red-400">{guess}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty state */}
      {guessedPlayers.length === 0 && incorrectGuesses.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          Start typing player names...
        </div>
      )}
    </div>
  );
}
