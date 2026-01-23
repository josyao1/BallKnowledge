import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useGameStore } from '../stores/gameStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { resetLobbyForNewRound } from '../services/lobby';
import type { Sport } from '../types';

export function MultiplayerResultsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, currentPlayerId, isHost, reset: resetLobby } = useLobbyStore();
  const { currentRoster, resetGame } = useGameStore();
  const [isResetting, setIsResetting] = useState(false);

  // Keep subscription active for realtime updates
  useLobbySubscription(lobby?.id || null);

  // Watch for lobby status change back to 'waiting' (host clicked Play Again)
  useEffect(() => {
    if (lobby?.status === 'waiting') {
      resetGame();
      navigate(`/lobby/${code}`);
    }
  }, [lobby?.status, code, navigate, resetGame]);

  // Sort players by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const currentPlayerRank = sortedPlayers.findIndex((p) => p.player_id === currentPlayerId) + 1;
  const winner = sortedPlayers[0];

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
              {winner.score} points ({currentRoster.length > 0 ? Math.round((winner.guessed_count / currentRoster.length) * 100) : 0}%)
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
          <div className="space-y-2">
            {sortedPlayers.map((player, index) => {
              const isCurrentPlayer = player.player_id === currentPlayerId;
              const percentage = currentRoster.length > 0 ? Math.round((player.guessed_count / currentRoster.length) * 100) : 0;

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
                      </div>
                    </div>
                  </div>
                  <div className="scoreboard-number text-3xl" style={{ color: index === 0 ? 'var(--nba-gold)' : accentColor }}>
                    {player.score}
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
