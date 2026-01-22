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
                  className="px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg"
                >
                  <span className="text-gray-300 font-medium">{guess}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            Start typing player names...
          </div>
        )}
      </div>
    );
  }

  // Standard mode: show correct and incorrect separately
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
                  className="px-3 py-1.5 bg-green-900/40 border border-green-700 rounded-lg"
                >
                  <span className="text-green-400 font-medium">{player.name}</span>
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
