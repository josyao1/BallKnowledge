/**
 * CapCrunchScoresPanel.tsx — Live lineups sidebar shown during picking.
 *
 * Masks the current-round pick for opponents until the local player submits,
 * so players can't just copy whoever submitted first.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { fmt, getPickErrorMessage, getPickBadgeLabel } from './capCrunchUtils';
import { FlipReveal } from './FlipReveal';
import { PlayerHeadshot } from './PlayerHeadshot';
import { isDivisionDraftRound, parseDivisionDraftRound, isTeammateRound, parseTeammateRound, isNameMatchRound, parseNameRound, isWildcardRound } from '../../services/capCrunch';
import type { PlayerLineup } from '../../types/capCrunch';

function draftLabel(code: string): string {
  if (code === 'R1')  return '1st Round';
  if (code === 'R2')  return '2nd Round';
  if (code === 'R23') return '2nd–3rd Round';
  if (code === 'R47') return '4th Round+';
  return code;
}

function formatPickTeam(team: string): string {
  if (isDivisionDraftRound(team)) {
    const { division, draftRound } = parseDivisionDraftRound(team);
    return `${division} · ${draftLabel(draftRound)}`;
  }
  if (isTeammateRound(team)) {
    const { pickIndex } = parseTeammateRound(team);
    return `Played with Pick ${pickIndex}`;
  }
  if (isNameMatchRound(team)) {
    const { type, pickIndex, proConf } = parseNameRound(team);
    const label = type === 'first' ? 'First Initial' : 'Last Initial';
    return proConf ? `${label}: Pick ${pickIndex} + ${proConf}` : `${label}: Pick ${pickIndex}`;
  }
  if (isWildcardRound(team)) return 'Wildcard';
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
  targetCap?: number;
  /** When true, running totals are hidden for all players */
  blindMode?: boolean;
  /** When true, picks are never masked — all players can always see all picks */
  hardMode?: boolean;
}

export function CapCrunchScoresPanel({
  players, allLineups, currentPlayerId, currentRound, totalRounds, canPickThisRound, sport, targetCap = 0, blindMode = false, hardMode = false,
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
      className="capcrunch-panel p-4 h-full overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
        <h3 className="capcrunch-title text-base text-[#FDF100]">Lineups</h3>
        <span className="capcrunch-kicker text-white/35">{players.length} players</span>
      </div>
      <div className="space-y-3">
        {sortedPlayers.map((player) => {
          const lineup = allLineups[player.player_id] as (PlayerLineup & { hasPickedThisRound?: boolean }) | undefined;
          const hasPicked = lineup?.hasPickedThisRound || lineup?.isFinished;
          const isMe = player.player_id === currentPlayerId;
          const maskCurrentRound = !hardMode && canPickThisRound && !isMe;
          const visiblePicks = maskCurrentRound
            ? (lineup?.selectedPlayers.slice(0, currentRound - 1) ?? [])
            : (lineup?.selectedPlayers ?? []);
          const myBustCount = !blindMode && isMe ? (lineup?.bustCount ?? 0) : 0;

          return (
            <div
              key={player.id}
              className={`p-3 border transition ${
                isMe ? 'border-[#FDF100]/60 bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(253,241,0,0.12)]' : 'border-white/10 bg-black/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className={`capcrunch-title text-sm ${isMe ? 'text-[#FDF100]' : 'text-white/70'}`}>
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
                {(() => {
                  let running = 0;
                  return visiblePicks.map((selected, idx) => {
                  const totalBefore = running;
                  if (!selected.isBust && !selected.neverOnTeam) running += selected.statValue;
                  const isBad = isMe && !blindMode && (selected.isBust || selected.neverOnTeam);
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
                              {isMe && !blindMode && isBad && <span className="text-[7px] bg-red-600 text-white px-0.5 rounded shrink-0">{getPickBadgeLabel(selected)}</span>}
                              <span className={`ml-1 text-[10px] ${isBad ? 'text-red-400/70' : 'text-white/40'}`}>({selected.selectedYear}, {formatPickTeam(selected.team)})</span>
                            </div>
                            {isMe && !blindMode && selected.isBust && targetCap > 0 && (
                              <div className="text-[9px] text-red-400/70 mt-0.5">busted by {fmt(totalBefore + selected.statValue - targetCap)}</div>
                            )}
                            {isMe && !blindMode && selected.neverOnTeam && (
                              <div className="text-[9px] text-orange-400/80 mt-0.5">
                                {getPickErrorMessage(selected)}
                              </div>
                            )}
                          </div>
                        </div>
                        {isMe && !blindMode && (
                          <span className={`font-semibold ml-1 flex-shrink-0 ${isBad ? 'text-red-400' : selected.statValue === 0 ? 'text-red-400' : 'text-[#d4af37]'}`}>
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
                            className="w-12 text-center bg-[#4E53A5]/10 border border-[#4E53A5]/40 text-[#68BBE5] capcrunch-title text-xs py-0.5 focus:outline-none focus:border-[#68BBE5] placeholder-[#68BBE5]/30 ml-1 flex-shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        )}
                      </>
                    )}
                  </motion.div>
                  );
                  });
                })()}
                {maskCurrentRound && hasPicked && (
                  <div className="text-white/20 italic text-[10px]">Pick hidden until you submit</div>
                )}
              </div>

              <div className="flex justify-between text-xs border-t border-white/10 pt-1.5">
                <span className="capcrunch-kicker text-white/35">{visiblePicks.length}/{totalRounds}</span>
                {blindMode && isMe ? (
                  <div className="flex items-baseline gap-1">
                    <span className="capcrunch-kicker text-[#4E53A5]/70">est</span>
                    <span className="capcrunch-title text-[#68BBE5]">
                      {Object.keys(myGuesses).length > 0 ? fmt(myEstimate) : '—'}
                    </span>
                  </div>
                ) : blindMode ? (
                  <span className="capcrunch-title text-white/20">—</span>
                ) : isMe ? (
                  <span className="capcrunch-title text-white">
                    {fmt(lineup?.totalStat ?? 0)}
                  </span>
                ) : (
                  <span className="capcrunch-title text-white/20">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
