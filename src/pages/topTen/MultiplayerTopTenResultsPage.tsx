import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMultiplayerResults } from '../../hooks/useMultiplayerResults';
import { getCategoryDef, getStatShortLabel } from '../../services/topTen';
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
      navigate(`/lobby/${code}/top-ten`, { replace: true });
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
  const statShortLabel                            = getStatShortLabel(catDef);

  const sortedPlayers = [...players].sort((a, b) => {
    const ga = guessAttribution[a.player_id] || 0;
    const gb = guessAttribution[b.player_id] || 0;
    if (gb !== ga) return gb - ga;
    return (maxStrikes - (playerStrikes[b.player_id] || 0)) - (maxStrikes - (playerStrikes[a.player_id] || 0));
  });

  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col relative overflow-hidden">

      <header className="relative z-10 capcrunch-panel p-4 border-b border-white/10">
        <div className="capcrunch-kicker text-[9px] text-white/25 tracking-[0.4em] uppercase text-center mb-1">Match Complete</div>
        <h1 className="capcrunch-title text-2xl text-[#FDF100] text-center">Top Ten</h1>
        {categoryLabel && (
          <p className="capcrunch-kicker text-[9px] text-white/30 tracking-widest uppercase text-center mt-1">
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
            <p className="capcrunch-kicker text-[9px] text-[#68BBE5]/60 tracking-[0.4em] uppercase mb-1">
              {winnerIds.length > 1 ? 'Tied' : 'Winner'}
            </p>
            <h2
              className="capcrunch-title text-5xl text-[#FDF100]"
              style={{ textShadow: '0 0 28px rgba(253,241,0,0.2)' }}
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
          <p className="capcrunch-kicker text-[9px] text-white/25 tracking-widest uppercase">Final Standings</p>
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
                className={`flex items-center gap-3 p-3 border ${
                  isWinner ? 'border-[#FDF100]/50 bg-[#FDF100]/08'
                  : isMe   ? 'border-[#68BBE5]/30 bg-[#68BBE5]/06'
                  :          'border-white/8 bg-white/[0.03]'
                }`}
              >
                <span className={`capcrunch-title text-xl w-6 ${isWinner ? 'text-[#FDF100]' : 'text-white/20'}`}>{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`capcrunch-title text-base ${isWinner ? 'text-[#FDF100]' : 'text-white/80'}`}>{p.player_name}</p>
                    {isWinner && (
                      <span className="capcrunch-kicker text-[9px] text-[#68BBE5] tracking-widest uppercase">
                        {winnerIds.length > 1 ? 'Tied' : 'Winner'}
                      </span>
                    )}
                  </div>
                  <p className="capcrunch-kicker text-[10px] text-white/35">
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
            <p className="capcrunch-kicker text-[9px] text-white/25 tracking-widest uppercase">The Board</p>
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
              className="flex-1 py-4 capcrunch-title text-lg capcrunch-btn-primary text-black shadow-[0_4px_0_rgba(253,241,0,0.16)] active:shadow-none active:translate-y-1 disabled:opacity-50 transition-all"
            >
              {isResetting ? 'Resetting...' : 'Play Again'}
            </button>
          )}
          <button
            onClick={handleLeave}
            disabled={isLeaving}
            className="flex-1 py-4 capcrunch-title text-lg bg-black/35 border border-white/15 text-white/50 hover:border-[#68BBE5]/35 disabled:opacity-50 transition-all"
          >
            Leave
          </button>
        </div>
      </main>
    </div>
  );
}
