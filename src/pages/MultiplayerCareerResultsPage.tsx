/**
 * MultiplayerCareerResultsPage.tsx — Final results for multiplayer career mode.
 *
 * Shown when lobby.status === 'finished'. Displays the overall match winner,
 * each player's win total, and navigation back home or to a new lobby.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers, resetMatchForPlayAgain } from '../services/lobby';

export function MultiplayerCareerResultsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers, leaveLobby } = useLobbyStore();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useLobbySubscription(lobby?.id || null);

  // Load lobby if not in store (page refresh)
  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby) return;

    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => {
        if (pr.players) setPlayers(pr.players);
      });
    });
  }, []);

  const careerState = lobby?.career_state as any;
  const winTarget = careerState?.win_target || 3;
  const sortedPlayers = [...players].sort((a, b) => (b.wins || 0) - (a.wins || 0));
  const matchWinner = sortedPlayers[0];
  const isWinner = matchWinner?.player_id === currentPlayerId;

  // Non-host: follow when host resets to waiting (Play Again)
  useEffect(() => {
    if (!lobby || isHost) return;
    if (lobby.status === 'waiting') {
      navigate(`/lobby/${code}`);
    }
  }, [lobby?.status]);

  const handlePlayAgain = async () => {
    if (!lobby || !isHost) return;
    setIsResetting(true);
    const winTarget = (lobby.career_state as any)?.win_target || 3;
    await resetMatchForPlayAgain(lobby.id, winTarget);
    navigate(`/lobby/${code}`);
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    await leaveLobby();
    navigate('/');
  };

  if (!lobby) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="text-white/50 sports-font">Loading results...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col p-4 md:p-6">
      {/* Header */}
      <header className="text-center mb-8 mt-4">
        <div className="sports-font text-[10px] text-[#888] tracking-[0.4em] uppercase mb-2">Match Complete</div>
        <h1 className="retro-title text-4xl md:text-5xl text-[#d4af37]">Career Mode</h1>
        <div className="sports-font text-[10px] text-[#555] tracking-widest mt-1 uppercase">
          {lobby.sport.toUpperCase()} · First to {winTarget}
        </div>
      </header>

      {/* Winner announcement */}
      {matchWinner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto w-full mb-8"
        >
          <div className={`p-6 rounded-lg text-center border-2 ${
            isWinner
              ? 'bg-[#d4af37]/10 border-[#d4af37]'
              : 'bg-[#1a1a1a] border-[#333]'
          }`}>
            <div className="text-4xl mb-2">{isWinner ? '🏆' : '🎯'}</div>
            <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase mb-1">
              {isWinner ? 'You won the match!' : 'Match Winner'}
            </div>
            <div className="retro-title text-3xl text-[#d4af37]">{matchWinner.player_name}</div>
            <div className="sports-font text-sm text-[#888] mt-1">
              {matchWinner.wins || 0} wins
            </div>
          </div>
        </motion.div>
      )}

      {/* All player results */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-md mx-auto w-full mb-8"
      >
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4">
          <div className="sports-font text-[10px] text-[#888] tracking-widest mb-4 uppercase text-center">
            Final Standings
          </div>
          <div className="space-y-2">
            {sortedPlayers.map((player, rank) => {
              const isMe = player.player_id === currentPlayerId;
              const wins = player.wins || 0;
              return (
                <motion.div
                  key={player.player_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + rank * 0.05 }}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    rank === 0
                      ? 'bg-[#d4af37]/15 border border-[#d4af37]/40'
                      : isMe
                        ? 'bg-white/5 border border-white/20'
                        : 'bg-black/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`retro-title text-lg w-8 text-center ${
                      rank === 0 ? 'text-[#d4af37]' : 'text-[#555]'
                    }`}>
                      #{rank + 1}
                    </span>
                    <div>
                      <span className="sports-font text-sm text-white/90">{player.player_name}</span>
                      {isMe && <span className="text-[10px] text-white/40 sports-font ml-1">(you)</span>}
                    </div>
                  </div>

                  {/* Win pips */}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: winTarget }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full ${
                            i < wins ? 'bg-[#d4af37]' : 'bg-[#333]'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="retro-title text-xl text-[#d4af37] ml-1">{wins}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="max-w-md mx-auto w-full space-y-3"
      >
        {isHost && (
          <button
            onClick={handlePlayAgain}
            disabled={isResetting}
            className="w-full py-4 rounded-lg retro-title text-xl tracking-wider transition-all bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_4px_0_#166534] active:shadow-none active:translate-y-1 disabled:opacity-50"
          >
            {isResetting ? 'Starting...' : 'Play Again'}
          </button>
        )}
        {!isHost && (
          <div className="text-center text-white/30 sports-font text-sm tracking-wider py-2">
            Waiting for host to start again...
          </div>
        )}
        <button
          onClick={handleLeave}
          disabled={isLeaving}
          className="w-full py-4 rounded-lg retro-title text-xl tracking-wider transition-all bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1 disabled:opacity-50"
        >
          {isLeaving ? 'Leaving...' : 'Back to Home'}
        </button>
      </motion.div>
    </div>
  );
}
