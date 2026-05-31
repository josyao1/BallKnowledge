import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMultiplayerResults } from '../../hooks/useMultiplayerResults';
import { getCategoryDef, formatStat } from '../../services/topTen';
import { TeamLogo } from '../../components/TeamLogo';
import { PlayerHeadshot } from '../../components/capCrunch/PlayerHeadshot';
import type { TopTenEntry } from '../../services/topTen';

export function MultiplayerTopTenResultsPage() {
  const { code } = useParams<{ code: string }>();
  const {
    lobby, players, isHost, currentPlayerId,
    isLeaving, isResetting,
    handlePlayAgain, handleLeave,
  } = useMultiplayerResults({ code, defaultWinTarget: 1 });

  const cs = (lobby?.career_state as any) || {};
  const entries: TopTenEntry[]  = cs.top10_entries || [];
  const guessedIndices: number[] = cs.guessed_indices || [];
  const guessAttribution: Record<string, number> = cs.guess_attribution || {};
  const sport: 'nba' | 'nfl'   = (cs.sport as 'nba' | 'nfl') || 'nba';
  const categoryKey: string     = cs.category || '';
  const categoryLabel: string   = cs.category_label || '';
  const roundInfo: string       = cs.round_info || '';
  const winnerId: string        = cs.winner_id || '';
  const catDef = getCategoryDef(sport, categoryKey);

  // Sort players by correct guesses descending
  const sortedPlayers = [...players].sort((a, b) =>
    (guessAttribution[b.player_id] || 0) - (guessAttribution[a.player_id] || 0)
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="p-4 border-b border-white/10">
        <h1 className="retro-title text-xl text-[#22c55e] text-center">Top Ten · Results</h1>
        {categoryLabel && (
          <p className="sports-font text-[9px] text-white/30 tracking-widest uppercase text-center mt-1">{categoryLabel} · {roundInfo}</p>
        )}
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full p-4 space-y-6">
        {/* Standings */}
        <div className="space-y-2">
          <p className="sports-font text-[9px] text-white/30 tracking-widest uppercase">Final Standings</p>
          {sortedPlayers.map((p, i) => {
            const guesses = guessAttribution[p.player_id] || 0;
            const isWinner = p.player_id === winnerId;
            const isMe = p.player_id === currentPlayerId;
            return (
              <motion.div
                key={p.player_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`flex items-center gap-3 p-3 rounded-sm border ${
                  isWinner
                    ? 'border-[#d4af37]/50 bg-[#d4af37]/8'
                    : isMe
                    ? 'border-[#22c55e]/30 bg-[#22c55e]/5'
                    : 'border-white/8 bg-[#111]'
                }`}
              >
                <span className={`retro-title text-xl w-6 ${isWinner ? 'text-[#d4af37]' : 'text-white/20'}`}>{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`retro-title text-base ${isWinner ? 'text-[#d4af37]' : 'text-white/80'}`}>{p.player_name}</p>
                    {isWinner && <span className="sports-font text-[9px] text-[#d4af37] tracking-widest uppercase">Winner</span>}
                  </div>
                  <p className="sports-font text-[10px] text-white/35">{guesses} correct {guesses === 1 ? 'guess' : 'guesses'}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Last round board */}
        {entries.length > 0 && (
          <div className="space-y-1.5">
            <p className="sports-font text-[9px] text-white/25 tracking-widest uppercase">The Board</p>
            {entries.map((entry, i) => {
              const isRevealed = guessedIndices.includes(i);
              const attributedTo = Object.entries(guessAttribution).find(() => false); // future use
              void attributedTo;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 p-2.5 rounded-sm border ${
                    isRevealed ? 'bg-emerald-900/15 border-emerald-700/25' : 'bg-[#111] border-white/5'
                  }`}
                >
                  <span className="sports-font text-[10px] text-white/20 w-5 text-right shrink-0">#{i + 1}</span>
                  <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 ${isRevealed ? '' : 'opacity-40'}`}>
                    <PlayerHeadshot playerId={entry.playerId} sport={sport} className="w-8 h-8 object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`retro-title text-sm truncate ${isRevealed ? 'text-emerald-300' : 'text-white/35'}`}>
                      {entry.playerName}
                    </p>
                    {isRevealed && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <TeamLogo abbr={entry.team} sport={sport} size={14} />
                        <span className="sports-font text-[9px] text-white/30">{entry.year}</span>
                      </div>
                    )}
                  </div>
                  {catDef && (
                    <span className={`sports-font text-xs shrink-0 tabular-nums ${isRevealed ? 'text-[#22c55e]' : 'text-white/20'}`}>
                      {formatStat(entry.stat, categoryKey)} <span className="text-[9px] opacity-60">{catDef.shortLabel}</span>
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
              className="flex-1 py-4 rounded-sm retro-title text-lg bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-black shadow-[0_4px_0_#166534] active:shadow-none active:translate-y-1 disabled:opacity-50 transition-all"
            >
              {isResetting ? 'Resetting...' : 'Play Again'}
            </button>
          )}
          <button
            onClick={handleLeave}
            disabled={isLeaving}
            className="flex-1 py-4 rounded-sm retro-title text-lg bg-[#1a1a1a] border border-white/15 text-white/50 hover:border-white/30 disabled:opacity-50 transition-all"
          >
            Leave
          </button>
        </div>
      </main>
    </div>
  );
}
