/**
 * LobbyWaitingPage.tsx — Multiplayer waiting room.
 *
 * Shows lobby info, player list with ready states, and host settings.
 * When all players ready (or host force-starts), triggers a dealing
 * animation (RouletteOverlay) then loads the roster and navigates to
 * GamePage. Includes stuck-detection that auto-reloads after 8s if
 * the lobby fails to load (e.g. after a network hiccup).
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { useGameStore } from '../stores/gameStore';
import { fetchTeamRoster, fetchDivisionRosters, fetchStaticSeasonPlayers, fetchStaticNFLRoster, fetchStaticNFLSeasonPlayers } from '../services/roster';
import { teams, getNBADivisions, getNBATeamsByDivision } from '../data/teams';
import { nflTeams, getNFLDivisions, getNFLTeamsByDivision } from '../data/nfl-teams';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus, setPlayerScoreMultiplier, kickPlayer, renamePlayer, getStoredPlayerName, startCareerRound } from '../services/lobby';
import { getNextGame, startPrefetch } from '../services/careerPrefetch';
import { selectRandomStatCategory, generateTargetCap, assignRandomTeam } from '../services/lineupIsRight';
import { getRandomNBAScramblePlayer, getRandomNFLScramblePlayer } from '../services/careerData';
import { scrambleName } from '../utils/scramble';
import { RouletteOverlay } from '../components/home/RouletteOverlay';
import { TeamSelector } from '../components/home/TeamSelector';
import { YearSelector } from '../components/home/YearSelector';
import { TEAM_COLORS } from '../utils/teamUtils';
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
    assignTeam,
    joinExistingLobby,
    updateCareerState,
  } = useLobbyStore();
  const setGameConfig = useGameStore((state) => state.setGameConfig);
  const setDivisionRosters = useGameStore((state) => state.setDivisionRosters);

  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isLoadingLobby, setIsLoadingLobby] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showDealingAnimation, setShowDealingAnimation] = useState(false);
  const [rerollCount, setRerollCount] = useState(0);
  const hasStartedGame = useRef(false);
  const hasAutoStarted = useRef(false);
  const prevTeamRef = useRef<string | null>(null);
  const prevSeasonRef = useRef<string | null>(null);

  // Host settings state
  const [showSettings, setShowSettings] = useState(false);
  const [editGameType, setEditGameType] = useState<'roster' | 'career' | 'scramble' | 'lineup-is-right'>('roster');
  const [editSport, setEditSport] = useState<Sport>('nba');
  const [editRandomSport, setEditRandomSport] = useState(false);
  const [editGameMode, setEditGameMode] = useState<'random' | 'manual'>('manual');
  const [editSelectionScope, setEditSelectionScope] = useState<'team' | 'division'>('team');
  const [editTeam, setEditTeam] = useState<GenericTeam | null>(null);
  const [editYear, setEditYear] = useState<number | null>(null);
  const [editTimer, setEditTimer] = useState(90);
  const [editCustomTimer, setEditCustomTimer] = useState('');
  const [editMinYear, setEditMinYear] = useState(2015);
  const [editMaxYear, setEditMaxYear] = useState(2025);
  const [editWinTarget, setEditWinTarget] = useState(3);
  const [editCareerFrom, setEditCareerFrom] = useState(0);
  const [editCareerTo, setEditCareerTo] = useState(0);

  // Join prompt for new players arriving via direct link
  const [joinName, setJoinName] = useState(getStoredPlayerName() || '');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Rename editing state (host only)
  const [renamingPlayerId, setRenamingPlayerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useLobbySubscription(lobby?.id || null);

  // Stuck detection: if the lobby hasn't loaded within 8 seconds (e.g. Supabase
  // realtime missed the initial payload), force a full page reload to recover.
  useEffect(() => {
    if (!isLoadingLobby && lobby) return;

    const stuckTimeout = setTimeout(() => {
      if (isLoadingLobby || !lobby) {
        window.location.reload();
      }
    }, 8000);

    return () => clearTimeout(stuckTimeout);
  }, [isLoadingLobby, lobby]);

  // Sync edit state with lobby when it changes (only when settings panel is closed)
  useEffect(() => {
    if (lobby && !showSettings) {
      const lobbySport = lobby.sport as Sport;
      setEditGameType((lobby.game_type as 'roster' | 'career' | 'scramble' | 'lineup-is-right') || 'roster');
      setEditSport(lobbySport);
      setEditRandomSport(false); // Random sport doesn't persist between rounds
      setEditGameMode(lobby.game_mode as 'random' | 'manual');
      setEditSelectionScope((lobby.selection_scope as 'team' | 'division') || 'team');
      setEditTimer(lobby.timer_duration);
      setEditCustomTimer('');
      setEditMinYear(lobby.min_year || 2000);
      setEditMaxYear(lobby.max_year || 2025);

      // Career state
      const cs = (lobby.career_state as any) || {};
      setEditWinTarget(cs.win_target || 3);
      setEditCareerFrom(cs.career_from || 0);
      setEditCareerTo(cs.career_to || 0);

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
  }, [lobby?.id, lobby?.sport, lobby?.game_mode, lobby?.timer_duration, lobby?.team_abbreviation, lobby?.season, lobby?.min_year, lobby?.max_year, lobby?.game_type, lobby?.career_state, showSettings]);

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

      const isDivisionMode = freshLobby.selection_scope === 'division' && freshLobby.division_conference && freshLobby.division_name;

      if (isDivisionMode) {
        // Division mode: fetch all 4 teams' rosters
        const divTeams = lobbySport === 'nba'
          ? getNBATeamsByDivision(freshLobby.division_conference!, freshLobby.division_name!)
          : getNFLTeamsByDivision(freshLobby.division_conference! as 'AFC' | 'NFC', freshLobby.division_name!);
        const teamAbbrs = divTeams.map(t => t.abbreviation);

        const divResult = await fetchDivisionRosters(lobbySport, teamAbbrs, freshLobby.season);
        rosterPlayers = divResult.combined;
        setDivisionRosters(divResult.byTeam, teamAbbrs);

        // Fetch league players for autocomplete
        if (lobbySport === 'nba') {
          leaguePlayers = await fetchStaticSeasonPlayers(freshLobby.season) ?? [];
        } else {
          const year = parseInt(freshLobby.season);
          leaguePlayers = await fetchStaticNFLSeasonPlayers(year) ?? [];
        }
      } else if (lobbySport === 'nba') {
        const result = await fetchTeamRoster(lobbyTeam.abbreviation, freshLobby.season);
        rosterPlayers = result.players;

        leaguePlayers = await fetchStaticSeasonPlayers(freshLobby.season) ?? [];
      } else {
        const year = parseInt(freshLobby.season);
        rosterPlayers = await fetchStaticNFLRoster(lobbyTeam.abbreviation, year) ?? [];
        leaguePlayers = await fetchStaticNFLSeasonPlayers(year) ?? [];
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
      if (lobby.game_type !== 'career' && lobby.game_type !== 'scramble') {
        setShowDealingAnimation(true);
      }
    } else if (lobby.status === 'playing') {
      if (lobby.game_type === 'scramble') {
        if (!hasStartedGame.current) {
          hasStartedGame.current = true;
          navigate(`/lobby/${code}/scramble`);
        }
      } else if (lobby.game_type === 'career') {
        // Career mode: navigate directly to career page
        if (!hasStartedGame.current) {
          hasStartedGame.current = true;
          navigate(`/lobby/${code}/career`);
        }
      } else if (lobby.game_type === 'lineup-is-right') {
        // Lineup Is Right mode: navigate directly to gameplay
        if (!hasStartedGame.current) {
          hasStartedGame.current = true;
          navigate(`/lobby/${code}/lineup-is-right`);
        }
      } else {
        // Roster mode: show dealing animation
        if (!hasStartedGame.current) {
          setShowDealingAnimation(true);
          if (!isHost) {
            handleDealingComplete();
          }
        }
      }
    } else if (lobby.status === 'finished') {
      if (lobby.game_type === 'career') {
        navigate(`/lobby/${code}/career/results`);
      } else if (lobby.game_type === 'scramble') {
        navigate(`/lobby/${code}/scramble/results`);
      } else if (lobby.game_type === 'lineup-is-right') {
        navigate(`/lobby/${code}/lineup-is-right/results`);
      } else {
        navigate(`/lobby/${code}/results`);
      }
    }
  }, [lobby?.status, showDealingAnimation, isHost, handleDealingComplete, lobby, navigate, code]);

  // Non-host reroll detection: when team/season changes during dealing animation, remount overlay
  useEffect(() => {
    if (!lobby) return;
    const teamAbbr = lobby.team_abbreviation;
    const season = lobby.season;

    if (prevTeamRef.current === null) {
      prevTeamRef.current = teamAbbr;
      prevSeasonRef.current = season;
      return;
    }

    if (showDealingAnimation && !isHost && (teamAbbr !== prevTeamRef.current || season !== prevSeasonRef.current)) {
      setRerollCount(prev => prev + 1);
    }

    prevTeamRef.current = teamAbbr;
    prevSeasonRef.current = season;
  }, [lobby?.team_abbreviation, lobby?.season, showDealingAnimation, isHost]);

  useEffect(() => {
    const allReady = players.length > 1 && players.every((p) => p.is_ready);

    // Only revert to waiting if not all ready AND host didn't force start
    if (lobby?.status === 'countdown' && !allReady && isHost && !hasAutoStarted.current) {
      updateLobbyStatus(lobby.id, 'waiting');
    }
  }, [players, lobby?.status, isHost]);

  const handleManualStart = async () => {
    if (!isHost || !lobby) return;
    hasAutoStarted.current = true;
    await startGame();
  };

  const handleCareerStart = async () => {
    if (!isHost || !lobby) return;
    setIsLoadingRoster(true);
    hasStartedGame.current = true;

    const sport = lobby.sport as Sport;
    try {
      const careerState = (lobby.career_state as any) || {};
      const careerFrom = careerState.career_from || 0;
      const careerTo   = careerState.career_to   || 0;
      const game = await getNextGame(sport, { careerFrom, careerTo });
      if (!game) { setIsLoadingRoster(false); return; }

      const newCareerState = {
        ...game.data,
        sport: game.sport,
        round: 1,
        win_target: careerState.win_target || 3,
        career_from: careerFrom,
        career_to: careerTo,
      };

      await startCareerRound(lobby.id, newCareerState);
      startPrefetch(sport);
      // Update local store immediately so host sees correct state on navigation
      // (realtime event may not arrive before the navigate call)
      setLobby({ ...lobby, career_state: newCareerState, status: 'playing' });
      navigate(`/lobby/${code}/career`);
    } catch {
      setIsLoadingRoster(false);
    }
  };

  const handleScrambleStart = async () => {
    if (!isHost || !lobby) return;
    setIsLoadingRoster(true);
    hasStartedGame.current = true;

    try {
      const careerState = (lobby.career_state as any) || {};
      const winTarget = careerState.win_target || 20;
      const careerTo = careerState.career_to || 0;
      const sport = lobby.sport as Sport;
      const filters = careerTo ? { careerTo } : undefined;

      const player = sport === 'nba'
        ? await getRandomNBAScramblePlayer(filters)
        : await getRandomNFLScramblePlayer(filters);

      if (!player) { setIsLoadingRoster(false); return; }

      const playerName = player.player_name;
      const scrambledName = scrambleName(playerName);

      const newCareerState = {
        playerName,
        scrambledName,
        sport,
        round: 1,
        win_target: winTarget,
        career_to: careerTo,
      };

      await startCareerRound(lobby.id, newCareerState);
      setLobby({ ...lobby, career_state: newCareerState, status: 'playing' });
      navigate(`/lobby/${code}/scramble`);
    } catch {
      setIsLoadingRoster(false);
    }
  };

  const handleLineupIsRightStart = async () => {
    if (!isHost || !lobby) return;
    setIsLoadingRoster(true);
    hasStartedGame.current = true;

    try {
      const careerState = (lobby.career_state as any) || {};
      const sport = lobby.sport as Sport;
      const winTarget = careerState.win_target || 3;

      // Generate stat category and cap once for all players
      const statCategory = selectRandomStatCategory(sport);
      const targetCap = generateTargetCap(sport, statCategory);

      // Fetch current player list to initialize empty lineups keyed by player_id
      const playersResult = await getLobbyPlayers(lobby.id);
      const lobbyPlayers = playersResult.players || [];
      const initialLineups: Record<string, object> = {};
      lobbyPlayers.forEach(p => {
        initialLineups[p.player_id] = {
          playerId: p.player_id,
          playerName: p.player_name,
          selectedPlayers: [],
          totalStat: 0,
          isBusted: false,
          isFinished: false,
          hasPickedThisRound: false,
        };
      });

      const firstTeam = assignRandomTeam(sport, statCategory);

      const newCareerState = {
        sport,
        win_target: winTarget,
        statCategory,
        targetCap,
        allLineups: initialLineups,
        currentRound: 1,
        totalRounds: 5,
        currentTeam: firstTeam,
        phase: 'picking',
      };

      await startCareerRound(lobby.id, newCareerState);
      setLobby({ ...lobby, career_state: newCareerState, status: 'playing' });
      navigate(`/lobby/${code}/lineup-is-right`);
    } catch {
      setIsLoadingRoster(false);
    }
  };

  const handleReroll = useCallback(async () => {
    if (!isHost || !lobby) return;

    const currentSport = lobby.sport as Sport;
    const minYear = Math.max(lobby.min_year || 2000, 2000);
    const maxYear = Math.min(lobby.max_year || 2025, 2025);
    const randomYear = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
    const newSeason = currentSport === 'nba'
      ? `${randomYear}-${String(randomYear + 1).slice(-2)}`
      : `${randomYear}`;

    if (lobby.selection_scope === 'division') {
      // Reroll division
      const allDivisions = currentSport === 'nba' ? getNBADivisions() : getNFLDivisions();
      const randomDiv = allDivisions[Math.floor(Math.random() * allDivisions.length)];
      const divTeams = currentSport === 'nba'
        ? getNBATeamsByDivision(randomDiv.conference, randomDiv.division)
        : getNFLTeamsByDivision(randomDiv.conference as 'AFC' | 'NFC', randomDiv.division);

      await updateSettings({
        teamAbbreviation: divTeams[0]?.abbreviation || lobby.team_abbreviation,
        season: newSeason,
        divisionConference: randomDiv.conference,
        divisionName: randomDiv.division,
      });
    } else {
      const currentTeamList = currentSport === 'nba' ? teams : nflTeams;
      const randomTeam = currentTeamList[Math.floor(Math.random() * currentTeamList.length)];

      await updateSettings({
        teamAbbreviation: randomTeam.abbreviation,
        season: newSeason,
      });
    }

    setRerollCount(prev => prev + 1);
  }, [isHost, lobby, updateSettings]);

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

    // If switching game type, update game_type column
    if (editGameType !== lobby.game_type) {
      await updateSettings({ gameType: editGameType });
    }

    if (editGameType === 'scramble') {
      // Scramble mode: update career_state with points target and era filter
      const existingState = (lobby.career_state as any) || {};
      const newCareerState = {
        ...existingState,
        win_target: editWinTarget,
        career_to: editCareerTo,
      };
      await updateCareerState(newCareerState);
      setLobby({ ...lobby, career_state: newCareerState });
    } else if (editGameType === 'career') {
      // Career mode: update career_state with win target and era filters
      const existingState = (lobby.career_state as any) || {};
      const newCareerState = {
        ...existingState,
        win_target: editWinTarget,
        career_from: editCareerFrom,
        career_to: editCareerTo,
      };
      await updateCareerState(newCareerState);
      // Update local store immediately — don't wait for Supabase realtime to avoid
      // a race condition where handleCareerStart reads stale career_state
      setLobby({ ...lobby, career_state: newCareerState });
    } else if (editGameType === 'lineup-is-right') {
      // Lineup Is Right mode: update sport and win target
      const existingState = (lobby.career_state as any) || {};
      const newCareerState = {
        ...existingState,
        sport: editSport,
        win_target: editWinTarget,
      };
      await updateCareerState(newCareerState);
      await updateSettings({ sport: editSport });
      setLobby({ ...lobby, career_state: newCareerState, sport: editSport });
    } else {
      // Roster mode: apply normal roster settings

      // Determine the sport (random picks one)
      const finalSport: Sport = editRandomSport
        ? (Math.random() < 0.5 ? 'nba' : 'nfl')
        : editSport;

      // Get the appropriate team list for the selected sport
      const newTeamList = finalSport === 'nba' ? teams : nflTeams;

      // Determine team abbreviation
      let newTeamAbbreviation: string;
      let newSeason: string;

      if (editGameMode === 'manual' && editTeam && !editRandomSport) {
        // Manual mode with team selected (only if sport is not random)
        newTeamAbbreviation = editTeam.abbreviation;
        newSeason = finalSport === 'nba' && editYear
          ? `${editYear}-${String(editYear + 1).slice(-2)}`
          : editYear ? `${editYear}` : lobby.season;
      } else {
        // Random mode OR random sport - pick a random team
        const randomTeam = newTeamList[Math.floor(Math.random() * newTeamList.length)];
        newTeamAbbreviation = randomTeam.abbreviation;

        // Pick a random year within the range
        const minYear = Math.max(editMinYear, 2000);
        const maxYear = Math.min(editMaxYear, 2025);
        const randomYear = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;

        newSeason = finalSport === 'nba'
          ? `${randomYear}-${String(randomYear + 1).slice(-2)}`
          : `${randomYear}`;
      }

      // Division mode: pick a random division when scope is division
      let divisionConference: string | null = null;
      let divisionNameVal: string | null = null;

      const finalScope = editRandomSport ? 'team' : editSelectionScope;
      const finalGameMode = editRandomSport ? 'random' : editGameMode;

      if (finalScope === 'division' && finalGameMode === 'random') {
        const allDivisions = finalSport === 'nba' ? getNBADivisions() : getNFLDivisions();
        const randomDiv = allDivisions[Math.floor(Math.random() * allDivisions.length)];
        divisionConference = randomDiv.conference;
        divisionNameVal = randomDiv.division;

        const divTeams = finalSport === 'nba'
          ? getNBATeamsByDivision(randomDiv.conference, randomDiv.division)
          : getNFLTeamsByDivision(randomDiv.conference as 'AFC' | 'NFC', randomDiv.division);
        newTeamAbbreviation = divTeams[0]?.abbreviation || newTeamAbbreviation;
      }

      await updateSettings({
        sport: finalSport,
        teamAbbreviation: newTeamAbbreviation,
        season: newSeason,
        timerDuration: editTimer,
        gameMode: finalGameMode,
        minYear: editMinYear,
        maxYear: editMaxYear,
        selectionScope: finalScope,
        divisionConference,
        divisionName: divisionNameVal,
      });
    }

    setShowSettings(false);
  };

  // Handle sport change in settings
  const handleEditSportChange = (newSport: Sport | 'random') => {
    if (newSport === 'random') {
      setEditRandomSport(true);
      setEditGameMode('random'); // Random sport implies random team
      setEditTeam(null);
      setEditYear(null);
    } else {
      setEditRandomSport(false);
      setEditSport(newSport);
      setEditTeam(null);
      setEditYear(null);
      if (newSport === 'nfl') {
        setEditMinYear(Math.max(editMinYear, 2000));
        setEditMaxYear(Math.min(editMaxYear, 2024));
      }
    }
  };

  const handleLeave = async () => {
    await leaveLobby();
    navigate('/');
  };

  const handleCycleTeam = async (playerId: string, currentTeamNumber: number | null) => {
    if (!isHost || lobby?.status !== 'waiting') return;
    const nextTeam = currentTeamNumber === null ? 1 : currentTeamNumber >= 4 ? null : currentTeamNumber + 1;
    await assignTeam(playerId, nextTeam);
  };

  const handleJoinFromLink = async () => {
    if (!joinName.trim() || !lobby) return;
    setIsJoining(true);
    setJoinError(null);
    const success = await joinExistingLobby(lobby, joinName.trim());
    if (success) {
      // Refresh players list
      const playersResult = await getLobbyPlayers(lobby.id);
      if (playersResult.players) {
        setPlayers(playersResult.players);
      }
    } else {
      setJoinError('Failed to join lobby');
    }
    setIsJoining(false);
  };

  const handleKickPlayer = async (targetPlayerId: string) => {
    if (!isHost || !lobby) return;
    await kickPlayer(lobby.id, targetPlayerId);
    // Manually refresh players since realtime DELETE events may not fire
    // when the filter column (lobby_id) isn't in the replica identity
    const result = await getLobbyPlayers(lobby.id);
    if (result.players) setPlayers(result.players);
  };

  const handleStartRename = (playerId: string, currentName: string) => {
    setRenamingPlayerId(playerId);
    setRenameValue(currentName);
  };

  const handleConfirmRename = async () => {
    if (!isHost || !lobby || !renamingPlayerId || !renameValue.trim()) return;
    await renamePlayer(lobby.id, renamingPlayerId, renameValue.trim());
    setRenamingPlayerId(null);
    setRenameValue('');
  };

  const handleCancelRename = () => {
    setRenamingPlayerId(null);
    setRenameValue('');
  };

  const currentPlayer = players.find((p) => p.player_id === currentPlayerId);
  const isSpectator = !isLoadingLobby && lobby && !currentPlayer;
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

  // Show join prompt for players who arrived via direct link and aren't in the lobby yet
  if (isSpectator && lobby.status === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col bg-[#0d2a0b] text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
        />
        <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="retro-title text-3xl text-[#d4af37]">Join Table</h1>
              <p className="sports-font text-[9px] text-white/30 tracking-[0.4em] uppercase">
                {lobby.host_name}'s Game • {players.length}/{lobby.max_players} seated
              </p>
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 max-w-md mx-auto w-full p-6 space-y-5 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/50 border border-white/10 rounded-sm p-6 space-y-4"
          >
            <div className="text-center">
              <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase mb-2">
                {lobby.sport.toUpperCase()} Roster Challenge
              </div>
              <div className="retro-title text-xl text-[#d4af37] mb-1">
                Take a Seat
              </div>
              <div className="sports-font text-[10px] text-white/30 tracking-wider">
                Enter your name to join
              </div>
            </div>

            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinFromLink()}
              className="w-full p-3 bg-[#111] rounded-sm border-2 border-white/20 text-white focus:outline-none focus:border-[#d4af37] transition-colors sports-font"
            />

            {joinError && (
              <div className="p-2 bg-red-900/30 border border-red-700 rounded-sm text-red-400 text-sm text-center sports-font">
                {joinError}
              </div>
            )}

            <button
              onClick={handleJoinFromLink}
              disabled={!joinName.trim() || isJoining}
              className="w-full py-4 rounded-sm retro-title text-xl tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1"
            >
              {isJoining ? 'Joining...' : 'Take a Seat'}
            </button>
          </motion.div>

          {/* Show current players */}
          {players.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-center space-y-2"
            >
              <div className="sports-font text-[10px] text-white/30 tracking-[0.3em] uppercase">
                Already Seated
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {players.map(p => (
                  <span key={p.player_id} className="px-3 py-1 bg-black/40 border border-white/10 rounded-sm sports-font text-sm text-white/60">
                    {p.is_host && '★ '}{p.player_name}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </main>
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
            key={rerollCount}
            winningTeam={
              lobby.selection_scope === 'division' && lobby.division_conference && lobby.division_name
                ? `${lobby.division_conference} ${lobby.division_name}`
                : team.name
            }
            winningLabel={lobby.selection_scope === 'division' ? 'DIVISION' : 'TEAM'}
            winningYear={lobby.season}
            sport={sport}
            winningTeamData={team}
            onComplete={handleDealingComplete}
            canSkip={isHost}
            onReroll={handleReroll}
          />
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors border border-white/10 hover:border-white/30"
            >
              <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="sports-font text-[11px] text-white/50 tracking-widest uppercase">Leave</span>
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
              {lobby.game_type === 'scramble' ? (
                <>
                  <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                    {lobby.sport.toUpperCase()} Name Scramble
                  </div>
                  <div className="retro-title text-xl text-[#3b82f6]">Name Scramble</div>
                  <div className="sports-font text-[9px] text-white/40 tracking-widest">
                    First to {(lobby.career_state as any)?.win_target ?? '?'} pts
                  </div>
                </>
              ) : lobby.game_type === 'career' ? (
                <>
                  <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                    {lobby.sport.toUpperCase()} Career Mode
                  </div>
                  <div className="retro-title text-xl text-[#22c55e]">Guess the Career</div>
                  <div className="sports-font text-[9px] text-white/40 tracking-widest">
                    First to {(lobby.career_state as any)?.win_target ?? '?'} wins
                  </div>
                </>
              ) : lobby.game_type === 'lineup-is-right' ? (
                <>
                  <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                    {lobby.sport.toUpperCase()} Lineup Builder
                  </div>
                  <div className="retro-title text-xl text-[#ec4899]">Lineup Is Right</div>
                  <div className="sports-font text-[9px] text-white/40 tracking-widest">
                    First to {(lobby.career_state as any)?.win_target ?? '?'} wins
                  </div>
                </>
              ) : (
                <>
                  <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                    {lobby.sport.toUpperCase()} Roster Challenge
                  </div>
                  {lobby.game_mode === 'random' ? (
                    <div>
                      <div className="retro-title text-xl text-[#d4af37]">Mystery Deck</div>
                      <div className="sports-font text-[9px] text-white/40 tracking-widest">
                        {lobby.selection_scope === 'division' ? 'Division Mode • ' : ''}
                        {lobby.min_year || 2000} - {lobby.max_year || 2025}
                      </div>
                    </div>
                  ) : (
                    <div className="retro-title text-xl text-[#d4af37]">
                      {lobby.team_abbreviation} • {lobby.season}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              {lobby.game_type !== 'career' && lobby.game_type !== 'scramble' && lobby.game_type !== 'lineup-is-right' && (
                <div className="text-right">
                  <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">Timer</div>
                  <div className="retro-title text-2xl text-white">
                    {Math.floor(lobby.timer_duration / 60)}:{String(lobby.timer_duration % 60).padStart(2, '0')}
                  </div>
                </div>
              )}
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

                {/* Mode Toggle */}
                <div>
                  <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase mb-2">Mode</div>
                  <select
                    value={editGameType}
                    onChange={e => setEditGameType(e.target.value as typeof editGameType)}
                    className="w-full bg-black/50 text-white px-3 py-2.5 rounded-sm border border-white/20 sports-font text-sm focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="roster">Roster Challenge</option>
                    <option value="career">Career Arc</option>
                    <option value="scramble">Name Scramble</option>
                    <option value="lineup-is-right">Lineup Is Right</option>
                  </select>
                </div>

                {editGameType === 'scramble' ? (
                  <>
                    {/* Scramble Win Target */}
                    <div>
                      <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase mb-2">Points Target</div>
                      <div className="flex gap-2 flex-wrap">
                        {[10, 20, 30, 40, 50].map(n => (
                          <button
                            key={n}
                            onClick={() => setEditWinTarget(n)}
                            className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                              editWinTarget === n
                                ? 'bg-[#3b82f6] text-white'
                                : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Era Filter */}
                    <div>
                      <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase mb-2">Career Era</div>
                      <select
                        value={editCareerTo}
                        onChange={(e) => setEditCareerTo(parseInt(e.target.value))}
                        className="w-full bg-black/50 text-white px-2 py-1.5 rounded-sm border border-white/20 sports-font text-sm focus:outline-none focus:border-[#3b82f6]"
                      >
                        <option value={0}>Any Era</option>
                        {Array.from({ length: 2024 - 2000 + 1 }, (_, i) => 2000 + i).map(y => (
                          <option key={y} value={y}>Active into {y}+</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : editGameType === 'career' ? (
                  <>
                    {/* Win Target */}
                    <div>
                      <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase mb-2">First To</div>
                      <div className="flex gap-2">
                        {[2, 3, 4, 5, 7].map(n => (
                          <button
                            key={n}
                            onClick={() => setEditWinTarget(n)}
                            className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                              editWinTarget === n
                                ? 'bg-[#d4af37] text-black'
                                : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Era Filters */}
                    <div>
                      <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase mb-2">Era Filter</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="sports-font text-[9px] text-[#666] block mb-1">Career started from</label>
                          <select
                            value={editCareerFrom}
                            onChange={(e) => setEditCareerFrom(parseInt(e.target.value))}
                            className="w-full bg-black/50 text-white px-2 py-1.5 rounded-sm border border-white/20 sports-font text-sm focus:outline-none focus:border-[#d4af37]"
                          >
                            <option value={0}>Any</option>
                            {Array.from({ length: 2015 - 1980 + 1 }, (_, i) => 1980 + i).map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="sports-font text-[9px] text-[#666] block mb-1">Active into</label>
                          <select
                            value={editCareerTo}
                            onChange={(e) => setEditCareerTo(parseInt(e.target.value))}
                            className="w-full bg-black/50 text-white px-2 py-1.5 rounded-sm border border-white/20 sports-font text-sm focus:outline-none focus:border-[#d4af37]"
                          >
                            <option value={0}>Any</option>
                            {Array.from({ length: 2026 - 1990 + 1 }, (_, i) => 1990 + i).map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                ) : editGameType === 'lineup-is-right' ? (
                  <>
                    {/* Sport Toggle */}
                    <div className="flex justify-center gap-2">
                      {(['nba', 'nfl'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setEditSport(s)}
                          className={`flex-1 py-2 rounded-sm sports-font text-xs uppercase tracking-wider transition-all ${
                            editSport === s
                              ? s === 'nba' ? 'bg-orange-500 text-white' : 'bg-[#013369] text-white'
                              : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                          }`}
                        >
                          {s.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {/* Win Target */}
                    <div>
                      <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase mb-2">First To</div>
                      <div className="flex gap-2">
                        {[2, 3, 4, 5, 7].map(n => (
                          <button
                            key={n}
                            onClick={() => setEditWinTarget(n)}
                            className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                              editWinTarget === n
                                ? 'bg-[#ec4899] text-white'
                                : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Sport Toggle */}
                    <div className="flex justify-center gap-2">
                      {(['nba', 'nfl', 'random'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleEditSportChange(s)}
                          className={`px-4 py-2 rounded-lg sports-font text-xs tracking-wider transition-all ${
                            (s === 'random' && editRandomSport) || (s !== 'random' && !editRandomSport && editSport === s)
                              ? (s === 'nba' ? 'bg-orange-500' : s === 'nfl' ? 'bg-[#013369]' : 'bg-[#d4af37]') + ' text-white'
                              : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                          }`}
                        >
                          {s === 'random' ? '?' : s.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {/* Game Mode Toggle - hidden when random sport selected */}
                    {!editRandomSport && (
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
                    )}

                    {/* Scope Toggle - visible when random mode and not random sport */}
                    {!editRandomSport && editGameMode === 'random' && (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setEditSelectionScope('team')}
                          className={`px-4 py-2 rounded-lg sports-font text-xs tracking-wider transition-all ${
                            editSelectionScope === 'team'
                              ? 'bg-[#d4af37] text-black'
                              : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                          }`}
                        >
                          Team
                        </button>
                        <button
                          onClick={() => setEditSelectionScope('division')}
                          className={`px-4 py-2 rounded-lg sports-font text-xs tracking-wider transition-all ${
                            editSelectionScope === 'division'
                              ? 'bg-[#d4af37] text-black'
                              : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                          }`}
                        >
                          Division
                        </button>
                      </div>
                    )}

                    {/* Random sport info */}
                    {editRandomSport && (
                      <div className="text-center text-white/40 text-xs sports-font tracking-wider">
                        Sport and team will be randomly selected
                      </div>
                    )}

                    {/* Manual Mode: Team & Year Selection */}
                    {!editRandomSport && editGameMode === 'manual' && (
                      <div className="space-y-3">
                        <TeamSelector
                          selectedTeam={editTeam}
                          onSelect={setEditTeam}
                          sport={editSport}
                        />
                        <YearSelector
                          selectedYear={editYear}
                          onSelect={setEditYear}
                          minYear={2000}
                          maxYear={2025}
                          sport={editSport}
                        />
                      </div>
                    )}

                    {/* Random Mode: Year Range */}
                    {(editRandomSport || editGameMode === 'random') && (
                      <div className="bg-black/30 border border-white/10 rounded-sm p-3">
                        <div className="sports-font text-[10px] text-white/40 mb-2 tracking-widest text-center uppercase">
                          Year Range
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <select
                            value={editMinYear}
                            onChange={(e) => setEditMinYear(parseInt(e.target.value))}
                            className="bg-black/50 text-white px-3 py-1.5 rounded-lg border border-white/20 sports-font text-sm"
                          >
                            {Array.from(
                              { length: 2025 - 2000 + 1 },
                              (_, i) => 2000 + i
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
                              { length: 2025 - 2000 + 1 },
                              (_, i) => 2000 + i
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
                      <div className="flex flex-wrap justify-center gap-2 mb-2">
                        {[60, 90, 120, 180, 300].map((seconds) => (
                          <button
                            key={seconds}
                            onClick={() => {
                              setEditTimer(seconds);
                              setEditCustomTimer('');
                            }}
                            className={`px-3 py-1.5 rounded-lg sports-font text-sm transition-all ${
                              editTimer === seconds && !editCustomTimer
                                ? 'bg-[#d4af37] text-black'
                                : 'bg-black/50 text-white/40 border border-white/10 hover:border-white/30'
                            }`}
                          >
                            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-white/40 text-[10px] sports-font tracking-wider">CUSTOM:</span>
                        <input
                          type="number"
                          value={editCustomTimer}
                          onChange={(e) => {
                            setEditCustomTimer(e.target.value);
                            if (e.target.value) {
                              const val = Math.max(10, Math.min(600, parseInt(e.target.value) || 90));
                              setEditTimer(val);
                            }
                          }}
                          placeholder="sec"
                          min={10}
                          max={600}
                          className="w-20 px-2 py-1 bg-black/50 rounded-lg border border-white/20 text-white text-center sports-font text-sm focus:outline-none focus:border-[#d4af37]"
                        />
                        {editCustomTimer && (
                          <span className="text-white/50 sports-font text-sm">
                            = {Math.floor(editTimer / 60)}:{String(editTimer % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Apply Button */}
                <button
                  onClick={handleApplySettings}
                  disabled={editGameType === 'roster' && editGameMode === 'manual' && (!editTeam || !editYear) || false}
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
              {players.map((player, index) => {
                const teamColor = player.team_number ? TEAM_COLORS[player.team_number - 1] : null;
                return (
                  <motion.div
                    key={player.player_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
                      player.player_id === currentPlayerId
                        ? 'border-[#d4af37]/50 bg-[#d4af37]/10'
                        : (player.score_multiplier ?? 1) > 1
                          ? 'border-purple-500/50 bg-purple-900/20'
                          : 'border-white/10 bg-black/30'
                    }`}
                    style={teamColor ? {
                      borderLeftWidth: '4px',
                      borderLeftColor: teamColor.bg,
                    } : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {teamColor && (
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: teamColor.bg }}
                        />
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
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleConfirmRename();
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                            maxLength={20}
                            autoFocus
                            className="w-28 px-2 py-0.5 bg-[#111] rounded-sm border border-[#d4af37] text-white text-sm sports-font focus:outline-none"
                          />
                          <button
                            onClick={handleConfirmRename}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Confirm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Cancel"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-white/90 sports-font truncate">{player.player_name}</span>
                          {player.player_id === currentPlayerId && (
                            <span className="text-[10px] text-white/40 sports-font flex-shrink-0">(you)</span>
                          )}
                          {/* Rename button - host only, for non-host players */}
                          {isHost && !player.is_host && lobby.status === 'waiting' && (
                            <button
                              onClick={() => handleStartRename(player.player_id, player.player_name)}
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
                      {(player.score_multiplier ?? 1) > 1 && lobby.game_type !== 'career' && lobby.game_type !== 'scramble' && (
                        <span className="text-[10px] text-purple-400 sports-font px-1.5 py-0.5 bg-purple-900/40 rounded flex-shrink-0">{player.score_multiplier}x</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Kick button - host only, for non-host players */}
                      {isHost && !player.is_host && lobby.status === 'waiting' && (
                        <button
                          onClick={() => handleKickPlayer(player.player_id)}
                          className="px-2 py-1 rounded-sm text-[9px] font-bold sports-font uppercase tracking-wider transition-all bg-black/40 text-red-400/60 border border-white/10 hover:border-red-500 hover:text-red-400"
                          title="Kick player"
                        >
                          Kick
                        </button>
                      )}
                      {/* Team assignment button - host only, waiting state, roster mode only */}
                      {isHost && lobby.status === 'waiting' && lobby.game_type !== 'career' && lobby.game_type !== 'scramble' && (
                        <button
                          onClick={() => handleCycleTeam(player.player_id, player.team_number)}
                          className={`px-2 py-1 rounded-sm text-[9px] font-bold sports-font uppercase tracking-wider transition-all ${
                            player.team_number
                              ? 'text-white border'
                              : 'bg-black/40 text-white/40 border border-white/10 hover:border-white/30'
                          }`}
                          style={player.team_number ? {
                            backgroundColor: teamColor!.bg + '40',
                            borderColor: teamColor!.bg,
                            color: teamColor!.bg,
                          } : undefined}
                          title="Click to assign team"
                        >
                          {player.team_number ? `T${player.team_number}` : 'Team'}
                        </button>
                      )}
                      {/* Show team label for non-host when teams are assigned, roster mode only */}
                      {!isHost && player.team_number && lobby.game_type !== 'career' && lobby.game_type !== 'scramble' && (
                        <span
                          className="px-2 py-1 rounded-sm text-[9px] font-bold sports-font uppercase tracking-wider border"
                          style={{
                            backgroundColor: teamColor!.bg + '40',
                            borderColor: teamColor!.bg,
                            color: teamColor!.bg,
                          }}
                        >
                          T{player.team_number}
                        </span>
                      )}
                      {/* Score multiplier cycle - host only, for non-host players, roster mode only */}
                      {isHost && !player.is_host && lobby.status === 'waiting' && lobby.game_type !== 'career' && lobby.game_type !== 'scramble' && lobby.game_type !== 'lineup-is-right' && (
                        <button
                          onClick={() => {
                            const MULTIPLIERS = [1, 1.5, 2, 3, 4];
                            const cur = player.score_multiplier ?? 1;
                            const idx = MULTIPLIERS.indexOf(cur);
                            const next = MULTIPLIERS[(idx + 1) % MULTIPLIERS.length];
                            setPlayerScoreMultiplier(lobby.id, player.player_id, next);
                          }}
                          className={`px-2 py-1 rounded-sm text-[9px] font-bold sports-font uppercase tracking-wider transition-all ${
                            (player.score_multiplier ?? 1) > 1
                              ? 'bg-purple-600 text-white border border-purple-400'
                              : 'bg-black/40 text-white/40 border border-white/10 hover:border-purple-400 hover:text-purple-400'
                          }`}
                          title="Click to cycle score multiplier (1x → 1.5x → 2x → 3x → 4x)"
                        >
                          {(player.score_multiplier ?? 1) > 1 ? `${player.score_multiplier}x` : '1x'}
                        </button>
                      )}
                      <div
                        className={`px-3 py-1 rounded-sm text-[10px] font-bold sports-font uppercase tracking-wider ${
                          player.is_ready
                            ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700'
                            : 'bg-black/40 text-white/40 border border-white/10'
                        }`}
                      >
                        {player.is_ready ? 'Ready' : 'Waiting'}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
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
                  ? 'bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1'
                  : 'bg-black/50 text-white/70 border-2 border-[#d4af37] hover:bg-[#d4af37]/10'
              }`}
            >
              {isLoadingRoster ? 'Starting...' : currentPlayer.is_ready ? '✓ Ready (click to unready)' : 'Ready Up'}
            </button>
          )}

          {lobby.game_type === 'scramble' ? (
            <>
              {/* Scramble mode: start button */}
              {isHost && players.every(p => p.is_ready) && lobby.status === 'waiting' && (
                <button
                  onClick={handleScrambleStart}
                  disabled={isLoadingRoster}
                  className="w-full py-4 rounded-sm retro-title text-lg tracking-wider transition-all bg-gradient-to-b from-[#3b82f6] to-[#2563eb] text-white shadow-[0_4px_0_#1d4ed8] active:shadow-none active:translate-y-1 disabled:opacity-50"
                >
                  {isLoadingRoster ? 'Loading Player...' : 'Start Name Scramble'}
                </button>
              )}
            </>
          ) : lobby.game_type === 'career' ? (
            <>
              {/* Career mode: start button */}
              {isHost && players.every(p => p.is_ready) && lobby.status === 'waiting' && (
                <button
                  onClick={handleCareerStart}
                  disabled={isLoadingRoster}
                  className="w-full py-4 rounded-sm retro-title text-lg tracking-wider transition-all bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_4px_0_#166534] active:shadow-none active:translate-y-1 disabled:opacity-50"
                >
                  {isLoadingRoster ? 'Loading Player...' : 'Start Career Mode'}
                </button>
              )}
            </>
          ) : lobby.game_type === 'lineup-is-right' ? (
            <>
              {/* Lineup Is Right mode: start button */}
              {isHost && players.every(p => p.is_ready) && lobby.status === 'waiting' && (
                <button
                  onClick={handleLineupIsRightStart}
                  disabled={isLoadingRoster}
                  className="w-full py-4 rounded-sm retro-title text-lg tracking-wider transition-all bg-gradient-to-b from-[#ec4899] to-[#be185d] text-white shadow-[0_4px_0_#831843] active:shadow-none active:translate-y-1 disabled:opacity-50"
                >
                  {isLoadingRoster ? 'Loading Game...' : 'Start Lineup Is Right'}
                </button>
              )}
            </>
          ) : (
            <>
              {/* Roster mode: host start button - shows when all ready */}
              {isHost && allReady && lobby.status === 'waiting' && (
                <button
                  onClick={handleManualStart}
                  disabled={isLoadingRoster}
                  className="w-full py-4 rounded-sm retro-title text-lg tracking-wider transition-all bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_4px_0_#166534] active:shadow-none active:translate-y-1"
                >
                  Deal Cards
                </button>
              )}

              {/* Roster mode: host force start */}
              {isHost && players.length >= 2 && !allReady && lobby.status === 'waiting' && (
                <button
                  onClick={handleManualStart}
                  disabled={isLoadingRoster}
                  className="w-full py-3 rounded-sm sports-font text-sm tracking-wider transition-all bg-black/50 text-white/50 border border-white/20 hover:border-orange-500 hover:text-orange-400"
                >
                  Force Start ({players.filter(p => p.is_ready).length}/{players.length} ready)
                </button>
              )}
            </>
          )}

          {/* Status messages */}
          {players.length < 2 && (
            <p className="text-center text-white/30 text-sm sports-font tracking-widest">
              Share the code above to invite players
            </p>
          )}

          {/* Tip for stuck screens */}
          <p className="text-center text-white/20 text-[10px] sports-font tracking-wider mt-4">
            Tip: If stuck on empty screen, refresh page to rejoin
          </p>
        </motion.div>
      </main>
    </div>
  );
}
