/**
 * MultiplayerCapCrunchPage.tsx — Simultaneous Multiplayer Cap Crunch.
 *
 * All players pick simultaneously each round:
 * 1. Same team shown to all players each round
 * 2. Each player searches for a player + selects a year they were on that team
 * 3. Once all players submit → host advances to next round (new team)
 * 4. If a pick exceeds the cap it busts — counts as 0, game always continues all 5 rounds
 * 5. After 5 rounds → results screen (highest score wins; tiebreak: fewest busts, then oldest avg year)
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { EmoteOverlay } from '../components/multiplayer/EmoteOverlay';
import {
  findLobbyByCode,
  getLobbyPlayers,
  updateCareerState,
  updateLobbyStatus,
  incrementPlayerWins,
} from '../services/lobby';
import {
  searchPlayersByNameOnly,
  getPlayerYearsOnTeam,
  getPlayerStatForYearAndTeam,
  getPlayerTotalGPForTeam,
  addPlayerToLineup,
  assignRandomTeam,
  isDivisionRound,
  NFL_DIVISIONS,
  findOptimalLastPick,
} from '../services/capCrunch';
import type { OptimalPick } from '../services/capCrunch';
import { getTeamByAbbreviation } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import type { PlayerLineup, SelectedPlayer, StatCategory } from '../types/capCrunch';
import { TeamLogo } from '../components/TeamLogo';

type Phase = 'loading' | 'picking' | 'results';

/** Format a stat value: whole numbers show no decimal, others show 1 decimal place. */
function fmt(val: number): string {
  const r = parseFloat(val.toFixed(1));
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
}

function getCategoryAbbr(category: StatCategory): string {
  switch (category) {
    case 'pts': return 'PTS';
    case 'ast': return 'AST';
    case 'reb': return 'REB';
    case 'min': return 'MIN';
    case 'pra': return 'PRA';
    case 'passing_yards': return 'PASS YD';
    case 'passing_tds': return 'PASS TD';
    case 'interceptions': return 'INT';
    case 'rushing_yards': return 'RUSH YD';
    case 'rushing_tds': return 'RUSH TD';
    case 'receiving_yards': return 'REC YD';
    case 'receiving_tds': return 'REC TD';
    case 'receptions': return 'REC';
    case 'total_gp': return 'TOT GP';
    default: return 'STAT';
  }
}

