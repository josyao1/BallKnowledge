/**
 * BlindModeReveal.tsx — Host-controlled reveal screen for Blind Mode.
 *
 * All players' picks are shown side by side. The host clicks "Reveal Next"
 * to uncover one round at a time (for all players simultaneously), building
 * up running totals so everyone can watch the scores tick up together.
 *
 * Mobile: horizontally scrollable columns. Desktop: all columns inline.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { fmt } from './capCrunchUtils';
import { PlayerHeadshot } from './PlayerHeadshot';
import { HomeButton } from '../multiplayer/HomeButton';
import type { PlayerLineup, StatCategory } from '../../types/capCrunch';

const PLAYER_COLORS = [
  '#818cf8',
  '#34d399',
  '#fb923c',
  '#f472b6',
  '#60a5fa',
  '#a78bfa',
  '#4ade80',
  '#f87171',
];

interface Player {
  id: string;
  player_id: string;
  player_name: string;
}

interface Props {
  players: Player[];
  allLineups: Record<string, PlayerLineup>;
  targetCap: number;
  totalRounds: number;
  /** How many rounds have been revealed so far (0 = none, totalRounds = all) */
  revealStep: number;
  isHost: boolean;
  statCategory: StatCategory;
  isCareerStatRound: boolean;
  sport: 'nba' | 'nfl';
  onReveal: () => void;
  onFinish: () => void;
}

