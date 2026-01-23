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
    <div className="scoreboard-panel p-3 space-y-2">
      <div className="sports-font text-xs text-[#888] tracking-widest text-center mb-2">
        LIVE SCORES
      </div>
      <AnimatePresence>
        {sortedPlayers.map((player, index) => {
          const isCurrentPlayer = player.player_id === currentPlayerId;
          const percentage = rosterSize > 0 ? Math.round((player.guessed_count / rosterSize) * 100) : 0;

          return (
            <motion.div
              key={player.player_id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-between p-2 rounded-lg ${
                isCurrentPlayer
                  ? 'bg-[var(--nba-gold)]/20 border border-[var(--nba-gold)]/30'
                  : 'bg-[#1a1a1a]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#666] w-4">{index + 1}.</span>
                <span className={`text-sm font-medium truncate max-w-[100px] ${
                  isCurrentPlayer ? 'text-[var(--nba-gold)]' : 'text-[var(--vintage-cream)]'
                }`}>
                  {player.player_name}
                  {isCurrentPlayer && <span className="text-xs ml-1">(you)</span>}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#666]">{percentage}%</span>
                <span className="scoreboard-number text-lg min-w-[2ch] text-right">
                  {player.score}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
