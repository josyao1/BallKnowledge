/**
 * CapCrunchScoresPanel.tsx — Live lineups sidebar shown during picking.
 *
 * Masks the current-round pick for opponents until the local player submits,
 * so players can't just copy whoever submitted first.
 */

import { motion } from 'framer-motion';
import { fmt } from './capCrunchUtils';
import { FlipReveal } from './FlipReveal';
import { PlayerHeadshot } from './PlayerHeadshot';
import type { PlayerLineup } from '../../types/capCrunch';

interface Player {
  id: string;
  player_id: string;
  player_name: string;
}

interface Props {
  players: Player[];
  /** Keyed by player_id */
  allLineups: Record<string, PlayerLineup>;
  currentPlayerId: string | null;
  currentRound: number;
  totalRounds: number;
  /** When true, the current-round pick is hidden for opponents until the local player submits */
  canPickThisRound: boolean;
  sport: 'nba' | 'nfl';
}

export function CapCrunchScoresPanel({
  players, allLineups, currentPlayerId, currentRound, totalRounds, canPickThisRound, sport,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-black/60 border-2 border-white/10 rounded p-4 flex-1 overflow-y-auto"
    >
      <h3 className="retro-title text-base text-[#d4af37] mb-3">Lineups</h3>
      <div className="space-y-3">
        {players.map((player) => {
          const lineup = allLineups[player.player_id] as (PlayerLineup & { hasPickedThisRound?: boolean }) | undefined;
          const hasPicked = lineup?.hasPickedThisRound || lineup?.isFinished;
          const isMe = player.player_id === currentPlayerId;
          const maskCurrentRound = canPickThisRound && !isMe;
          const visiblePicks = maskCurrentRound
            ? (lineup?.selectedPlayers.slice(0, currentRound - 1) ?? [])
            : (lineup?.selectedPlayers ?? []);
          const myBustCount = isMe ? (lineup?.bustCount ?? 0) : 0;

          return (
            <div
              key={player.id}
              className={`p-3 rounded border-2 transition ${
                isMe ? 'border-[#d4af37] bg-[#1a1a1a]' : 'border-white/10 bg-black/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className={`font-semibold text-sm ${isMe ? 'text-[#d4af37]' : 'text-white/60'}`}>
                    {player.player_name}
                  </p>
                  {isMe && myBustCount > 0 && (
                    <p className="text-[9px] text-red-400/70 sports-font">{myBustCount} bust{myBustCount !== 1 ? 's' : ''}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {hasPicked ? (
                    <span className="text-emerald-400 text-sm">✓</span>
                  ) : (
                    <span className="text-yellow-400 text-sm">⏳</span>
                  )}
                </div>
              </div>

              <div className="space-y-1 mb-2 text-xs">
                {visiblePicks.map((selected, idx) => {
                  const isBad = isMe && (selected.isBust || selected.statValue === 0);
                  return (
                  <motion.div
                    key={idx}
                    animate={isMe && selected.isBust ? { x: [0, -5, 5, -3, 3, 0] } : {}}
                    transition={{ duration: 0.35 }}
                    className={`flex justify-between items-center gap-1 ${isBad ? 'text-red-300' : 'text-white/70'}`}
                  >
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {isMe && (
                        <div className="relative shrink-0">
                          <PlayerHeadshot playerId={selected.playerId} sport={sport} className={`w-5 h-5 rounded-full object-cover bg-white/5${isBad ? ' grayscale' : ''}`} />
                          {isBad && <div className="absolute inset-0 rounded-full bg-red-500/30" />}
                        </div>
                      )}
                      <div className="min-w-0 flex items-baseline gap-1">
                        <FlipReveal text={selected.playerName} className={`truncate text-xs ${isBad ? 'text-red-400' : ''}`} />
                        {isMe && selected.isBust && <span className="text-[7px] bg-red-600 text-white px-0.5 rounded shrink-0">BUST</span>}
                        <span className={`ml-1 text-[10px] ${isBad ? 'text-red-400/70' : 'text-white/40'}`}>({selected.selectedYear}, {selected.team})</span>
                      </div>
                    </div>
                    {isMe && (
                      <span className={`font-semibold ml-1 flex-shrink-0 ${isBad ? 'text-red-400' : 'text-[#d4af37]'}`}>
                        {selected.isBust ? `${fmt(selected.statValue)}→0` : fmt(selected.statValue)}
                      </span>
                    )}
                  </motion.div>
                  );
                })}
                {maskCurrentRound && hasPicked && (
                  <div className="text-white/20 italic text-[10px]">Pick hidden until you submit</div>
                )}
              </div>

              <div className="flex justify-between text-xs border-t border-white/10 pt-1.5">
                <span className="text-white/40">{visiblePicks.length}/{totalRounds}</span>
                {isMe ? (
                  <span className="font-semibold text-white">
                    {fmt(lineup?.totalStat ?? 0)}
                  </span>
                ) : (
                  <span className="font-semibold text-white/20">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
