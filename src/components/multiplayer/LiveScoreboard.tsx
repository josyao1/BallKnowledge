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

    // Debug: log the guess counts
    console.log('[Uniqueness] guessCount:', guessCount);
    console.log('[Uniqueness] players guessed_players:', players.map(p => ({ name: p.player_name, guesses: p.guessed_players })));

    // For each player, count how many of their guesses are unique (only they guessed it)
    players.forEach(player => {
      const guessedPlayers = player.guessed_players || [];
      const uniqueGuesses = guessedPlayers.filter(name => guessCount[name] === 1);
      bonuses[player.player_id] = uniqueGuesses.length;
    });

    console.log('[Uniqueness] bonuses:', bonuses);

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
    <div className="scoreboard-panel p-3 space-y-2">
      <div className="sports-font text-xs text-[#888] tracking-widest text-center mb-2">
        LIVE SCORES
      </div>
      {showBonuses && (
        <div className="text-[10px] text-[#555] text-center mb-1">
          +1 for unique guesses
        </div>
      )}
      <AnimatePresence>
        {sortedPlayers.map((player, index) => {
          const isCurrentPlayer = player.player_id === currentPlayerId;
          const percentage = rosterSize > 0 ? Math.round((player.guessed_count / rosterSize) * 100) : 0;
          const bonus = playerBonuses[player.player_id] || 0;
          const totalScore = player.score + bonus;

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
                <div className="flex items-center gap-1">
                  {showBonuses && bonus > 0 && (
                    <span className="text-xs text-emerald-400">+{bonus}</span>
                  )}
                  <span className="scoreboard-number text-lg min-w-[2ch] text-right">
                    {totalScore}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
