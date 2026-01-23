import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { Timer } from '../components/game/Timer';
import { PlayerInput } from '../components/game/PlayerInput';
import { GuessedPlayersList } from '../components/game/GuessedPlayersList';
import { TeamDisplay } from '../components/game/TeamDisplay';
import { LiveScoreboard } from '../components/multiplayer/LiveScoreboard';

export function GamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMultiplayer = location.state?.multiplayer || false;
  const lobbyCode = useLobbyStore((state) => state.lobby?.join_code);

  const {
    selectedTeam,
    selectedSeason,
    status,
    timeRemaining,
    currentRoster,
    pendingGuesses,
    guessedPlayers,
    incorrectGuesses,
    score,
    hideResultsDuringGame,
    startGame,
    endGame,
    processGuesses,
    tick,
  } = useGameStore();

  // Multiplayer state
  const { lobby, players, currentPlayerId, syncScore, endGame: endLobbyGame } = useLobbyStore();
  useLobbySubscription(isMultiplayer ? lobby?.id || null : null);

  // Debounce score sync for multiplayer
  const lastSyncRef = useRef<{ score: number; count: number }>({ score: 0, count: 0 });

  // Sync score to lobby in multiplayer mode
  useEffect(() => {
    if (!isMultiplayer || !lobby) return;

    const currentScore = score;
    const currentCount = guessedPlayers.length;

    // Only sync if changed
    if (lastSyncRef.current.score !== currentScore || lastSyncRef.current.count !== currentCount) {
      lastSyncRef.current = { score: currentScore, count: currentCount };

      // Debounce sync
      const timeout = setTimeout(() => {
        syncScore(currentScore, currentCount);
      }, 300);

      return () => clearTimeout(timeout);
    }
  }, [score, guessedPlayers.length, isMultiplayer, lobby, syncScore]);

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
      // Process pending guesses before showing results (when in hidden mode)
      if (hideResultsDuringGame) {
        processGuesses();
      }

      if (isMultiplayer && lobbyCode) {
        // Sync final score then navigate to multiplayer results
        syncScore(score, guessedPlayers.length);
        endLobbyGame();
        navigate(`/lobby/${lobbyCode}/results`);
      } else {
        navigate('/results');
      }
    }
  }, [status, navigate, hideResultsDuringGame, processGuesses, isMultiplayer, lobbyCode, score, guessedPlayers.length, syncScore, endLobbyGame]);

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
                <div className="stat-value" style={{ color: selectedTeam.colors.secondary }}>
                  {hideResultsDuringGame ? '?' : score}
                </div>
                <div className="stat-label">Points</div>
              </div>
              <div className="stat-display">
                <div className="stat-value" style={{ color: selectedTeam.colors.primary }}>
                  {hideResultsDuringGame ? pendingGuesses.length : guessedPlayers.length}
                </div>
                <div className="stat-label">{hideResultsDuringGame ? 'Guesses' : 'Found'}</div>
              </div>
              <div className="stat-display">
                <div className="stat-value">{currentRoster.length}</div>
                <div className="stat-label">Roster</div>
              </div>
            </div>

            {/* Progress bar - hidden mode shows guesses, normal mode shows correct */}
            <div className="mt-4 retro-progress" style={{ borderColor: `${selectedTeam.colors.primary}30` }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: hideResultsDuringGame
                    ? `${Math.min((pendingGuesses.length / currentRoster.length) * 100, 100)}%`
                    : `${(guessedPlayers.length / currentRoster.length) * 100}%`,
                  background: hideResultsDuringGame
                    ? `linear-gradient(90deg, ${selectedTeam.colors.primary}80, ${selectedTeam.colors.secondary}80)`
                    : `linear-gradient(90deg, ${selectedTeam.colors.primary}, ${selectedTeam.colors.secondary})`
                }}
              />
            </div>
            <div className="mt-2 text-center sports-font text-xs text-[#666]">
              {hideResultsDuringGame
                ? `${pendingGuesses.length} guesses`
                : `${Math.round((guessedPlayers.length / currentRoster.length) * 100)}% Complete`}
            </div>
          </div>
        </div>
      </header>

      {/* Main game area */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 flex gap-4">
        {/* Game content */}
        <div className="flex-1 flex flex-col min-w-0">
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
              {hideResultsDuringGame
                ? `Your Guesses (${pendingGuesses.length})`
                : `Players Found (${guessedPlayers.length})`}
            </div>
            <GuessedPlayersList
              guessedPlayers={guessedPlayers}
              incorrectGuesses={incorrectGuesses}
              pendingGuesses={hideResultsDuringGame ? pendingGuesses : []}
              hideResults={hideResultsDuringGame}
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
        </div>

        {/* Live scoreboard (multiplayer only) */}
        {isMultiplayer && players.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-64 flex-shrink-0 hidden md:block"
          >
            <LiveScoreboard
              players={players}
              currentPlayerId={currentPlayerId}
              rosterSize={currentRoster.length}
            />
          </motion.div>
        )}
      </main>
    </div>
  );
}
