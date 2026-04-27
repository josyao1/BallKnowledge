/**
 * MultiplayerCapCrunchPage.tsx — Simultaneous Multiplayer Cap Crunch orchestrator.
 *
 * All players pick simultaneously each round:
 * 1. Same team shown to all players each round
 * 2. Each player searches for a player + selects a year they were on that team
 * 3. Once all players submit → host advances to next round (new team)
 * 4. If a pick exceeds the cap it busts — counts as 0, game always continues all 5 rounds
 * 5. After 5 rounds → results screen (highest score wins; tiebreak: fewest busts, then oldest avg year)
 *
 * UI lives in sub-components:
 *   CapCrunchHeader     — sticky header: team, target, stat, round counter
 *   CapCrunchPickPanel  — player search → year select → confirm flow
 *   CapCrunchScoresPanel — live lineups sidebar
 *   CapCrunchResultCard  — single player card on results screen
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { EmoteOverlay } from '../../components/multiplayer/EmoteOverlay';
import {
  findLobbyByCode,
  getLobbyPlayers,
  updateCareerState,
  updateLobbyStatus,
  incrementPlayerWins,
} from '../../services/lobby';
import {
  searchPlayersByNameOnly,
  getPlayerYearsOnTeam,
  getPlayerStatForYearAndTeam,
  getPlayerTotalGPForTeam,
  addPlayerToLineup,
  assignRandomTeam,
  findOptimalLastPick,
  isCareerStat,
  stripPositionSuffix,
} from '../../services/capCrunch';
import type { OptimalPick } from '../../services/capCrunch';
import type { PlayerLineup, SelectedPlayer, StatCategory } from '../../types/capCrunch';
import { CapCrunchHeader }      from '../../components/capCrunch/CapCrunchHeader';
import { CapCrunchPickPanel }   from '../../components/capCrunch/CapCrunchPickPanel';
import { CapCrunchScoresPanel } from '../../components/capCrunch/CapCrunchScoresPanel';
import { CapCrunchResultCard }  from '../../components/capCrunch/CapCrunchResultCard';
import { BlindModeReveal }      from '../../components/capCrunch/BlindModeReveal';
import { getCategoryAbbr }      from '../../components/capCrunch/capCrunchUtils';
import { getTotalColor }        from '../../components/capCrunch/SpinningNumber';

type Phase = 'loading' | 'picking' | 'blind-reveal' | 'results';

export function MultiplayerCapCrunchPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, currentPlayerId, isHost, setLobby, setPlayers } = useLobbyStore();

  const [phase, setPhase] = useState<Phase>('loading');
  const [statCategory, setStatCategory] = useState<StatCategory | null>(null);
  const [targetCap, setTargetCap] = useState<number>(0);
  const [allLineups, setAllLineups] = useState<Record<string, PlayerLineup>>({});
  const [mobileTab, setMobileTab] = useState<'pick' | 'scores'>('pick');
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(5);
  const totalRoundsRef = useRef(5);
  const [optimalPicks, setOptimalPicks] = useState<Map<string, OptimalPick | null>>(new Map());

  // Hard mode state
  const [hardMode, setHardMode] = useState(false);
  const [currentPickerId, setCurrentPickerId] = useState<string | null>(null);
  const [pickedPlayerSeasons, setPickedPlayerSeasons] = useState<string[]>([]);

  // Blind mode state
  const [blindMode, setBlindMode] = useState(false);
  const [revealStep, setRevealStep] = useState(0);

  // Pick timer setting (seconds); null = no timer
  const [pickTimer, setPickTimer] = useState<number | null>(null);
  // Active countdown displayed to this player; null = not counting down
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track what triggered the current countdown so we can detect changes
  const countdownKeyRef = useRef<string>(''); // "round:currentPickerId_or_lastPicker"
  // Signals the auto-skip effect to fire (set when interval hits 0)
  const [autoSkipNeeded, setAutoSkipNeeded] = useState(false);

  // Ephemeral UI state — never synced to Supabase
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ playerId: string | number; playerName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | number | null>(null);
  const [currentTeam, setCurrentTeam] = useState('');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [loadingYears, setLoadingYears] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [showExactHit, setShowExactHit] = useState(false);
  const [badFlashKey, setBadFlashKey] = useState(0);
  const exactHitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      if (exactHitTimerRef.current !== null) clearTimeout(exactHitTimerRef.current);
      confettiTimersRef.current.forEach(clearTimeout);
      if (countdownIntervalRef.current !== null) clearInterval(countdownIntervalRef.current);

    };
  }, []);

  // Prevent realtime sync from clobbering state mid-pick
  const addingPlayerRef = useRef(false);
  // Prevent host from double-advancing the same round
  const lastAdvancedRoundRef = useRef(0);
  // Prevent double-click on blind finish from inflating win counts
  const blindFinishingRef = useRef(false);
  // Detect round changes to reset ephemeral search UI
  const prevRoundRef = useRef(0);
  // Saved pick for race-condition recovery
  const mySubmittedLineupRef = useRef<any>(null);

  // ── Pick timer countdown — purely local, never synced to Supabase ──────────
  useEffect(() => {
    if (phase !== 'picking' || !pickTimer || !currentPlayerId) {
      // Not in picking phase or timer disabled — clear any running countdown
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(null);
      countdownKeyRef.current = '';
      return;
    }

    const cs = (lobby?.career_state as any) || {};
    const lineups = cs.allLineups || {};
    const playerIds: string[] = cs.playerOrder || Object.keys(lineups);

    // Determine whether this player should have an active countdown right now.
    // Hard mode: it's my turn (currentPickerId === me and I haven't picked)
    // Normal mode: I'm the last one who hasn't picked this round
    let shouldCountdown = false;
    const myLineupCs = lineups[currentPlayerId] as any;
    const iAlreadyPicked = myLineupCs?.hasPickedThisRound || myLineupCs?.isFinished;

    if (!iAlreadyPicked) {
      if (hardMode) {
        shouldCountdown = currentPickerId === currentPlayerId;
      } else {
        // Normal mode: countdown if I'm the only one left
        const stillWaiting = playerIds.filter(pid => {
          const l = lineups[pid] as any;
          return !l?.hasPickedThisRound && !l?.isFinished;
        });
        shouldCountdown = stillWaiting.length === 1 && stillWaiting[0] === currentPlayerId;
      }
    }

    // Build a key that uniquely identifies this countdown trigger.
    // When the key changes, reset the timer (new round or new hard-mode turn).
    const triggerKey = hardMode
      ? `${cs.currentRound}:${currentPickerId}`
      : `${cs.currentRound}:last`;

    if (!shouldCountdown) {
      // Not my turn / I already picked — clear countdown
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(null);
      countdownKeyRef.current = '';
      return;
    }

    // Same trigger as what's already running — don't restart
    if (countdownKeyRef.current === triggerKey && countdownIntervalRef.current !== null) {
      return;
    }

    // New trigger: clear old interval and start fresh
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownKeyRef.current = triggerKey;
    setCountdown(pickTimer);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (countdownIntervalRef.current !== null) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          countdownKeyRef.current = '';
          setAutoSkipNeeded(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  // allLineups is the reactive signal here — it changes whenever anyone picks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLineups, phase, pickTimer, currentPlayerId, currentPickerId, hardMode]);

  // ── Auto-skip when countdown expires ────────────────────────────────────────
  useEffect(() => {
    if (!autoSkipNeeded) return;
    setAutoSkipNeeded(false);
    // Only skip if it's actually still my turn (race-condition guard: I may have
    // picked manually in the same tick the timer fired)
    if (phase !== 'picking' || !canPickThisRound) return;
    handleAutoSkip();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSkipNeeded]);

  const selectedSport = ((lobby?.career_state as any)?.sport ?? null) as import('../../types').Sport | null;

  // Derived: my lineup and whether I can pick this round
  const myLineup = allLineups[currentPlayerId || ''] as (PlayerLineup & { hasPickedThisRound?: boolean }) | undefined;
  const canPickThisRound = hardMode
    ? (currentPickerId === currentPlayerId && !myLineup?.isFinished)
    : (!myLineup?.hasPickedThisRound && !myLineup?.isFinished);

  const usedPlayerNames = new Set(myLineup?.selectedPlayers.map(p => p.playerName) ?? []);
  const lockedPlayerNames = hardMode
    ? new Set(pickedPlayerSeasons.map(k => k.split('|')[0]))
    : new Set<string>();

  const isTotalGP = statCategory === 'total_gp';
  const isCareerStatRound = statCategory ? isCareerStat(statCategory) : false;
  const isNoYearSelect = isTotalGP || isCareerStatRound;

  useLobbySubscription(lobby?.id || null);

  // ── Mount: load lobby and read full game state from career_state ────────────
  useEffect(() => {
    if (!code) { navigate('/'); return; }

    const initGame = async () => {
      try {
        const result = await findLobbyByCode(code);
        if (!result.lobby) { navigate('/'); return; }

        setLobby(result.lobby);

        const playersResult = await getLobbyPlayers(result.lobby.id);
        const lobbyPlayers = Array.isArray(playersResult) ? playersResult : (playersResult?.players || []);
        if (lobbyPlayers.length > 0) setPlayers(lobbyPlayers);

        const cs = (result.lobby.career_state as any) || {};
        setStatCategory((cs.statCategory as StatCategory) || null);
        setTargetCap(cs.targetCap || 0);
        setAllLineups((cs.allLineups as Record<string, PlayerLineup>) || {});
        setCurrentRound(cs.currentRound ?? 1);
        setTotalRounds(cs.totalRounds ?? 5);
        totalRoundsRef.current = cs.totalRounds ?? 5;
        setCurrentTeam(cs.currentTeam || '');
        setHardMode(cs.hardMode || false);
        setBlindMode(cs.blindMode || false);
        setCurrentPickerId(cs.currentPickerId || null);
        setPickedPlayerSeasons(cs.pickedPlayerSeasons || []);
        setRevealStep(cs.revealStep ?? 0);
        setPickTimer((cs.pickTimer as number | null) ?? null);

        if (cs.phase === 'results') setPhase('results');
        else if (cs.phase === 'blind-reveal') { setPhase('blind-reveal'); }
        else if (cs.statCategory && cs.allLineups) setPhase('picking');
      } catch (error) {
        console.error('Error initializing game:', error);
        navigate('/');
      }
    };

    initGame();
  }, [code, navigate, setLobby, setPlayers]);

  // ── Realtime sync: when lobby.career_state changes, update local state ──────
  useEffect(() => {
    const cs = (lobby?.career_state as any);
    if (!cs?.statCategory || !cs?.allLineups) return;

    // Always process results/blind-reveal transitions — must not be blocked by addingPlayerRef
    if (cs.phase === 'results') {
      setAllLineups(cs.allLineups as Record<string, PlayerLineup>);
      if (exactHitTimerRef.current !== null) {
        clearTimeout(exactHitTimerRef.current);
        exactHitTimerRef.current = null;
        setShowExactHit(false);
      }
      setPhase('results');
      return;
    }
    if (cs.phase === 'blind-reveal') {
      setAllLineups(cs.allLineups as Record<string, PlayerLineup>);
      setRevealStep(cs.revealStep ?? 0);
      if (exactHitTimerRef.current !== null) {
        clearTimeout(exactHitTimerRef.current);
        exactHitTimerRef.current = null;
        setShowExactHit(false);
      }
      setPhase('blind-reveal');
      return;
    }

    if (addingPlayerRef.current) return; // don't clobber mid-pick for round changes

    const newRound = cs.currentRound ?? 1;

    // Reset ephemeral search UI when the round advances
    if (newRound !== prevRoundRef.current && prevRoundRef.current !== 0) {
      mySubmittedLineupRef.current = null;
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPlayerName(null);
      setSelectedYear('');
      setAvailableYears([]);
    }
    prevRoundRef.current = newRound;

    setStatCategory(cs.statCategory as StatCategory);
    setTargetCap(cs.targetCap);
    setAllLineups(cs.allLineups as Record<string, PlayerLineup>);
    setCurrentRound(newRound);
    setTotalRounds(cs.totalRounds ?? 5);
    setCurrentTeam(cs.currentTeam || '');
    setHardMode(cs.hardMode || false);
    setBlindMode(cs.blindMode || false);
    setCurrentPickerId(cs.currentPickerId || null);
    setPickedPlayerSeasons(cs.pickedPlayerSeasons || []);
    setPickTimer((cs.pickTimer as number | null) ?? null);

    if (phase === 'loading') setPhase('picking');

    // Race-condition recovery: if our submitted pick was overwritten by a
    // concurrent write (both players confirming within ~100ms), re-write it.
    if (
      mySubmittedLineupRef.current?.hasPickedThisRound === true &&
      currentPlayerId &&
      lobby?.id &&
      !cs.allLineups[currentPlayerId]?.hasPickedThisRound &&
      !cs.allLineups[currentPlayerId]?.isFinished
    ) {
      updateCareerState(lobby.id, {
        ...cs,
        allLineups: { ...cs.allLineups, [currentPlayerId]: mySubmittedLineupRef.current },
      }).catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.career_state]);

  // ── Host-only: advance round when all players have picked ───────────────────
  useEffect(() => {
    if (!isHost || !lobby?.career_state || !lobby?.id) return;

    const cs = lobby.career_state as any;
    if (cs.phase !== 'picking') return;

    const lineups = cs.allLineups || {};
    const playerIds: string[] = cs.playerOrder || Object.keys(lineups);
    if (playerIds.length === 0) return;

    const allPicked = playerIds.every(pid =>
      (lineups[pid] as any)?.hasPickedThisRound || (lineups[pid] as any)?.isFinished
    );
    if (!allPicked) return;

    const round = cs.currentRound || 1;
    if (lastAdvancedRoundRef.current >= round) return;
    lastAdvancedRoundRef.current = round;

    const lobbyId = lobby.id;
    const totalRds = cs.totalRounds || 5;
    const nextRound = round + 1;

    const advanceRound = async () => {
      if (nextRound > totalRds) {
        const isBlind = cs.blindMode || false;

        if (isBlind) {
          // Blind mode: go to reveal phase first; winner determined after all revealed
          await updateCareerState(lobbyId, { ...cs, phase: 'blind-reveal', revealStep: 0 });
        } else {
          // Normal mode: determine winner(s): highest score → fewest busts → oldest avg year
          const avgPickYear = (pid: string): number => {
            const picks = (lineups[pid] as any)?.selectedPlayers ?? [];
            if (picks.length === 0) return 2025;
            return picks.reduce((s: number, p: any) => s + (p.selectedYear === 'career' ? 2025 : (parseInt(p.selectedYear) || 2025)), 0) / picks.length;
          };
          const sorted = [...playerIds].sort((a, b) => {
            const la = lineups[a] as any, lb = lineups[b] as any;
            if (lb.totalStat !== la.totalStat) return lb.totalStat - la.totalStat;
            const aBusts = la.bustCount ?? 0, bBusts = lb.bustCount ?? 0;
            if (aBusts !== bBusts) return aBusts - bBusts;
            return avgPickYear(a) - avgPickYear(b);
          });
          if (sorted.length > 0) {
            const topPid = sorted[0];
            const topLineup = lineups[topPid] as any;
            const topStat = topLineup?.totalStat ?? 0;
            const topBusts = topLineup?.bustCount ?? 0;
            const topAvgYear = avgPickYear(topPid);
            for (const pid of sorted) {
              const l = lineups[pid] as any;
              if (
                l.totalStat === topStat &&
                (l.bustCount ?? 0) === topBusts &&
                avgPickYear(pid) === topAvgYear
              ) {
                await incrementPlayerWins(lobbyId, pid);
              } else {
                break;
              }
            }
          }
          await updateCareerState(lobbyId, { ...cs, phase: 'results' });
        }
      } else {
        // Next round: new team, reset hasPickedThisRound for active players
        const newTeam = assignRandomTeam(cs.sport || 'nba', cs.statCategory, cs.usedTeams || []);
        const resetLineups: Record<string, any> = {};
        playerIds.forEach(pid => {
          resetLineups[pid] = {
            ...lineups[pid],
            hasPickedThisRound: (lineups[pid] as any).isFinished ? true : false,
          };
        });

        // Hard mode: rotate first picker each round
        let hardModeUpdates: Record<string, any> = {};
        if (cs.hardMode) {
          const newRoundStartIndex = ((cs.roundStartPickerIndex ?? 0) + 1) % playerIds.length;
          let firstPicker: string | null = null;
          for (let i = 0; i < playerIds.length; i++) {
            const idx = (newRoundStartIndex + i) % playerIds.length;
            const pid = playerIds[idx];
            if (!resetLineups[pid]?.isFinished) {
              firstPicker = pid;
              break;
            }
          }
          hardModeUpdates = { currentPickerId: firstPicker, roundStartPickerIndex: newRoundStartIndex };
        }

        await updateCareerState(lobbyId, {
          ...cs,
          allLineups: resetLineups,
          currentRound: nextRound,
          currentTeam: newTeam,
          usedTeams: [...(cs.usedTeams || []), newTeam],
          ...hardModeUpdates,
        });
      }
    };

    advanceRound().catch(err => console.error('[advanceRound] Failed:', err));
  }, [lobby?.career_state, isHost, lobby?.id]);

  // ── Navigate back to lobby when host resets or abandons ────────────────────
  useEffect(() => {
    if ((lobby?.career_state as any)?.abandoned) { navigate(`/lobby/${code}`); return; }
    if (lobby?.status === 'waiting' && phase !== 'picking' && phase !== 'loading') {
      navigate(`/lobby/${code}`);
    }
  }, [lobby?.career_state, lobby?.status, phase, navigate, code]);

  // ── Compute optimal last picks once results screen loads ────────────────────
  useEffect(() => {
    if (phase !== 'results' || !statCategory || !selectedSport) return;
    const computeAll = async () => {
      const results = new Map<string, OptimalPick | null>();
      await Promise.all(
        players.map(async (p) => {
          const lineup = allLineups[p.player_id] as PlayerLineup | undefined;
          if (!lineup || lineup.selectedPlayers.length === 0) { results.set(p.player_id, null); return; }
          const lastPick = lineup.selectedPlayers[lineup.selectedPlayers.length - 1];
          const totalBeforeLast = lastPick.isBust
            ? lineup.totalStat
            : parseFloat((lineup.totalStat - lastPick.statValue).toFixed(1));
          const remainingBudget = parseFloat((targetCap - totalBeforeLast).toFixed(1));
          const excludeNames = hardMode
            ? pickedPlayerSeasons.map(k => k.split('|')[0]).filter(n => n !== lastPick.playerName)
            : undefined;
          const opt = await findOptimalLastPick(selectedSport, lastPick.team, statCategory, remainingBudget, lastPick.isBust ? 0 : lastPick.statValue, excludeNames);
          results.set(p.player_id, opt);
        })
      );
      setOptimalPicks(results);
    };
    computeAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handlePlayAgain = async () => {
    if (!isHost || !lobby) return;
    await updateLobbyStatus(lobby.id, 'waiting');
  };

  const handleEndGame = async () => {
    if (!isHost || !lobby) return;
    // Replacing career_state with {abandoned:true} signals all clients to return
    // to the lobby without processing results.
    await updateCareerState(lobby.id, { abandoned: true });
    await updateLobbyStatus(lobby.id, 'waiting');
  };

  const handleAutoSkip = async () => {
    if (!currentPlayerId || !lobby) return;
    const latestCS = (lobby.career_state as any) || {};
    const myCurrentLineup: any = latestCS.allLineups?.[currentPlayerId] || {
      playerId: currentPlayerId,
      playerName: players.find(p => p.player_id === currentPlayerId)?.player_name || '',
      selectedPlayers: [],
      totalStat: 0,
      bustCount: 0,
      isFinished: false,
      hasPickedThisRound: false,
    };
    // Don't skip if already acted this round
    if (myCurrentLineup.hasPickedThisRound || myCurrentLineup.isFinished) return;

    const skipPick: SelectedPlayer = {
      playerName: 'SKIPPED',
      team: currentTeam,
      selectedYear: 'career',
      playerSeason: null,
      statValue: 0,
      isBust: false,
      neverOnTeam: false,
      isSkipped: true,
    };

    const withSkip = addPlayerToLineup(myCurrentLineup as PlayerLineup, skipPick);
    withSkip.totalStat = myCurrentLineup.totalStat;
    withSkip.bustCount = myCurrentLineup.bustCount ?? 0;
    (withSkip as any).hasPickedThisRound = true;
    if (withSkip.selectedPlayers.length >= totalRoundsRef.current) {
      withSkip.isFinished = true;
    }

    let hardModeUpdates: Record<string, any> = {};
    if (latestCS.hardMode) {
      const allLineupsAfterSkip = { ...latestCS.allLineups, [currentPlayerId]: withSkip };
      const order: string[] = latestCS.playerOrder || players.map(p => p.player_id);
      const currentIdx = order.indexOf(currentPlayerId);
      let nextPickerId: string | null = null;
      for (let i = 1; i <= order.length; i++) {
        const pid = order[(currentIdx + i) % order.length];
        if (!((allLineupsAfterSkip[pid] as any)?.hasPickedThisRound) && !((allLineupsAfterSkip[pid] as any)?.isFinished)) {
          nextPickerId = pid;
          break;
        }
      }
      hardModeUpdates = { currentPickerId: nextPickerId };
    }

    const updatedCS = {
      ...latestCS,
      allLineups: { ...latestCS.allLineups, [currentPlayerId]: withSkip },
      ...hardModeUpdates,
    };
    await updateCareerState(lobby.id, updatedCS);
    mySubmittedLineupRef.current = withSkip;
    setAllLineups(prev => ({ ...prev, [currentPlayerId]: withSkip }));
  };

  const handleBlindReveal = async () => {
    if (!isHost || !lobby) return;
    const cs = (lobby.career_state as any) || {};
    const nextStep = (cs.revealStep ?? 0) + 1;
    if (nextStep > (cs.totalRounds ?? 5)) return;
    await updateCareerState(lobby.id, { ...cs, revealStep: nextStep });
  };

  const handleBlindFinish = async () => {
    if (!isHost || !lobby || blindFinishingRef.current) return;
    blindFinishingRef.current = true;
    const cs = (lobby.career_state as any) || {};
    const lineups = cs.allLineups || {};
    const playerIds: string[] = cs.playerOrder || Object.keys(lineups);
    const cap: number = cs.targetCap || 0;

    // Blind mode winner: absolute value closest to cap
    const rawTotal = (pid: string): number => {
      const picks = (lineups[pid] as any)?.selectedPlayers ?? [];
      return parseFloat(picks.reduce((s: number, p: any) => s + (p.statValue ?? 0), 0).toFixed(1));
    };
    const dist = (pid: string) => Math.abs(cap - rawTotal(pid));
    const sorted = [...playerIds].sort((a, b) => dist(a) - dist(b));

    if (sorted.length > 0) {
      const topDist = dist(sorted[0]);
      for (const pid of sorted) {
        if (dist(pid) === topDist) await incrementPlayerWins(lobby.id, pid);
        else break;
      }
    }
    await updateCareerState(lobby.id, { ...cs, phase: 'results' });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setDuplicateError(null);
    setPickError(null);
    if (!selectedSport || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const results = await searchPlayersByNameOnly(selectedSport, query, statCategory ?? undefined);
      setSearchResults(results);
    } catch (error) {
      console.error('[handleSearch] Failed:', error);
      setSearchResults([]);
      setPickError('Player search failed — please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlayer = async (player: { playerId: string | number; playerName: string }) => {
    if (usedPlayerNames.has(player.playerName)) {
      setDuplicateError(`You already used ${player.playerName} this game.`);
      return;
    }
    if (lockedPlayerNames.has(player.playerName)) {
      setDuplicateError(`${player.playerName} has already been picked this game.`);
      return;
    }
    setDuplicateError(null);
    setSelectedPlayerName(player.playerName);
    setSelectedPlayerId(player.playerId);
    setSelectedYear('');
    setAvailableYears([]);

    if (isNoYearSelect) return;

    setLoadingYears(true);
    try {
      const years = await getPlayerYearsOnTeam(selectedSport!, player.playerName, currentTeam, player.playerId);
      setAvailableYears(years);
    } catch (error) {
      console.error('[handleSelectPlayer] Failed to fetch years:', error);
      setAvailableYears([]);
    } finally {
      setLoadingYears(false);
    }
  };

  const handleBackFromPlayer = () => {
    setSelectedPlayerName(null);
    setSelectedPlayerId(null);
    setSelectedYear('');
    setAvailableYears([]);
  };

  const handleConfirmYear = async () => {
    if (!selectedPlayerName || !selectedSport || !statCategory || !lobby || !currentPlayerId) return;
    if (!isNoYearSelect && !selectedYear) return;

    addingPlayerRef.current = true;
    setAddingPlayer(true);
    try {
      const statResult = isTotalGP
        ? await getPlayerTotalGPForTeam(selectedSport as any, selectedPlayerName, currentTeam, selectedPlayerId ?? undefined)
        : isCareerStatRound
          ? await getPlayerStatForYearAndTeam(selectedSport as any, selectedPlayerName, currentTeam, 'career', statCategory, selectedPlayerId ?? undefined)
          : await getPlayerStatForYearAndTeam(selectedSport as any, selectedPlayerName, currentTeam, selectedYear, statCategory, selectedPlayerId ?? undefined);

      const statValue = statResult.value;
      const neverOnTeam = statResult.neverOnTeam;
      const actualTeam = statResult.actualTeam;
      const actualNflConf = statResult.actualNflConf;
      const actualCollege = statResult.actualCollege;

      const latestCS = (lobby.career_state as any) || {};
      const myCurrentLineup: any = latestCS.allLineups?.[currentPlayerId] || {
        playerId: currentPlayerId,
        playerName: players.find(p => p.player_id === currentPlayerId)?.player_name || '',
        selectedPlayers: [],
        totalStat: 0,
        bustCount: 0,
        isFinished: false,
        hasPickedThisRound: false,
      };

      const isBlindMode = (latestCS.blindMode || false) as boolean;
      const wouldBust = !isBlindMode && (myCurrentLineup.totalStat + statValue) > targetCap;

      const newSelectedPlayer: SelectedPlayer = {
        playerName: stripPositionSuffix(selectedPlayerName),
        team: currentTeam,
        selectedYear: isNoYearSelect ? 'career' : selectedYear,
        playerSeason: null,
        statValue,
        isBust: wouldBust,
        neverOnTeam,
        actualTeam,
        actualNflConf,
        actualCollege,
        playerId: selectedPlayerId ?? undefined,
      };

      const withNewPlayer = addPlayerToLineup(myCurrentLineup as PlayerLineup, newSelectedPlayer);
      if (wouldBust) {
        // Normal mode bust: revert total, increment bust count
        withNewPlayer.totalStat = myCurrentLineup.totalStat;
        withNewPlayer.bustCount = (myCurrentLineup.bustCount ?? 0) + 1;
      } else {
        // Blind mode: always accumulate (no revert); normal mode: accumulate if under cap
        withNewPlayer.totalStat = parseFloat((myCurrentLineup.totalStat + statValue).toFixed(1));
        withNewPlayer.bustCount = myCurrentLineup.bustCount ?? 0;
      }
      (withNewPlayer as any).hasPickedThisRound = true;
      // In blind mode, only finish when all rounds are played (no early exit on exact cap hit)
      const exactHit = !isBlindMode && !wouldBust && withNewPlayer.totalStat === targetCap;
      if (withNewPlayer.selectedPlayers.length >= totalRoundsRef.current || exactHit) {
        withNewPlayer.isFinished = true;
      }

      // Hard mode: compute next picker
      let hardModeUpdates: Record<string, any> = {};
      if (latestCS.hardMode && currentPlayerId) {
        const allLineupsAfterPick = { ...latestCS.allLineups, [currentPlayerId]: withNewPlayer };
        const order: string[] = latestCS.playerOrder || players.map(p => p.player_id);
        const currentIndexInOrder = order.indexOf(currentPlayerId);
        let nextPickerId: string | null = null;
        if (currentIndexInOrder === -1) {
          for (const pid of order) {
            if (!((allLineupsAfterPick[pid] as any)?.hasPickedThisRound) && !((allLineupsAfterPick[pid] as any)?.isFinished)) {
              nextPickerId = pid;
              break;
            }
          }
        } else {
          for (let i = 1; i < order.length; i++) {
            const pid = order[(currentIndexInOrder + i) % order.length];
            if (!((allLineupsAfterPick[pid] as any)?.hasPickedThisRound) && !((allLineupsAfterPick[pid] as any)?.isFinished)) {
              nextPickerId = pid;
              break;
            }
          }
        }
        const pickKey = `${selectedPlayerName}|${isTotalGP ? 'career' : selectedYear}|${currentTeam}`;
        hardModeUpdates = {
          currentPickerId: nextPickerId,
          pickedPlayerSeasons: [...(latestCS.pickedPlayerSeasons || []), pickKey],
        };
      }

      const updatedCS = {
        ...latestCS,
        allLineups: { ...latestCS.allLineups, [currentPlayerId]: withNewPlayer },
        ...hardModeUpdates,
      };

      await updateCareerState(lobby.id, updatedCS);

      mySubmittedLineupRef.current = withNewPlayer;
      setAllLineups(prev => ({ ...prev, [currentPlayerId]: withNewPlayer }));

      if (!isBlindMode && (wouldBust || statValue === 0)) setBadFlashKey(k => k + 1);

      if (!isBlindMode && !wouldBust && withNewPlayer.totalStat === targetCap) {
        setShowExactHit(true);
        confetti({ particleCount: 160, spread: 90, origin: { y: 0.55 }, colors: ['#d4af37', '#f5e6c8', '#ffffff', '#facc15', '#fbbf24'] });
        confettiTimersRef.current = [
          setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.4, x: 0.3 }, colors: ['#d4af37', '#ffffff'] }), 250),
          setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.4, x: 0.7 }, colors: ['#d4af37', '#ffffff'] }), 400),
        ];
        exactHitTimerRef.current = setTimeout(() => setShowExactHit(false), 2500);
      }

      setSearchQuery('');
      setSearchResults([]);
      setSelectedPlayerName(null);
      setSelectedPlayerId(null);
      setSelectedYear('');
      setAvailableYears([]);
    } catch (error) {
      console.error('Error confirming pick:', error);
      setPickError('Something went wrong adding that player. Please try again.');
    } finally {
      addingPlayerRef.current = false;
      setAddingPlayer(false);
    }
  };

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d2a0b] text-white flex items-center justify-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
        />
        <div className="relative z-10 text-center">
          <p className="text-xl text-white/80">Loading game...</p>
        </div>
      </div>
    );
  }

  // ── Picking screen ───────────────────────────────────────────────────────────
  if (phase === 'picking' && statCategory) {
    const waitingFor = players.filter(p => {
      const l = allLineups[p.player_id] as any;
      return !l?.hasPickedThisRound && !l?.isFinished;
    });
    const currentPlayerName = players.find(p => p.player_id === currentPlayerId)?.player_name;

    return (
      <motion.div
        animate={showExactHit ? { x: [0, -10, 10, -7, 7, -4, 4, 0] } : {}}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className="h-[100dvh] bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden"
      >
        <EmoteOverlay lobbyId={lobby?.id} currentPlayerId={currentPlayerId} currentPlayerName={currentPlayerName} />
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
        />

        {/* Exact hit celebration overlay */}
        {showExactHit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.35) 0%, rgba(0,0,0,0.9) 100%)' }}
          >
            {[0, 0.25, 0.5].map((delay, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-[#d4af37]/70 pointer-events-none"
                style={{ width: 160, height: 160, marginLeft: -80, marginTop: -80, left: '50%', top: '50%' }}
                initial={{ scale: 0.4, opacity: 0.9 }}
                animate={{ scale: 5, opacity: 0 }}
                transition={{ duration: 1.4, ease: 'easeOut', delay }}
              />
            ))}
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.05 }}
              className="text-center relative z-10"
            >
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 0.6, delay: 0.5, repeat: 2, ease: 'easeInOut' }}
                className="retro-title text-6xl md:text-8xl text-[#d4af37] mb-2"
                style={{ textShadow: '0 0 40px #d4af37, 0 0 100px #d4af37bb' }}
              >
                EXACT!
              </motion.div>
              <div className="sports-font text-xl md:text-2xl text-white tracking-widest uppercase mb-1">Perfect score</div>
              <div className="retro-title text-3xl md:text-4xl text-[#d4af37]">{targetCap}</div>
            </motion.div>
          </motion.div>
        )}

        <CapCrunchHeader
          hardMode={hardMode}
          currentPickerId={currentPickerId}
          currentPlayerId={currentPlayerId}
          players={players}
          currentRound={currentRound}
          totalRounds={totalRounds}
          currentTeam={currentTeam}
          selectedSport={selectedSport as 'nba' | 'nfl' | null}
          targetCap={targetCap}
          statCategory={statCategory}
          myLineup={myLineup}
          badFlashKey={badFlashKey}
          isCareerStatRound={isCareerStatRound}
          blindMode={blindMode}
          isHost={isHost}
          onEndGame={handleEndGame}
        />

        {/* Mobile cap progress strip — hidden in blind mode */}
        {!blindMode && (
          <div className="md:hidden w-full h-1 bg-white/10 flex-shrink-0">
            <motion.div
              className="h-full"
              animate={{
                width: `${Math.min(((myLineup?.totalStat ?? 0) / targetCap) * 100, 100)}%`,
                backgroundColor: getTotalColor(myLineup?.totalStat ?? 0, targetCap),
              }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* Mobile tab bar */}
        <div className="relative z-10 flex-shrink-0 flex md:hidden border-b border-white/10 bg-black/40">
          {(['pick', 'scores'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2.5 sports-font text-[11px] uppercase tracking-widest transition-all ${
                mobileTab === tab
                  ? 'text-[#d4af37] border-b-2 border-[#d4af37]'
                  : 'text-white/40'
              }`}
            >
              {tab === 'pick' ? (canPickThisRound ? '🟡 Pick' : '✓ Pick') : 'Scores'}
            </button>
          ))}
        </div>

        <main className="relative z-10 flex-1 min-h-0 w-full overflow-hidden">
          {/* Mobile: single tab panel */}
          <div className="md:hidden h-full p-3 flex flex-col">
            {/* Countdown banner — shown to the player whose turn it is */}
            {countdown !== null && mobileTab === 'pick' && (
              <div className={`flex-shrink-0 mb-2 py-2 rounded-sm text-center retro-title text-lg tracking-wider transition-colors ${
                countdown <= 10 ? 'bg-red-900/60 text-red-300 border border-red-500/40' : 'bg-[#7c3aed]/20 text-[#a78bfa] border border-[#7c3aed]/30'
              }`}>
                {hardMode ? 'Your turn — ' : 'Last to pick — '}{countdown}s
              </div>
            )}
            <div className={mobileTab !== 'pick' ? 'hidden' : 'flex-1 min-h-0 flex flex-col'}>
              <CapCrunchPickPanel
                myLineup={myLineup}
                canPickThisRound={canPickThisRound}
                hardMode={hardMode}
                currentPickerId={currentPickerId}
                players={players}
                totalRounds={totalRounds}
                selectedPlayerName={selectedPlayerName}
                isNoYearSelect={isNoYearSelect}
                isCareerStatRound={isCareerStatRound}
                currentTeam={currentTeam}
                searchQuery={searchQuery}
                searchResults={searchResults}
                loading={loading}
                loadingYears={loadingYears}
                availableYears={availableYears}
                selectedYear={selectedYear}
                duplicateError={duplicateError}
                pickError={pickError}
                addingPlayer={addingPlayer}
                usedPlayerNames={usedPlayerNames}
                lockedPlayerNames={lockedPlayerNames}
                waitingFor={waitingFor}
                selectedSport={selectedSport as 'nba' | 'nfl' | null}
                onSearch={handleSearch}
                onSelectPlayer={handleSelectPlayer}
                onSelectYear={setSelectedYear}
                onConfirm={handleConfirmYear}
                onBack={handleBackFromPlayer}
              />
            </div>
            <div className={mobileTab !== 'scores' ? 'hidden' : 'flex-1 min-h-0'}>
              <CapCrunchScoresPanel
                players={players}
                allLineups={allLineups}
                currentPlayerId={currentPlayerId}
                currentRound={currentRound}
                totalRounds={totalRounds}
                canPickThisRound={canPickThisRound}
                sport={selectedSport as 'nba' | 'nfl'}
                blindMode={blindMode}
              />
            </div>
          </div>

          {/* Desktop: 3-column layout */}
          <div className="hidden md:flex h-full px-6 py-4 gap-4">
            <div className="w-52 flex flex-col gap-4">
              <div className="bg-[#111] border border-white/5 px-6 py-6 rounded-sm text-center shadow-xl">
                <div className="sports-font text-[8px] text-white/30 tracking-widest uppercase mb-2">Target</div>
                <p className="retro-title text-4xl text-white">{targetCap}</p>
              </div>
              <div className="bg-[#111] border border-white/5 px-6 py-6 rounded-sm text-center shadow-xl">
                <div className="sports-font text-[8px] text-white/30 tracking-widest uppercase mb-2">{isCareerStatRound ? 'Career' : 'Category'}</div>
                <p className="retro-title text-2xl text-white">
                  {statCategory ? (isCareerStatRound ? getCategoryAbbr(statCategory).replace('CAREER ', '') : getCategoryAbbr(statCategory)) : '—'}
                </p>
              </div>
              {!blindMode && (
              <div className="bg-[#111] border border-white/5 px-3 py-2 rounded-sm shadow-xl">
                <div className="sports-font text-[6px] text-white/30 tracking-widest uppercase mb-1.5">Cap</div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{
                      width: `${Math.min(((myLineup?.totalStat ?? 0) / targetCap) * 100, 100)}%`,
                      backgroundColor: getTotalColor(myLineup?.totalStat ?? 0, targetCap),
                    }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="sports-font text-[6px] text-white/20">0</span>
                  <span className="sports-font text-[6px] text-white/20">{targetCap}</span>
                </div>
              </div>
              )}
            </div>
            <div className="flex-1 flex flex-col">
              {/* Countdown banner — desktop */}
              {countdown !== null && (
                <div className={`flex-shrink-0 mb-3 py-2.5 rounded-sm text-center retro-title text-xl tracking-wider transition-colors ${
                  countdown <= 10 ? 'bg-red-900/60 text-red-300 border border-red-500/40' : 'bg-[#7c3aed]/20 text-[#a78bfa] border border-[#7c3aed]/30'
                }`}>
                  {hardMode ? 'Your turn — ' : 'Last to pick — '}{countdown}s
                </div>
              )}
              <CapCrunchPickPanel
                myLineup={myLineup}
                canPickThisRound={canPickThisRound}
                hardMode={hardMode}
                currentPickerId={currentPickerId}
                players={players}
                totalRounds={totalRounds}
                selectedPlayerName={selectedPlayerName}
                isNoYearSelect={isNoYearSelect}
                isCareerStatRound={isCareerStatRound}
                currentTeam={currentTeam}
                searchQuery={searchQuery}
                searchResults={searchResults}
                loading={loading}
                loadingYears={loadingYears}
                availableYears={availableYears}
                selectedYear={selectedYear}
                duplicateError={duplicateError}
                pickError={pickError}
                addingPlayer={addingPlayer}
                usedPlayerNames={usedPlayerNames}
                lockedPlayerNames={lockedPlayerNames}
                waitingFor={waitingFor}
                selectedSport={selectedSport as 'nba' | 'nfl' | null}
                onSearch={handleSearch}
                onSelectPlayer={handleSelectPlayer}
                onSelectYear={setSelectedYear}
                onConfirm={handleConfirmYear}
                onBack={handleBackFromPlayer}
              />
            </div>
            <div className="w-96 flex flex-col">
              <CapCrunchScoresPanel
                players={players}
                allLineups={allLineups}
                currentPlayerId={currentPlayerId}
                currentRound={currentRound}
                totalRounds={totalRounds}
                canPickThisRound={canPickThisRound}
                sport={selectedSport as 'nba' | 'nfl'}
                blindMode={blindMode}
              />
            </div>
          </div>
        </main>
      </motion.div>
    );
  }

  // ── Blind reveal screen ──────────────────────────────────────────────────────
  if (phase === 'blind-reveal' && statCategory) {
    return (
      <BlindModeReveal
        players={players}
        allLineups={allLineups}
        targetCap={targetCap}
        totalRounds={totalRounds}
        revealStep={revealStep}
        isHost={isHost}
        statCategory={statCategory}
        isCareerStatRound={isCareerStatRound}
        sport={selectedSport as 'nba' | 'nfl'}
        onReveal={handleBlindReveal}
        onFinish={handleBlindFinish}
      />
    );
  }

  // ── Results screen ───────────────────────────────────────────────────────────
  if (phase === 'results') {
    const avgPickYear = (lineup: PlayerLineup): number => {
      const picks = lineup.selectedPlayers;
      if (picks.length === 0) return 2025;
      return picks.reduce((sum, p) => sum + (p.selectedYear === 'career' ? 2025 : (parseInt(p.selectedYear) || 2025)), 0) / picks.length;
    };

    const sortedLineups = players
      .map((p) => ({
        ...p,
        lineup: (allLineups[p.player_id] || { playerId: p.player_id, playerName: p.player_name, selectedPlayers: [], totalStat: 0, bustCount: 0, isFinished: false }) as PlayerLineup,
      }))
      .sort((a, b) => {
        if (blindMode) {
          // Blind mode: absolute value closest to cap wins
          const distA = Math.abs(targetCap - a.lineup.totalStat);
          const distB = Math.abs(targetCap - b.lineup.totalStat);
          return distA - distB;
        }
        if (b.lineup.totalStat !== a.lineup.totalStat) return b.lineup.totalStat - a.lineup.totalStat;
        const aBusts = a.lineup.bustCount ?? 0, bBusts = b.lineup.bustCount ?? 0;
        if (aBusts !== bBusts) return aBusts - bBusts;
        return avgPickYear(a.lineup) - avgPickYear(b.lineup);
      });

    const tiedOnScore = sortedLineups.length >= 2 && (
      blindMode
        ? Math.abs(targetCap - sortedLineups[0].lineup.totalStat) === Math.abs(targetCap - sortedLineups[1].lineup.totalStat)
        : sortedLineups[0].lineup.totalStat === sortedLineups[1].lineup.totalStat
    );
    const tiedOnBusts = tiedOnScore && !blindMode && (sortedLineups[0].lineup.bustCount ?? 0) === (sortedLineups[1].lineup.bustCount ?? 0);
    const tiebreakerUsed = tiedOnScore;

    return (
      <div className="min-h-screen bg-[#111] text-white flex flex-col relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
        />

        <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <h1 className="retro-title text-2xl text-[#d4af37]">Final Results</h1>
          </div>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-start p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            <div className="mb-4 p-4 bg-black/60 border border-white/10 rounded text-center">
              <p className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">Target Cap</p>
              <p className="retro-title text-3xl text-[#d4af37]">{targetCap}</p>
            </div>
            {tiebreakerUsed && (
              <div className="mb-4 p-3 bg-[#d4af37]/10 border border-[#d4af37]/30 rounded text-center">
                <p className="sports-font text-[10px] text-[#d4af37] tracking-widest uppercase">
                  {tiedOnBusts ? 'Tied score & busts — older avg lineup year wins' : 'Tied score — fewest busts wins'}
                </p>
              </div>
            )}

            {/* Reveal order: last place enters first, winner enters last */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedLineups.map((item, idx) => (
                <CapCrunchResultCard
                  key={item.id}
                  item={item}
                  idx={idx}
                  isWinner={idx === 0}
                  tiebreakerUsed={tiebreakerUsed}
                  tiedOnBusts={tiedOnBusts}
                  targetCap={targetCap}
                  optimalPicks={optimalPicks}
                  statCategory={statCategory!}
                  isCareerStatRound={isCareerStatRound}
                  avgPickYear={avgPickYear}
                  sport={selectedSport as 'nba' | 'nfl'}
                />
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3">
              {isHost ? (
                <button
                  onClick={handlePlayAgain}
                  className="w-full py-4 rounded-sm retro-title text-lg tracking-wider bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1 transition-all"
                >
                  Play Again
                </button>
              ) : (
                <div className="w-full py-4 rounded-sm text-center sports-font text-sm text-white/40 border border-white/10">
                  Waiting for host to start next game...
                </div>
              )}
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 rounded-sm sports-font text-sm tracking-widest uppercase text-white/40 border border-white/10 hover:border-white/30 hover:text-white/60 transition-all"
              >
                Back to Home
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return null;
}
