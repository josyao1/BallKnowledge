import { motion, AnimatePresence } from 'framer-motion';
import type { LobbyPlayer } from '../../types/database';

interface LiveScoreboardProps {
  players: LobbyPlayer[];
  currentPlayerId: string;
  rosterSize: number;
}

export function LiveScoreboard({ players, currentPlayerId, rosterSize }: LiveScoreboardProps) {
  // Sort players by score (descending)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {sortedPlayers.map((player, index) => {
          const isCurrentPlayer = player.player_id === currentPlayerId;
          const percentage = rosterSize > 0 ? Math.round((player.guessed_count / rosterSize) * 100) : 0;
          const isLeader = index === 0;

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
                <span className="retro-title text-xl text-white">
                  {player.score}
                </span>
                <span className="text-[9px] text-white/40">{percentage}%</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