function getTeamColor(sport: any, teamAbbr: string): string {
  if (sport === 'nba') {
    const team = getTeamByAbbreviation(teamAbbr);
    return team?.colors.primary || '#666666';
  } else {
    const nflTeam = nflTeams.find(t => t.abbreviation === teamAbbr);
    return nflTeam?.colors?.primary || '#003875';
  }
}

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
  const [optimalPicks, setOptimalPicks] = useState<Map<string, OptimalPick | null>>(new Map());

  // Hard mode state
  const [hardMode, setHardMode] = useState(false);
  const [currentPickerId, setCurrentPickerId] = useState<string | null>(null);
  const [pickedPlayerSeasons, setPickedPlayerSeasons] = useState<string[]>([]);

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

  // Prevent realtime sync from clobbering state mid-pick
  const addingPlayerRef = useRef(false);
  // Prevent host from double-advancing the same round
  const lastAdvancedRoundRef = useRef(0);
  // Detect round changes to reset ephemeral search UI
  const prevRoundRef = useRef(0);
  // Saved pick for race-condition recovery: if a concurrent write overwrites our pick, re-send it
  const mySubmittedLineupRef = useRef<any>(null);

  const selectedSport = ((lobby?.career_state as any)?.sport ?? null) as import('../types').Sport | null;

  // Derived: my lineup and whether I can pick this round
  const myLineup = allLineups[currentPlayerId || ''] as (PlayerLineup & { hasPickedThisRound?: boolean }) | undefined;
  const canPickThisRound = hardMode
    ? (currentPickerId === currentPlayerId && !myLineup?.isFinished)
    : (!myLineup?.hasPickedThisRound && !myLineup?.isFinished);

  // Players I've already used this game (no repeats allowed)
  const usedPlayerNames = new Set(myLineup?.selectedPlayers.map(p => p.playerName) ?? []);

  // Hard mode: players picked by anyone — entire player is locked globally
  const lockedPlayerNames = hardMode
    ? new Set(pickedPlayerSeasons.map(k => k.split('|')[0]))
    : new Set<string>();

  useLobbySubscription(lobby?.id || null);

  // ── Mount: load lobby and read full game state from career_state ──────────
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
        setCurrentTeam(cs.currentTeam || '');
        setHardMode(cs.hardMode || false);
        setCurrentPickerId(cs.currentPickerId || null);
        setPickedPlayerSeasons(cs.pickedPlayerSeasons || []);

        if (cs.phase === 'results') setPhase('results');
        else if (cs.statCategory && cs.allLineups) setPhase('picking');
        // else: career_state not ready yet — stay on 'loading' and let the
        // realtime sync rescue us when the write completes (line 215).
      } catch (error) {
        console.error('Error initializing game:', error);
        navigate('/');
      }
    };

    initGame();
  }, [code, navigate, setLobby, setPlayers]);

  // ── Realtime sync: when lobby.career_state changes, update local state ────
  useEffect(() => {
    const cs = (lobby?.career_state as any);
    if (!cs?.statCategory || !cs?.allLineups) return;

    // Always process transition to results — even if a pick is in flight.
    // (The addingPlayerRef guard must not block the final phase change or the
    //  player gets stuck on the green picking screen after the last round.)
    if (cs.phase === 'results') {
      setAllLineups(cs.allLineups as Record<string, PlayerLineup>);
      setPhase('results');
      return;
    }

    if (addingPlayerRef.current) return; // don't clobber mid-pick for round changes

    const newRound = cs.currentRound ?? 1;

    // Reset ephemeral search UI when the round advances
    if (newRound !== prevRoundRef.current && prevRoundRef.current !== 0) {
      mySubmittedLineupRef.current = null; // clear saved pick on new round
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
    setCurrentPickerId(cs.currentPickerId || null);
    setPickedPlayerSeasons(cs.pickedPlayerSeasons || []);

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

  // ── Host-only: advance round when all players have picked ─────────────────
  useEffect(() => {
    if (!isHost || !lobby?.career_state || !lobby?.id) return;

    const cs = lobby.career_state as any;
    if (cs.phase !== 'picking') return;

    const lineups = cs.allLineups || {};
    // Use stored playerOrder (stable, unaffected by JSONB key sorting in Postgres).
    // Fall back to Object.keys for old lobbies that predate this field.
    const playerIds: string[] = cs.playerOrder || Object.keys(lineups);
    if (playerIds.length === 0) return;

    const allPicked = playerIds.every(pid =>
      (lineups[pid] as any)?.hasPickedThisRound || (lineups[pid] as any)?.isFinished
    );
    if (!allPicked) return;

    const round = cs.currentRound || 1;
    if (lastAdvancedRoundRef.current >= round) return; // guard against double-advance
    lastAdvancedRoundRef.current = round;

    const lobbyId = lobby.id;
    const totalRds = cs.totalRounds || 5;
    const nextRound = round + 1;

    const advanceRound = async () => {
      if (nextRound > totalRds) {
        // Determine winner(s) — highest score, then fewest busts, then oldest avg year
        const avgPickYear = (pid: string): number => {
          const picks = (lineups[pid] as any)?.selectedPlayers ?? [];
          if (picks.length === 0) return 2025;
          return picks.reduce((s: number, p: any) => s + (p.selectedYear === 'career' ? 2025 : (parseInt(p.selectedYear) || 2025)), 0) / picks.length;
        };
        const sorted = [...playerIds].sort((a, b) => {
          const la = lineups[a] as any, lb = lineups[b] as any;
          if (lb.totalStat !== la.totalStat) return lb.totalStat - la.totalStat;
          // Tiebreak 1: fewer busts
          const aBusts = la.bustCount ?? 0, bBusts = lb.bustCount ?? 0;
          if (aBusts !== bBusts) return aBusts - bBusts;
          // Tiebreak 2: older avg pick year
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
            // Award wins to all players fully tied across all three tiebreakers
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
        // Game over → go to results
        await updateCareerState(lobbyId, { ...cs, phase: 'results' });
      } else {
        // Next round: new team, reset hasPickedThisRound for active players
        const newTeam = cs.statCategory === 'total_gp'
          ? cs.currentTeam  // same team all 5 rounds in GP mode
          : assignRandomTeam(cs.sport || 'nba', cs.statCategory, cs.usedTeams || []);
        const resetLineups: Record<string, any> = {};
        playerIds.forEach(pid => {
          resetLineups[pid] = {
            ...lineups[pid],
            // Players who've used all 5 picks keep hasPickedThisRound true so they're auto-skipped
            hasPickedThisRound: (lineups[pid] as any).isFinished ? true : false,
          };
        });

        // Hard mode: determine first picker for next round (rotates by 1 each round)
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
          usedTeams: cs.statCategory === 'total_gp' ? (cs.usedTeams || []) : [...(cs.usedTeams || []), newTeam],
          ...hardModeUpdates,
        });
      }
    };

    advanceRound();
  }, [lobby?.career_state, isHost, lobby?.id]);

  // ── All clients: navigate back to lobby when host resets to waiting ────────
  // Check phase !== 'picking' to avoid navigating away mid-game if realtime delivers
  // a stale 'waiting' status before the new game's 'playing' status arrives.
  useEffect(() => {
    if (lobby?.status === 'waiting' && phase !== 'picking') {
      navigate(`/lobby/${code}`);
    }
  }, [lobby?.status, phase, navigate, code]);

  // ── Optimal last pick — compute once when results screen loads ─────────────
  // NOTE: must live here (before any early returns) to satisfy Rules of Hooks.
  useEffect(() => {
    if (phase !== 'results' || !statCategory || !selectedSport) return;
    const computeAll = async () => {
      const results = new Map<string, OptimalPick | null>();
      await Promise.all(
        players.map(async (p) => {
          const lineup = allLineups[p.player_id] as PlayerLineup | undefined;
          if (!lineup || lineup.selectedPlayers.length === 0) { results.set(p.player_id, null); return; }
          const lastPick = lineup.selectedPlayers[lineup.selectedPlayers.length - 1];
          // For bust picks the total was reverted, so totalBeforeLast == lineup.totalStat
          const totalBeforeLast = lastPick.isBust
            ? lineup.totalStat
            : parseFloat((lineup.totalStat - lastPick.statValue).toFixed(1));
          const remainingBudget = parseFloat((targetCap - totalBeforeLast).toFixed(1));
          // In hard mode, exclude all globally locked players except the one being replaced
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

  const handlePlayAgain = async () => {
    if (!isHost || !lobby) return;
    await updateLobbyStatus(lobby.id, 'waiting');
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setDuplicateError(null);
    if (!selectedSport || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchPlayersByNameOnly(selectedSport, query);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
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

    // total_gp mode: no year needed, go straight to confirm
    if (statCategory === 'total_gp') return;

    setLoadingYears(true);
    try {
      const years = await getPlayerYearsOnTeam(selectedSport!, player.playerName, currentTeam, player.playerId);
      setAvailableYears(years);
    } catch {
      setAvailableYears([]);
    } finally {
      setLoadingYears(false);
    }
  };

  const isTotalGP = statCategory === 'total_gp';

  const handleConfirmYear = async () => {
    if (!selectedPlayerName || !selectedSport || !statCategory || !lobby || !currentPlayerId) return;
    if (!isTotalGP && !selectedYear) return;

    addingPlayerRef.current = true;
    setAddingPlayer(true);
    try {
      const statValue = isTotalGP
        ? await getPlayerTotalGPForTeam(selectedSport as any, selectedPlayerName, currentTeam, selectedPlayerId ?? undefined)
        : await getPlayerStatForYearAndTeam(
            selectedSport as any,
            selectedPlayerName,
            currentTeam,
            selectedYear,
            statCategory,
            selectedPlayerId ?? undefined
          );

      // Read latest career_state from store (synced via realtime) to minimize race window
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

      // Check if this pick would push over the cap
      const wouldBust = (myCurrentLineup.totalStat + statValue) > targetCap;

      const newSelectedPlayer: SelectedPlayer = {
        playerName: selectedPlayerName,
        team: currentTeam,
        selectedYear: isTotalGP ? 'career' : selectedYear,
        playerSeason: null,
        statValue,
        isBust: wouldBust,
      };

      const withNewPlayer = addPlayerToLineup(myCurrentLineup as PlayerLineup, newSelectedPlayer);
      // Bust picks revert the total (count as 0); game always continues all 5 picks
      if (wouldBust) {
        withNewPlayer.totalStat = myCurrentLineup.totalStat;
        withNewPlayer.bustCount = (myCurrentLineup.bustCount ?? 0) + 1;
      } else {
        withNewPlayer.totalStat = parseFloat((myCurrentLineup.totalStat + statValue).toFixed(1));
        withNewPlayer.bustCount = myCurrentLineup.bustCount ?? 0;
      }
      (withNewPlayer as any).hasPickedThisRound = true;
      // Only finished when all 5 picks made
      if (withNewPlayer.selectedPlayers.length >= 5) withNewPlayer.isFinished = true;

      // Hard mode: compute next picker and record locked player-season
      let hardModeUpdates: Record<string, any> = {};
      if (latestCS.hardMode && currentPlayerId) {
        const allLineupsAfterPick = { ...latestCS.allLineups, [currentPlayerId]: withNewPlayer };
        // Find next player by continuing the rotation from the current picker's position in playerOrder
        const order: string[] = latestCS.playerOrder || players.map(p => p.player_id);
        const currentIndexInOrder = order.indexOf(currentPlayerId);
        let nextPickerId: string | null = null;
        if (currentIndexInOrder === -1) {
          // Player not found in order (e.g. joined after game started) — fall back to first unpicked
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

      // Write merged update: spread latest state, override only my lineup entry
      const updatedCS = {
        ...latestCS,
        allLineups: {
          ...latestCS.allLineups,
          [currentPlayerId]: withNewPlayer,
        },
        ...hardModeUpdates,
      };

      await updateCareerState(lobby.id, updatedCS);

      // Save for race-condition recovery in the realtime sync effect
      mySubmittedLineupRef.current = withNewPlayer;

      // Apply locally so UI reflects immediately
      setAllLineups(prev => ({ ...prev, [currentPlayerId]: withNewPlayer }));

      // Clear search UI
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPlayerName(null);
      setSelectedPlayerId(null);
      setSelectedYear('');
      setAvailableYears([]);
    } catch (error) {
      console.error('Error confirming pick:', error);
    } finally {
      addingPlayerRef.current = false;
      setAddingPlayer(false);
    }
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
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

  // ── Picking screen ─────────────────────────────────────────────────────────
  if (phase === 'picking' && statCategory) {
    // Players who haven't submitted yet this round (and aren't busted/finished)
    const waitingFor = players.filter(p => {
      const l = allLineups[p.player_id] as any;
      return !l?.hasPickedThisRound && !l?.isFinished;
    });

    // Reusable pick panel content (used in both mobile and desktop)
    const pickPanel = (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-black/60 border-2 border-white/10 rounded p-4 flex-1 flex flex-col"
      >
        {myLineup?.isFinished ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <p className="text-2xl text-emerald-400 retro-title">All Picks In!</p>
            <p className="text-white/50 sports-font text-sm">You've made all 5 picks. Sit tight while others finish.</p>
            {(myLineup.bustCount ?? 0) > 0 && (
              <p className="text-red-400/70 sports-font text-xs">{myLineup.bustCount} bust pick{myLineup.bustCount !== 1 ? 's' : ''} — each counted as 0</p>
            )}
          </div>
        ) : canPickThisRound ? (
          <>
            {!selectedPlayerName ? (
              <div>
                <label className="block sports-font text-[9px] tracking-[0.4em] text-white/60 uppercase mb-3 font-semibold">
                  Search for a player
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Enter player name..."
                  className="w-full px-4 py-3 bg-[#222] text-white rounded border border-white/10 focus:outline-none focus:border-white/30 mb-3 text-base"
                />
                {loading && <p className="text-white/60 text-sm">Loading...</p>}
                {!loading && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-white/30 text-[9px] sports-font mt-1">No results — player may be too recent, have limited stats, or try a different spelling. 2025 NFL not yet available.</p>
                )}
                {duplicateError && (
                  <p className="text-red-400 text-sm font-semibold mb-2">{duplicateError}</p>
                )}
                {searchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {searchResults.map((result, idx) => {
                      const alreadyUsed = usedPlayerNames.has(result.playerName);
                      const taken = lockedPlayerNames.has(result.playerName);
                      const disabled = alreadyUsed || taken;
                      return (
                        <button
                          key={String(result.playerId) + idx}
                          onClick={() => handleSelectPlayer(result)}
                          className={`w-full text-left px-4 py-3 rounded border transition text-sm font-semibold ${
                            disabled
                              ? 'bg-[#111] border-white/5 text-white/25 cursor-not-allowed line-through'
                              : 'bg-[#1a1a1a] hover:bg-[#2a2a2a] border-white/10 text-white'
                          }`}
                        >
                          {result.playerName}
                          {alreadyUsed && <span className="ml-2 text-[10px] text-white/20 no-underline not-italic font-normal">(already used)</span>}
                          {taken && <span className="ml-2 text-[10px] text-red-400/40 no-underline not-italic font-normal">(taken)</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : isTotalGP ? (
              // ── Total GP mode: no year selection, just confirm the player ──
              <div className="flex flex-col gap-3 h-full">
                <div className="p-3 bg-[#1a1a1a] rounded border border-white/10">
                  <p className="font-semibold text-white text-base truncate">{selectedPlayerName}</p>
                  <p className="text-xs text-white/60 mt-0.5">Will count all career GP with {currentTeam}</p>
                </div>
                <div className="flex-1 flex items-center justify-center text-center">
                  <p className="text-white/30 sports-font text-xs leading-relaxed">
                    Games played across every season<br />this player was on the team
                  </p>
                </div>
                <div className="flex gap-2 mt-auto pt-2">
                  <button
                    onClick={() => { setSelectedPlayerName(null); setSelectedPlayerId(null); setSelectedYear(''); setAvailableYears([]); }}
                    className="flex-1 px-4 py-2.5 bg-[#333] hover:bg-[#444] text-white rounded-sm transition border border-white/10 text-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmYear}
                    disabled={addingPlayer}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] shadow-[0_2px_0_#a89860] active:translate-y-1 active:shadow-none disabled:opacity-50 text-black font-semibold rounded-sm transition text-sm retro-title"
                  >
                    {addingPlayer ? 'Adding...' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              // ── Normal mode: pick a year ──
              <div className="flex flex-col gap-3 h-full">
                <div className="p-3 bg-[#1a1a1a] rounded border border-white/10">
                  <p className="font-semibold text-white text-base truncate">{selectedPlayerName}</p>
                  <p className="text-xs text-white/60 mt-0.5">Select any year this player played</p>
                </div>
                <div className="flex items-baseline justify-between">
                  <label className="sports-font text-[9px] tracking-[0.4em] text-white/60 uppercase font-semibold">Select a year</label>
                  {selectedSport === 'nfl' && <span className="text-white/25 text-[8px] sports-font">through 2024</span>}
                </div>
                {loadingYears ? (
                  <p className="text-white/60 text-sm">Loading years...</p>
                ) : availableYears.length > 0 ? (
                  <div className="space-y-1.5 overflow-y-auto max-h-48 md:max-h-64">
                    {availableYears.map((year) => (
                      <button
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        className={`w-full px-4 py-2.5 rounded border transition text-white font-semibold text-sm ${
                          selectedYear === year
                            ? 'bg-[#d4af37] text-black border-[#d4af37]'
                            : 'bg-[#1a1a1a] border-white/10 hover:border-white/20'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-red-400 text-sm">No data found — player may be too recent, have limited stats, or try a different spelling.</p>
                )}
                <div className="flex gap-2 mt-auto pt-2">
                  <button
                    onClick={() => { setSelectedPlayerName(null); setSelectedPlayerId(null); setSelectedYear(''); setAvailableYears([]); }}
                    className="flex-1 px-4 py-2.5 bg-[#333] hover:bg-[#444] text-white rounded-sm transition border border-white/10 text-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmYear}
                    disabled={!selectedYear || addingPlayer}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] shadow-[0_2px_0_#a89860] active:translate-y-1 active:shadow-none disabled:opacity-50 text-black font-semibold rounded-sm transition text-sm retro-title"
                  >
                    {addingPlayer ? 'Adding...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            {hardMode && !myLineup?.hasPickedThisRound ? (
              // Hard mode: waiting for your turn
              <div>
                <p className="text-lg text-yellow-400 font-semibold mb-1">Waiting for your turn</p>
                <p className="text-white/50 sports-font text-sm">
                  {players.find(p => p.player_id === currentPickerId)?.player_name ?? '...'} is picking
                </p>
              </div>
            ) : (
              <div>
                <p className="text-lg text-emerald-400 font-semibold mb-1">Pick submitted!</p>
                <p className="text-white/50 sports-font text-sm">Waiting for other players...</p>
              </div>
            )}
            {!hardMode && waitingFor.length > 0 && (
              <div className="bg-black/40 border border-white/10 rounded p-3 w-full max-w-xs">
                <p className="sports-font text-[10px] text-white/30 tracking-widest uppercase mb-2">Still picking</p>
                {waitingFor.map(p => (
                  <div key={p.player_id} className="flex items-center gap-2 py-1">
                    <span className="text-yellow-400 text-xs">⏳</span>
                    <span className="text-white/70 text-sm">{p.player_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    );

    // Reusable scores panel content
    const scoresPanel = (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-black/60 border-2 border-white/10 rounded p-4 flex-1 overflow-y-auto"
      >
        <h3 className="retro-title text-base text-[#d4af37] mb-3">Lineups</h3>
        <div className="space-y-3">
          {players.map((player) => {
            const lineup = allLineups[player.player_id] as (PlayerLineup & { hasPickedThisRound?: boolean }) | undefined;
            const hasPicked = lineup?.hasPickedThisRound || lineup?.isFinished;
            const isMe = player.player_id === currentPlayerId;
            const maskCurrentRound = canPickThisRound && !isMe;
            const visiblePicks = maskCurrentRound
              ? (lineup?.selectedPlayers.slice(0, currentRound - 1) ?? [])
              : (lineup?.selectedPlayers ?? []);
            const myBustCount = isMe ? (lineup?.bustCount ?? 0) : 0;

            return (
              <div
                key={player.id}
                className={`p-3 rounded border-2 transition ${
                  isMe ? 'border-[#d4af37] bg-[#1a1a1a]' : 'border-white/10 bg-black/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className={`font-semibold text-sm ${isMe ? 'text-[#d4af37]' : 'text-white/60'}`}>
                      {player.player_name}
                    </p>
                    {isMe && myBustCount > 0 && (
                      <p className="text-[9px] text-red-400/70 sports-font">{myBustCount} bust{myBustCount !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasPicked ? (
                      <span className="text-emerald-400 text-sm">✓</span>
                    ) : (
                      <span className="text-yellow-400 text-sm">⏳</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1 mb-2 text-xs">
                  {visiblePicks.map((selected, idx) => (
                    <div key={idx} className={`flex justify-between ${isMe && (selected.isBust || selected.statValue === 0) ? 'text-red-300' : 'text-white/70'}`}>
                      <div className="flex-1 min-w-0 flex items-baseline gap-1">
                        <span className={`truncate text-xs ${isMe && (selected.isBust || selected.statValue === 0) ? 'text-red-400' : ''}`}>{selected.playerName}</span>
                        {isMe && selected.isBust && <span className="text-[7px] bg-red-600 text-white px-0.5 rounded shrink-0">BUST</span>}
                        <span className={`ml-1 text-[10px] ${isMe && (selected.isBust || selected.statValue === 0) ? 'text-red-400/70' : 'text-white/40'}`}>({selected.selectedYear}, {selected.team})</span>
                      </div>
                      {isMe && (
                        <span className={`font-semibold ml-1 flex-shrink-0 ${(selected.isBust || selected.statValue === 0) ? 'text-red-400' : 'text-[#d4af37]'}`}>
                          {selected.isBust ? `${fmt(selected.statValue)}→0` : fmt(selected.statValue)}
                        </span>
                      )}
                    </div>
                  ))}
                  {maskCurrentRound && hasPicked && (
                    <div className="text-white/20 italic text-[10px]">Pick hidden until you submit</div>
                  )}
                </div>
                <div className="flex justify-between text-xs border-t border-white/10 pt-1.5">
                  <span className="text-white/40">{visiblePicks.length}/{totalRounds}</span>
                  {isMe ? (
                    <span className="font-semibold text-white">
                      {fmt(lineup?.totalStat ?? 0)}
                    </span>
                  ) : (
                    <span className="font-semibold text-white/20">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    );

    const currentPlayerName = players.find(p => p.player_id === currentPlayerId)?.player_name;

    return (
      <div className="h-[100dvh] bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden">
        <EmoteOverlay lobbyId={lobby?.id} currentPlayerId={currentPlayerId} currentPlayerName={currentPlayerName} />
        {/* Green felt background */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
        />

        {/* ── Header ── */}
        <header className="relative z-10 flex-shrink-0 bg-black/60 border-b-2 border-white/10 backdrop-blur-sm">
          <div className="px-4 py-2 flex items-center justify-between border-b border-white/5">
            <h1 className="retro-title text-xl text-[#d4af37]">Cap Crunch</h1>
            <div className="flex items-center gap-2">
              {hardMode && (
                <div className={`px-3 py-1 rounded-sm border ${
                  currentPickerId === currentPlayerId
                    ? 'bg-yellow-400/20 border-yellow-400/60'
                    : 'bg-black/40 border-white/20'
                }`}>
                  <span className={`retro-title text-xs ${
                    currentPickerId === currentPlayerId ? 'text-yellow-400' : 'text-white/50'
                  }`}>
                    {currentPickerId === currentPlayerId
                      ? 'Your Turn'
                      : `${players.find(p => p.player_id === currentPickerId)?.player_name ?? '...'}'s Turn`}
                  </span>
                </div>
              )}
              <div className="px-3 py-1 bg-[#ec4899]/20 border border-[#ec4899]/50 rounded-sm">
                <span className="retro-title text-sm text-[#ec4899]">Round {currentRound} / {totalRounds}</span>
              </div>
            </div>
          </div>
          {/* Team + compact stats row */}
          <div className="flex items-center gap-3 px-4 py-2">
            <motion.div
              key={currentTeam + currentRound}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex items-center gap-2"
            >
              {isDivisionRound(currentTeam) ? (
                <div className="px-5 py-2 rounded border-2 bg-black border-[#d4af37]/80 shadow-[0_0_12px_rgba(212,175,55,0.25)]">
                  <p className="sports-font text-[8px] text-white/50 tracking-widest uppercase leading-none mb-0.5">Division</p>
                  <p className="retro-title text-2xl md:text-3xl font-bold text-[#d4af37] leading-tight">
                    {currentTeam}
                  </p>
                  <p className="sports-font text-[8px] text-white/40 leading-none mt-0.5">
                    {(NFL_DIVISIONS[currentTeam] ?? []).join(' · ')}
                  </p>
                </div>
              ) : (
                <div
                  className="flex items-center gap-3 px-5 py-2 rounded border-2 bg-black"
                  style={{ borderColor: getTeamColor(selectedSport, currentTeam), boxShadow: `0 0 14px ${getTeamColor(selectedSport, currentTeam)}44` }}
                >
                  <TeamLogo sport={selectedSport as 'nba' | 'nfl'} abbr={currentTeam} size={44} />
                  <p className="retro-title text-2xl md:text-3xl font-bold leading-tight" style={{ color: getTeamColor(selectedSport, currentTeam) }}>
                    {currentTeam}
                  </p>
                </div>
              )}
            </motion.div>
            <div className="flex gap-2 ml-auto">
              <div className="bg-[#111] border border-white/10 px-3 py-1.5 rounded-sm text-center">
                <div className="sports-font text-[7px] text-white/30 tracking-widest uppercase">Target</div>
                <p className="retro-title text-lg text-white leading-none">{targetCap}</p>
              </div>
              <div className="bg-[#111] border border-white/10 px-3 py-1.5 rounded-sm text-center">
                <div className="sports-font text-[7px] text-white/30 tracking-widest uppercase">Stat</div>
                <p className="retro-title text-sm text-white leading-none">{getCategoryAbbr(statCategory!)}</p>
              </div>
              {/* My running total — always visible */}
              <div className="bg-[#d4af37]/10 border border-[#d4af37]/40 px-3 py-1.5 rounded-sm text-center">
                <div className="sports-font text-[7px] text-white/30 tracking-widest uppercase">You</div>
                <p className="retro-title text-lg leading-none text-[#d4af37]">
                  {fmt(myLineup?.totalStat ?? 0)}
                </p>
              </div>
              {/* Remaining to cap */}
              <div className="bg-[#111] border border-white/10 px-3 py-1.5 rounded-sm text-center">
                <div className="sports-font text-[7px] text-white/30 tracking-widest uppercase">Left</div>
                <p className="retro-title text-lg leading-none text-white">
                  {fmt(targetCap - (myLineup?.totalStat ?? 0))}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ── Mobile tab bar (hidden on md+) ── */}
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
              {tab === 'pick' ? (canPickThisRound ? '🟡 Pick' : '✓ Pick') : `Scores`}
            </button>
          ))}
        </div>

        {/* ── Main content ── */}
        <main className="relative z-10 flex-1 min-h-0 w-full overflow-hidden">
          {/* Mobile: single tab panel */}
          <div className="md:hidden h-full p-3 flex flex-col">
            {mobileTab === 'pick' ? pickPanel : scoresPanel}
          </div>

          {/* Desktop: 3-column layout */}
          <div className="hidden md:flex h-full px-6 py-4 gap-4">
            {/* Left Column */}
            <div className="w-52 flex flex-col gap-4">
              <div className="bg-[#111] border border-white/5 px-6 py-6 rounded-sm text-center shadow-xl">
                <div className="sports-font text-[8px] text-white/30 tracking-widest uppercase mb-2">Target</div>
                <p className="retro-title text-4xl text-white">{targetCap}</p>
              </div>
              <div className="bg-[#111] border border-white/5 px-6 py-6 rounded-sm text-center shadow-xl">
                <div className="sports-font text-[8px] text-white/30 tracking-widest uppercase mb-2">Category</div>
                <p className="retro-title text-2xl text-white">{getCategoryAbbr(statCategory!)}</p>
              </div>
            </div>
            {/* Middle Column */}
            <div className="flex-1 flex flex-col">{pickPanel}</div>
            {/* Right Column */}
            <div className="w-96 flex flex-col">{scoresPanel}</div>
          </div>
        </main>
      </div>
    );
  }

  // ── Results screen ─────────────────────────────────────────────────────────
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
        // Primary: highest score
        if (b.lineup.totalStat !== a.lineup.totalStat) return b.lineup.totalStat - a.lineup.totalStat;
        // Tiebreak 1: fewer busts
        const aBusts = a.lineup.bustCount ?? 0, bBusts = b.lineup.bustCount ?? 0;
        if (aBusts !== bBusts) return aBusts - bBusts;
        // Tiebreak 2: older avg pick year
        return avgPickYear(a.lineup) - avgPickYear(b.lineup);
      });

    // Detect whether 1st and 2nd place are tied on score (tiebreaker decided it)
    const tiedOnScore =
      sortedLineups.length >= 2 &&
      sortedLineups[0].lineup.totalStat === sortedLineups[1].lineup.totalStat;
    const tiedOnBusts = tiedOnScore && (sortedLineups[0].lineup.bustCount ?? 0) === (sortedLineups[1].lineup.bustCount ?? 0);
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

            <div className="space-y-4">
              {sortedLineups.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-black/60 border border-white/10 rounded p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-white text-lg">
                        {idx + 1}. {item.player_name}
                      </p>
                      {(item.lineup.bustCount ?? 0) > 0 && (
                        <span className="text-[9px] sports-font text-red-400/70">{item.lineup.bustCount} bust{item.lineup.bustCount !== 1 ? 's' : ''} (each counted as 0)</span>
                      )}
                      {tiebreakerUsed && tiedOnBusts && idx <= 1 && (
                        <span className="block text-[9px] sports-font text-[#d4af37]/60">avg yr {avgPickYear(item.lineup).toFixed(1)}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="retro-title text-3xl text-[#d4af37]">
                        {fmt(item.lineup.totalStat)}
                      </p>
                      <p className="text-xs text-white/40">
                        {fmt(Math.abs(item.lineup.totalStat - targetCap))} away
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs mb-3 border-t border-white/10 pt-3">
                    {item.lineup.selectedPlayers.map((selected, pidx) => {
                      const isBust = selected.isBust;
                      const isMiss = !isBust && selected.statValue === 0;
                      const isBad = isBust || isMiss;
                      return (
                        <div key={pidx} className={`flex justify-between ${isBad ? 'text-red-300' : 'text-white/70'}`}>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-1">
                              <span className={`truncate ${isBad ? 'text-red-400' : ''}`}>{pidx + 1}. {selected.playerName}</span>
                              {isBust && <span className="text-[7px] bg-red-600 text-white px-0.5 rounded shrink-0">BUST</span>}
                            </div>
                            <span className={`block text-[11px] ${isBad ? 'text-red-400/70' : 'text-white/40'}`}>({selected.selectedYear}, {selected.team})</span>
                            {isBust && <span className="block text-[10px] text-red-400/60">Exceeded cap — scored 0, total reverted</span>}
                          </div>
                          <span className={`font-semibold ml-2 ${isBad ? 'text-red-400' : 'text-[#d4af37]'}`}>
                            {isBust ? `${fmt(selected.statValue)}→0` : fmt(selected.statValue)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Optimal last pick hint */}
                  {(() => {
                    const opt = optimalPicks.get(item.player_id);
                    if (!opt || item.lineup.selectedPlayers.length === 0) return null;
                    const lastPick = item.lineup.selectedPlayers[item.lineup.selectedPlayers.length - 1];
                    const totalBeforeLast = lastPick.isBust
                      ? item.lineup.totalStat
                      : parseFloat((item.lineup.totalStat - lastPick.statValue).toFixed(1));
                    const wouldFinishAt = parseFloat((totalBeforeLast + opt.statValue).toFixed(1));
                    return (
                      <div className="mt-2 bg-black/40 border border-[#d4af37]/25 rounded px-3 py-2">
                        <div className="sports-font text-[8px] text-[#d4af37]/50 tracking-widest uppercase mb-1">Optimal Last Pick</div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-xs text-white/80 font-medium">{opt.playerName}</span>
                            <span className="text-[10px] text-white/35 ml-2">
                              {opt.year === 'career' ? 'Career GP' : opt.year} · {opt.team}
                            </span>
                            {lastPick.isBust && (
                              <span className="block text-[10px] text-emerald-400/70 mt-0.5">
                                Would finish: {fmt(wouldFinishAt)} / {targetCap}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-sm text-[#d4af37] font-semibold">{fmt(opt.statValue)}</span>
                            {opt.statValue > lastPick.statValue && (
                              <span className="text-[10px] text-emerald-400/70 ml-1">+{fmt(opt.statValue - lastPick.statValue)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
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
