/**
 * LobbyWaitingPage.tsx — Multiplayer waiting room orchestrator.
 *
 * Holds all async logic and Supabase writes. The UI lives in sub-components:
 *
 *   LobbyJoinPrompt    — full-screen join form for direct-link arrivals
 *   LobbyGameInfo      — current game info card + session wins scoreboard
 *   LobbyHostSettings  — expandable settings accordion (host only)
 *   LobbyPlayerList    — per-player rows with ready state, kick, rename, teams
 *   LobbyActionButtons — ready toggle, start/force-start, how-to-play
 *
 * Navigation after lobby status changes is handled in the lobby status effect.
 * Stuck detection auto-reloads after 8s if Supabase realtime misses the payload.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { useGameStore } from '../../stores/gameStore';
import { fetchTeamRoster, fetchDivisionRosters, fetchStaticSeasonPlayers, fetchStaticNFLRoster, fetchStaticNFLSeasonPlayers } from '../../services/roster';
import { teams, getNBADivisions, getNBATeamsByDivision } from '../../data/teams';
import { nflTeams, getNFLDivisions, getNFLTeamsByDivision } from '../../data/nfl-teams';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus, getStoredPlayerName, startCareerRound } from '../../services/lobby';
import { getNextGame, startPrefetch } from '../../services/careerPrefetch';
import { selectRandomStatCategory, generateTargetCap, assignRandomTeam } from '../../services/capCrunch';
import { getRandomNBAScramblePlayer, getRandomNFLScramblePlayer, loadNBALineupPool, loadNFLLineupPool } from '../../services/careerData';
import type { NBACareerPlayer, NFLCareerPlayer } from '../../services/careerData';
import { DEFENSE_ALLOWLIST } from '../../data/faceRevealDefenseAllowlist';
import { getRandomBoxScoreGame, ALL_BOX_SCORE_YEARS } from '../../services/boxScoreData';
import { loadNFLStarters, getRandomNFLTeamAndSide, getRandomEncoding, pickBestEncoding, loadNBAStarters, getRandomNBATeam } from '../../services/startingLineupData';
import { scrambleName } from '../../utils/scramble';
import { RouletteOverlay } from '../../components/home/RouletteOverlay';
import { LobbyJoinPrompt }    from '../../components/lobby/LobbyJoinPrompt';
import { LobbyGameInfo }      from '../../components/lobby/LobbyGameInfo';
import { LobbyHostSettings }  from '../../components/lobby/LobbyHostSettings';
import { LobbyPlayerList }    from '../../components/lobby/LobbyPlayerList';
import { LobbyActionButtons } from '../../components/lobby/LobbyActionButtons';
import type { HostFormValues } from '../../components/lobby/LobbyHostSettings';
import type { Sport } from '../../types';

export function LobbyWaitingPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const {
    lobby, players, isHost, currentPlayerId,
    setLobby, setPlayers, leaveLobby, setReady, startGame,
    updateSettings, assignTeam, joinExistingLobby, updateCareerState,
  } = useLobbyStore();
  const setGameConfig      = useGameStore(s => s.setGameConfig);
  const setDivisionRosters = useGameStore(s => s.setDivisionRosters);

  // ── Core state ────────────────────────────────────────────────────────────
  const [isLoadingRoster,      setIsLoadingRoster]      = useState(false);
  const [isLoadingLobby,       setIsLoadingLobby]       = useState(true);
  const [copied,               setCopied]               = useState(false);
  const [showDealingAnimation, setShowDealingAnimation] = useState(false);
  const [rerollCount,          setRerollCount]          = useState(0);
  const [showSettings,         setShowSettings]         = useState(false);

  // Join prompt (for players arriving via direct link)
  const [joinName,  setJoinName]  = useState(getStoredPlayerName() || '');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Refs to prevent duplicate game-start side-effects
  const hasStartedGame  = useRef(false);
  const hasAutoStarted  = useRef(false);
  const prevTeamRef     = useRef<string | null>(null);
  const prevSeasonRef   = useRef<string | null>(null);

  useLobbySubscription(lobby?.id || null);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Stuck detection: if lobby hasn't loaded within 8s, force a reload
  useEffect(() => {
    if (!isLoadingLobby && lobby) return;
    const t = setTimeout(() => { if (isLoadingLobby || !lobby) window.location.reload(); }, 8000);
    return () => clearTimeout(t);
  }, [isLoadingLobby, lobby]);

  // Initial lobby load
  useEffect(() => {
    const loadLobby = async () => {
      if (!code) { navigate('/'); return; }
      setIsLoadingLobby(true);
      hasStartedGame.current = false;
      hasAutoStarted.current = false;

      const result = await findLobbyByCode(code);
      if (result.lobby) {
        setLobby(result.lobby);
        const playersResult = await getLobbyPlayers(result.lobby.id);
        if (playersResult.players) setPlayers(playersResult.players);
        if (result.lobby.status === 'waiting') setShowDealingAnimation(false);
      } else {
        navigate('/lobby/join');
      }
      setIsLoadingLobby(false);
    };
    loadLobby();
  }, [code, navigate, setLobby, setPlayers]);

  // ── Roster dealing complete ───────────────────────────────────────────────
  // Defined early because the lobby-status effect references it.
  const handleDealingComplete = useCallback(async () => {
    if (hasStartedGame.current) return;
    hasStartedGame.current = true;

    if (isHost && lobby && lobby.status === 'countdown') {
      await updateLobbyStatus(lobby.id, 'playing');
    }
    if (!lobby) return;
    setIsLoadingRoster(true);

    try {
      const freshLobbyResult = await findLobbyByCode(lobby.join_code);
      const freshLobby = freshLobbyResult.lobby || lobby;
      const lobbySport = freshLobby.sport as Sport;
      const lobbyTeamList = lobbySport === 'nba' ? teams : nflTeams;
      const lobbyTeam = lobbyTeamList.find(t => t.abbreviation === freshLobby.team_abbreviation);

      if (!lobbyTeam) { console.error('Team not found:', freshLobby.team_abbreviation); setIsLoadingRoster(false); return; }

      let rosterPlayers: any[] = [];
      let leaguePlayers: any[] = [];
      const isDivisionMode = freshLobby.selection_scope === 'division' && freshLobby.division_conference && freshLobby.division_name;

      if (isDivisionMode) {
        const divTeams = lobbySport === 'nba'
          ? getNBATeamsByDivision(freshLobby.division_conference!, freshLobby.division_name!)
          : getNFLTeamsByDivision(freshLobby.division_conference! as 'AFC' | 'NFC', freshLobby.division_name!);
        const divResult = await fetchDivisionRosters(lobbySport, divTeams.map(t => t.abbreviation), freshLobby.season);
        rosterPlayers = divResult.combined;
        setDivisionRosters(divResult.byTeam, divTeams.map(t => t.abbreviation));
        leaguePlayers = lobbySport === 'nba'
          ? await fetchStaticSeasonPlayers(freshLobby.season) ?? []
          : await fetchStaticNFLSeasonPlayers(parseInt(freshLobby.season)) ?? [];
      } else if (lobbySport === 'nba') {
        const result = await fetchTeamRoster(lobbyTeam.abbreviation, freshLobby.season);
        rosterPlayers = result.players;
        leaguePlayers = await fetchStaticSeasonPlayers(freshLobby.season) ?? [];
      } else {
        rosterPlayers = await fetchStaticNFLRoster(lobbyTeam.abbreviation, parseInt(freshLobby.season)) ?? [];
        leaguePlayers = await fetchStaticNFLSeasonPlayers(parseInt(freshLobby.season)) ?? [];
      }

      setGameConfig(lobbySport, lobbyTeam, freshLobby.season, 'manual', freshLobby.timer_duration, rosterPlayers, leaguePlayers, false);
      navigate('/game', { state: { multiplayer: true, lobbyId: freshLobby.id } });
    } catch (err) {
      console.error('Error loading roster:', err);
    } finally {
      setIsLoadingRoster(false);
    }
  }, [isHost, lobby, navigate, setGameConfig, setDivisionRosters]);

  // Watch lobby status — navigate to the right game page when the game starts
  useEffect(() => {
    if (!lobby) return;

    if (lobby.status === 'waiting') {
      setShowDealingAnimation(false);
      hasStartedGame.current = false;
      hasAutoStarted.current = false;
    } else if (lobby.status === 'countdown') {
      if (lobby.game_type !== 'career' && lobby.game_type !== 'scramble' && lobby.game_type !== 'starting-lineup') {
        setShowDealingAnimation(true);
      }
    } else if (lobby.status === 'playing') {
      if (lobby.game_type === 'scramble') {
        if (!hasStartedGame.current) { hasStartedGame.current = true; navigate(`/lobby/${code}/scramble`); }
      } else if (lobby.game_type === 'career') {
        if (!hasStartedGame.current) { hasStartedGame.current = true; navigate(`/lobby/${code}/career`); }
      } else if (lobby.game_type === 'lineup-is-right') {
        if (!hasStartedGame.current) { hasStartedGame.current = true; navigate(`/lobby/${code}/lineup-is-right`); }
      } else if (lobby.game_type === 'box-score') {
        if (!hasStartedGame.current) { hasStartedGame.current = true; navigate(`/lobby/${code}/box-score`); }
      } else if (lobby.game_type === 'starting-lineup') {
        if (!hasStartedGame.current) { hasStartedGame.current = true; navigate(`/lobby/${code}/starting-lineup`); }
      } else if (lobby.game_type === 'face-reveal') {
        if (!hasStartedGame.current) { hasStartedGame.current = true; navigate(`/lobby/${code}/face-reveal`); }
      } else {
        // Roster mode: trigger dealing animation; non-hosts jump straight to game load
        if (!hasStartedGame.current) {
          setShowDealingAnimation(true);
          if (!isHost) handleDealingComplete();
        }
      }
    } else if (lobby.status === 'finished') {
      const routes: Record<string, string> = {
        career: `/lobby/${code}/career/results`,
        scramble: `/lobby/${code}/scramble/results`,
        'lineup-is-right': `/lobby/${code}/lineup-is-right/results`,
        'box-score': `/lobby/${code}/box-score/results`,
        'starting-lineup': `/lobby/${code}/starting-lineup/results`,
        'face-reveal': `/lobby/${code}/face-reveal/results`,
      };
      navigate(routes[lobby.game_type] ?? `/lobby/${code}/results`);
    }
  }, [lobby?.status, showDealingAnimation, isHost, handleDealingComplete, lobby, navigate, code]);

  // Revert to waiting if players un-ready before host force-started
  useEffect(() => {
    const allReady = players.length > 1 && players.every(p => p.is_ready);
    if (lobby?.status === 'countdown' && !allReady && isHost && !hasAutoStarted.current) {
      updateLobbyStatus(lobby.id, 'waiting');
    }
  }, [players, lobby?.status, isHost]);

  // Non-host reroll detection: when team/season changes mid-animation, remount overlay
  useEffect(() => {
    if (!lobby) return;
    const { team_abbreviation: teamAbbr, season } = lobby;
    if (prevTeamRef.current === null) { prevTeamRef.current = teamAbbr; prevSeasonRef.current = season; return; }
    if (showDealingAnimation && !isHost && (teamAbbr !== prevTeamRef.current || season !== prevSeasonRef.current)) {
      setRerollCount(prev => prev + 1);
    }
    prevTeamRef.current = teamAbbr;
    prevSeasonRef.current = season;
  }, [lobby?.team_abbreviation, lobby?.season, showDealingAnimation, isHost]);

  // ── Game start handlers ───────────────────────────────────────────────────

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
      const cs = (lobby.career_state as any) || {};
      const game = await getNextGame(sport, { careerFrom: cs.career_from || 0, careerTo: cs.career_to || 0 });
      if (!game) { setIsLoadingRoster(false); return; }
      const newState = { ...game.data, sport: game.sport, round: 1, win_target: cs.win_target || 3, career_from: cs.career_from || 0, career_to: cs.career_to || 0 };
      await startCareerRound(lobby.id, newState);
      startPrefetch(sport);
      setLobby({ ...lobby, career_state: newState, status: 'playing' });
      navigate(`/lobby/${code}/career`);
    } catch { setIsLoadingRoster(false); }
  };

  const handleScrambleStart = async () => {
    if (!isHost || !lobby) return;
    setIsLoadingRoster(true);
    hasStartedGame.current = true;
    try {
      const cs = (lobby.career_state as any) || {};
      const sport = lobby.sport as Sport;
      const filters = cs.career_to ? { careerTo: cs.career_to } : undefined;
      const player = sport === 'nba' ? await getRandomNBAScramblePlayer(filters) : await getRandomNFLScramblePlayer(filters);
      if (!player) { setIsLoadingRoster(false); return; }
      const newState = { playerName: player.player_name, scrambledName: scrambleName(player.player_name), sport, round: 1, win_target: cs.win_target || 20, career_to: cs.career_to || 0 };
      await startCareerRound(lobby.id, newState);
      setLobby({ ...lobby, career_state: newState, status: 'playing' });
      navigate(`/lobby/${code}/scramble`);
    } catch { setIsLoadingRoster(false); }
  };

  const handleLineupIsRightStart = async () => {
    if (!isHost || !lobby) return;
    setIsLoadingRoster(true);
    hasStartedGame.current = true;
    try {
      const cs = (lobby.career_state as any) || {};
      const sport = lobby.sport as Sport;
      const forcedStat = cs.forcedStatCategory as string | null;
      const statCategory = (forcedStat && forcedStat !== 'random') ? forcedStat as any : selectRandomStatCategory(sport);
      const forcedCap = cs.forcedTargetCap as number | null;
      const targetCap = (forcedCap && forcedCap > 0) ? forcedCap : generateTargetCap(sport, statCategory);

      const playersResult = await getLobbyPlayers(lobby.id);
      const lobbyPlayers = playersResult.players || [];
      const initialLineups: Record<string, object> = {};
      lobbyPlayers.forEach(p => {
        initialLineups[p.player_id] = { playerId: p.player_id, playerName: p.player_name, selectedPlayers: [], totalStat: 0, isBusted: false, isFinished: false, hasPickedThisRound: false };
      });

      const hardMode = cs.hardMode || false;
      const blindMode = cs.blindMode || false;
      const pickTimer: number | null = (cs.pickTimer as number | null) ?? null;
      let playerOrder = lobbyPlayers.map((p: any) => p.player_id);
      if (hardMode && cs.firstPickerId) {
        const idx = playerOrder.indexOf(cs.firstPickerId);
        if (idx > 0) playerOrder = [...playerOrder.slice(idx), ...playerOrder.slice(0, idx)];
      }

      const firstTeam = assignRandomTeam(sport, statCategory);
      const newState = {
        sport, win_target: cs.win_target || 3, statCategory, targetCap,
        allLineups: initialLineups, currentRound: 1, totalRounds: cs.totalRounds || 5,
        currentTeam: firstTeam, usedTeams: [firstTeam],
        phase: 'picking', hardMode, blindMode, pickTimer,
        currentPickerId: hardMode && playerOrder.length > 0 ? playerOrder[0] : null,
        roundStartPickerIndex: 0, playerOrder, pickedPlayerSeasons: [],
      };
      await startCareerRound(lobby.id, newState);
      setLobby({ ...lobby, career_state: newState, status: 'playing' });
      navigate(`/lobby/${code}/lineup-is-right`);
    } catch { setIsLoadingRoster(false); }
  };

  const handleBoxScoreStart = async () => {
    if (!isHost || !lobby) return;
    setIsLoadingRoster(true);
    hasStartedGame.current = true;
    try {
      const cs = (lobby.career_state as any) || {};
      const minYear = cs.min_year || 2015;
      const maxYear = cs.max_year || 2024;
      const filteredYears = ALL_BOX_SCORE_YEARS.filter(y => y >= minYear && y <= maxYear);
      const game = await getRandomBoxScoreGame({ years: filteredYears.length > 0 ? filteredYears : undefined, team: cs.team || null });
      const newState = { type: 'box_score', game_id: game.game_id, season: game.season, min_year: minYear, max_year: maxYear, team: cs.team || null };
      await startCareerRound(lobby.id, newState);
      setPlayers(players.map(p => ({ ...p, finished_at: null, score: 0, guessed_count: 0, guessed_players: [], incorrect_guesses: [] })));
      setLobby({ ...lobby, career_state: newState, status: 'playing', started_at: new Date().toISOString() });
      navigate(`/lobby/${code}/box-score`);
    } catch { setIsLoadingRoster(false); }
  };

  const handleStartingLineupStart = async () => {
    if (!isHost || !lobby) return;
    setIsLoadingRoster(true);
    try {
      const cs = (lobby.career_state as any) || {};
      const sport = (cs.sport as 'nba' | 'nfl') || 'nfl';
      let pick: { team: string; players: any[] };
      let side: 'offense' | 'defense' | undefined;

      if (sport === 'nba') {
        pick = getRandomNBATeam(await loadNBAStarters());
      } else {
        const nflPick = getRandomNFLTeamAndSide(await loadNFLStarters());
        pick = nflPick;
        side = nflPick.side;
      }

      let enc = getRandomEncoding();
      const hasEncodingData = (p: any): boolean => enc === 'college' ? p.college_espn_id != null : enc === 'number' ? p.number != null : p.draft_pick != null;
      if (pick.players.filter(hasEncodingData).length < 5) enc = pickBestEncoding(pick.players);

      const newState: Record<string, unknown> = { sport, team: pick.team, encoding: enc, round: 1, win_target: cs.win_target || 10, unlock_epoch: 0 };
      if (side !== undefined) newState.side = side;

      await startCareerRound(lobby.id, newState);
      hasStartedGame.current = true;
      setLobby({ ...lobby, career_state: newState, status: 'playing' });
      navigate(`/lobby/${code}/starting-lineup`);
    } catch (err) {
      console.error('[StartingLineup] Failed to start game:', err);
      setIsLoadingRoster(false);
    }
  };

  const handleFaceRevealStart = async () => {
    if (!isHost || !lobby) return;
    setIsLoadingRoster(true);
    hasStartedGame.current = true;
    try {
      const cs = (lobby.career_state as any) || {};
      const sport = lobby.sport as 'nba' | 'nfl';
      const careerTo: number = cs.career_to || 0;
      const timerSecs: number = cs.timer || 60;
      const winTarget: number = cs.win_target || 20;
      const minYards: number    = cs.min_yards || 0;
      const minMpg: number      = cs.min_mpg   || 0;
      const defenseMode: string = cs.defense_mode || 'known';

      // Returns the team abbreviation a player spent the most seasons with.
      const getLongestTeam = (seasons: Array<{ team: string }>): string => {
        const counts: Record<string, number> = {};
        for (const s of seasons) {
          const team = (s.team || '').split('/')[0].trim();
          if (team) counts[team] = (counts[team] || 0) + 1;
        }
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      };

      // NFL pool filter: ST always out; offense filtered by yards; defense by mode.
      const NFL_OFF = new Set(['QB', 'RB', 'WR', 'TE', 'FB']);
      const NFL_ST  = new Set(['K', 'P', 'LS']);
      const nflInPool = (p: NFLCareerPlayer) => {
        if (NFL_ST.has(p.position)) return false;
        if (NFL_OFF.has(p.position)) {
          if (minYards === 0) return true;
          return p.seasons.some(
            (s: any) => (s.passing_yards || 0) + (s.rushing_yards || 0) + (s.receiving_yards || 0) >= minYards
          );
        }
        return defenseMode === 'all' || DEFENSE_ALLOWLIST.has(String(p.player_id));
      };

      // Load player pool and filter by era, yards, and MPG.
      let pool: { player_id: string | number; player_name: string; longestTeam: string }[] = [];
      if (sport === 'nba') {
        const all = await loadNBALineupPool();
        let filtered = all.filter((p: NBACareerPlayer) => p.player_id != null);
        if (careerTo) {
          filtered = filtered.filter((p: NBACareerPlayer) => {
            const years = p.seasons.map((s: any) => parseInt(s.season)).filter(Boolean);
            return years.length ? Math.max(...years) >= careerTo : false;
          });
        }
        if (minMpg) {
          filtered = filtered.filter((p: NBACareerPlayer) =>
            p.seasons.some((s: any) => (s.min ?? 0) >= minMpg)
          );
        }
        pool = filtered.map((p: NBACareerPlayer) => ({
          player_id: p.player_id,
          player_name: p.player_name,
          longestTeam: getLongestTeam(p.seasons),
        }));
      } else {
        const all = await loadNFLLineupPool();
        let filtered = all.filter((p: NFLCareerPlayer) => p.player_id != null);
        if (careerTo) {
          filtered = filtered.filter((p: NFLCareerPlayer) => {
            const years = p.seasons.map((s: any) => parseInt(s.season)).filter(Boolean);
            return years.length ? Math.max(...years) >= careerTo : false;
          });
        }
        filtered = filtered.filter(nflInPool);
        pool = filtered.map((p: NFLCareerPlayer) => ({
          player_id: p.player_id,
          player_name: p.player_name,
          position: p.position,
          longestTeam: getLongestTeam(p.seasons),
        } as any));
      }

      if (!pool.length) { setIsLoadingRoster(false); return; }

      // Weighted pick: NFL offensive positions 3×, others 1×.
      const totalWeight = pool.reduce((s: number, p: any) => s + (NFL_OFF.has(p.position) ? 3 : 1), 0);
      let r = Math.random() * totalWeight;
      let chosen = pool[pool.length - 1];
      for (const p of pool) {
        r -= NFL_OFF.has((p as any).position) ? 3 : 1;
        if (r <= 0) { chosen = p; break; }
      }
      const focalX = Math.round(38 + Math.random() * 24);
      const focalY = Math.round(20 + Math.random() * 16);
      const newState = {
        sport,
        win_target: winTarget,
        career_to: careerTo,
        timer: timerSecs,
        min_yards: minYards,
        min_mpg: minMpg,
        defense_mode: defenseMode,
        round: 1,
        player_name: chosen.player_name,
        player_id: chosen.player_id,
        longest_team: chosen.longestTeam ?? '',
        zoom_level: 1,
        zoom_deadline: new Date(Date.now() + timerSecs * 1000).toISOString(),
        focal_x: focalX,
        focal_y: focalY,
      };

      await startCareerRound(lobby.id, newState);
      setLobby({ ...lobby, career_state: newState, status: 'playing' });
      navigate(`/lobby/${code}/face-reveal`);
    } catch {
      hasStartedGame.current = false;
      setIsLoadingRoster(false);
    }
  };

  const handleReroll = useCallback(async () => {
    if (!isHost || !lobby) return;
    const currentSport = lobby.sport as Sport;
    const minYear = Math.max(lobby.min_year || 2000, 2000);
    const maxYear = Math.min(lobby.max_year || 2025, 2025);
    const randomYear = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
    const newSeason = currentSport === 'nba' ? `${randomYear}-${String(randomYear + 1).slice(-2)}` : `${randomYear}`;

    if (lobby.selection_scope === 'division') {
      const allDivisions = currentSport === 'nba' ? getNBADivisions() : getNFLDivisions();
      const randomDiv = allDivisions[Math.floor(Math.random() * allDivisions.length)];
      const divTeams = currentSport === 'nba'
        ? getNBATeamsByDivision(randomDiv.conference, randomDiv.division)
        : getNFLTeamsByDivision(randomDiv.conference as 'AFC' | 'NFC', randomDiv.division);
      await updateSettings({ teamAbbreviation: divTeams[0]?.abbreviation || lobby.team_abbreviation, season: newSeason, divisionConference: randomDiv.conference, divisionName: randomDiv.division });
    } else {
      const currentTeamList = currentSport === 'nba' ? teams : nflTeams;
      const randomTeam = currentTeamList[Math.floor(Math.random() * currentTeamList.length)];
      await updateSettings({ teamAbbreviation: randomTeam.abbreviation, season: newSeason });
    }
    setRerollCount(prev => prev + 1);
  }, [isHost, lobby, updateSettings]);

  // ── Settings apply (called from LobbyHostSettings via HostFormValues) ─────
  const handleApplySettings = async (v: HostFormValues) => {
    if (!isHost || !lobby) return;

    if (v.gameType !== lobby.game_type) await updateSettings({ gameType: v.gameType });

    if (v.gameType === 'scramble') {
      const newState = { ...(lobby.career_state as any) || {}, win_target: v.winTarget, career_to: v.careerTo };
      await updateCareerState(newState);
      await updateSettings({ sport: v.sport });
      setLobby({ ...lobby, career_state: newState, sport: v.sport });
    } else if (v.gameType === 'career') {
      const newState = { ...(lobby.career_state as any) || {}, win_target: v.winTarget, career_from: v.careerFrom, career_to: v.careerTo };
      await updateCareerState(newState);
      await updateSettings({ sport: v.sport });
      setLobby({ ...lobby, career_state: newState, sport: v.sport });
    } else if (v.gameType === 'lineup-is-right') {
      const newState = { ...(lobby.career_state as any) || {}, sport: v.sport, forcedStatCategory: v.lineupStat === 'random' ? null : v.lineupStat, forcedTargetCap: (v.lineupStat !== 'random' && v.customCap) ? v.customCap : null, hardMode: v.hardMode, blindMode: v.blindMode, pickTimer: v.pickTimer ?? null, firstPickerId: v.hardMode ? v.firstPickerId : null, totalRounds: v.totalRounds };
      await updateCareerState(newState);
      await updateSettings({ sport: v.sport });
      setLobby({ ...lobby, career_state: newState, sport: v.sport });
    } else if (v.gameType === 'box-score') {
      const newState = { ...(lobby.career_state as any) || {}, type: 'box_score', min_year: v.boxMinYear, max_year: v.boxMaxYear, team: v.boxTeam };
      await updateCareerState(newState);
      await updateSettings({ timerDuration: v.timer });
      setLobby({ ...lobby, career_state: newState });
    } else if (v.gameType === 'starting-lineup') {
      const newState = { ...(lobby.career_state as any) || {}, win_target: v.winTarget, sport: v.startingSport };
      await updateCareerState(newState);
      setLobby({ ...lobby, career_state: newState });
    } else if (v.gameType === 'face-reveal') {
      const newState = { ...(lobby.career_state as any) || {}, win_target: v.winTarget, career_to: v.careerTo, timer: v.faceRevealTimer, min_yards: v.faceRevealMinYards, min_mpg: v.faceRevealMinMpg, defense_mode: v.faceRevealDefenseMode };
      await updateCareerState(newState);
      await updateSettings({ sport: v.sport });
      setLobby({ ...lobby, career_state: newState, sport: v.sport });
    } else {
      // Roster mode
      const finalSport: Sport = v.randomSport ? (Math.random() < 0.5 ? 'nba' : 'nfl') : v.sport;
      const newTeamList = finalSport === 'nba' ? teams : nflTeams;
      const finalScope = v.randomSport ? 'team' : v.selectionScope;
      const finalGameMode = v.randomSport ? 'random' : v.gameMode;
      let newTeamAbbreviation: string;
      let newSeason: string;

      if (finalGameMode === 'manual' && v.team && !v.randomSport) {
        newTeamAbbreviation = v.team.abbreviation;
        newSeason = finalSport === 'nba' && v.year ? `${v.year}-${String(v.year + 1).slice(-2)}` : v.year ? `${v.year}` : lobby.season;
      } else {
        const randomTeam = newTeamList[Math.floor(Math.random() * newTeamList.length)];
        newTeamAbbreviation = randomTeam.abbreviation;
        const minYear = Math.max(v.minYear, 2000);
        const maxYear = Math.min(v.maxYear, 2025);
        const randomYear = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
        newSeason = finalSport === 'nba' ? `${randomYear}-${String(randomYear + 1).slice(-2)}` : `${randomYear}`;
      }

      let divisionConference: string | null = null;
      let divisionNameVal: string | null = null;
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

      await updateSettings({ sport: finalSport, teamAbbreviation: newTeamAbbreviation, season: newSeason, timerDuration: v.timer, gameMode: finalGameMode, minYear: v.minYear, maxYear: v.maxYear, selectionScope: finalScope, divisionConference, divisionName: divisionNameVal });
    }

    setShowSettings(false);
  };

  // ── Misc handlers ─────────────────────────────────────────────────────────

  const handleLeave = async () => { await leaveLobby(); navigate('/'); };

  const handleCopyCode = () => {
    if (lobby?.join_code) {
      navigator.clipboard.writeText(lobby.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
      const playersResult = await getLobbyPlayers(lobby.id);
      if (playersResult.players) setPlayers(playersResult.players);
    } else {
      setJoinError('Failed to join lobby');
    }
    setIsJoining(false);
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const currentPlayer = players.find(p => p.player_id === currentPlayerId);
  const isSpectator   = !isLoadingLobby && lobby && !currentPlayer;
  const allReady      = players.length > 1 && players.every(p => p.is_ready);
  const sport         = (lobby?.sport as Sport) || 'nba';
  const teamList      = sport === 'nba' ? teams : nflTeams;
  let   team          = lobby ? teamList.find(t => t.abbreviation === lobby.team_abbreviation) : null;

  // Fallback: sport may have changed before team_abbreviation synced
  if (!team && lobby) {
    const otherList = sport === 'nba' ? nflTeams : teams;
    team = otherList.find(t => t.abbreviation === lobby.team_abbreviation) ?? teamList[0];
  }

  // ── Early returns ─────────────────────────────────────────────────────────

  if (!lobby || isLoadingLobby) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d2a0b]">
        <div className="text-white/50 sports-font">Loading table...</div>
      </div>
    );
  }

  if (isSpectator && lobby.status === 'waiting') {
    return (
      <LobbyJoinPrompt
        lobby={lobby}
        players={players}
        joinName={joinName}
        setJoinName={setJoinName}
        isJoining={isJoining}
        joinError={joinError}
        onJoin={handleJoinFromLink}
      />
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#0d2a0b] text-white relative overflow-hidden">
      {/* Green felt background */}
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)' }} />

      {/* Dealing animation overlay */}
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

          {/* Join code copy button */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 px-4 py-2 bg-black/50 rounded-sm border border-white/20 hover:border-[#d4af37] transition-colors"
          >
            <span className="font-mono text-xl tracking-widest text-[#d4af37]">{lobby.join_code}</span>
            <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied && <span className="text-emerald-400 text-sm sports-font">Copied!</span>}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full p-6 space-y-6">
        <LobbyGameInfo
          lobby={lobby}
          players={players}
          isHost={isHost}
          onToggleSettings={() => setShowSettings(s => !s)}
        />

        {isHost && showSettings && lobby.status === 'waiting' && (
          <LobbyHostSettings
            lobby={lobby}
            players={players}
            onApply={handleApplySettings}
          />
        )}

        <LobbyPlayerList
          players={players}
          currentPlayerId={currentPlayerId}
          isHost={isHost}
          lobby={lobby}
          onPlayersRefresh={(updated) => setPlayers(updated as any)}
          onCycleTeam={handleCycleTeam}
        />

        <LobbyActionButtons
          lobby={lobby}
          players={players}
          currentPlayer={currentPlayer}
          isHost={isHost}
          isLoadingRoster={isLoadingRoster}
          allReady={allReady}
          onReadyToggle={() => currentPlayer && setReady(!currentPlayer.is_ready)}
          onManualStart={handleManualStart}
          onCareerStart={handleCareerStart}
          onScrambleStart={handleScrambleStart}
          onLineupStart={handleLineupIsRightStart}
          onBoxScoreStart={handleBoxScoreStart}
          onStartingLineupStart={handleStartingLineupStart}
          onFaceRevealStart={handleFaceRevealStart}
        />
      </main>
    </div>
  );
}
