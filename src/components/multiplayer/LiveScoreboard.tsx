/**
 * LiveScoreboard.tsx — Real-time multiplayer score sidebar during gameplay.
 *
 * Displays all players sorted by effective score (base + uniqueness bonus,
 * optionally doubled for 2x/dummy players). Uniqueness bonus (+1 per
 * exclusively-guessed roster player) only activates with 3+ players.
 * Re-sorts on every score update via Zustand subscription.
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LobbyPlayer } from '../../types/database';
import {
  buildScoringEntities,
  computeEntityBonuses,
  hasTeams,
  getEntityScore,
  getEntityGuessedCount,
  isCurrentPlayerInEntity,
  type ScoringEntity,
} from '../../utils/teamUtils';

interface LiveScoreboardProps {
  players: LobbyPlayer[];
  currentPlayerId: string;
  rosterSize: number;
}

export function LiveScoreboard({ players, currentPlayerId, rosterSize }: LiveScoreboardProps) {
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());

  const isTeamMode = useMemo(() => hasTeams(players), [players]);

  const entities = useMemo(() => buildScoringEntities(players), [players]);
  const entityBonuses = useMemo(() => computeEntityBonuses(entities), [entities]);

  // For solo players, apply score_multiplier; team score is already weighted in teamUtils
  const getEffectiveEntityScore = (entity: ScoringEntity): number => {
    const bonus = entityBonuses.get(entity.entityId) || 0;
    if (entity.type === 'solo') {
      const base = entity.player.score + bonus;
      return base * (entity.player.score_multiplier ?? 1);
    }
    return getEntityScore(entity) + bonus;
  };

  // Sort entities by total score descending
  const sortedEntities = useMemo(() => {
    return [...entities].sort((a, b) => getEffectiveEntityScore(b) - getEffectiveEntityScore(a));
  }, [entities, entityBonuses]);

  const showBonuses = entities.length >= 3;
  const hasMultiplierPlayers = players.some(p => (p.score_multiplier ?? 1) > 1);

  const toggleTeam = (teamNumber: number) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamNumber)) next.delete(teamNumber);
      else next.add(teamNumber);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {(showBonuses || hasMultiplierPlayers) && (
        <div className="text-[10px] text-white/40 text-center mb-1 sports-font">
          {showBonuses && (isTeamMode ? '+1 for unique guesses (teams = one)' : '+1 for unique guesses')}
          {showBonuses && hasMultiplierPlayers && ' • '}
          {hasMultiplierPlayers && <span className="text-purple-400">multipliers active</span>}
        </div>
      )}
      <AnimatePresence>
        {sortedEntities.map((entity, index) => {
          const isLeader = index === 0;
          const bonus = entityBonuses.get(entity.entityId) || 0;
          const isCurrent = isCurrentPlayerInEntity(entity, currentPlayerId);
          const effectiveScore = getEffectiveEntityScore(entity);
          const guessedCount = getEntityGuessedCount(entity);
          const percentage = rosterSize > 0 ? Math.round((guessedCount / rosterSize) * 100) : 0;

          if (entity.type === 'team') {
            const { team } = entity;
            const isExpanded = expandedTeams.has(team.teamNumber);

            return (
              <motion.div
                key={entity.entityId}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-sm border transition-all overflow-hidden ${
                  isCurrent
                    ? 'bg-[#d4af37]/20 border-[#d4af37]/50'
                    : 'bg-black/40 border-white/10'
                }`}
                style={{
                  borderLeftWidth: '3px',
                  borderLeftColor: team.color.bg,
                }}
              >
                {/* Team header row */}
                <div
                  onClick={() => toggleTeam(team.teamNumber)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`retro-title text-lg w-6 ${
                      isLeader ? 'text-[#d4af37]' : 'text-white/30'
                    }`}>
                      {index + 1}
                    </span>
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: team.color.bg }}
                    />
                    <div className="flex flex-col">
                      <span className={`sports-font text-sm font-medium truncate max-w-[100px] ${
                        isCurrent ? 'text-[#d4af37]' : 'text-white/80'
                      }`}>
                        {team.members.map(m => m.player_name).join(' & ')}
                      </span>
                      <span className="text-[8px] text-white/40 uppercase tracking-widest">
                        Team {team.teamNumber} • {team.members.length}p
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        {showBonuses && bonus > 0 && (
                          <span className="text-xs text-emerald-400">+{bonus}</span>
                        )}
                        <span className="retro-title text-xl text-white">
                          {effectiveScore}
                        </span>
                      </div>
                      <span className="text-[9px] text-white/40">{percentage}%</span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded member details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {team.members.map(member => {
                        const isMemberCurrent = member.player_id === currentPlayerId;
                        return (
                          <div
                            key={member.player_id}
                            className="flex items-center justify-between px-6 py-2 border-t border-white/5"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`sports-font text-xs ${isMemberCurrent ? 'text-[#d4af37]' : 'text-white/60'}`}>
                                {member.player_name}
                              </span>
                              {isMemberCurrent && (
                                <span className="text-[7px] text-white/40 uppercase">you</span>
                              )}
                              {(member.score_multiplier ?? 1) > 1 && (
                                <span className="text-[7px] text-purple-400 px-1 bg-purple-900/40 rounded">{member.score_multiplier}x</span>
                              )}
                            </div>
                            <span className="text-xs text-white/40">{member.score} pts</span>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          }

          // Solo player entity - render same as before
          const { player } = entity;
          const isCurrentPlayer = player.player_id === currentPlayerId;

          return (
            <motion.div
              key={entity.entityId}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
                isCurrentPlayer
                  ? 'bg-[#d4af37]/20 border-[#d4af37]/50'
                  : (player.score_multiplier ?? 1) > 1
                  ? 'bg-purple-900/20 border-purple-500/30'
                  : 'bg-black/40 border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`retro-title text-lg w-6 ${
                  isLeader ? 'text-[#d4af37]' : 'text-white/30'
                }`}>
                  {index + 1}
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className={`sports-font text-sm font-medium truncate max-w-[100px] ${
                      isCurrentPlayer ? 'text-[#d4af37]' : 'text-white/80'
                    }`}>
                      {player.player_name}
                    </span>
                    {(player.score_multiplier ?? 1) > 1 && (
                      <span className="text-[8px] text-purple-400 px-1 py-0.5 bg-purple-900/40 rounded">{player.score_multiplier}x</span>
                    )}
                  </div>
                  {isCurrentPlayer && (
                    <span className="text-[8px] text-white/40 uppercase tracking-widest">You</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1">
                  {showBonuses && bonus > 0 && (
                    <span className="text-xs text-emerald-400">+{bonus}</span>
                  )}
                  {(player.score_multiplier ?? 1) > 1 && (
                    <span className="text-xs text-purple-400">×{player.score_multiplier}</span>
                  )}
                  <span className="retro-title text-xl text-white">
                    {effectiveScore}
                  </span>
                </div>
                <span className="text-[9px] text-white/40">{percentage}%</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
