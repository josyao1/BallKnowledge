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
import { TeamSelector } from '../components/home/TeamSelector';
import { YearSelector } from '../components/home/YearSelector';
import type { Sport } from '../types';

type GenericTeam = {
  id: number;
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
};

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
    updateSettings,
  } = useLobbyStore();
  const setGameConfig = useGameStore((state) => state.setGameConfig);

  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isLoadingLobby, setIsLoadingLobby] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showDealingAnimation, setShowDealingAnimation] = useState(false);
  const hasStartedGame = useRef(false);
  const hasAutoStarted = useRef(false);

  // Host settings state
  const [showSettings, setShowSettings] = useState(false);
  const [editSport, setEditSport] = useState<Sport>('nba');
  const [editGameMode, setEditGameMode] = useState<'random' | 'manual'>('manual');
  const [editTeam, setEditTeam] = useState<GenericTeam | null>(null);
  const [editYear, setEditYear] = useState<number | null>(null);
  const [editTimer, setEditTimer] = useState(90);
  const [editMinYear, setEditMinYear] = useState(2015);
  const [editMaxYear, setEditMaxYear] = useState(2024);

  useLobbySubscription(lobby?.id || null);

  // Stuck detection - auto-reload if lobby doesn't load within 8 seconds
  useEffect(() => {
    if (!isLoadingLobby && lobby) return; // Already loaded, no need for timeout

    const stuckTimeout = setTimeout(() => {
      if (isLoadingLobby || !lobby) {
        console.warn('Lobby stuck in loading state, reloading page...');
        window.location.reload();
      }
    }, 8000);

    return () => clearTimeout(stuckTimeout);
  }, [isLoadingLobby, lobby]);

  // Sync edit state with lobby when it changes
  useEffect(() => {
    if (lobby) {
      const lobbySport = lobby.sport as Sport;
      setEditSport(lobbySport);
      setEditGameMode(lobby.game_mode as 'random' | 'manual');
      setEditTimer(lobby.timer_duration);
      setEditMinYear(lobby.min_year || (lobbySport === 'nfl' ? 2000 : 2015));
      setEditMaxYear(lobby.max_year || 2024);

      // Find team from the current lobby
      const teamList = lobbySport === 'nba' ? teams : nflTeams;
      const foundTeam = teamList.find(t => t.abbreviation === lobby.team_abbreviation);
      setEditTeam(foundTeam || null);

      // Parse year from season
      const yearMatch = lobby.season.match(/^(\d{4})/);
      if (yearMatch) {
        setEditYear(parseInt(yearMatch[1]));
      }
    }
  }, [lobby?.id, lobby?.sport, lobby?.game_mode, lobby?.timer_duration, lobby?.team_abbreviation, lobby?.season, lobby?.min_year, lobby?.max_year]);

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

  // Handle dealing animation complete
  const handleDealingComplete = useCallback(async () => {
    if (hasStartedGame.current) return;
    hasStartedGame.current = true;

    // Host updates status to playing if not already
    if (isHost && lobby && lobby.status === 'countdown') {
      await updateLobbyStatus(lobby.id, 'playing');
    }

    // Load roster and start game - fetch fresh lobby data to ensure we have latest settings
    if (!lobby) return;
    setIsLoadingRoster(true);

    try {
      // Fetch fresh lobby data to get the latest settings
      const freshLobbyResult = await findLobbyByCode(lobby.join_code);
      const freshLobby = freshLobbyResult.lobby || lobby;

      const lobbySport = freshLobby.sport as Sport;
      const lobbyTeamList = lobbySport === 'nba' ? teams : nflTeams;
      const lobbyTeam = lobbyTeamList.find((t) => t.abbreviation === freshLobby.team_abbreviation);

      if (!lobbyTeam) {
        console.error('Team not found:', freshLobby.team_abbreviation);
        setIsLoadingRoster(false);
        return;
      }

      let rosterPlayers: { id: number | string; name: string; position?: string; number?: string; ppg?: number; isLowScorer?: boolean; unit?: string }[] = [];
      let leaguePlayers: { id: number | string; name: string }[] = [];

      if (lobbySport === 'nba') {
        const result = await fetchTeamRoster(lobbyTeam.abbreviation, freshLobby.season);
        rosterPlayers = result.players;

        const leagueResult = await fetchSeasonPlayers(freshLobby.season);
        if (leagueResult?.players) {
          leaguePlayers = leagueResult.players;
        }
      } else {
        const year = parseInt(freshLobby.season);
        const result = await fetchNFLRosterFromApi(lobbyTeam.abbreviation, year);
        if (result?.players) {
          rosterPlayers = result.players;
        }

        const leagueResult = await fetchNFLSeasonPlayers(year);
        if (leagueResult?.players) {
          leaguePlayers = leagueResult.players;
        }
      }

      setGameConfig(lobbySport, lobbyTeam, freshLobby.season, 'manual', freshLobby.timer_duration, rosterPlayers, leaguePlayers, false);
      navigate('/game', { state: { multiplayer: true, lobbyId: freshLobby.id } });
    } catch (error) {
      console.error('Error loading roster:', error);
    } finally {
      setIsLoadingRoster(false);
    }
  }, [isHost, lobby, navigate, setGameConfig]);

  // Watch lobby status changes
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
      // If status is 'playing' and we haven't started the game yet,
      // the host must have skipped - immediately complete for all players
      if (!hasStartedGame.current) {
        setShowDealingAnimation(true);
        // Trigger game start for non-host players (host already triggered via skip)
        if (!isHost) {
          handleDealingComplete();
        }
      }
    } else if (lobby.status === 'finished') {
      navigate(`/lobby/${code}/results`);
    }
  }, [lobby?.status, showDealingAnimation, isHost, handleDealingComplete, lobby, navigate, code]);

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

  const handleCopyCode = () => {
    if (lobby?.join_code) {
      navigator.clipboard.writeText(lobby.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Apply settings changes (host only)
  const handleApplySettings = async () => {
    if (!isHost || !lobby) return;

    // Get the appropriate team list for the selected sport
    const newTeamList = editSport === 'nba' ? teams : nflTeams;

    // Determine team abbreviation
    let newTeamAbbreviation: string;
    let newSeason: string;

    if (editGameMode === 'manual' && editTeam) {
      // Manual mode with team selected
      newTeamAbbreviation = editTeam.abbreviation;
      newSeason = editSport === 'nba' && editYear
        ? `${editYear}-${String(editYear + 1).slice(-2)}`
        : editYear ? `${editYear}` : lobby.season;
    } else {
      // Random mode OR manual mode without team - pick a random team for the new sport
      const randomTeam = newTeamList[Math.floor(Math.random() * newTeamList.length)];
      newTeamAbbreviation = randomTeam.abbreviation;

      // Pick a random year within the range
      const minYear = editSport === 'nfl' ? Math.max(editMinYear, 2000) : editMinYear;
      const maxYear = editSport === 'nfl' ? Math.min(editMaxYear, 2024) : editMaxYear;
      const randomYear = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;

      newSeason = editSport === 'nba'
        ? `${randomYear}-${String(randomYear + 1).slice(-2)}`
        : `${randomYear}`;
    }

    await updateSettings({
      sport: editSport,
      teamAbbreviation: newTeamAbbreviation,
      season: newSeason,
      timerDuration: editTimer,
      gameMode: editGameMode,
      minYear: editMinYear,
      maxYear: editMaxYear,
    });

    setShowSettings(false);
  };

  // Handle sport change in settings
  const handleEditSportChange = (newSport: Sport) => {
    setEditSport(newSport);
    setEditTeam(null);
    setEditYear(null);
    if (newSport === 'nfl') {
      setEditMinYear(Math.max(editMinYear, 2000));
      setEditMaxYear(Math.min(editMaxYear, 2024));
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
  let team = lobby ? teamList.find((t) => t.abbreviation === lobby.team_abbreviation) : null;

  // Fallback: if team not found (e.g., sport changed but team_abbreviation hasn't synced yet),
  // try to find the team in both lists or use a default
  if (!team && lobby) {
    // Try the other sport's team list
    const otherTeamList = sport === 'nba' ? nflTeams : teams;
    team = otherTeamList.find((t) => t.abbreviation === lobby.team_abbreviation);

    // If still not found, use first team from current sport as fallback
    if (!team) {
      team = teamList[0];
    }
  }

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
            canSkip={isHost}
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
                <div>
                  <div className="retro-title text-xl text-[#d4af37]">Mystery Deck</div>
                  <div className="sports-font text-[9px] text-white/40 tracking-widest">
                    {lobby.min_year || (lobby.sport === 'nfl' ? 2000 : 2015)} - {lobby.max_year || 2024}
                  </div>
                </div>
              ) : (
                <div className="retro-title text-xl text-[#d4af37]">
                  {lobby.team_abbreviation} • {lobby.season}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">Timer</div>
                <div className="retro-title text-2xl text-white">
                  {Math.floor(lobby.timer_duration / 60)}:{String(lobby.timer_duration % 60).padStart(2, '0')}
                </div>
              </div>
              {isHost && lobby.status === 'waiting' && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 border border-white/20 rounded-sm hover:border-[#d4af37] hover:text-[#d4af37] transition-colors"
                  title="Change Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Session Wins Scoreboard */}
        {players.some(p => (p.wins || 0) > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/50 border border-[#d4af37]/30 rounded-sm p-4"
          >
            <div className="sports-font text-[10px] text-[#d4af37] mb-3 tracking-[0.3em] uppercase text-center">
              Session Wins
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {[...players]
                .sort((a, b) => (b.wins || 0) - (a.wins || 0))
                .map((player) => (
                  <div
                    key={player.player_id}
                    className="flex items-center gap-2 px-3 py-2 bg-black/30 rounded-sm border border-white/10"
                  >
                    <span className="sports-font text-sm text-white/80">{player.player_name}</span>
                    <span className="retro-title text-lg text-[#d4af37]">{player.wins || 0}</span>
                  </div>
                ))}
            </div>
          </motion.div>
        )}

        {/* Host Settings Panel */}
        <AnimatePresence>
          {isHost && showSettings && lobby.status === 'waiting' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-black/50 border border-[#d4af37]/30 rounded-sm p-4 space-y-4">
                <div className="sports-font text-[10px] text-[#d4af37] tracking-[0.3em] uppercase text-center">
                  Host Settings
                </div>

                {/* Sport Toggle */}
                <div className="flex justify-center gap-2">
                  {(['nba', 'nfl'] as Sport[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleEditSportChange(s)}
                      className={`px-4 py-2 rounded-lg sports-font text-xs tracking-wider transition-all ${
                        editSport === s
                          ? (s === 'nba' ? 'bg-orange-500' : 'bg-[#013369]') + ' text-white'
                          : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                      }`}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Game Mode Toggle */}
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setEditGameMode('random')}
                    className={`px-4 py-2 rounded-lg sports-font text-xs tracking-wider transition-all ${
                      editGameMode === 'random'
                        ? 'bg-[#d4af37] text-black'
                        : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                    }`}
                  >
                    Random
                  </button>
                  <button
                    onClick={() => setEditGameMode('manual')}
                    className={`px-4 py-2 rounded-lg sports-font text-xs tracking-wider transition-all ${
                      editGameMode === 'manual'
                        ? 'bg-[#d4af37] text-black'
                        : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                    }`}
                  >
                    Manual
                  </button>
                </div>

                {/* Manual Mode: Team & Year Selection */}
                {editGameMode === 'manual' && (
                  <div className="space-y-3">
                    <TeamSelector
                      selectedTeam={editTeam}
                      onSelect={setEditTeam}
                      sport={editSport}
                    />
                    <YearSelector
                      selectedYear={editYear}
                      onSelect={setEditYear}
                      minYear={editSport === 'nba' ? 1985 : 2000}
                      maxYear={2024}
                      sport={editSport}
                    />
                  </div>
                )}

                {/* Random Mode: Year Range */}
                {editGameMode === 'random' && (
                  <div className="bg-black/30 border border-white/10 rounded-sm p-3">
                    <div className="sports-font text-[10px] text-white/40 mb-2 tracking-widest text-center uppercase">
                      Year Range {editSport === 'nfl' && '(2000-2024)'}
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <select
                        value={editMinYear}
                        onChange={(e) => setEditMinYear(parseInt(e.target.value))}
                        className="bg-black/50 text-white px-3 py-1.5 rounded-lg border border-white/20 sports-font text-sm"
                      >
                        {Array.from(
                          { length: 2024 - (editSport === 'nfl' ? 2000 : 1985) + 1 },
                          (_, i) => (editSport === 'nfl' ? 2000 : 1985) + i
                        ).map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      <span className="text-white/40 sports-font">to</span>
                      <select
                        value={editMaxYear}
                        onChange={(e) => setEditMaxYear(parseInt(e.target.value))}
                        className="bg-black/50 text-white px-3 py-1.5 rounded-lg border border-white/20 sports-font text-sm"
                      >
                        {Array.from(
                          { length: 2024 - (editSport === 'nfl' ? 2000 : 1985) + 1 },
                          (_, i) => (editSport === 'nfl' ? 2000 : 1985) + i
                        ).map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Timer Selection */}
                <div className="bg-black/30 border border-white/10 rounded-sm p-3">
                  <div className="sports-font text-[10px] text-white/40 mb-2 tracking-widest text-center uppercase">
                    Timer Duration
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[60, 90, 120, 180, 300].map((seconds) => (
                      <button
                        key={seconds}
                        onClick={() => setEditTimer(seconds)}
                        className={`px-3 py-1.5 rounded-lg sports-font text-sm transition-all ${
                          editTimer === seconds
                            ? 'bg-[#d4af37] text-black'
                            : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                        }`}
                      >
                        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Apply Button */}
                <button
                  onClick={handleApplySettings}
                  disabled={editGameMode === 'manual' && (!editTeam || !editYear)}
                  className="w-full py-3 rounded-sm retro-title tracking-wider transition-all disabled:opacity-50 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1"
                >
                  Apply Changes
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