export function BlindModeReveal({
  players,
  allLineups,
  targetCap,
  totalRounds,
  revealStep,
  isHost,
  sport,
  onReveal,
  onFinish,
}: Props) {
  const allRevealed = revealStep >= totalRounds;

  /** Running total for a player up to revealStep picks, no bust revert in blind mode */
  function runningTotal(lineup: PlayerLineup, upTo: number): number {
    const picks = lineup.selectedPlayers.slice(0, upTo);
    return parseFloat(picks.reduce((sum, p) => sum + p.statValue, 0).toFixed(1));
  }

  /** Distance from cap for winner determination */
  function distFromCap(lineup: PlayerLineup): number {
    return Math.abs(targetCap - runningTotal(lineup, totalRounds));
  }

  const winnerDist = allRevealed
    ? Math.min(
        ...players.map((p) =>
          distFromCap(
            allLineups[p.player_id] ?? {
              selectedPlayers: [],
              totalStat: 0,
              bustCount: 0,
              isFinished: false,
              playerId: '',
              playerName: '',
            },
          ),
        ),
      )
    : Infinity;

  return (
    <div className="min-h-screen capcrunch-shell text-white flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="relative z-10 capcrunch-panel border-b border-white/10 flex-shrink-0 px-4 md:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="capcrunch-kicker text-[9px] text-[#a855f7]/70 mb-0.5">Blind Mode</div>
              <h1 className="capcrunch-title text-xl md:text-2xl text-[#a855f7]">Reveal</h1>
            </div>
            <HomeButton />
          </div>
          <div className="text-center">
            <div className="capcrunch-kicker text-[8px] text-white/30 mb-0.5">Target</div>
            <p className="capcrunch-title text-2xl text-white">{targetCap}</p>
          </div>
          <div className="text-center">
            <div className="capcrunch-kicker text-[8px] text-white/30 mb-0.5">Round</div>
            <p className="capcrunch-title text-xl text-white">
              {revealStep}/{totalRounds}
            </p>
          </div>
        </div>
      </header>

      {/* Main: scrollable player columns */}
      <main className="relative z-10 flex-1 overflow-y-auto p-3 md:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Single scroll container keeps totals row and pick rows in sync */}
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Running totals row */}
              <div className="flex gap-3 pb-2 mb-4">
                {players.map((player, pi) => {
                  const lineup = allLineups[player.player_id];
                  const total = lineup ? runningTotal(lineup, revealStep) : 0;
                  const color = PLAYER_COLORS[pi % PLAYER_COLORS.length];
                  const isWinner =
                    allRevealed && lineup ? distFromCap(lineup) === winnerDist : false;
                  return (
                    <div
                      key={player.player_id}
                      className="flex flex-col items-center"
                      style={{
                        width: Math.max(
                          120,
                          Math.floor(
                            Math.min(
                              180,
                              (typeof window !== 'undefined' ? window.innerWidth - 24 : 400) /
                                players.length,
                            ),
                          ),
                        ),
                      }}
                    >
                      <div
                        className={`w-full p-3 text-center border transition-all ${isWinner ? 'border-[#FDF100]/60 bg-[#FDF100]/10' : 'border-white/10 bg-black/40'}`}
                      >
                        <p
                          className="capcrunch-kicker text-[9px] tracking-widest truncate mb-1"
                          style={{ color }}
                        >
                          {player.player_name}
                        </p>
                        <motion.p
                          key={`${player.player_id}-${revealStep}`}
                          initial={{ scale: 1.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                          className="capcrunch-title text-2xl md:text-3xl"
                          style={{ color: revealStep === 0 ? '#444' : color }}
                        >
                          {revealStep === 0 ? '—' : fmt(total)}
                        </motion.p>
                        {isWinner && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="capcrunch-kicker text-[8px] text-[#d4af37] tracking-widest mt-1 uppercase"
                          >
                            Winner
                          </motion.div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pick rows */}
              <div className="flex gap-3">
                {players.map((player, pi) => {
                  const lineup = allLineups[player.player_id];
                  const picks = lineup?.selectedPlayers ?? [];
                  const color = PLAYER_COLORS[pi % PLAYER_COLORS.length];
                  return (
                    <div
                      key={player.player_id}
                      className="flex flex-col gap-2"
                      style={{
                        width: Math.max(
                          120,
                          Math.floor(
                            Math.min(
                              180,
                              (typeof window !== 'undefined' ? window.innerWidth - 24 : 400) /
                                players.length,
                            ),
                          ),
                        ),
                      }}
                    >
                      {Array.from({ length: totalRounds }).map((_, roundIdx) => {
                        const pick = picks[roundIdx];
                        const revealed = roundIdx < revealStep;
                        return (
                          <AnimatePresence key={roundIdx} mode="wait">
                            {revealed && pick ? (
                              <motion.div
                                key="pick"
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.05 * pi }}
                                className="border border-white/10 bg-black/40 p-2"
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <PlayerHeadshot
                                    playerId={pick.playerId}
                                    sport={sport}
                                    className="w-6 h-6 rounded-full object-cover bg-white/5 shrink-0"
                                  />
                                  <p className="capcrunch-kicker text-[10px] text-white/80 truncate leading-tight">
                                    {pick.playerName}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="capcrunch-kicker text-[9px] text-white/30">
                                    {pick.team} {pick.selectedYear}
                                  </span>
                                  <span className="capcrunch-title text-sm" style={{ color }}>
                                    {fmt(pick.statValue)}
                                  </span>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="hidden"
                                className="border border-white/5 bg-black/20 p-2 flex items-center justify-center"
                                style={{ height: 60 }}
                              >
                                <span className="capcrunch-kicker text-[10px] text-white/15 tracking-widest">
                                  {roundIdx < revealStep ? '—' : `Round ${roundIdx + 1}`}
                                </span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* min-w-max */}
          </div>
          {/* overflow-x-auto */}
        </div>
      </main>

      {/* Footer controls */}
      <footer className="relative z-10 flex-shrink-0 px-4 py-3 border-t border-white/10 capcrunch-panel">
        <div className="max-w-6xl mx-auto flex gap-3">
          {isHost ? (
            allRevealed ? (
              <button
                onClick={onFinish}
                className="flex-1 py-4 capcrunch-btn-primary capcrunch-title text-lg transition"
              >
                Final Results
              </button>
            ) : (
              <button
                onClick={onReveal}
                className="flex-1 py-4 capcrunch-title text-lg bg-[#a855f7]/80 border border-[#a855f7] text-white hover:bg-[#a855f7] transition"
              >
                Reveal Round {revealStep + 1}
              </button>
            )
          ) : (
            <div className="flex-1 py-4 text-center capcrunch-kicker text-sm text-white/40 border border-white/10">
              {allRevealed
                ? 'Waiting for host to show final results...'
                : `Waiting for host to reveal round ${revealStep + 1}...`}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
