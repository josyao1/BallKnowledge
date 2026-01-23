import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { useGameStore } from '../stores/gameStore';
import { fetchTeamRoster } from '../services/roster';
import { fetchSeasonPlayers } from '../services/api';
import { fetchNFLRosterFromApi, fetchNFLSeasonPlayers } from '../services/nfl-api';
import { teams } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus } from '../services/lobby';
import type { Sport } from '../types';

export function LobbyWaitingPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const {
    lobby,
    players,
    isHost,
    currentPlayerId,
    setLobby,
    setPlayers,
    leaveLobby,
    setReady,
    startGame,
  } = useLobbyStore();
  const setGameConfig = useGameStore((state) => state.setGameConfig);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isLoadingLobby, setIsLoadingLobby] = useState(true);
  const [copied, setCopied] = useState(false);
  const hasStartedGame = useRef(false);
  const hasAutoStarted = useRef(false);

  // Subscribe to realtime updates
  useLobbySubscription(lobby?.id || null);

  // Always load/refresh lobby data when entering this page
  useEffect(() => {
    const loadLobby = async () => {
      if (!code) {
        navigate('/');
        return;
      }

      setIsLoadingLobby(true);
      // Reset game start flags when entering lobby
      hasStartedGame.current = false;
      hasAutoStarted.current = false;

      // Always fetch fresh lobby data
      const result = await findLobbyByCode(code);
      if (result.lobby) {
        setLobby(result.lobby);
        const playersResult = await getLobbyPlayers(result.lobby.id);
        if (playersResult.players) {
          setPlayers(playersResult.players);
        }
        // Reset countdown if lobby is in waiting state (e.g., after Play Again)
        if (result.lobby.status === 'waiting') {
          setCountdown(null);
        }
      } else {
        navigate('/lobby/join');
      }
      setIsLoadingLobby(false);
    };

    loadLobby();
  }, [code, navigate, setLobby, setPlayers]);

  // Handle lobby status changes
  useEffect(() => {
    if (!lobby) return;

    if (lobby.status === 'waiting') {
      // Reset all flags when lobby goes back to waiting
      setCountdown(null);
      hasStartedGame.current = false;
      hasAutoStarted.current = false;
    } else if (lobby.status === 'countdown') {
      setCountdown(3);
    } else if (lobby.status === 'playing') {
      // Load roster and navigate to game (only once)
      if (!hasStartedGame.current) {
        hasStartedGame.current = true;
        loadRosterAndStart();
      }
    } else if (lobby.status === 'finished') {
      navigate(`/lobby/${code}/results`);
    }
  }, [lobby?.status]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      // Countdown finished - host triggers the game start
      if (isHost && lobby) {
        updateLobbyStatus(lobby.id, 'playing');
      }
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isHost, lobby]);

  // Cancel countdown if someone unreadies during countdown
  useEffect(() => {
    const allReady = players.length > 1 && players.every((p) => p.is_ready);

    // If countdown is active but not everyone is ready, cancel it
    if (lobby?.status === 'countdown' && !allReady && isHost) {
      updateLobbyStatus(lobby.id, 'waiting');
      hasAutoStarted.current = false;
    }
  }, [players, lobby?.status, isHost]);

  // Manual start handler for host backup button
  const handleManualStart = async () => {
    if (!isHost || !lobby) return;
    hasAutoStarted.current = true;
    await startGame();
  };

  const loadRosterAndStart = async () => {
    if (!lobby) return;
    setIsLoadingRoster(true);

    try {
      const sport = lobby.sport as Sport;
      const teamList = sport === 'nba' ? teams : nflTeams;
      const team = teamList.find((t) => t.abbreviation === lobby.team_abbreviation);

      if (!team) {
        console.error('Team not found');
        return;
      }

      let players: { id: number | string; name: string; position?: string; number?: string; ppg?: number; isLowScorer?: boolean; unit?: string }[] = [];
      let leaguePlayers: { id: number | string; name: string }[] = [];

      if (sport === 'nba') {
        const result = await fetchTeamRoster(team.abbreviation, lobby.season);
        players = result.players;

        const leagueResult = await fetchSeasonPlayers(lobby.season);
        if (leagueResult?.players) {
          leaguePlayers = leagueResult.players;
        }
      } else {
        const year = parseInt(lobby.season);
        const result = await fetchNFLRosterFromApi(team.abbreviation, year);
        if (result?.players) {
          players = result.players;
        }

        const leagueResult = await fetchNFLSeasonPlayers(year);
        if (leagueResult?.players) {
          leaguePlayers = leagueResult.players;
        }
      }

      // Configure game with multiplayer flag
      setGameConfig(sport, team, lobby.season, 'manual', lobby.timer_duration, players, leaguePlayers, false);

      // Navigate to game
      navigate('/game', { state: { multiplayer: true, lobbyId: lobby.id } });
    } catch (error) {
      console.error('Error loading roster:', error);
    } finally {
      setIsLoadingRoster(false);
    }
  };

  const handleCopyCode = () => {
    if (lobby?.join_code) {
      navigator.clipboard.writeText(lobby.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeave = async () => {
    await leaveLobby();
    navigate('/');
  };

  const currentPlayer = players.find((p) => p.player_id === currentPlayerId);
  const allReady = players.length > 1 && players.every((p) => p.is_ready);
  const sport = (lobby?.sport as Sport) || 'nba';
  const accentColor = sport === 'nba' ? 'var(--nba-orange)' : '#013369';

  if (!lobby || isLoadingLobby) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#888]">Loading lobby...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Countdown overlay */}
      <AnimatePresence>
        {countdown !== null && countdown > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-9xl font-bold"
              style={{ color: accentColor }}
            >
              {countdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-6 border-b-4 border-[#333]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLeave}
              className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="retro-title text-2xl" style={{ color: accentColor }}>
              Lobby
            </h1>
          </div>

          {/* Join code */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] rounded-lg border-2 border-[#3d3d3d] hover:border-[#555] transition-colors"
          >
            <span className="font-mono text-xl tracking-widest" style={{ color: accentColor }}>
              {lobby.join_code}
            </span>
            <svg className="w-5 h-5 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied && <span className="text-green-400 text-sm">Copied!</span>}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-6">
        {/* Game info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="scoreboard-panel p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="sports-font text-sm text-[#888] tracking-widest">
                {sport.toUpperCase()} Roster Trivia
              </div>
              {lobby.game_mode === 'random' ? (
                <div className="text-xl font-bold" style={{ color: accentColor }}>
                  Mystery Team
                </div>
              ) : (
                <div className="text-xl font-bold" style={{ color: accentColor }}>
                  {lobby.team_abbreviation} - {lobby.season}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="sports-font text-sm text-[#888] tracking-widest">Timer</div>
              <div className="scoreboard-number text-2xl">
                {Math.floor(lobby.timer_duration / 60)}:{String(lobby.timer_duration % 60).padStart(2, '0')}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Players list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="scoreboard-panel p-4"
        >
          <div className="sports-font text-sm text-[#888] mb-4 tracking-widest">
            Players ({players.length}/{lobby.max_players})
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {players.map((player, index) => (
                <motion.div
                  key={player.player_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                    player.player_id === currentPlayerId
                      ? 'border-[var(--nba-gold)] bg-[var(--nba-gold)]/10'
                      : 'border-[#3d3d3d] bg-[#1a1a1a]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {player.is_host && (
                      <span className="text-yellow-500" title="Host">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </span>
                    )}
                    <span className="font-medium">{player.player_name}</span>
                    {player.player_id === currentPlayerId && (
                      <span className="text-xs text-[#888]">(you)</span>
                    )}
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      player.is_ready
                        ? 'bg-green-900/40 text-green-400'
                        : 'bg-[#333] text-[#888]'
                    }`}
                  >
                    {player.is_ready ? 'Ready' : 'Not Ready'}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {/* Ready toggle */}
          {currentPlayer && (
            <button
              onClick={() => setReady(!currentPlayer.is_ready)}
              disabled={isLoadingRoster || lobby.status === 'countdown'}
              className={`w-full py-4 rounded-lg sports-font text-lg tracking-wider transition-all disabled:opacity-50 ${
                currentPlayer.is_ready
                  ? 'bg-green-600 text-white'
                  : 'bg-[#333] text-[#888] border-2 border-[#3d3d3d]'
              }`}
            >
              {isLoadingRoster ? 'Starting...' : currentPlayer.is_ready ? 'Ready!' : 'Click when Ready'}
            </button>
          )}

          {/* Host backup start button - appears when all ready */}
          {isHost && allReady && lobby.status === 'waiting' && (
            <button
              onClick={handleManualStart}
              disabled={isLoadingRoster}
              className="w-full py-4 rounded-lg sports-font text-lg tracking-wider transition-all text-white"
              style={{ backgroundColor: accentColor }}
            >
              Start Game
            </button>
          )}

          {/* Status messages */}
          {players.length < 2 && (
            <p className="text-center text-[#666] text-sm">
              Share the code above to invite players
            </p>
          )}
          {players.length >= 2 && !allReady && (
            <p className="text-center text-[#666] text-sm">
              Waiting for all players to be ready...
            </p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
