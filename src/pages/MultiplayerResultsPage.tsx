import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useGameStore } from '../stores/gameStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { resetLobbyForNewRound, findLobbyByCode, getLobbyPlayers, updateLobbyStatus, incrementPlayerWins } from '../services/lobby';

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
          // Also fetch players
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

  // Detect broken state: on results page but 0 players finished - redirect to lobby
  useEffect(() => {
    if (!code || players.length === 0) return;

    const finishedCount = players.filter(p => p.finished_at !== null).length;

    // If we have players but none are finished, this is a broken state
    // Wait a moment to make sure it's not just loading, then redirect
    if (finishedCount === 0) {
      const brokenStateTimeout = setTimeout(() => {
        // Re-check in case data updated
        const currentFinished = players.filter(p => p.finished_at !== null).length;
        if (currentFinished === 0 && !hasNavigated.current) {
          console.warn('Broken state detected: 0 players finished on results page, redirecting to lobby');
          hasNavigated.current = true;
          resetGame();
          navigate(`/lobby/${code}`);
        }
      }, 3000); // Give 3 seconds for data to potentially update

      return () => clearTimeout(brokenStateTimeout);
    }
  }, [players, code, navigate, resetGame]);

  // Fetch fresh player data on mount and poll until all have finished
  useEffect(() => {
    if (!lobby?.id) return;

    const fetchPlayers = async () => {
      const result = await getLobbyPlayers(lobby.id);
      if (result.players) {
        setPlayers(result.players);

        // Check if all players are finished and update lobby status if needed
        const allFinished = result.players.every(p => p.finished_at !== null);
        if (allFinished && lobby.status !== 'finished') {
          await updateLobbyStatus(lobby.id, 'finished');
        }
      }
    };

    // Initial fetch
    fetchPlayers();

    // Poll every 2 seconds until all players have finished
    const pollInterval = setInterval(fetchPlayers, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [lobby?.id, lobby?.status, setPlayers]);

  // Navigate back to lobby when status changes to 'waiting'
  const navigateToLobby = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    resetGame();
    navigate(`/lobby/${code}`);
  }, [code, navigate, resetGame]);

  // Watch for lobby status change back to 'waiting' (host clicked Play Again)
  useEffect(() => {
    if (lobby?.status === 'waiting') {
      navigateToLobby();
    }
  }, [lobby?.status, navigateToLobby]);

  // Polling fallback for non-host players in case realtime misses the update
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
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [isHost, code, setLobby, navigateToLobby]);

  // Calculate uniqueness bonus for each player (only when 3+ players)
  const playerBonuses = useMemo(() => {
    const bonuses: Record<string, number> = {};

    if (players.length < 3) {
      players.forEach(p => { bonuses[p.player_id] = 0; });
      return bonuses;
    }

    // Build a map of roster player name -> count of who guessed them
    const guessCount: Record<string, number> = {};
    players.forEach(player => {
      const guessedPlayers = player.guessed_players || [];
      guessedPlayers.forEach(name => {
        guessCount[name] = (guessCount[name] || 0) + 1;
      });
    });

    // For each player, count unique guesses
    players.forEach(player => {
      const guessedPlayers = player.guessed_players || [];
      const uniqueGuesses = guessedPlayers.filter(name => guessCount[name] === 1);
      bonuses[player.player_id] = uniqueGuesses.length;
    });

    return bonuses;
  }, [players]);

  const showBonuses = players.length >= 3;

  // Sort players by total score (base + bonus), with incorrect guesses as tiebreaker
  const { sortedPlayers, tiebreakerUsed } = useMemo(() => {
    let tiebreaker = false;
    const sorted = [...players].sort((a, b) => {
      const totalA = a.score + (playerBonuses[a.player_id] || 0);
      const totalB = b.score + (playerBonuses[b.player_id] || 0);

      // If scores are equal, use incorrect guesses as tiebreaker (fewer is better)
      if (totalA === totalB) {
        const incorrectA = (a.incorrect_guesses || []).length;
        const incorrectB = (b.incorrect_guesses || []).length;
        if (incorrectA !== incorrectB) {
          tiebreaker = true;
          return incorrectA - incorrectB; // Fewer incorrect guesses wins
        }
      }
      return totalB - totalA;
    });
    return { sortedPlayers: sorted, tiebreakerUsed: tiebreaker };
  }, [players, playerBonuses]);

  const currentPlayerRank = sortedPlayers.findIndex((p) => p.player_id === currentPlayerId) + 1;
  const winner = sortedPlayers[0];
  const winnerBonus = winner ? (playerBonuses[winner.player_id] || 0) : 0;
  const winnerTotal = winner ? winner.score + winnerBonus : 0;
  const winnerIncorrect = winner ? (winner.incorrect_guesses || []).length : 0;

  // Find all players tied for first place
  const tiedWinners = useMemo(() => {
    if (sortedPlayers.length === 0) return [];
    const first = sortedPlayers[0];
    const firstTotal = first.score + (playerBonuses[first.player_id] || 0);
    const firstIncorrect = (first.incorrect_guesses || []).length;

    // Find all players with the same score AND same incorrect guesses as first place
    return sortedPlayers.filter(p => {
      const total = p.score + (playerBonuses[p.player_id] || 0);
      const incorrect = (p.incorrect_guesses || []).length;
      return total === firstTotal && incorrect === firstIncorrect;
    });
  }, [sortedPlayers, playerBonuses]);

  const isTrueTie = tiedWinners.length > 1;

  // Increment wins for all tied winners (host only, once per game)
  useEffect(() => {
    if (!isHost || !allPlayersFinished || !lobby || hasIncrementedWins.current) return;
    if (tiedWinners.length === 0) return;

    hasIncrementedWins.current = true;
    // Give a win to all tied players
    tiedWinners.forEach(player => {
      incrementPlayerWins(lobby.id, player.player_id);
    });
  }, [isHost, allPlayersFinished, lobby, tiedWinners]);

  // Build roster breakdown - which players each participant guessed
  const rosterBreakdown = useMemo(() => {
    // Create a map of roster player name -> array of participants who guessed them
    const breakdown: Map<string, { playerId: string; playerName: string; color: string }[]> = new Map();

    // Initialize with all roster players
    currentRoster.forEach(rosterPlayer => {
      breakdown.set(rosterPlayer.name, []);
    });

    // Assign colors to each participant
    const playerColors: Map<string, string> = new Map();
    sortedPlayers.forEach((player, index) => {
      playerColors.set(player.player_id, PLAYER_COLORS[index % PLAYER_COLORS.length]);
    });

    // Fill in who guessed each player
    players.forEach(participant => {
      const color = playerColors.get(participant.player_id) || '#888';
      const guessedPlayers = participant.guessed_players || [];

      guessedPlayers.forEach(guessedName => {
        const existing = breakdown.get(guessedName);
        if (existing) {
          existing.push({
            playerId: participant.player_id,
            playerName: participant.player_name,
            color
          });
        }
      });
    });

    return {
      breakdown,
      playerColors
    };
  }, [currentRoster, players, sortedPlayers]);

  const handlePlayAgain = async () => {
    if (!lobby || hasNavigated.current) return;

    // Set flag immediately to prevent race condition with realtime subscription
    hasNavigated.current = true;
    setIsResetting(true);

    try {
      // Reset lobby status and player scores
      const result = await resetLobbyForNewRound(lobby.id);
      if (result.error) {
        console.error('Failed to reset lobby:', result.error);
      }
    } catch (err) {
      console.error('Error resetting lobby:', err);
    }

    // Always navigate regardless of reset success - the lobby page will fetch fresh data
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

  // Show waiting screen if not all players have finished
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
        {/* Winner announcement or Tie */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6 bg-black/50 border border-[#d4af37]/30 rounded-sm"
          >
            {isTrueTie ? (
              <>
                <div className="sports-font text-[10px] text-white/40 mb-2 tracking-[0.3em] uppercase">Result</div>
                <div className="retro-title text-4xl text-[#d4af37]">
                  It's a Tie!
                </div>
                <div className="retro-title text-2xl text-white mt-2">
                  {winnerTotal} points each
                </div>
                <div className="text-emerald-400 text-sm sports-font mt-1">
                  {tiedWinners.length} players share the win
                </div>
              </>
            ) : (
              <>
                <div className="sports-font text-[10px] text-white/40 mb-2 tracking-[0.3em] uppercase">Champion</div>
                <div className="retro-title text-4xl text-[#d4af37]">
                  {winner.player_name}
                </div>
                <div className="retro-title text-2xl text-white mt-2">
                  {winnerTotal} points
                  {showBonuses && winnerBonus > 0 && (
                    <span className="text-emerald-400 text-lg ml-2">(+{winnerBonus} unique)</span>
                  )}
                </div>
                <div className="text-white/40 text-sm sports-font">
                  {currentRoster.length > 0 ? Math.round((winner.guessed_count / currentRoster.length) * 100) : 0}% of roster
                </div>
                {tiebreakerUsed && (
                  <div className="text-amber-400 text-xs sports-font mt-2 tracking-wider">
                    Won by tiebreaker ({winnerIncorrect} incorrect {winnerIncorrect === 1 ? 'guess' : 'guesses'})
                  </div>
                )}
              </>
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
              +1 bonus for each unique guess
            </div>
          )}
          {tiebreakerUsed && (
            <div className="text-xs text-amber-400/70 text-center mb-2">
              Tiebreaker: fewer incorrect guesses wins
            </div>
          )}
          <div className="space-y-2">
            {sortedPlayers.map((player, index) => {
              const isCurrentPlayer = player.player_id === currentPlayerId;
              const percentage = currentRoster.length > 0 ? Math.round((player.guessed_count / currentRoster.length) * 100) : 0;
              const bonus = playerBonuses[player.player_id] || 0;
              const totalScore = player.score + bonus;
              const incorrectCount = (player.incorrect_guesses || []).length;

              return (
                <motion.div
                  key={player.player_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`flex items-center justify-between p-4 rounded-sm border transition-all ${
                    index === 0
                      ? 'bg-[#d4af37]/20 border-[#d4af37]/50'
                      : isCurrentPlayer
                      ? 'bg-[#d4af37]/10 border-[#d4af37]/30'
                      : 'bg-black/30 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-sm flex items-center justify-center retro-title ${
                        index === 0
                          ? 'bg-gradient-to-b from-[#f5e6c8] to-[#d4af37] text-black'
                          : index === 1
                          ? 'bg-gradient-to-b from-gray-300 to-gray-500 text-black'
                          : index === 2
                          ? 'bg-gradient-to-b from-amber-600 to-amber-800 text-white'
                          : 'bg-black/50 text-white/40 border border-white/10'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div className={`sports-font font-medium ${isCurrentPlayer ? 'text-[#d4af37]' : 'text-white/90'}`}>
                        {player.player_name}
                        {isCurrentPlayer && <span className="text-[10px] ml-2 text-white/40">(you)</span>}
                      </div>
                      <div className="text-[10px] text-white/40 sports-font">
                        {player.guessed_count}/{currentRoster.length} found ({percentage}%)
                        {showBonuses && bonus > 0 && (
                          <span className="text-emerald-400 ml-2">+{bonus} unique</span>
                        )}
                        {tiebreakerUsed && (
                          <span className="text-amber-400/70 ml-2">• {incorrectCount} miss{incorrectCount !== 1 ? 'es' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`retro-title text-3xl ${index === 0 ? 'text-[#d4af37]' : 'text-white'}`}>
                    {totalScore}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Your position highlight */}
        {currentPlayerRank > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-white/50 sports-font"
          >
            You finished in <span className="text-[#d4af37] font-bold">{currentPlayerRank}{getOrdinalSuffix(currentPlayerRank)}</span> place!
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
                  {sortedPlayers.map((player) => (
                    <div
                      key={player.player_id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-black/30 rounded-sm"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: rosterBreakdown.playerColors.get(player.player_id) || '#888' }}
                      />
                      <span className="text-[10px] text-white/70 sports-font">
                        {player.player_name}
                      </span>
                    </div>
                  ))}
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
                        <span className={`text-sm truncate mr-2 ${wasGuessed ? 'text-white/90' : 'text-white/30'}`}>
                          {rosterPlayer.name}
                        </span>
                        <div className="flex gap-0.5 flex-shrink-0">
                          {guessers.length > 0 ? (
                            guessers.map((guesser, idx) => (
                              <div
                                key={`${guesser.playerId}-${idx}`}
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                                style={{ backgroundColor: guesser.color }}
                                title={guesser.playerName}
                              >
                                {guesser.playerName.charAt(0).toUpperCase()}
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
