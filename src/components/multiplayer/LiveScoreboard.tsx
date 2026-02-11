import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LobbyPlayer } from '../../types/database';

interface LiveScoreboardProps {
  players: LobbyPlayer[];
  currentPlayerId: string;
  rosterSize: number;
}

export function LiveScoreboard({ players, currentPlayerId, rosterSize }: LiveScoreboardProps) {
  // Calculate uniqueness bonus for each player (only when 3+ players)
  const playerBonuses = useMemo(() => {
    const bonuses: Record<string, number> = {};

    // Only calculate uniqueness bonus with 3+ players
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

    // For each player, count how many of their guesses are unique (only they guessed it)
    players.forEach(player => {
      const guessedPlayers = player.guessed_players || [];
      const uniqueGuesses = guessedPlayers.filter(name => guessCount[name] === 1);
      bonuses[player.player_id] = uniqueGuesses.length;
    });

    return bonuses;
  }, [players]);

  // Calculate effective score including dummy multiplier
  const getEffectiveScore = (player: LobbyPlayer) => {
    const baseScore = player.score + (playerBonuses[player.player_id] || 0);
    return player.is_dummy ? baseScore * 2 : baseScore;
  };

  // Sort players by total score (base + bonus + dummy multiplier) descending
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      return getEffectiveScore(b) - getEffectiveScore(a);
    });
  }, [players, playerBonuses]);

  const showBonuses = players.length >= 3;
  const hasDummyPlayers = players.some(p => p.is_dummy);

  return (
    <div className="space-y-3">
      {(showBonuses || hasDummyPlayers) && (
        <div className="text-[10px] text-white/40 text-center mb-1 sports-font">
          {showBonuses && '+1 for unique guesses'}
          {showBonuses && hasDummyPlayers && ' • '}
          {hasDummyPlayers && <span className="text-purple-400">2x for beginners</span>}
        </div>
      )}
      <AnimatePresence>
        {sortedPlayers.map((player, index) => {
          const isCurrentPlayer = player.player_id === currentPlayerId;
          const percentage = rosterSize > 0 ? Math.round((player.guessed_count / rosterSize) * 100) : 0;
          const isLeader = index === 0;
          const bonus = playerBonuses[player.player_id] || 0;
          const baseScore = player.score + bonus;
          const effectiveScore = player.is_dummy ? baseScore * 2 : baseScore;

          return (
            <motion.div
              key={player.player_id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
                isCurrentPlayer
                  ? 'bg-[#d4af37]/20 border-[#d4af37]/50'
                  : player.is_dummy
                  ? 'bg-purple-900/20 border-purple-500/30'
                  : 'bg-black/40 border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`retro-title text-lg w-6 ${
                  isLeader ? 'text-[#d4af37]' : 'text-white/30'
                }`}>
                  {index + 1}
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className={`sports-font text-sm font-medium truncate max-w-[100px] ${
                      isCurrentPlayer ? 'text-[#d4af37]' : 'text-white/80'
                    }`}>
                      {player.player_name}
                    </span>
                    {player.is_dummy && (
                      <span className="text-[8px] text-purple-400 px-1 py-0.5 bg-purple-900/40 rounded">2x</span>
                    )}
                  </div>
                  {isCurrentPlayer && (
                    <span className="text-[8px] text-white/40 uppercase tracking-widest">You</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1">
                  {showBonuses && bonus > 0 && (
                    <span className="text-xs text-emerald-400">+{bonus}</span>
                  )}
                  {player.is_dummy && (
                    <span className="text-xs text-purple-400">×2</span>
                  )}
                  <span className="retro-title text-xl text-white">
                    {effectiveScore}
                  </span>
                </div>
                <span className="text-[9px] text-white/40">{percentage}%</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
