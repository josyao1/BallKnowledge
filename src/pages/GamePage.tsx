import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { Timer } from '../components/game/Timer';
import { PlayerInput } from '../components/game/PlayerInput';
import { GuessedPlayersList } from '../components/game/GuessedPlayersList';
import { TeamDisplay } from '../components/game/TeamDisplay';

export function GamePage() {
  const navigate = useNavigate();
  const {
    selectedTeam,
    selectedSeason,
    status,
    timeRemaining,
    currentRoster,
    guessedPlayers,
    incorrectGuesses,
    score,
    bonusPoints,
    startGame,
    endGame,
    tick,
  } = useGameStore();

  // Redirect if no game configured
  useEffect(() => {
    if (!selectedTeam || !selectedSeason) {
      navigate('/');
    }
  }, [selectedTeam, selectedSeason, navigate]);

  // Start game on mount
  useEffect(() => {
    if (status === 'idle' && selectedTeam) {
      startGame();
    }
  }, [status, selectedTeam, startGame]);

  // Timer tick
  useEffect(() => {
    if (status !== 'playing') return;

    const interval = setInterval(() => {
      tick();
    }, 1000);

    return () => clearInterval(interval);
  }, [status, tick]);

  // End game when time runs out
  useEffect(() => {
    if (timeRemaining <= 0 && status === 'playing') {
      endGame();
    }
  }, [timeRemaining, status, endGame]);

  // Navigate to results when game ends
  useEffect(() => {
    if (status === 'ended') {
      navigate('/results');
    }
  }, [status, navigate]);

  const handleGiveUp = useCallback(() => {
    endGame();
  }, [endGame]);

  if (!selectedTeam || !selectedSeason) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Scoreboard style */}
      <header
        className="p-4 border-b-4 border-[#333]"
        style={{
          background: `linear-gradient(90deg, ${selectedTeam.colors.primary}20 0%, transparent 50%, ${selectedTeam.colors.secondary}20 100%)`,
        }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Team and Season */}
          <div className="flex justify-between items-center mb-4">
            <TeamDisplay team={selectedTeam} season={selectedSeason} />
            <Timer
              timeRemaining={timeRemaining}
              totalTime={useGameStore.getState().timerDuration}
            />
          </div>

          {/* Score Panel */}
          <div className="scoreboard-panel p-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="stat-display">
                <div className="stat-value">{score + bonusPoints}</div>
                <div className="stat-label">Points</div>
              </div>
              <div className="stat-display">
                <div className="stat-value">{guessedPlayers.length}</div>
                <div className="stat-label">Found</div>
              </div>
              <div className="stat-display">
                <div className="stat-value">{currentRoster.length}</div>
                <div className="stat-label">Roster</div>
              </div>
              <div className="stat-display">
                <div className="stat-value text-[var(--nba-gold)]">+{bonusPoints}</div>
                <div className="stat-label">Bonus</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 retro-progress">
              <div
                className="retro-progress-fill"
                style={{ width: `${(guessedPlayers.length / currentRoster.length) * 100}%` }}
              />
            </div>
            <div className="mt-2 text-center sports-font text-xs text-[#666]">
              {Math.round((guessedPlayers.length / currentRoster.length) * 100)}% Complete
            </div>
          </div>
        </div>
      </header>

      {/* Main game area */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col">
        {/* Player input */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <PlayerInput />
        </motion.div>

        {/* Guessed players */}
        <div className="flex-1 overflow-y-auto vintage-card p-4">
          <div className="sports-font text-xs text-[#666] mb-3 tracking-widest">
            Players Found ({guessedPlayers.length})
          </div>
          <GuessedPlayersList
            guessedPlayers={guessedPlayers}
            incorrectGuesses={incorrectGuesses}
          />
        </div>

        {/* Give up button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 flex justify-center"
        >
          <button
            onClick={handleGiveUp}
            className="px-8 py-2 bg-[var(--nba-red)]/20 hover:bg-[var(--nba-red)]/40 text-[var(--nba-red)] border-2 border-[var(--nba-red)]/30 rounded-lg transition-colors sports-font tracking-wider"
          >
            Give Up
          </button>
        </motion.div>
      </main>
    </div>
  );
}
