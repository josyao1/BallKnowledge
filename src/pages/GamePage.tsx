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

  // Team color CSS variables
  const teamColorStyles = {
    '--team-primary': selectedTeam.colors.primary,
    '--team-secondary': selectedTeam.colors.secondary,
    '--team-primary-20': `${selectedTeam.colors.primary}33`,
    '--team-secondary-20': `${selectedTeam.colors.secondary}33`,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen flex flex-col" style={teamColorStyles}>
      {/* Header - Scoreboard style */}
      <header
        className="p-4 border-b-4"
        style={{
          borderColor: selectedTeam.colors.primary,
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
          <div
            className="scoreboard-panel p-4"
            style={{ borderColor: `${selectedTeam.colors.primary}50` }}
          >
            <div className="grid grid-cols-3 gap-4">
              <div className="stat-display">
                <div className="stat-value" style={{ color: selectedTeam.colors.secondary }}>{score}</div>
                <div className="stat-label">Points</div>
              </div>
              <div className="stat-display">
                <div className="stat-value" style={{ color: selectedTeam.colors.primary }}>{guessedPlayers.length}</div>
                <div className="stat-label">Found</div>
              </div>
              <div className="stat-display">
                <div className="stat-value">{currentRoster.length}</div>
                <div className="stat-label">Roster</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 retro-progress" style={{ borderColor: `${selectedTeam.colors.primary}30` }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(guessedPlayers.length / currentRoster.length) * 100}%`,
                  background: `linear-gradient(90deg, ${selectedTeam.colors.primary}, ${selectedTeam.colors.secondary})`
                }}
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
        <div
          className="flex-1 overflow-y-auto vintage-card p-4"
          style={{ borderColor: `${selectedTeam.colors.primary}30` }}
        >
          <div className="sports-font text-xs mb-3 tracking-widest" style={{ color: selectedTeam.colors.secondary }}>
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
            className="px-8 py-2 rounded-lg transition-colors sports-font tracking-wider"
            style={{
              backgroundColor: `${selectedTeam.colors.primary}20`,
              color: selectedTeam.colors.primary,
              borderWidth: '2px',
              borderColor: `${selectedTeam.colors.primary}50`,
            }}
          >
            Give Up
          </button>
        </motion.div>
      </main>
    </div>
  );
}
