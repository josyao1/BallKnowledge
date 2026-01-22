import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { Timer } from '../components/game/Timer';
import { ScoreDisplay } from '../components/game/ScoreDisplay';
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
    <div
      className="min-h-screen text-white flex flex-col"
      style={{
        backgroundColor: '#111827',
        backgroundImage: `linear-gradient(135deg, ${selectedTeam.colors.primary}15 0%, transparent 50%)`,
      }}
    >
      {/* Header */}
      <header className="p-4 border-b border-gray-800">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <TeamDisplay team={selectedTeam} season={selectedSeason} />
          <div className="flex items-center gap-6">
            <ScoreDisplay
              score={score}
              bonusPoints={bonusPoints}
              guessedCount={guessedPlayers.length}
              totalPlayers={currentRoster.length}
            />
            <Timer
              timeRemaining={timeRemaining}
              totalTime={useGameStore.getState().timerDuration}
            />
          </div>
        </div>
      </header>

      {/* Main game area */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col">
        {/* Player input */}
        <div className="mb-6">
          <PlayerInput />
        </div>

        {/* Guessed players */}
        <div className="flex-1 overflow-y-auto">
          <GuessedPlayersList
            guessedPlayers={guessedPlayers}
            incorrectGuesses={incorrectGuesses}
          />
        </div>

        {/* Give up button */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleGiveUp}
            className="px-6 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
          >
            Give Up
          </button>
        </div>
      </main>
    </div>
  );
}
