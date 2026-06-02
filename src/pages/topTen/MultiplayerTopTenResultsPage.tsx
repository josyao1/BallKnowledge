import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMultiplayerResults } from '../../hooks/useMultiplayerResults';
import { getCategoryDef, parseRoundFlags, getStatShortLabel } from '../../services/topTen';
import { TopTenEntryRow } from '../../components/topTen/TopTenEntryRow';
import type { TopTenEntry } from '../../services/topTen';

export function MultiplayerTopTenResultsPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const {
    lobby, players, isHost, currentPlayerId,
    isLeaving, isResetting,
    handlePlayAgain, handleLeave,
  } = useMultiplayerResults({
    code,
    defaultWinTarget: 1,
    extraPlayAgainState: (c) => ({
      top_ten_sport: c.top_ten_sport,
      top_ten_round_type: c.top_ten_round_type,
      top_ten_min_year: c.top_ten_min_year,
      top_ten_max_year: c.top_ten_max_year,
      top_ten_window_years: c.top_ten_window_years,
      max_strikes: c.max_strikes,
      turn_timer: c.turn_timer,
    }),
  });

  useEffect(() => {
    if (lobby && lobby.status !== 'finished') {
      navigate(`/top-ten/${code}`, { replace: true });
    }
  }, [lobby?.status]);

  const cs = (lobby?.career_state as any) || {};
  const entries: TopTenEntry[]                    = cs.top10_entries || [];
  const guessedIndices: number[]                  = cs.guessed_indices || [];
  const guessAttribution: Record<string, number>  = cs.guess_attribution || {};
  const playerStrikes: Record<string, number>     = cs.player_strikes || {};
  const maxStrikes: number                        = cs.max_strikes || 2;
  const sport: 'nba' | 'nfl'                     = (cs.sport as 'nba' | 'nfl') || 'nba';
  const categoryKey: string                       = cs.category || '';
  const categoryLabel: string                     = cs.category_label || '';
  const roundInfo: string                         = cs.round_info || '';
  const winnerIds: string[]                       = cs.winner_ids || (cs.winner_id ? [cs.winner_id] : []);

  const catDef                                    = getCategoryDef(sport, categoryKey);
  const { isCumulativeRound }                     = parseRoundFlags(cs);
  const statShortLabel                            = getStatShortLabel(catDef, isCumulativeRound, sport);

  const sortedPlayers = [...players].sort((a, b) => {
    const ga = guessAttribution[a.player_id] || 0;
    const gb = guessAttribution[b.player_id] || 0;
    if (gb !== ga) return gb - ga;
    return (maxStrikes - (playerStrikes[b.player_id] || 0)) - (maxStrikes - (playerStrikes[a.player_id] || 0));
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col relative overflow-hidden">
      {/* Subtle green atmosphere at top */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(34,197,94,0.08) 0%, transparent 55%)' }} />

      <header className="relative z-10 p-4 border-b border-white/8">
        <div className="sports-font text-[9px] text-white/25 tracking-[0.4em] uppercase text-center mb-1">Match Complete</div>
        <h1 className="retro-title text-2xl text-[#22c55e] text-center">Top Ten</h1>
        {categoryLabel && (
          <p className="sports-font text-[9px] text-white/30 tracking-widest uppercase text-center mt-1">
            {categoryLabel} · {roundInfo}
          </p>
        )}
      </header>

      <main className="relative z-10 flex-1 max-w-lg mx-auto w-full p-4 space-y-5">
        {/* Winner banner */}
        {winnerIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center pt-2 pb-1"
          >
            <p className="sports-font text-[9px] text-[#d4af37]/50 tracking-[0.4em] uppercase mb-1">
              {winnerIds.length > 1 ? 'Tied' : 'Winner'}
            </p>
            <h2
              className="retro-title text-5xl text-[#d4af37]"
              style={{ textShadow: '0 0 28px rgba(212,175,55,0.35)' }}
            >
              {winnerIds.length === 1
                ? (sortedPlayers.find(p => winnerIds.includes(p.player_id))?.player_name ?? '')
                : sortedPlayers.filter(p => winnerIds.includes(p.player_id)).map(p => p.player_name).join(' · ')
              }
            </h2>
          </motion.div>
        )}

        {/* Standings */}
        <div className="space-y-1.5">
          <p className="sports-font text-[9px] text-white/25 tracking-widest uppercase">Final Standings</p>
          {sortedPlayers.map((p, i) => {
            const guesses  = guessAttribution[p.player_id] || 0;
            const isWinner = winnerIds.includes(p.player_id);
            const isMe     = p.player_id === currentPlayerId;
            return (
              <motion.div
                key={p.player_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`flex items-center gap-3 p-3 rounded-sm border ${
                  isWinner ? 'border-[#d4af37]/50 bg-[#d4af37]/8'
                  : isMe   ? 'border-[#22c55e]/30 bg-[#22c55e]/5'
                  :          'border-white/8 bg-[#111]'
                }`}
              >
                <span className={`retro-title text-xl w-6 ${isWinner ? 'text-[#d4af37]' : 'text-white/20'}`}>{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`retro-title text-base ${isWinner ? 'text-[#d4af37]' : 'text-white/80'}`}>{p.player_name}</p>
                    {isWinner && (
                      <span className="sports-font text-[9px] text-[#d4af37] tracking-widest uppercase">
                        {winnerIds.length > 1 ? 'Tied' : 'Winner'}
                      </span>
                    )}
                  </div>
                  <p className="sports-font text-[10px] text-white/35">
                    {guesses} correct {guesses === 1 ? 'guess' : 'guesses'}
                    {' · '}{maxStrikes - (playerStrikes[p.player_id] || 0)} strikes left
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Board */}
        {entries.length > 0 && (
          <div className="space-y-1.5">
            <p className="sports-font text-[9px] text-white/25 tracking-widest uppercase">The Board</p>
            {entries.map((entry, i) => (
              <TopTenEntryRow
                key={i}
                entry={entry}
                index={i}
                wasGuessed={guessedIndices.includes(i)}
                gameOver
                sport={sport}
                categoryKey={categoryKey}
                catDef={catDef}
                statShortLabel={statShortLabel}
              />
            ))}
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
