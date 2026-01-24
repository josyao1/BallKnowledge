import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useGameStore } from '../stores/gameStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { resetLobbyForNewRound, findLobbyByCode } from '../services/lobby';
import type { Sport } from '../types';

export function MultiplayerResultsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, currentPlayerId, isHost, reset: resetLobby, setLobby } = useLobbyStore();
  const { currentRoster, resetGame } = useGameStore();
  const [isResetting, setIsResetting] = useState(false);
  const hasNavigated = useRef(false);

  // Keep subscription active for realtime updates
  useLobbySubscription(lobby?.id || null);

  // Navigate back to lobby when status changes to 'waiting'
  const navigateToLobby = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    resetGame();
    navigate(`/lobby/${code}`);
  }, [code, navigate, resetGame]);

  // Watch for lobby status change back to 'waiting' (host clicked Play Again)
  useEffect(() => {
    if (lobby?.status === 'waiting') {
      navigateToLobby();
    }
  }, [lobby?.status, navigateToLobby]);

  // Polling fallback for non-host players in case realtime misses the update
  useEffect(() => {
    if (isHost || !code) return;

    const pollInterval = setInterval(async () => {
      if (hasNavigated.current) {
        clearInterval(pollInterval);
        return;
      }

      const result = await findLobbyByCode(code);
      if (result.lobby) {
        setLobby(result.lobby);
        if (result.lobby.status === 'waiting') {
          navigateToLobby();
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [isHost, code, setLobby, navigateToLobby]);

  // Calculate uniqueness bonus for each player (only when 3+ players)
  const playerBonuses = useMemo(() => {
    const bonuses: Record<string, number> = {};

    if (players.length < 3) {
      players.forEach(p => { bonuses[p.player_id] = 0; });
      return bonuses;
    }

    // Build a map of roster player name -> count of who guessed them
    const guessCount: Record<string, number> = {};
    players.forEach(player => {
      const guessedPlayers = player.guessed_players || [];
      guessedPlayers.forEach(name => {
        guessCount[name] = (guessCount[name] || 0) + 1;
      });
    });

    // For each player, count unique guesses
    players.forEach(player => {
      const guessedPlayers = player.guessed_players || [];
      const uniqueGuesses = guessedPlayers.filter(name => guessCount[name] === 1);
      bonuses[player.player_id] = uniqueGuesses.length;
    });

    return bonuses;
  }, [players]);

  const showBonuses = players.length >= 3;

  // Sort players by total score (base + bonus)
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const totalA = a.score + (playerBonuses[a.player_id] || 0);
      const totalB = b.score + (playerBonuses[b.player_id] || 0);
      return totalB - totalA;
    });
  }, [players, playerBonuses]);

  const currentPlayerRank = sortedPlayers.findIndex((p) => p.player_id === currentPlayerId) + 1;
  const winner = sortedPlayers[0];
  const winnerBonus = winner ? (playerBonuses[winner.player_id] || 0) : 0;
  const winnerTotal = winner ? winner.score + winnerBonus : 0;

  const sport = (lobby?.sport as Sport) || 'nba';
  const accentColor = sport === 'nba' ? 'var(--nba-orange)' : '#013369';

  const handlePlayAgain = async () => {
    if (!lobby) return;
    setIsResetting(true);

    // Reset lobby status and player scores
    const result = await resetLobbyForNewRound(lobby.id);
    if (result.error) {
      console.error('Failed to reset lobby:', result.error);
      setIsResetting(false);
      return;
    }

    resetGame();
    navigate(`/lobby/${code}`);
  };

  const handleBackToHome = () => {
    resetLobby();
    resetGame();
    navigate('/');
  };

  if (!lobby) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#888] mb-4">Lobby ended</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-[var(--nba-orange)] text-white rounded-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-6 border-b-4 border-[#333]">
        <div className="text-center">
          <h1 className="retro-title text-4xl" style={{ color: accentColor }}>
            Game Over!
          </h1>
          <div className="text-[#888] mt-1">
            {lobby.team_abbreviation} - {lobby.season}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-6">
        {/* Winner announcement */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <div className="text-[#888] text-sm mb-2">Winner</div>
            <div className="text-4xl font-bold" style={{ color: accentColor }}>
              {winner.player_name}
            </div>
            <div className="text-2xl text-[var(--nba-gold)] mt-2">
              {winnerTotal} points
              {showBonuses && winnerBonus > 0 && (
                <span className="text-emerald-400 text-lg ml-2">(+{winnerBonus} unique)</span>
              )}
            </div>
            <div className="text-sm text-[#888] mt-1">
              {currentRoster.length > 0 ? Math.round((winner.guessed_count / currentRoster.length) * 100) : 0}% of roster
            </div>
          </motion.div>
        )}

        {/* Rankings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="scoreboard-panel p-4"
        >
          <div className="sports-font text-sm text-[#888] mb-4 tracking-widest text-center">
            Final Rankings
          </div>
          {showBonuses && (
            <div className="text-xs text-[#555] text-center mb-2">
              +1 bonus for each unique guess
            </div>
          )}
          <div className="space-y-2">
            {sortedPlayers.map((player, index) => {
              const isCurrentPlayer = player.player_id === currentPlayerId;
              const percentage = currentRoster.length > 0 ? Math.round((player.guessed_count / currentRoster.length) * 100) : 0;
              const bonus = playerBonuses[player.player_id] || 0;
              const totalScore = player.score + bonus;

              return (
                <motion.div
                  key={player.player_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    index === 0
                      ? 'bg-[var(--nba-gold)]/20 border-2 border-[var(--nba-gold)]'
                      : isCurrentPlayer
                      ? 'bg-[var(--nba-orange)]/10 border-2 border-[var(--nba-orange)]/30'
                      : 'bg-[#1a1a1a] border-2 border-[#3d3d3d]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0
                          ? 'bg-[var(--nba-gold)] text-black'
                          : index === 1
                          ? 'bg-gray-400 text-black'
                          : index === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-[#333] text-[#888]'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div className={`font-medium ${isCurrentPlayer ? 'text-[var(--nba-orange)]' : ''}`}>
                        {player.player_name}
                        {isCurrentPlayer && <span className="text-xs ml-2 text-[#888]">(you)</span>}
                      </div>
                      <div className="text-xs text-[#666]">
                        {player.guessed_count}/{currentRoster.length} found ({percentage}%)
                        {showBonuses && bonus > 0 && (
                          <span className="text-emerald-400 ml-2">+{bonus} unique</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="scoreboard-number text-3xl" style={{ color: index === 0 ? 'var(--nba-gold)' : accentColor }}>
                    {totalScore}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Your position highlight */}
        {currentPlayerRank > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-[#888]"
          >
            You finished in <span className="text-[var(--nba-gold)] font-bold">{currentPlayerRank}{getOrdinalSuffix(currentPlayerRank)}</span> place!
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col gap-3"
        >
          {isHost && (
            <button
              onClick={handlePlayAgain}
              disabled={isResetting}
              className="w-full py-4 rounded-lg sports-font text-lg tracking-wider text-white disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {isResetting ? 'Resetting...' : 'Play Again'}
            </button>
          )}
          {!isHost && (
            <p className="text-center text-[#666] text-sm">
              Waiting for host to start another round...
            </p>
          )}
          <button
            onClick={handleBackToHome}
            className="w-full py-3 rounded-lg sports-font tracking-wider border-2 border-[#3d3d3d] text-[#888] hover:border-[#555] hover:text-[var(--vintage-cream)] transition-all"
          >
            Back to Home
          </button>
        </motion.div>
      </main>
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
