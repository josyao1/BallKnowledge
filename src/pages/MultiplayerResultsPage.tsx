import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useGameStore } from '../stores/gameStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { resetLobbyForNewRound, findLobbyByCode, getLobbyPlayers, updateLobbyStatus, incrementPlayerWins } from '../services/lobby';
import {
  buildScoringEntities,
  computeEntityBonuses,
  hasTeams,
  getEntityScore,
  getEntityGuessedCount,
  getEntityIncorrectGuesses,
  getEntityDisplayName,
  isCurrentPlayerInEntity,
  type ScoringEntity,
} from '../utils/teamUtils';

// Generate distinct colors for players
const PLAYER_COLORS = [
  '#d4af37', // Gold
  '#4ade80', // Green
  '#f472b6', // Pink
  '#60a5fa', // Blue
  '#fb923c', // Orange
  '#a78bfa', // Purple
  '#fbbf24', // Yellow
  '#34d399', // Teal
];

export function MultiplayerResultsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, currentPlayerId, isHost, reset: resetLobby, setLobby, setPlayers } = useLobbyStore();
  const { currentRoster, resetGame } = useGameStore();
  const [isResetting, setIsResetting] = useState(false);
  const [showRosterBreakdown, setShowRosterBreakdown] = useState(false);
  const hasNavigated = useRef(false);
  const hasIncrementedWins = useRef(false);

  // If lobby is null but we have a code, try to fetch it
  useEffect(() => {
    if (!lobby && code) {
      const fetchLobby = async () => {
        const result = await findLobbyByCode(code);
        if (result.lobby) {
          setLobby(result.lobby);
          const playersResult = await getLobbyPlayers(result.lobby.id);
          if (playersResult.players) {
            setPlayers(playersResult.players);
          }
        }
      };
      fetchLobby();
    }
  }, [lobby, code, setLobby, setPlayers]);

  // Keep subscription active for realtime updates
  useLobbySubscription(lobby?.id || null);

  // Check if all players have finished
  const allPlayersFinished = useMemo(() => {
    if (players.length === 0) return false;
    return players.every(p => p.finished_at !== null);
  }, [players]);

  // Fetch fresh player data on mount and poll until all have finished
  useEffect(() => {
    if (!lobby?.id) return;

    const fetchPlayers = async () => {
      const result = await getLobbyPlayers(lobby.id);
      if (result.players) {
        setPlayers(result.players);
        const allFinished = result.players.every(p => p.finished_at !== null);
        if (allFinished && lobby.status !== 'finished') {
          await updateLobbyStatus(lobby.id, 'finished');
        }
      }
    };

    fetchPlayers();
    const pollInterval = setInterval(fetchPlayers, 2000);
    return () => clearInterval(pollInterval);
  }, [lobby?.id, lobby?.status, setPlayers]);

  // Navigate back to lobby when status changes to 'waiting'
  const navigateToLobby = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    resetGame();
    navigate(`/lobby/${code}`);
  }, [code, navigate, resetGame]);

  useEffect(() => {
    if (lobby?.status === 'waiting') {
      navigateToLobby();
    }
  }, [lobby?.status, navigateToLobby]);

  // Polling fallback for non-host players
  useEffect(() => {
    if (isHost || !code) return;

    const pollInterval = setInterval(async () => {
      if (hasNavigated.current) {
        clearInterval(pollInterval);
        return;
      }
      const result = await findLobbyByCode(code);
      if (result.lobby) {
        setLobby(result.lobby);
        if (result.lobby.status === 'waiting') {
          navigateToLobby();
        }
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isHost, code, setLobby, navigateToLobby]);

  // Entity-based scoring
  const isTeamMode = useMemo(() => hasTeams(players), [players]);
  const entities = useMemo(() => buildScoringEntities(players), [players]);
  const entityBonuses = useMemo(() => computeEntityBonuses(entities), [entities]);

  const showBonuses = entities.length >= 3;
  const hasDummyPlayers = players.some(p => p.is_dummy);

  // Get effective score for an entity (handles dummy multiplier for solo players)
  const getEffectiveEntityScore = useCallback((entity: ScoringEntity): number => {
    const bonus = entityBonuses.get(entity.entityId) || 0;
    if (entity.type === 'solo') {
      const base = entity.player.score + bonus;
      return entity.player.is_dummy ? base * 2 : base;
    }
    return getEntityScore(entity) + bonus;
  }, [entityBonuses]);

  // Sort entities by total score, with incorrect guesses as tiebreaker
  const { sortedEntities, tiebreakerUsed } = useMemo(() => {
    let tiebreaker = false;
    const sorted = [...entities].sort((a, b) => {
      const totalA = getEffectiveEntityScore(a);
      const totalB = getEffectiveEntityScore(b);

      if (totalA === totalB) {
        const incorrectA = getEntityIncorrectGuesses(a).length;
        const incorrectB = getEntityIncorrectGuesses(b).length;
        if (incorrectA !== incorrectB) {
          tiebreaker = true;
          return incorrectA - incorrectB;
        }
      }
      return totalB - totalA;
    });
    return { sortedEntities: sorted, tiebreakerUsed: tiebreaker };
  }, [entities, getEffectiveEntityScore]);

  // Find all winning entities
  const winnerEntities = useMemo(() => {
    if (sortedEntities.length === 0) return [];

    const first = sortedEntities[0];
    const firstTotal = getEffectiveEntityScore(first);
    const firstIncorrect = getEntityIncorrectGuesses(first).length;

    return sortedEntities.filter(e => {
      const total = getEffectiveEntityScore(e);
      const incorrect = getEntityIncorrectGuesses(e).length;
      return total === firstTotal && incorrect === firstIncorrect;
    });
  }, [sortedEntities, getEffectiveEntityScore]);

  const isTie = winnerEntities.length > 1;
  const winnerTotal = winnerEntities[0] ? getEffectiveEntityScore(winnerEntities[0]) : 0;
  const winnerBonus = winnerEntities[0] ? (entityBonuses.get(winnerEntities[0].entityId) || 0) : 0;
  const winnerIncorrect = winnerEntities[0] ? getEntityIncorrectGuesses(winnerEntities[0]).length : 0;
  const winnerGuessedCount = winnerEntities[0] ? getEntityGuessedCount(winnerEntities[0]) : 0;

  // Current player's rank
  const currentEntityRank = sortedEntities.findIndex(e => isCurrentPlayerInEntity(e, currentPlayerId)) + 1;
  const currentIsWinner = winnerEntities.some(e => isCurrentPlayerInEntity(e, currentPlayerId));

  // Increment wins for all winners (host only, once per game)
  // Individual wins: all members of a winning team get +1
  useEffect(() => {
    if (!isHost || !allPlayersFinished || winnerEntities.length === 0 || !lobby || hasIncrementedWins.current) return;

    hasIncrementedWins.current = true;
    for (const entity of winnerEntities) {
      if (entity.type === 'solo') {
        incrementPlayerWins(lobby.id, entity.player.player_id);
      } else {
        for (const member of entity.team.members) {
          incrementPlayerWins(lobby.id, member.player_id);
        }
      }
    }
  }, [isHost, allPlayersFinished, winnerEntities, lobby]);

  // Build roster breakdown - which individual players guessed each roster player
  const rosterBreakdown = useMemo(() => {
    const breakdown: Map<string, { playerId: string; displayName: string; color: string; initial: string }[]> = new Map();

    currentRoster.forEach(rosterPlayer => {
      breakdown.set(rosterPlayer.name, []);
    });

    // Assign colors: use team colors for team members, PLAYER_COLORS for solos
    const entityColors: Map<string, string> = new Map();
    let soloColorIndex = 0;

    sortedEntities.forEach(entity => {
      if (entity.type === 'team') {
        const color = entity.team.color.bg;
        entityColors.set(entity.entityId, color);
        entity.team.members.forEach(m => entityColors.set(m.player_id, color));
      } else {
        const color = PLAYER_COLORS[soloColorIndex % PLAYER_COLORS.length];
        entityColors.set(entity.entityId, color);
        entityColors.set(entity.player.player_id, color);
        soloColorIndex++;
      }
    });

    // Fill in who guessed each roster player (by individual player, not entity)
    sortedEntities.forEach(entity => {
      if (entity.type === 'team') {
        // For teams, attribute each guess to the specific member who made it
        entity.team.members.forEach(member => {
          const memberGuesses = member.guessed_players || [];
          const color = entityColors.get(member.player_id) || '#888';
          const initial = member.player_name.charAt(0).toUpperCase();

          memberGuesses.forEach(guessedName => {
            const existing = breakdown.get(guessedName);
            if (existing && !existing.some(e => e.playerId === member.player_id)) {
              existing.push({ playerId: member.player_id, displayName: member.player_name, color, initial });
            }
          });
        });
      } else {
        const { player } = entity;
        const guesses = player.guessed_players || [];
        const color = entityColors.get(player.player_id) || '#888';
        const initial = player.player_name.charAt(0).toUpperCase();

        guesses.forEach(guessedName => {
          const existing = breakdown.get(guessedName);
          if (existing && !existing.some(e => e.playerId === player.player_id)) {
            existing.push({ playerId: player.player_id, displayName: player.player_name, color, initial });
          }
        });
      }
    });

    return { breakdown, entityColors };
  }, [currentRoster, sortedEntities]);

  const handlePlayAgain = async () => {
    if (!lobby || hasNavigated.current) return;

    hasNavigated.current = true;
    setIsResetting(true);

    try {
      const result = await resetLobbyForNewRound(lobby.id);
      if (result.error) {
        console.error('Failed to reset lobby:', result.error);
      }
    } catch (err) {
      console.error('Error resetting lobby:', err);
    }

    resetGame();
    navigate(`/lobby/${code}`);
  };

  const handleBackToHome = () => {
    resetLobby();
    resetGame();
    navigate('/');
  };

  if (!lobby) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d2a0b]">
        <div className="text-center">
          <p className="text-white/50 mb-4 sports-font">Table closed</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-sm retro-title tracking-wider bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860]"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (lobby.status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d2a0b]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50 sports-font tracking-widest">Shuffling deck...</p>
        </div>
      </div>
    );
  }

  if (!allPlayersFinished) {
    const finishedCount = players.filter(p => p.finished_at !== null).length;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d2a0b]">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
        />
        <div className="relative z-10 text-center space-y-6">
          <div className="w-12 h-12 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto" />
          <div>
            <h2 className="retro-title text-2xl text-[#d4af37] mb-2">Waiting for Players</h2>
            <p className="sports-font text-white/50 tracking-widest">
              {finishedCount}/{players.length} players finished
            </p>
          </div>
          <div className="space-y-2">
            {players.map(player => (
              <div
                key={player.player_id}
                className={`flex items-center justify-between px-4 py-2 rounded-sm ${
                  player.finished_at ? 'bg-emerald-900/30 border border-emerald-700/50' : 'bg-black/30 border border-white/10'
                }`}
              >
                <span className="sports-font text-sm text-white/70">{player.player_name}</span>
                <span className={`text-xs ${player.finished_at ? 'text-emerald-400' : 'text-white/30'}`}>
                  {player.finished_at ? '✓ Finished' : 'Playing...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d2a0b] text-white relative overflow-hidden">
      {/* Green felt background */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
      />

      {/* Header */}
      <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="text-center">
          <h1 className="retro-title text-4xl text-[#d4af37]">
            Final Score
          </h1>
          <p className="sports-font text-[9px] text-white/30 tracking-[0.4em] uppercase mt-1">
            {lobby.team_abbreviation} • {lobby.season}
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full p-6 space-y-6">
        {/* Winner announcement */}
        {winnerEntities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6 bg-black/50 border border-[#d4af37]/30 rounded-sm"
          >
            <div className="sports-font text-[10px] text-white/40 mb-2 tracking-[0.3em] uppercase">
              {isTie ? 'Co-Champions' : 'Champion'}
            </div>
            <div className="retro-title text-4xl text-[#d4af37]">
              {isTie
                ? winnerEntities.map(e => getEntityDisplayName(e)).join(' & ')
                : getEntityDisplayName(winnerEntities[0])}
            </div>
            <div className="retro-title text-2xl text-white mt-2">
              {winnerTotal} points
              {showBonuses && winnerBonus > 0 && (
                <span className="text-emerald-400 text-lg ml-2">(+{winnerBonus} unique)</span>
              )}
            </div>
            <div className="text-white/40 text-sm sports-font">
              {currentRoster.length > 0 ? Math.round((winnerGuessedCount / currentRoster.length) * 100) : 0}% of roster
            </div>
            {isTie && (
              <div className="text-amber-400 text-xs sports-font mt-2 tracking-wider">
                Tied with {winnerTotal} points and {winnerIncorrect} incorrect {winnerIncorrect === 1 ? 'guess' : 'guesses'}
              </div>
            )}
            {tiebreakerUsed && !isTie && (
              <div className="text-amber-400 text-xs sports-font mt-2 tracking-wider">
                Won by tiebreaker ({winnerIncorrect} incorrect {winnerIncorrect === 1 ? 'guess' : 'guesses'})
              </div>
            )}
          </motion.div>
        )}

        {/* Rankings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-black/50 border border-white/10 rounded-sm p-4"
        >
          <div className="sports-font text-[10px] text-white/40 mb-4 tracking-[0.3em] uppercase text-center">
            Final Standings
          </div>
          {showBonuses && (
            <div className="text-xs text-white/30 text-center mb-2">
              {isTeamMode ? '+1 bonus for each unique guess (teams = one)' : '+1 bonus for each unique guess'}
            </div>
          )}
          {tiebreakerUsed && (
            <div className="text-xs text-amber-400/70 text-center mb-2">
              Tiebreaker: fewer incorrect guesses wins
            </div>
          )}
          {hasDummyPlayers && (
            <div className="text-xs text-purple-400/70 text-center mb-2">
              Players with 2x have doubled points
            </div>
          )}
          <div className="space-y-2">
            {sortedEntities.map((entity, index) => {
              const isCurrent = isCurrentPlayerInEntity(entity, currentPlayerId);
              const isWinner = winnerEntities.some(w => w.entityId === entity.entityId);
              const bonus = entityBonuses.get(entity.entityId) || 0;
              const effectiveScore = getEffectiveEntityScore(entity);
              const guessedCount = getEntityGuessedCount(entity);
              const percentage = currentRoster.length > 0 ? Math.round((guessedCount / currentRoster.length) * 100) : 0;
              const incorrectCount = getEntityIncorrectGuesses(entity).length;
              const displayRank = isWinner ? 1 : index + 1;

              if (entity.type === 'team') {
                const { team } = entity;
                return (
                  <motion.div
                    key={entity.entityId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className={`p-4 rounded-sm border transition-all ${
                      isWinner
                        ? 'bg-[#d4af37]/20 border-[#d4af37]/50'
                        : isCurrent
                        ? 'bg-[#d4af37]/10 border-[#d4af37]/30'
                        : 'bg-black/30 border-white/10'
                    }`}
                    style={{
                      borderLeftWidth: '4px',
                      borderLeftColor: team.color.bg,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-sm flex items-center justify-center retro-title ${
                            isWinner
                              ? 'bg-gradient-to-b from-[#f5e6c8] to-[#d4af37] text-black'
                              : displayRank === 2
                              ? 'bg-gradient-to-b from-gray-300 to-gray-500 text-black'
                              : displayRank === 3
                              ? 'bg-gradient-to-b from-amber-600 to-amber-800 text-white'
                              : 'bg-black/50 text-white/40 border border-white/10'
                          }`}
                        >
                          {displayRank}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3.5 h-3.5 rounded-full"
                              style={{ backgroundColor: team.color.bg }}
                            />
                            <span className={`sports-font font-medium ${isCurrent ? 'text-[#d4af37]' : 'text-white/90'}`}>
                              {team.members.map(m => m.player_name).join(' & ')}
                            </span>
                          </div>
                          <div className="text-[10px] text-white/40 sports-font mt-0.5">
                            {guessedCount}/{currentRoster.length} found ({percentage}%)
                            {showBonuses && bonus > 0 && (
                              <span className="text-emerald-400 ml-2">+{bonus} unique</span>
                            )}
                            {(tiebreakerUsed || isTie) && (
                              <span className="text-amber-400/70 ml-2">• {incorrectCount} miss{incorrectCount !== 1 ? 'es' : ''}</span>
                            )}
                          </div>
                          {/* Individual member scores */}
                          <div className="flex gap-3 mt-1.5">
                            {team.members.map(member => (
                              <span key={member.player_id} className="text-[9px] text-white/30 sports-font">
                                {member.player_name}: {member.score}
                                {member.player_id === currentPlayerId && <span className="text-white/50"> (you)</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={`retro-title text-3xl ${isWinner ? 'text-[#d4af37]' : 'text-white'}`}>
                        {effectiveScore}
                      </div>
                    </div>
                  </motion.div>
                );
              }

              // Solo player entity
              const { player } = entity;
              const isCurrentPlayer = player.player_id === currentPlayerId;

              return (
                <motion.div
                  key={entity.entityId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`flex items-center justify-between p-4 rounded-sm border transition-all ${
                    isWinner
                      ? 'bg-[#d4af37]/20 border-[#d4af37]/50'
                      : isCurrentPlayer
                      ? 'bg-[#d4af37]/10 border-[#d4af37]/30'
                      : player.is_dummy
                      ? 'bg-purple-900/20 border-purple-500/30'
                      : 'bg-black/30 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-sm flex items-center justify-center retro-title ${
                        isWinner
                          ? 'bg-gradient-to-b from-[#f5e6c8] to-[#d4af37] text-black'
                          : displayRank === 2
                          ? 'bg-gradient-to-b from-gray-300 to-gray-500 text-black'
                          : displayRank === 3
                          ? 'bg-gradient-to-b from-amber-600 to-amber-800 text-white'
                          : 'bg-black/50 text-white/40 border border-white/10'
                      }`}
                    >
                      {displayRank}
                    </div>
                    <div>
                      <div className={`sports-font font-medium ${isCurrentPlayer ? 'text-[#d4af37]' : 'text-white/90'}`}>
                        {player.player_name}
                        {isCurrentPlayer && <span className="text-[10px] ml-2 text-white/40">(you)</span>}
                        {player.is_dummy && <span className="text-[10px] ml-2 text-purple-400 px-1 py-0.5 bg-purple-900/40 rounded">2x</span>}
                      </div>
                      <div className="text-[10px] text-white/40 sports-font">
                        {player.guessed_count}/{currentRoster.length} found ({percentage}%)
                        {showBonuses && bonus > 0 && (
                          <span className="text-emerald-400 ml-2">+{bonus} unique</span>
                        )}
                        {player.is_dummy && (
                          <span className="text-purple-400 ml-2">×2 = {effectiveScore}</span>
                        )}
                        {(tiebreakerUsed || isTie) && (
                          <span className="text-amber-400/70 ml-2">• {incorrectCount} miss{incorrectCount !== 1 ? 'es' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`retro-title text-3xl ${isWinner ? 'text-[#d4af37]' : 'text-white'}`}>
                    {effectiveScore}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Your position highlight */}
        {currentEntityRank > 1 && !currentIsWinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-white/50 sports-font"
          >
            You finished in <span className="text-[#d4af37] font-bold">{currentEntityRank}{getOrdinalSuffix(currentEntityRank)}</span> place!
          </motion.div>
        )}

        {/* Incorrect Guesses Comparison */}
        {sortedEntities.some(e => getEntityIncorrectGuesses(e).length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-black/50 border border-red-900/30 rounded-sm p-4"
          >
            <div className="sports-font text-[10px] text-red-400/70 mb-4 tracking-[0.3em] uppercase text-center">
              Incorrect Guesses
            </div>
            <div className="space-y-3">
              {sortedEntities.map((entity) => {
                const incorrectList = getEntityIncorrectGuesses(entity);
                if (incorrectList.length === 0) return null;
                const isCurrent = isCurrentPlayerInEntity(entity, currentPlayerId);
                const displayName = getEntityDisplayName(entity);
                const teamColor = entity.type === 'team' ? entity.team.color.bg : null;

                return (
                  <div key={entity.entityId} className="space-y-1">
                    <div className={`text-xs sports-font flex items-center gap-2 ${isCurrent ? 'text-[#d4af37]' : 'text-white/60'}`}>
                      {teamColor && (
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamColor }} />
                      )}
                      {displayName} ({incorrectList.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {incorrectList.map((guess, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-red-900/20 border border-red-900/30 rounded text-[10px] text-red-300/70"
                        >
                          {guess}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Roster Breakdown Toggle */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          onClick={() => setShowRosterBreakdown(!showRosterBreakdown)}
          className="w-full py-3 bg-black/50 border border-white/10 rounded-sm sports-font text-sm tracking-wider text-white/60 hover:text-white/90 hover:border-white/30 transition-all flex items-center justify-center gap-2"
        >
          <span>{showRosterBreakdown ? 'Hide' : 'Show'} Roster Breakdown</span>
          <svg
            className={`w-4 h-4 transition-transform ${showRosterBreakdown ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.button>

        {/* Roster Breakdown */}
        <AnimatePresence>
          {showRosterBreakdown && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-black/50 border border-white/10 rounded-sm p-4">
                {/* Player Legend */}
                <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-white/10">
                  {sortedEntities.flatMap((entity) => {
                    if (entity.type === 'team') {
                      return entity.team.members.map(member => {
                        const color = rosterBreakdown.entityColors.get(member.player_id) || '#888';
                        return (
                          <div
                            key={member.player_id}
                            className="flex items-center gap-1.5 px-2 py-1 bg-black/30 rounded-sm"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-[10px] text-white/70 sports-font">
                              {member.player_name}
                            </span>
                          </div>
                        );
                      });
                    }
                    const color = rosterBreakdown.entityColors.get(entity.player.player_id) || '#888';
                    return [(
                      <div
                        key={entity.player.player_id}
                        className="flex items-center gap-1.5 px-2 py-1 bg-black/30 rounded-sm"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[10px] text-white/70 sports-font">
                          {entity.player.player_name}
                        </span>
                      </div>
                    )];
                  })}
                </div>

                {/* Roster Grid */}
                <div className="sports-font text-[10px] text-white/40 mb-3 tracking-[0.3em] uppercase text-center">
                  Full Roster ({currentRoster.length} players)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {currentRoster.map((rosterPlayer) => {
                    const guessers = rosterBreakdown.breakdown.get(rosterPlayer.name) || [];
                    const wasGuessed = guessers.length > 0;

                    return (
                      <div
                        key={rosterPlayer.id}
                        className={`flex items-center justify-between p-2 rounded-sm border ${
                          wasGuessed
                            ? 'bg-black/30 border-white/20'
                            : 'bg-black/10 border-white/5'
                        }`}
                      >
                        <div className="truncate mr-2">
                          {rosterPlayer.position && (
                            <span className={`text-[9px] sports-font ${wasGuessed ? 'text-white/40' : 'text-white/15'}`}>
                              {rosterPlayer.position}
                              {' '}
                            </span>
                          )}
                          <span className={`text-sm ${wasGuessed ? 'text-white/90' : 'text-white/30'}`}>
                            {rosterPlayer.name}
                          </span>
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0">
                          {guessers.length > 0 ? (
                            guessers.map((guesser) => (
                              <div
                                key={guesser.playerId}
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                                style={{ backgroundColor: guesser.color }}
                                title={guesser.displayName}
                              >
                                {guesser.initial}
                              </div>
                            ))
                          ) : (
                            <span className="text-[9px] text-white/20">missed</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col gap-3"
        >
          {isHost && (
            <button
              onClick={handlePlayAgain}
              disabled={isResetting}
              className="w-full py-4 rounded-sm retro-title text-lg tracking-wider transition-all disabled:opacity-50 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1"
            >
              {isResetting ? 'Shuffling...' : 'Deal Again'}
            </button>
          )}
          {!isHost && (
            <p className="text-center text-white/30 text-sm sports-font tracking-widest">
              Waiting for dealer to start another round...
            </p>
          )}
          <button
            onClick={handleBackToHome}
            className="w-full py-3 rounded-sm sports-font tracking-wider border border-white/20 text-white/50 hover:border-[#d4af37] hover:text-[#d4af37] transition-all"
          >
            Leave Table
          </button>
        </motion.div>
      </main>
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
