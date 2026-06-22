/**
 * MultiplayerFaceRevealResultsPage.tsx — Final results for Face Reveal mode.
 *
 * Shows match winner, final standings, and round history (player name per round
 * with pts awarded: 3 for first correct, 1 for others).
 */

import { useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMultiplayerResults } from '../../hooks/useMultiplayerResults';
import { ZoomedHeadshot } from '../../components/faceReveal/ZoomedHeadshot';

interface RoundSummary {
  playerName: string;
  playerId: string | number;
  round: number;
  pts: Record<string, number>;
  finishedAt: Record<string, string | null>;
}

const COLOR = '#06b6d4';

export function MultiplayerFaceRevealResultsPage() {
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
  } = useMultiplayerResults({ code, defaultWinTarget: 30 });

  const roundHistory: RoundSummary[] = (location.state as any)?.roundHistory ?? [];

  const careerState = lobby?.career_state as any;
  const winTarget = careerState?.win_target || 30;
  const sport = careerState?.sport || 'nba';

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
    <div className="min-h-screen home-chalkboard text-white flex flex-col p-4 md:p-6">
      {/* Header */}
      <header className="text-center mb-8 mt-4">
        <div className="capcrunch-kicker text-[10px] text-[#888] tracking-[0.4em] uppercase mb-2">
          Match Complete
        </div>
        <h1 className="capcrunch-title text-4xl md:text-5xl" style={{ color: COLOR }}>
          Face Reveal
        </h1>
        <div className="capcrunch-kicker text-[10px] text-[#555] tracking-widest mt-1 uppercase">
          {lobby.sport.toUpperCase()} · First to {winTarget} pts
        </div>
      </header>

      {/* Winner announcement */}
      {matchWinner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto w-full mb-8"
        >
          <div
            className={`p-6 text-center border-2 ${isWinner ? '' : 'bg-black/40 border-white/10'}`}
            style={isWinner ? { backgroundColor: `${COLOR}18`, borderColor: COLOR } : {}}
          >
            <div className="text-4xl mb-2">{isWinner ? '🏆' : '🎯'}</div>
            <div className="capcrunch-kicker text-[10px] text-[#888] tracking-widest uppercase mb-1">
              {isWinner ? 'You won the match!' : 'Match Winner'}
            </div>
            <div className="capcrunch-title text-3xl text-[#d4af37]">{matchWinner.player_name}</div>
            <div className="capcrunch-kicker text-sm text-[#888] mt-1">
              {matchWinner.points ?? 0} pts
            </div>
          </div>
        </motion.div>
      )}

      {/* Final standings */}
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
          <div className="space-y-3">
            {sortedPlayers.map((player, rank) => {
              const isMe = player.player_id === currentPlayerId;
              const pts = player.points ?? 0;
              const pct = Math.min(100, (pts / winTarget) * 100);
              return (
                <motion.div
                  key={player.player_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + rank * 0.05 }}
                  className={`p-3 ${
                    rank === 0
                      ? 'border'
                      : isMe
                        ? 'bg-white/5 border border-white/20'
                        : 'bg-black/20'
                  }`}
                  style={
                    rank === 0 ? { backgroundColor: `${COLOR}10`, borderColor: `${COLOR}50` } : {}
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`capcrunch-title text-lg w-8 text-center ${rank === 0 ? 'text-[#d4af37]' : 'text-[#555]'}`}
                      >
                        #{rank + 1}
                      </span>
                      <span className="capcrunch-kicker text-sm text-white/90">
                        {player.player_name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] text-white/40 capcrunch-kicker">(you)</span>
                      )}
                    </div>
                    <span className="capcrunch-title text-xl" style={{ color: COLOR }}>
                      {pts}
                    </span>
                  </div>
                  <div className="h-2 bg-[#222] rounded-full overflow-hidden ml-10">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(to right, ${COLOR}, #67e8f9)`,
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Round history */}
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
                const sortedForRound = [...players].sort(
                  (a, b) => (round.pts[b.player_id] ?? 0) - (round.pts[a.player_id] ?? 0),
                );
                const finisherMs = players
                  .map((p) => round.finishedAt?.[p.player_id])
                  .filter((t): t is string => !!t)
                  .map((t) => new Date(t).getTime());
                const firstMs = finisherMs.length > 0 ? Math.min(...finisherMs) : null;

                return (
                  <div key={round.round} className="border border-white/10 overflow-hidden">
                    {/* Round header */}
                    <div className="px-3 py-2 bg-black/40 flex items-center gap-3">
                      <div className="overflow-hidden flex-shrink-0">
                        <ZoomedHeadshot
                          playerId={round.playerId}
                          sport={sport}
                          zoomLevel={0}
                          size={40}
                        />
                      </div>
                      <div>
                        <div className="capcrunch-kicker text-[10px] text-[#666] tracking-wider uppercase">
                          Round {round.round}
                        </div>
                        <div className="capcrunch-title text-sm text-white/80">
                          {round.playerName}
                        </div>
                      </div>
                    </div>
                    {/* Player rows */}
                    <div className="divide-y divide-[#222]">
                      {sortedForRound.map((player) => {
                        const pts = round.pts[player.player_id] ?? 0;
                        const isMe = player.player_id === currentPlayerId;
                        const badge = pts === 3 ? '🥇' : pts === 1 ? '✓' : '—';
                        const finMs = round.finishedAt?.[player.player_id]
                          ? new Date(round.finishedAt[player.player_id]!).getTime()
                          : null;
                        const offsetMs =
                          finMs !== null && firstMs !== null ? finMs - firstMs : null;
                        return (
                          <div
                            key={player.player_id}
                            className={`flex items-center justify-between px-3 py-2 ${isMe ? 'bg-[#06b6d4]/5' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm w-6 text-center">{badge}</span>
                              <span
                                className={`capcrunch-kicker text-xs ${pts > 0 ? 'text-white/80' : 'text-white/30'}`}
                              >
                                {player.player_name}
                                {isMe && <span className="text-white/30 ml-1">(you)</span>}
                              </span>
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
                              className={`capcrunch-title text-base ${pts > 0 ? 'text-[#d4af37]' : 'text-[#444]'}`}
                            >
                              {pts > 0 ? `+${pts}` : '—'}
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
            className="w-full py-4 capcrunch-title text-xl tracking-wider transition-all bg-[#06b6d4] hover:bg-[#0891b2] text-black disabled:opacity-50"
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
