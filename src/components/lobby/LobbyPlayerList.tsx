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

  // Games that don't use team assignment or multipliers
  const isTeamlessMode = ['career', 'scramble', 'box-score', 'starting-lineup'].includes(lobby.game_type);
  const isMultiplierlessMode = ['career', 'scramble', 'lineup-is-right', 'box-score', 'starting-lineup'].includes(lobby.game_type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-black/50 border border-white/10 rounded-sm p-4"
    >
      <div className="sports-font text-[10px] text-white/40 mb-4 tracking-[0.3em] uppercase">
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
                className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
                  isCurrentPlayer
                    ? 'border-[#d4af37]/50 bg-[#d4af37]/10'
                    : multiplier > 1
                      ? 'border-purple-500/50 bg-purple-900/20'
                      : 'border-white/10 bg-black/30'
                }`}
                style={teamColor ? { borderLeftWidth: '4px', borderLeftColor: teamColor.bg } : undefined}
              >
                {/* Left: name + badges */}
                <div className="flex items-center gap-3 min-w-0">
                  {teamColor && (
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor.bg }} />
                  )}
                  {player.is_host && (
                    <span className="text-[#d4af37] flex-shrink-0" title="Host">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </span>
                  )}

                  {renamingPlayerId === player.player_id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text" value={renameValue} maxLength={20} autoFocus
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleConfirmRename();
                          if (e.key === 'Escape') { setRenamingPlayerId(null); setRenameValue(''); }
                        }}
                        className="w-28 px-2 py-0.5 bg-[#111] rounded-sm border border-[#d4af37] text-white text-sm sports-font focus:outline-none"
                      />
                      <button onClick={handleConfirmRename} className="text-emerald-400 hover:text-emerald-300 transition-colors" title="Confirm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button onClick={() => { setRenamingPlayerId(null); setRenameValue(''); }} className="text-red-400 hover:text-red-300 transition-colors" title="Cancel">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-white/90 sports-font truncate">{player.player_name}</span>
                      {isCurrentPlayer && (
                        <span className="text-[10px] text-white/40 sports-font flex-shrink-0">(you)</span>
                      )}
                      {isHost && !player.is_host && lobby.status === 'waiting' && (
                        <button
                          onClick={() => { setRenamingPlayerId(player.player_id); setRenameValue(player.player_name); }}
                          className="text-white/20 hover:text-[#d4af37] transition-colors flex-shrink-0"
                          title="Rename player"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}

                  {multiplier > 1 && !isMultiplierlessMode && (
                    <span className="text-[10px] text-purple-400 sports-font px-1.5 py-0.5 bg-purple-900/40 rounded flex-shrink-0">
                      {multiplier}x
                    </span>
                  )}
                </div>

                {/* Right: host controls + ready badge */}
                <div className="flex items-center gap-2">
                  {isHost && !player.is_host && lobby.status === 'waiting' && (
                    <button
                      onClick={() => handleKick(player.player_id)}
                      className="px-2 py-1 rounded-sm text-[9px] font-bold sports-font uppercase tracking-wider transition-all bg-black/40 text-red-400/60 border border-white/10 hover:border-red-500 hover:text-red-400"
                    >
                      Kick
                    </button>
                  )}

                  {/* Team assignment — host only, non-teamless modes */}
                  {isHost && lobby.status === 'waiting' && !isTeamlessMode && (
                    <button
                      onClick={() => onCycleTeam(player.player_id, player.team_number)}
                      className={`px-2 py-1 rounded-sm text-[9px] font-bold sports-font uppercase tracking-wider transition-all ${
                        player.team_number ? 'text-white border' : 'bg-black/40 text-white/40 border border-white/10 hover:border-white/30'
                      }`}
                      style={player.team_number ? {
                        backgroundColor: teamColor!.bg + '40',
                        borderColor: teamColor!.bg,
                        color: teamColor!.bg,
                      } : undefined}
                    >
                      {player.team_number ? `T${player.team_number}` : 'Team'}
                    </button>
                  )}

                  {/* Team label for non-host when teams are assigned */}
                  {!isHost && player.team_number && !isTeamlessMode && (
                    <span
                      className="px-2 py-1 rounded-sm text-[9px] font-bold sports-font uppercase tracking-wider border"
                      style={{ backgroundColor: teamColor!.bg + '40', borderColor: teamColor!.bg, color: teamColor!.bg }}
                    >
                      T{player.team_number}
                    </span>
                  )}

                  {/* Score multiplier cycle — host only, non-multiplierless modes */}
                  {isHost && !player.is_host && lobby.status === 'waiting' && !isMultiplierlessMode && (
                    <button
                      onClick={() => handleCycleMultiplier(player.player_id, multiplier)}
                      className={`px-2 py-1 rounded-sm text-[9px] font-bold sports-font uppercase tracking-wider transition-all ${
                        multiplier > 1
                          ? 'bg-purple-600 text-white border border-purple-400'
                          : 'bg-black/40 text-white/40 border border-white/10 hover:border-purple-400 hover:text-purple-400'
                      }`}
                      title="Click to cycle score multiplier (1x → 1.5x → 2x → 3x → 4x)"
                    >
                      {multiplier > 1 ? `${multiplier}x` : '1x'}
                    </button>
                  )}

                  <div className={`px-3 py-1 rounded-sm text-[10px] font-bold sports-font uppercase tracking-wider ${
                    player.is_ready
                      ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700'
                      : 'bg-black/40 text-white/40 border border-white/10'
                  }`}>
                    {player.is_ready ? 'Ready' : 'Waiting'}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
