/**
 * CapCrunchScoresPanel.tsx — Live lineups sidebar shown during picking.
 *
 * Masks the current-round pick for opponents until the local player submits,
 * so players can't just copy whoever submitted first.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { fmt } from './capCrunchUtils';
import { FlipReveal } from './FlipReveal';
import { PlayerHeadshot } from './PlayerHeadshot';
import { isDivisionDraftRound, parseDivisionDraftRound } from '../../services/capCrunch';
import type { PlayerLineup } from '../../types/capCrunch';

function draftLabel(code: string): string {
  if (code === 'R1')  return '1st Round';
  if (code === 'R2')  return '2nd Round';
  if (code === 'R23') return '2nd–3rd Round';
  if (code === 'R47') return '4th–7th Round';
  return code;
}

function formatPickTeam(team: string): string {
  if (isDivisionDraftRound(team)) {
    const { division, draftRound } = parseDivisionDraftRound(team);
    return `${division} · ${draftLabel(draftRound)}`;
  }
  return team;
}

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
  /** When true, running totals are hidden for all players */
  blindMode?: boolean;
}

export function CapCrunchScoresPanel({
  players, allLineups, currentPlayerId, currentRound, totalRounds, canPickThisRound, sport, blindMode = false,
}: Props) {
  // Per-pick stat guesses typed by the local player in blind mode.
  // Keyed by pick index; values are raw input strings so partial input is preserved.
  const [myGuesses, setMyGuesses] = useState<Record<number, string>>({});

  const myEstimate = Object.values(myGuesses).reduce((sum, v) => {
    const n = parseFloat(v);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  // Put the current player first, then everyone else in original order
  const sortedPlayers = currentPlayerId
    ? [
        ...players.filter(p => p.player_id === currentPlayerId),
        ...players.filter(p => p.player_id !== currentPlayerId),
      ]
    : players;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-black/60 border-2 border-white/10 rounded p-4 h-full overflow-y-auto"
    >
      <h3 className="retro-title text-base text-[#d4af37] mb-3">Lineups</h3>
      <div className="space-y-3">
        {sortedPlayers.map((player) => {
          const lineup = allLineups[player.player_id] as (PlayerLineup & { hasPickedThisRound?: boolean }) | undefined;
          const hasPicked = lineup?.hasPickedThisRound || lineup?.isFinished;
          const isMe = player.player_id === currentPlayerId;
          const maskCurrentRound = canPickThisRound && !isMe;
          const visiblePicks = maskCurrentRound
            ? (lineup?.selectedPlayers.slice(0, currentRound - 1) ?? [])
            : (lineup?.selectedPlayers ?? []);
          const myBustCount = !blindMode && isMe ? (lineup?.bustCount ?? 0) : 0;

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
                  const isBad = isMe && !blindMode && (selected.isBust || selected.neverOnTeam || selected.statValue === 0);
                  return (
                  <motion.div
                    key={`${selected.playerName}-${selected.team}-${selected.selectedYear}`}
                    animate={isMe && !blindMode && selected.isBust ? { x: [0, -5, 5, -3, 3, 0] } : {}}
                    transition={{ duration: 0.35 }}
                    className={`flex justify-between items-center gap-1 ${isBad ? 'text-red-300' : 'text-white/70'}`}
                  >
                    {selected.isSkipped ? (
                      // Skipped pick — timer expired with no selection
                      <div className="flex items-center gap-1.5 flex-1">
                        <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <span className="text-[8px] text-white/25">✕</span>
                        </div>
                        <span className="sports-font text-[10px] text-white/25 italic">Skipped</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-1 min-w-0 flex-1">
                          <div className="relative shrink-0 mt-0.5">
                            <PlayerHeadshot playerId={selected.playerId} sport={sport} className={`w-5 h-5 rounded-full object-cover bg-white/5${isBad ? ' grayscale' : ''}`} />
                            {isBad && <div className="absolute inset-0 rounded-full bg-red-500/30" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1">
                              <FlipReveal text={selected.playerName} className={`truncate text-xs ${isBad ? 'text-red-400' : ''}`} />
                              {isMe && !blindMode && selected.isBust && <span className="text-[7px] bg-red-600 text-white px-0.5 rounded shrink-0">BUST</span>}
                              <span className={`ml-1 text-[10px] ${isBad ? 'text-red-400/70' : 'text-white/40'}`}>({selected.selectedYear}, {formatPickTeam(selected.team)})</span>
                            </div>
                            {isMe && !blindMode && selected.neverOnTeam && (
                              <div className="text-[9px] text-orange-400/80 mt-0.5">
                                {selected.actualCollege && selected.actualNflConf
                                  ? `went to ${selected.actualCollege} / in ${selected.actualNflConf}`
                                  : selected.actualCollege
                                  ? `went to ${selected.actualCollege}`
                                  : selected.actualNflConf && selected.actualDraftRound
                                  ? `in ${selected.actualNflConf} / drafted in ${selected.actualDraftRound}`
                                  : selected.actualNflConf
                                  ? `in ${selected.actualNflConf}`
                                  : selected.actualDraftRound
                                  ? `drafted in ${selected.actualDraftRound}`
                                  : selected.actualTeam
                                  ? `played for ${selected.actualTeam}`
                                  : "didn't qualify"}
                              </div>
                            )}
                          </div>
                        </div>
                        {isMe && !blindMode && (
                          <span className={`font-semibold ml-1 flex-shrink-0 ${isBad ? 'text-red-400' : 'text-[#d4af37]'}`}>
                            {selected.isBust ? `${fmt(selected.statValue)}→0` : fmt(selected.statValue)}
                          </span>
                        )}
                        {isMe && blindMode && (
                          <input
                            type="number"
                            min={0}
                            value={myGuesses[idx] ?? ''}
                            placeholder="?"
                            onChange={e => setMyGuesses(prev => ({ ...prev, [idx]: e.target.value }))}
                            className="w-12 text-center bg-[#7c3aed]/10 border border-[#7c3aed]/30 rounded-sm text-[#a78bfa] retro-title text-xs py-0.5 focus:outline-none focus:border-[#7c3aed] placeholder-[#7c3aed]/30 ml-1 flex-shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        )}
                      </>
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
                {blindMode && isMe ? (
                  <div className="flex items-baseline gap-1">
                    <span className="sports-font text-[8px] text-[#7c3aed]/50 tracking-widest uppercase">est</span>
                    <span className="font-semibold text-[#a78bfa]">
                      {Object.keys(myGuesses).length > 0 ? fmt(myEstimate) : '—'}
                    </span>
                  </div>
                ) : blindMode ? (
                  <span className="font-semibold text-white/20">—</span>
                ) : isMe ? (
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
