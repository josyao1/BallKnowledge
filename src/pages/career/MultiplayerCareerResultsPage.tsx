/**
 * MultiplayerCareerResultsPage.tsx — Final results for multiplayer career mode.
 *
 * Shown when lobby.status === 'finished'. Displays the overall match winner,
 * each player's win total, and navigation back home or to a new lobby.
 */

import { useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMultiplayerResults } from '../../hooks/useMultiplayerResults';

interface RoundSummary {
  answer: string;
  round: number;
  scores: Record<string, number>;
  finishedAt: Record<string, string | null>;
}

export function MultiplayerCareerResultsPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const {
    lobby,
    players,
    isHost,
    currentPlayerId,
    sortedPlayers,
    matchWinner,
    isWinner,
    isLeaving,
    isResetting,
    handlePlayAgain,
    handleLeave,
  } = useMultiplayerResults({ code, defaultWinTarget: 3, includeCareerFrom: true });

  const roundHistory: RoundSummary[] = (location.state as any)?.roundHistory ?? [];

  const careerState = lobby?.career_state as any;
  const winTarget = careerState?.win_target || 3;

  if (!lobby) {
    return (
      <div className="min-h-screen home-chalkboard flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="capcrunch-kicker text-[10px] text-[#d4af37]/50 tracking-[0.3em] uppercase">
            Loading results
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col p-4 md:p-6 relative overflow-hidden">
      {/* Header */}
      <header className="text-center mb-8 mt-4">
        <div className="capcrunch-kicker text-[10px] text-[#888] tracking-[0.4em] uppercase mb-2">
          Match Complete
        </div>
        <h1 className="capcrunch-title text-4xl md:text-5xl text-[#d4af37]">Career Mode</h1>
        <div className="capcrunch-kicker text-[10px] text-[#555] tracking-widest mt-1 uppercase">
          {lobby.sport.toUpperCase()} · First to {winTarget}
        </div>
      </header>

      {/* Winner announcement */}
      {matchWinner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto w-full mb-6 text-center"
        >
          <p className="capcrunch-kicker text-[9px] text-[#d4af37]/50 tracking-[0.4em] uppercase mb-1">
            {isWinner ? 'You won' : 'Match Winner'}
          </p>
          <h2
            className="capcrunch-title text-5xl text-[#d4af37]"
            style={{ textShadow: '0 0 28px rgba(212,175,55,0.35)' }}
          >
            {matchWinner.player_name}
          </h2>
          <p className="capcrunch-kicker text-[10px] text-[#666] mt-1 tracking-wider">
            {matchWinner.points ?? 0} rounds won
          </p>
        </motion.div>
      )}

      {/* All player results */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-md mx-auto w-full mb-8"
      >
        <div className="capcrunch-panel p-4">
          <div className="capcrunch-kicker text-[10px] text-[#888] tracking-widest mb-4 uppercase text-center">
            Final Standings
          </div>
          <div className="space-y-2">
            {sortedPlayers.map((player, rank) => {
              const isMe = player.player_id === currentPlayerId;
              const wins = player.points ?? 0;
              return (
                <motion.div
                  key={player.player_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + rank * 0.05 }}
                  className={`flex items-center justify-between p-3 ${
                    rank === 0
                      ? 'bg-[#d4af37]/15 border border-[#d4af37]/40'
                      : isMe
                        ? 'bg-white/5 border border-white/20'
                        : 'bg-black/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`capcrunch-title text-lg w-8 text-center ${
                        rank === 0 ? 'text-[#d4af37]' : 'text-[#555]'
                      }`}
                    >
                      #{rank + 1}
                    </span>
                    <div>
                      <span className="capcrunch-kicker text-sm text-white/90">
                        {player.player_name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] text-white/40 capcrunch-kicker ml-1">
                          (you)
                        </span>
                      )}
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
                    <span className="capcrunch-title text-xl text-[#d4af37] ml-1">{wins}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Round-by-round history */}
      {roundHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-md mx-auto w-full mb-8"
        >
          <div className="capcrunch-panel p-4">
            <div className="capcrunch-kicker text-[10px] text-[#888] tracking-widest mb-4 uppercase text-center">
              Round History
            </div>
            <div className="space-y-3">
              {roundHistory.map((round) => {
                const topScore = Math.max(0, ...players.map((p) => round.scores[p.player_id] ?? 0));
                const topScorers =
                  topScore > 0
                    ? players.filter((p) => (round.scores[p.player_id] ?? 0) === topScore)
                    : [];
                const isTiebreaker =
                  topScorers.length > 1 && topScorers.every((p) => round.finishedAt[p.player_id]);
                const sortedTopScorers = isTiebreaker
                  ? [...topScorers].sort(
                      (a, b) =>
                        new Date(round.finishedAt[a.player_id]!).getTime() -
                        new Date(round.finishedAt[b.player_id]!).getTime(),
                    )
                  : topScorers;
                const roundWinnerId = sortedTopScorers[0]?.player_id;
                const finisherMs = players
                  .map((p) => round.finishedAt[p.player_id])
                  .filter((t): t is string => !!t)
                  .map((t) => new Date(t).getTime());
                const firstMs = finisherMs.length > 0 ? Math.min(...finisherMs) : null;

                return (
                  <div key={round.round} className="border border-white/10 overflow-hidden">
                    {/* Round header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-black/40">
                      <span className="capcrunch-kicker text-[10px] text-[#666] tracking-wider uppercase">
                        Round {round.round}
                      </span>
                      <span className="capcrunch-kicker text-xs text-white/80">{round.answer}</span>
                    </div>
                    {/* Player rows */}
                    <div className="divide-y divide-[#222]">
                      {[...players]
                        .sort(
                          (a, b) =>
                            (round.scores[b.player_id] ?? 0) - (round.scores[a.player_id] ?? 0),
                        )
                        .map((player) => {
                          const score = round.scores[player.player_id] ?? 0;
                          const isMe = player.player_id === currentPlayerId;
                          const isWinner = player.player_id === roundWinnerId && topScore > 0;
                          const gotIt = score > 0;
                          const finMs = round.finishedAt[player.player_id]
                            ? new Date(round.finishedAt[player.player_id]!).getTime()
                            : null;
                          const offsetMs =
                            finMs !== null && firstMs !== null ? finMs - firstMs : null;
                          return (
                            <div
                              key={player.player_id}
                              className={`flex items-center justify-between px-3 py-2 ${isMe ? 'bg-[#d4af37]/5' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`capcrunch-kicker text-xs ${gotIt ? 'text-white/80' : 'text-white/30'}`}
                                >
                                  {player.player_name}
                                  {isMe && <span className="text-white/30 ml-1">(you)</span>}
                                </span>
                                {isWinner && (
                                  <span className="capcrunch-kicker text-[9px] text-[#d4af37]">
                                    {isTiebreaker ? '⚡' : '★'}
                                  </span>
                                )}
                                {offsetMs !== null && offsetMs > 0 && (
                                  <span className="capcrunch-kicker text-[9px] text-[#d4af37]">
                                    +
                                    {offsetMs < 1000
                                      ? `${offsetMs}ms`
                                      : `${(offsetMs / 1000).toFixed(1)}s`}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`capcrunch-title text-base ${gotIt ? 'text-white' : 'text-[#444]'}`}
                              >
                                {gotIt ? score : '—'}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

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
            className="w-full py-4 capcrunch-title text-xl tracking-wider transition-all bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            {isResetting ? 'Starting...' : 'Play Again'}
          </button>
        )}
        {!isHost && (
          <div className="text-center text-white/30 capcrunch-kicker text-sm tracking-wider py-2">
            Waiting for host to start again...
          </div>
        )}
        <button
          onClick={handleLeave}
          disabled={isLeaving}
          className="w-full py-4 capcrunch-title text-xl tracking-wider transition-all bg-black/40 border border-white/10 hover:border-white/20 text-white disabled:opacity-50"
        >
          {isLeaving ? 'Leaving...' : 'Back to Home'}
        </button>
      </motion.div>
    </div>
  );
}
