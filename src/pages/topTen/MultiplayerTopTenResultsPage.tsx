import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMultiplayerResults } from '../../hooks/useMultiplayerResults';
import { getCategoryDef, formatStat } from '../../services/topTen';
import type { TopTenEntry } from '../../services/topTen';

export function MultiplayerTopTenResultsPage() {
  const { code } = useParams<{ code: string }>();
  const {
    lobby, players, isHost, currentPlayerId, sortedPlayers,
    matchWinner, isWinner, isLeaving, isResetting,
    handlePlayAgain, handleLeave,
  } = useMultiplayerResults({ code, defaultWinTarget: 3 });

  const cs = (lobby?.career_state as any) || {};
  const entries: TopTenEntry[] = cs.top10_entries || [];
  const guessedIndices: number[] = cs.guessed_indices || [];
  const roundWins: Record<string, number> = cs.round_wins || {};
  const guessAttribution: Record<string, number> = cs.guess_attribution || {};
  const sport: string = cs.sport || 'nba';
  const categoryKey: string = cs.category || '';
  const categoryLabel: string = cs.category_label || '';
  const roundInfo: string = cs.round_info || '';
  const catDef = getCategoryDef(sport as 'nba' | 'nfl', categoryKey);

  const playerById = Object.fromEntries(players.map(p => [p.player_id, p]));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="p-4 border-b border-white/10">
        <h1 className="retro-title text-xl text-[#22c55e] text-center">Top Ten · Results</h1>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full p-4 space-y-6">
        {/* Winner banner */}
        {matchWinner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-4"
          >
            <p className="sports-font text-[10px] text-[#d4af37] tracking-widest uppercase mb-1">
              {isWinner ? '🏆 You win!' : 'Winner'}
            </p>
            <p className="retro-title text-3xl text-[#d4af37]">
              {playerById[matchWinner.player_id]?.player_name ?? matchWinner.player_id}
            </p>
          </motion.div>
        )}

        {/* Standings */}
        <div className="space-y-2">
          <p className="sports-font text-[9px] text-white/30 tracking-widest uppercase">Standings</p>
          {sortedPlayers.map((p, i) => {
            const wins = roundWins[p.player_id] || 0;
            const guesses = guessAttribution[p.player_id] || 0;
            return (
              <div
                key={p.player_id}
                className={`flex items-center gap-3 p-3 rounded-sm border ${
                  p.player_id === currentPlayerId ? 'border-[#22c55e]/40 bg-[#22c55e]/5' : 'border-white/10 bg-[#111]'
                }`}
              >
                <span className="retro-title text-xl text-white/30 w-6">{i + 1}</span>
                <div className="flex-1">
                  <p className="retro-title text-base text-white">{p.player_name}</p>
                  <p className="sports-font text-[10px] text-white/30">{guesses} correct guesses</p>
                </div>
                <span className="retro-title text-lg text-[#d4af37]">{wins}W</span>
              </div>
            );
          })}
        </div>

        {/* Last round board */}
        {entries.length > 0 && (
          <div className="space-y-2">
            <div>
              <p className="sports-font text-[9px] text-white/30 tracking-widest uppercase">{categoryLabel}</p>
              <p className="sports-font text-[9px] text-white/20 tracking-widest uppercase">{roundInfo}</p>
            </div>
            {entries.map((entry, i) => {
              const isRevealed = guessedIndices.includes(i);
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-2.5 rounded-sm border ${
                    isRevealed ? 'bg-emerald-900/20 border-emerald-700/30' : 'bg-[#111] border-white/5'
                  }`}
                >
                  <span className="sports-font text-[10px] text-white/25 w-5 text-right shrink-0">#{i + 1}</span>
                  <p className={`flex-1 retro-title text-sm ${isRevealed ? 'text-emerald-300' : 'text-white/40'}`}>
                    {entry.playerName}
                  </p>
                  {catDef && (
                    <span className="sports-font text-xs text-[#22c55e] shrink-0">
                      {formatStat(entry.stat, categoryKey)} {catDef.shortLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          {isHost && (
            <button
              onClick={handlePlayAgain}
              disabled={isResetting}
              className="flex-1 py-4 rounded-sm retro-title text-lg bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-white shadow-[0_4px_0_#166534] active:shadow-none active:translate-y-1 disabled:opacity-50 transition-all"
            >
              {isResetting ? 'Resetting...' : 'Play Again'}
            </button>
          )}
          <button
            onClick={handleLeave}
            disabled={isLeaving}
            className="flex-1 py-4 rounded-sm retro-title text-lg bg-[#1a1a1a] border border-white/20 text-white/60 hover:border-white/40 disabled:opacity-50 transition-all"
          >
            Leave
          </button>
        </div>
      </main>
    </div>
  );
}
