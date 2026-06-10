/**
 * LobbyPlayerList.tsx — Scrollable list of players in the waiting room.
 *
 * Each row shows ready state, team color, host star, score multiplier badge,
 * and host-only controls (kick, rename, team assignment, multiplier cycle).
 * Rename state is managed internally since it's purely local UI.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { renamePlayer, kickPlayer, getLobbyPlayers, setPlayerScoreMultiplier } from '../../services/lobby';
import { TEAM_COLORS } from '../../utils/teamUtils';

const MULTIPLIERS = [1, 1.5, 2, 3, 4];

interface Player {
  player_id: string;
  player_name: string;
  is_host: boolean;
  is_ready: boolean;
  team_number: number | null;
  score_multiplier?: number;
  wins?: number;
}

interface Props {
  players: Player[];
  currentPlayerId: string | null;
  isHost: boolean;
  lobby: {
    id: string;
    status: string;
    game_type: string;
    max_players: number;
  };
  onPlayersRefresh: (updated: Player[]) => void;
  onCycleTeam: (playerId: string, teamNumber: number | null) => void;
}

export function LobbyPlayerList({ players, currentPlayerId, isHost, lobby, onPlayersRefresh, onCycleTeam }: Props) {
  const [renamingPlayerId, setRenamingPlayerId] = useState<string | null>(null);
  const [renameValue,      setRenameValue]      = useState('');

  const handleKick = async (targetPlayerId: string) => {
    await kickPlayer(lobby.id, targetPlayerId);
    // Manually refresh since realtime DELETE events may not fire when the
    // filter column isn't in the replica identity
    const result = await getLobbyPlayers(lobby.id);
    if (result.players) onPlayersRefresh(result.players as Player[]);
  };

  const handleConfirmRename = async () => {
    if (!renamingPlayerId || !renameValue.trim()) return;
    await renamePlayer(lobby.id, renamingPlayerId, renameValue.trim());
    setRenamingPlayerId(null);
    setRenameValue('');
  };

  const handleCycleMultiplier = (playerId: string, current: number) => {
    const idx = MULTIPLIERS.indexOf(current);
    const next = MULTIPLIERS[(idx + 1) % MULTIPLIERS.length];
    setPlayerScoreMultiplier(lobby.id, playerId, next);
  };

  // Only Roster Royale uses team assignment
  const isTeamlessMode = lobby.game_type !== 'roster';
  const isMultiplierlessMode = ['career', 'scramble', 'lineup-is-right', 'box-score', 'starting-lineup', 'face-reveal', 'top-ten'].includes(lobby.game_type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="capcrunch-panel p-4"
    >
      <div className="capcrunch-kicker text-[9px] text-white/40 mb-4">
        Seats ({players.length}/{lobby.max_players})
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {players.map((player, index) => {
            const teamColor = player.team_number ? TEAM_COLORS[player.team_number - 1] : null;
            const isCurrentPlayer = player.player_id === currentPlayerId;
            const multiplier = player.score_multiplier ?? 1;

            return (
              <motion.div
                key={player.player_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-2 p-3 border transition-all ${
                  isCurrentPlayer
                    ? 'border-[#FDF100]/40 bg-[#FDF100]/5'
                    : multiplier > 1
                      ? 'border-purple-500/50 bg-purple-900/20'
                      : 'border-white/10 bg-black/30'
                }`}
                style={teamColor ? { borderLeftWidth: '4px', borderLeftColor: teamColor.bg } : undefined}
              >
                {/* Host star */}
                {player.is_host && (
                  <span className="text-[#FDF100] flex-shrink-0" title="Host">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </span>
                )}

                {/* Name / rename input — takes remaining space */}
                {renamingPlayerId === player.player_id ? (
                  <>
                    <input
                      type="text" value={renameValue} maxLength={20} autoFocus
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleConfirmRename();
                        if (e.key === 'Escape') { setRenamingPlayerId(null); setRenameValue(''); }
                      }}
                      className="flex-1 min-w-0 w-28 px-2 py-0.5 bg-black/40 border border-[#FDF100]/60 text-white text-sm capcrunch-kicker focus:outline-none"
                    />
                    <button onClick={handleConfirmRename} className="text-emerald-400 hover:text-emerald-300 transition-colors flex-shrink-0" title="Confirm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button onClick={() => { setRenamingPlayerId(null); setRenameValue(''); }} className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0" title="Cancel">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <span className="capcrunch-title text-sm text-white truncate flex-1 min-w-0">
                    {player.player_name}
                    {isCurrentPlayer && <span className="capcrunch-kicker text-[9px] text-white/30 ml-1.5">(you)</span>}
                  </span>
                )}

                {/* Host controls — inline, right of name */}
                {isHost && lobby.status === 'waiting' && !player.is_host && (
                  <>
                    <button
                      onClick={() => handleKick(player.player_id)}
                      className="flex-shrink-0 px-2 py-0.5 capcrunch-kicker text-[9px] text-red-400/60 border border-white/10 hover:border-red-500 hover:text-red-400 transition-all"
                    >
                      Kick
                    </button>
                    <button
                      onClick={() => { setRenamingPlayerId(player.player_id); setRenameValue(player.player_name); }}
                      className="flex-shrink-0 text-white/20 hover:text-[#FDF100] transition-colors"
                      title="Rename player"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </>
                )}

                {/* Team assignment */}
                {isHost && lobby.status === 'waiting' && !isTeamlessMode && (
                  <button
                    onClick={() => onCycleTeam(player.player_id, player.team_number)}
                    className={`flex-shrink-0 px-2 py-0.5 capcrunch-kicker text-[9px] transition-all ${
                      player.team_number ? 'text-white border' : 'text-white/40 border border-white/10 hover:border-white/30'
                    }`}
                    style={player.team_number ? { backgroundColor: teamColor!.bg + '40', borderColor: teamColor!.bg, color: teamColor!.bg } : undefined}
                  >
                    {player.team_number ? `T${player.team_number}` : 'Team'}
                  </button>
                )}
                {!isHost && player.team_number && !isTeamlessMode && (
                  <span
                    className="flex-shrink-0 capcrunch-kicker text-[9px] px-2 py-0.5 border"
                    style={{ backgroundColor: teamColor!.bg + '40', borderColor: teamColor!.bg, color: teamColor!.bg }}
                  >
                    T{player.team_number}
                  </span>
                )}

                {/* Score multiplier */}
                {isHost && !player.is_host && lobby.status === 'waiting' && !isMultiplierlessMode && (
                  <button
                    onClick={() => handleCycleMultiplier(player.player_id, multiplier)}
                    className={`flex-shrink-0 px-2 py-0.5 capcrunch-kicker text-[9px] transition-all ${
                      multiplier > 1
                        ? 'bg-purple-600 text-white border border-purple-400'
                        : 'text-white/40 border border-white/10 hover:border-purple-400 hover:text-purple-400'
                    }`}
                    title="Click to cycle score multiplier"
                  >
                    {multiplier > 1 ? `${multiplier}x` : '1x'}
                  </button>
                )}
                {multiplier > 1 && !isMultiplierlessMode && !isHost && (
                  <span className="flex-shrink-0 text-[10px] text-purple-400 capcrunch-kicker px-1.5 py-0.5 bg-purple-900/40 rounded">
                    {multiplier}x
                  </span>
                )}

                {/* Ready badge */}
                <div className={`flex-shrink-0 px-2.5 py-0.5 capcrunch-kicker text-[9px] ${
                  player.is_ready
                    ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700'
                    : 'bg-black/40 text-white/30 border border-white/10'
                }`}>
                  {player.is_ready ? 'Ready' : 'Waiting'}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
