import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';

export function ResultsPage() {
  const navigate = useNavigate();
  const [draggedGuess, setDraggedGuess] = useState<string | null>(null);
  const [dragOverPlayerId, setDragOverPlayerId] = useState<number | string | null>(null);

  const {
    selectedTeam,
    selectedSeason,
    currentRoster,
    guessedPlayers,
    incorrectGuesses,
    score,
    timerDuration,
    timeRemaining,
    hideResultsDuringGame,
    overrideGuess,
    resetGame,
  } = useGameStore();

  const percentage = currentRoster.length > 0
    ? Math.round((guessedPlayers.length / currentRoster.length) * 100)
    : 0;
  const timeTaken = timerDuration - timeRemaining;

  // Redirect if no game data
  useEffect(() => {
    if (!selectedTeam || !selectedSeason) {
      navigate('/');
    }
  }, [selectedTeam, selectedSeason, navigate]);

  if (!selectedTeam || !selectedSeason) {
    return null;
  }

  // Create a set of guessed player IDs for quick lookup
  const guessedIds = new Set(guessedPlayers.map((p) => p.id));

  const handlePlayAgain = () => {
    resetGame();
    navigate('/');
  };

  // Team color CSS variables
  const teamColorStyles = {
    '--team-primary': selectedTeam.colors.primary,
    '--team-secondary': selectedTeam.colors.secondary,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen" style={teamColorStyles}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1
            className="retro-title text-5xl md:text-6xl mb-2"
            style={{ color: selectedTeam.colors.primary }}
          >
            Final Score
          </h1>
          <div
            className="team-badge inline-flex"
            style={{
              background: `linear-gradient(135deg, ${selectedTeam.colors.primary} 0%, ${selectedTeam.colors.secondary} 100%)`,
            }}
          >
            {selectedTeam.abbreviation} {selectedSeason}
          </div>
        </motion.div>

        {/* Score summary - Scoreboard style */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="scoreboard-panel p-6 mb-8"
          style={{ borderColor: `${selectedTeam.colors.primary}50` }}
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-display">
              <div className="stat-value" style={{ color: selectedTeam.colors.secondary }}>{score}</div>
              <div className="stat-label">Points</div>
            </div>
            <div className="stat-display">
              <div className="stat-value" style={{ color: selectedTeam.colors.primary }}>{percentage}%</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-display">
              <div className="stat-value">
                {guessedPlayers.length}/{currentRoster.length}
              </div>
              <div className="stat-label">Found</div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <div
              className="scoreboard-number text-2xl px-4 py-2 rounded-lg"
              style={{ backgroundColor: `${selectedTeam.colors.primary}20` }}
            >
              Time: {Math.floor(timeTaken / 60)}:{String(timeTaken % 60).padStart(2, '0')}
            </div>
          </div>
        </motion.div>

        {/* Incorrect guesses */}
        {incorrectGuesses.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="vintage-card p-4 mb-8"
          >
            <h2 className="sports-font text-lg text-[var(--nba-red)] mb-3 tracking-wider">
              Incorrect Guesses
              {hideResultsDuringGame && (
                <span className="text-xs text-gray-500 ml-2 font-normal">
                  (drag onto a player to correct)
                </span>
              )}
            </h2>
            <div className="flex flex-wrap gap-2">
              {incorrectGuesses.map((guess, index) => (
                <span
                  key={index}
                  draggable={hideResultsDuringGame}
                  onDragStart={() => setDraggedGuess(guess)}
                  onDragEnd={() => setDraggedGuess(null)}
                  className={`px-3 py-1 bg-[var(--nba-red)]/20 text-[var(--nba-red)] border border-[var(--nba-red)]/30 rounded-full text-sm ${
                    hideResultsDuringGame ? 'cursor-grab active:cursor-grabbing hover:bg-[var(--nba-red)]/30' : ''
                  } ${draggedGuess === guess ? 'opacity-50' : ''}`}
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
          className="vintage-card p-4 mb-8"
          style={{ borderColor: `${selectedTeam.colors.primary}30` }}
        >
          <h2 className="sports-font text-lg mb-4 tracking-wider" style={{ color: selectedTeam.colors.secondary }}>
            Full Roster
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {currentRoster.map((player, index) => {
              const wasGuessed = guessedIds.has(player.id);
              const isDropTarget = hideResultsDuringGame && !wasGuessed && draggedGuess;
              const isDragOver = dragOverPlayerId === player.id;

              const handleDragOver = (e: React.DragEvent) => {
                if (isDropTarget) {
                  e.preventDefault();
                  setDragOverPlayerId(player.id);
                }
              };

              const handleDragLeave = () => {
                setDragOverPlayerId(null);
              };

              const handleDrop = (e: React.DragEvent) => {
                e.preventDefault();
                if (draggedGuess && !wasGuessed) {
                  overrideGuess(draggedGuess, player.id as number);
                  setDraggedGuess(null);
                  setDragOverPlayerId(null);
                }
              };

              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.03 }}
                  className={`player-card p-3 transition-all ${
                    isDropTarget ? 'ring-2 ring-dashed ring-gray-500' : ''
                  } ${isDragOver ? 'ring-[var(--nba-orange)] bg-[var(--nba-orange)]/10 scale-105' : ''}`}
                  style={{
                    borderColor: wasGuessed ? selectedTeam.colors.primary : undefined,
                    backgroundColor: wasGuessed ? `${selectedTeam.colors.primary}15` : isDragOver ? undefined : undefined,
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div
                        className="font-medium"
                        style={{ color: wasGuessed ? selectedTeam.colors.secondary : '#aaa' }}
                      >
                        {player.name}
                      </div>
                      <div className="text-sm text-[#666]">
                        {player.position} {player.number && `#${player.number}`}
                      </div>
                    </div>
                    <div className="text-right">
                      {player.ppg !== undefined && (
                        <div className="text-sm text-[#888]">{player.ppg.toFixed(1)} PPG</div>
                      )}
                    </div>
                  </div>
                  {wasGuessed && (
                    <div className="mt-1">
                      <span
                        className="text-xs sports-font tracking-wider"
                        style={{ color: selectedTeam.colors.primary }}
                      >
                        Found!
                      </span>
                    </div>
                  )}
                  {isDropTarget && isDragOver && (
                    <div className="mt-1 text-xs text-[var(--nba-orange)] sports-font">
                      Drop to assign "{draggedGuess}"
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
          className="flex justify-center gap-4"
        >
          <button
            onClick={handlePlayAgain}
            className="px-12 py-4 text-lg rounded-lg font-bold sports-font tracking-wider transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${selectedTeam.colors.primary}, ${selectedTeam.colors.secondary})`,
              color: '#fff',
              boxShadow: `0 4px 15px ${selectedTeam.colors.primary}50`,
            }}
          >
            Play Again
          </button>
        </motion.div>
      </div>
    </div>
  );
}
