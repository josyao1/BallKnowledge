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

  // Sort players by total score (base + bonus) descending
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const totalA = a.score + (playerBonuses[a.player_id] || 0);
      const totalB = b.score + (playerBonuses[b.player_id] || 0);
      return totalB - totalA;
    });
  }, [players, playerBonuses]);

  const showBonuses = players.length >= 3;

  return (
    <div className="space-y-3">
      {showBonuses && (
        <div className="text-[10px] text-white/40 text-center mb-1 sports-font">
          +1 for unique guesses
        </div>
      )}
      <AnimatePresence>
        {sortedPlayers.map((player, index) => {
          const isCurrentPlayer = player.player_id === currentPlayerId;
          const percentage = rosterSize > 0 ? Math.round((player.guessed_count / rosterSize) * 100) : 0;
          const isLeader = index === 0;
          const bonus = playerBonuses[player.player_id] || 0;
          const totalScore = player.score + bonus;

          return (
            <motion.div
              key={player.player_id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
                isCurrentPlayer
                  ? 'bg-[#d4af37]/20 border-[#d4af37]/50'
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
                  <span className={`sports-font text-sm font-medium truncate max-w-[100px] ${
                    isCurrentPlayer ? 'text-[#d4af37]' : 'text-white/80'
                  }`}>
                    {player.player_name}
                  </span>
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
                  <span className="retro-title text-xl text-white">
                    {totalScore}
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
