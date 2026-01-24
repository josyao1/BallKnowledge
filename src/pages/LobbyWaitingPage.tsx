import { useEffect, useState, useRef, useCallback } from 'react';
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
import { RouletteOverlay } from '../components/home/RouletteOverlay';
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

  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isLoadingLobby, setIsLoadingLobby] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showDealingAnimation, setShowDealingAnimation] = useState(false);
  const hasStartedGame = useRef(false);
  const hasAutoStarted = useRef(false);

  useLobbySubscription(lobby?.id || null);

  useEffect(() => {
    const loadLobby = async () => {
      if (!code) {
        navigate('/');
        return;
      }

      setIsLoadingLobby(true);
      hasStartedGame.current = false;
      hasAutoStarted.current = false;

      const result = await findLobbyByCode(code);
      if (result.lobby) {
        setLobby(result.lobby);
        const playersResult = await getLobbyPlayers(result.lobby.id);
        if (playersResult.players) {
          setPlayers(playersResult.players);
        }
        if (result.lobby.status === 'waiting') {
          setShowDealingAnimation(false);
        }
      } else {
        navigate('/lobby/join');
      }
      setIsLoadingLobby(false);
    };

    loadLobby();
  }, [code, navigate, setLobby, setPlayers]);

  useEffect(() => {
    if (!lobby) return;

    if (lobby.status === 'waiting') {
      setShowDealingAnimation(false);
      hasStartedGame.current = false;
      hasAutoStarted.current = false;
    } else if (lobby.status === 'countdown') {
      // Show the dealing animation instead of simple countdown
      setShowDealingAnimation(true);
    } else if (lobby.status === 'playing') {
      // If animation isn't showing yet, show it now
      if (!showDealingAnimation && !hasStartedGame.current) {
        setShowDealingAnimation(true);
      }
    } else if (lobby.status === 'finished') {
      navigate(`/lobby/${code}/results`);
    }
  }, [lobby?.status, showDealingAnimation]);

  // Handle dealing animation complete
  const handleDealingComplete = useCallback(async () => {
    if (hasStartedGame.current) return;
    hasStartedGame.current = true;

    // Host updates status to playing if not already
    if (isHost && lobby && lobby.status === 'countdown') {
      await updateLobbyStatus(lobby.id, 'playing');
    }

    // Load roster and start game
    await loadRosterAndStart();
  }, [isHost, lobby]);

  useEffect(() => {
    const allReady = players.length > 1 && players.every((p) => p.is_ready);

    if (lobby?.status === 'countdown' && !allReady && isHost) {
      updateLobbyStatus(lobby.id, 'waiting');
      hasAutoStarted.current = false;
    }
  }, [players, lobby?.status, isHost]);

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

      let rosterPlayers: { id: number | string; name: string; position?: string; number?: string; ppg?: number; isLowScorer?: boolean; unit?: string }[] = [];
      let leaguePlayers: { id: number | string; name: string }[] = [];

      if (sport === 'nba') {
        const result = await fetchTeamRoster(team.abbreviation, lobby.season);
        rosterPlayers = result.players;

        const leagueResult = await fetchSeasonPlayers(lobby.season);
        if (leagueResult?.players) {
          leaguePlayers = leagueResult.players;
        }
      } else {
        const year = parseInt(lobby.season);
        const result = await fetchNFLRosterFromApi(team.abbreviation, year);
        if (result?.players) {
          rosterPlayers = result.players;
        }

        const leagueResult = await fetchNFLSeasonPlayers(year);
        if (leagueResult?.players) {
          leaguePlayers = leagueResult.players;
        }
      }

      setGameConfig(sport, team, lobby.season, 'manual', lobby.timer_duration, rosterPlayers, leaguePlayers, false);
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

  // Get team info for the dealing animation
  const sport = (lobby?.sport as Sport) || 'nba';
  const teamList = sport === 'nba' ? teams : nflTeams;
  const team = lobby ? teamList.find((t) => t.abbreviation === lobby.team_abbreviation) : null;

  if (!lobby || isLoadingLobby) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d2a0b]">
        <div className="text-white/50 sports-font">Loading table...</div>
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

      {/* Card dealing animation overlay */}
      {showDealingAnimation && lobby && team && (
        <div className="fixed inset-0 z-50">
          <RouletteOverlay
            winningTeam={team.name}
            winningYear={lobby.season}
            sport={sport}
            winningTeamData={team}
            onComplete={handleDealingComplete}
          />
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLeave}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="retro-title text-2xl text-[#d4af37]">Private Table</h1>
              <p className="sports-font text-[9px] text-white/30 tracking-[0.4em] uppercase">Waiting for Players</p>
            </div>
          </div>

          {/* Join code */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 px-4 py-2 bg-black/50 rounded-sm border border-white/20 hover:border-[#d4af37] transition-colors"
          >
            <span className="font-mono text-xl tracking-widest text-[#d4af37]">
              {lobby.join_code}
            </span>
            <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied && <span className="text-emerald-400 text-sm sports-font">Copied!</span>}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full p-6 space-y-6">
        {/* Game info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/50 border border-white/10 rounded-sm p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                {lobby.sport.toUpperCase()} Roster Challenge
              </div>
              {lobby.game_mode === 'random' ? (
                <div className="retro-title text-xl text-[#d4af37]">Mystery Deck</div>
              ) : (
                <div className="retro-title text-xl text-[#d4af37]">
                  {lobby.team_abbreviation} • {lobby.season}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">Timer</div>
              <div className="retro-title text-2xl text-white">
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
          className="bg-black/50 border border-white/10 rounded-sm p-4"
        >
          <div className="sports-font text-[10px] text-white/40 mb-4 tracking-[0.3em] uppercase">
            Seats ({players.length}/{lobby.max_players})
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
                  className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
                    player.player_id === currentPlayerId
                      ? 'border-[#d4af37]/50 bg-[#d4af37]/10'
                      : 'border-white/10 bg-black/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {player.is_host && (
                      <span className="text-[#d4af37]" title="Host">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </span>
                    )}
                    <span className="font-medium text-white/90 sports-font">{player.player_name}</span>
                    {player.player_id === currentPlayerId && (
                      <span className="text-[10px] text-white/40 sports-font">(you)</span>
                    )}
                  </div>
                  <div
                    className={`px-3 py-1 rounded-sm text-[10px] font-bold sports-font uppercase tracking-wider ${
                      player.is_ready
                        ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700'
                        : 'bg-black/40 text-white/40 border border-white/10'
                    }`}
                  >
                    {player.is_ready ? 'Ready' : 'Waiting'}
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
              className={`w-full py-4 rounded-sm retro-title text-lg tracking-wider transition-all disabled:opacity-50 ${
                currentPlayer.is_ready
                  ? 'bg-emerald-600 text-white shadow-[0_4px_0_#166534]'
                  : 'bg-black/50 text-white/50 border border-white/20 hover:border-[#d4af37]'
              }`}
            >
              {isLoadingRoster ? 'Starting...' : currentPlayer.is_ready ? 'Ready!' : 'Click When Ready'}
            </button>
          )}

          {/* Host start button */}
          {isHost && allReady && lobby.status === 'waiting' && (
            <button
              onClick={handleManualStart}
              disabled={isLoadingRoster}
              className="w-full py-4 rounded-sm retro-title text-lg tracking-wider transition-all bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1"
            >
              Deal Cards
            </button>
          )}

          {/* Status messages */}
          {players.length < 2 && (
            <p className="text-center text-white/30 text-sm sports-font tracking-widest">
              Share the code above to invite players
            </p>
          )}
          {players.length >= 2 && !allReady && (
            <p className="text-center text-white/30 text-sm sports-font tracking-widest">
              Waiting for all players to be ready...
            </p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
