import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';

export function ResultsPage() {
  const navigate = useNavigate();
  const {
    selectedTeam,
    selectedSeason,
    currentRoster,
    guessedPlayers,
    incorrectGuesses,
    score,
    bonusPoints,
    timerDuration,
    timeRemaining,
    resetGame,
  } = useGameStore();

  // Redirect if no game data
  useEffect(() => {
    if (!selectedTeam || !selectedSeason) {
      navigate('/');
    }
  }, [selectedTeam, selectedSeason, navigate]);

  if (!selectedTeam || !selectedSeason) {
    return null;
  }

  const totalScore = score + bonusPoints;
  const percentage = Math.round((guessedPlayers.length / currentRoster.length) * 100);
  const timeTaken = timerDuration - timeRemaining;

  // Create a set of guessed player IDs for quick lookup
  const guessedIds = new Set(guessedPlayers.map((p) => p.id));

  const handlePlayAgain = () => {
    resetGame();
    navigate('/');
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{
        backgroundColor: '#111827',
        backgroundImage: `linear-gradient(135deg, ${selectedTeam.colors.primary}15 0%, transparent 50%)`,
      }}
    >
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Game Over!</h1>
          <p className="text-gray-400">
            {selectedTeam.name} - {selectedSeason}
          </p>
        </motion.div>

        {/* Score summary */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/50 rounded-xl p-6 mb-8"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-4xl font-bold text-green-400">{totalScore}</div>
              <div className="text-gray-400 text-sm">Total Points</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-400">{percentage}%</div>
              <div className="text-gray-400 text-sm">Roster Completed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white">
                {guessedPlayers.length}/{currentRoster.length}
              </div>
              <div className="text-gray-400 text-sm">Players Found</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-400">+{bonusPoints}</div>
              <div className="text-gray-400 text-sm">Bonus Points</div>
            </div>
          </div>
          <div className="mt-4 text-center text-gray-500">
            Time: {Math.floor(timeTaken / 60)}:{String(timeTaken % 60).padStart(2, '0')}
          </div>
        </motion.div>

        {/* Incorrect guesses */}
        {incorrectGuesses.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="text-xl font-semibold mb-3 text-red-400">Incorrect Guesses</h2>
            <div className="flex flex-wrap gap-2">
              {incorrectGuesses.map((guess, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-red-900/30 text-red-400 rounded-full text-sm"
                >
                  {guess}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Full roster reveal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-xl font-semibold mb-4">Full Roster</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {currentRoster.map((player, index) => {
              const wasGuessed = guessedIds.has(player.id);
              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.03 }}
                  className={`p-3 rounded-lg ${
                    wasGuessed
                      ? 'bg-green-900/30 border border-green-700'
                      : 'bg-gray-800/50 border border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className={`font-medium ${wasGuessed ? 'text-green-400' : 'text-gray-300'}`}>
                        {player.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {player.position} {player.number && `#${player.number}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">{player.ppg.toFixed(1)} PPG</div>
                      {player.isLowScorer && (
                        <span className="text-xs text-yellow-500">+1 bonus</span>
                      )}
                    </div>
                  </div>
                  {wasGuessed && (
                    <div className="mt-1">
                      <span className="text-xs text-green-500">Guessed!</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 flex justify-center gap-4"
        >
          <button
            onClick={handlePlayAgain}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors"
          >
            Play Again
          </button>
        </motion.div>
      </div>
    </div>
  );
}
