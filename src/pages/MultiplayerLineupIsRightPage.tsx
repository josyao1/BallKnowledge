/**
 * MultiplayerLineupIsRightPage.tsx — Simultaneous Multiplayer Lineup Is Right.
 *
 * All players pick simultaneously each round:
 * 1. Same team shown to all players each round
 * 2. Each player searches for a player + selects a year they were on that team
 * 3. Once all players submit → host advances to next round (new team)
 * 4. Busted players are auto-skipped in subsequent rounds
 * 5. After 5 rounds → results screen (closest to cap without busting wins)
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import {
  findLobbyByCode,
  getLobbyPlayers,
  updateCareerState,
  updateLobbyStatus,
} from '../services/lobby';
import {
  searchPlayersByNameOnly,
  getPlayerYearsOnTeam,
  getPlayerStatForYearAndTeam,
  getPlayerTotalGPForTeam,
  addPlayerToLineup,
  calculateLineupStat,
  assignRandomTeam,
  isDivisionRound,
  NFL_DIVISIONS,
} from '../services/lineupIsRight';
import { getTeamByAbbreviation } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import type { PlayerLineup, SelectedPlayer, StatCategory } from '../types/lineupIsRight';

type Phase = 'loading' | 'picking' | 'results';

function getCategoryAbbr(category: StatCategory): string {
  switch (category) {
    case 'pts': return 'PTS';
    case 'ast': return 'AST';
    case 'reb': return 'REB';
    case 'min': return 'MIN';
    case 'passing_yards': return 'PASS YD';
    case 'passing_tds': return 'PASS TD';
    case 'rushing_yards': return 'RUSH YD';
    case 'rushing_tds': return 'RUSH TD';
    case 'receiving_yards': return 'REC YD';
    case 'receiving_tds': return 'REC TD';
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

export function MultiplayerLineupIsRightPage() {
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

  // Ephemeral UI state — never synced to Supabase
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ playerId: string | number; playerName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
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

  const selectedSport = ((lobby?.career_state as any)?.sport ?? null) as import('../types').Sport | null;

  // Derived: my lineup and whether I can pick this round
  const myLineup = allLineups[currentPlayerId || ''] as (PlayerLineup & { hasPickedThisRound?: boolean }) | undefined;
  const canPickThisRound = !myLineup?.hasPickedThisRound && !myLineup?.isFinished;

  // Players I've already used this game (no repeats allowed)
  const usedPlayerNames = new Set(myLineup?.selectedPlayers.map(p => p.playerName) ?? []);

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

        if (cs.phase === 'results') setPhase('results');
        else setPhase('picking');
      } catch (error) {
        console.error('Error initializing game:', error);
        navigate('/');
      }
    };

    initGame();
  }, [code, navigate, setLobby, setPlayers]);

  // ── Realtime sync: when lobby.career_state changes, update local state ────
  useEffect(() => {
    if (addingPlayerRef.current) return; // don't clobber mid-pick
    const cs = (lobby?.career_state as any);
    if (!cs?.statCategory || !cs?.allLineups) return;

    const newRound = cs.currentRound ?? 1;

    // Reset ephemeral search UI when the round advances
    if (newRound !== prevRoundRef.current && prevRoundRef.current !== 0) {
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

    if (cs.phase === 'results') setPhase('results');
    else if (phase === 'loading') setPhase('picking');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.career_state]);

  // ── Host-only: advance round when all players have picked ─────────────────
  useEffect(() => {
    if (!isHost || !lobby?.career_state || !lobby?.id) return;

    const cs = lobby.career_state as any;
    if (cs.phase !== 'picking') return;

    const lineups = cs.allLineups || {};
    const playerIds = Object.keys(lineups);
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
    const allBusted = playerIds.every(pid => (lineups[pid] as any)?.isBusted);

    const advanceRound = async () => {
      if (nextRound > totalRds || allBusted) {
        // Game over → go to results
        await updateCareerState(lobbyId, { ...cs, phase: 'results' });
      } else {
        // Next round: new team, reset hasPickedThisRound for active players
        const newTeam = cs.statCategory === 'total_gp'
          ? cs.currentTeam  // same team all 5 rounds in GP mode
          : assignRandomTeam(cs.sport || 'nba', cs.statCategory);
        const resetLineups: Record<string, any> = {};
        playerIds.forEach(pid => {
          resetLineups[pid] = {
            ...lineups[pid],
            // Finished/busted players keep hasPickedThisRound true so they're auto-skipped
            hasPickedThisRound: (lineups[pid] as any).isFinished ? true : false,
          };
        });

        await updateCareerState(lobbyId, {
          ...cs,
          allLineups: resetLineups,
          currentRound: nextRound,
          currentTeam: newTeam,
        });
      }
    };

    advanceRound();
  }, [lobby?.career_state, isHost, lobby?.id]);

  // ── All clients: navigate back to lobby when host resets to waiting ────────
  useEffect(() => {
    if (lobby?.status === 'waiting' && phase === 'results') {
      navigate(`/lobby/${code}`);
    }
  }, [lobby?.status, phase, navigate, code]);

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
    setDuplicateError(null);
    setSelectedPlayerName(player.playerName);
    setSelectedYear('');
    setAvailableYears([]);

    // total_gp mode: no year needed, go straight to confirm
    if (statCategory === 'total_gp') return;

    setLoadingYears(true);
    try {
      const years = await getPlayerYearsOnTeam(selectedSport!, player.playerName, currentTeam);
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
        ? await getPlayerTotalGPForTeam(selectedPlayerName, currentTeam)
        : await getPlayerStatForYearAndTeam(
            selectedSport as any,
            selectedPlayerName,
            currentTeam,
            selectedYear,
            statCategory
          );

      // Read latest career_state from store (synced via realtime) to minimize race window
      const latestCS = (lobby.career_state as any) || {};
      const myCurrentLineup: any = latestCS.allLineups?.[currentPlayerId] || {
        playerId: currentPlayerId,
        playerName: players.find(p => p.player_id === currentPlayerId)?.player_name || '',
        selectedPlayers: [],
        totalStat: 0,
        isBusted: false,
        isFinished: false,
        hasPickedThisRound: false,
      };

      const newSelectedPlayer: SelectedPlayer = {
        playerName: selectedPlayerName,
        team: currentTeam,
        selectedYear: isTotalGP ? 'career' : selectedYear,
        playerSeason: null,
        statValue,
      };

      const withNewPlayer = addPlayerToLineup(myCurrentLineup as PlayerLineup, newSelectedPlayer);
      const { total, isBusted } = calculateLineupStat(withNewPlayer, statCategory, targetCap);
      withNewPlayer.totalStat = total;
      withNewPlayer.isBusted = isBusted;
      (withNewPlayer as any).hasPickedThisRound = true;
      if (isBusted) withNewPlayer.isFinished = true;

      // Write merged update: spread latest state, override only my lineup entry
      const updatedCS = {
        ...latestCS,
        allLineups: {
          ...latestCS.allLineups,
          [currentPlayerId]: withNewPlayer,
        },
      };

      await updateCareerState(lobby.id, updatedCS);

      // Apply locally so UI reflects immediately
      setAllLineups(prev => ({ ...prev, [currentPlayerId]: withNewPlayer }));

      // Clear search UI
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPlayerName(null);
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
            <p className="text-2xl text-red-400 retro-title">BUSTED</p>
            <p className="text-white/50 sports-font text-sm">You exceeded the cap. Sit tight while others finish the round.</p>
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
                {duplicateError && (
                  <p className="text-red-400 text-sm font-semibold mb-2">{duplicateError}</p>
                )}
                {searchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {searchResults.map((result, idx) => {
                      const alreadyUsed = usedPlayerNames.has(result.playerName);
                      return (
                        <button
                          key={String(result.playerId) + idx}
                          onClick={() => handleSelectPlayer(result)}
                          className={`w-full text-left px-4 py-3 rounded border transition text-sm font-semibold ${
                            alreadyUsed
                              ? 'bg-[#111] border-white/5 text-white/25 cursor-not-allowed line-through'
                              : 'bg-[#1a1a1a] hover:bg-[#2a2a2a] border-white/10 text-white'
                          }`}
                        >
                          {result.playerName}
                          {alreadyUsed && <span className="ml-2 text-[10px] text-white/20 no-underline not-italic font-normal">(already used)</span>}
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
                    onClick={() => { setSelectedPlayerName(null); setSelectedYear(''); setAvailableYears([]); }}
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
                  <div className="space-y-1.5 overflow-y-auto flex-1">
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
                  <p className="text-red-400 text-sm">No playing years found for this player</p>
                )}
                <div className="flex gap-2 mt-auto pt-2">
                  <button
                    onClick={() => { setSelectedPlayerName(null); setSelectedYear(''); setAvailableYears([]); }}
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
            <div>
              <p className="text-lg text-emerald-400 font-semibold mb-1">Pick submitted!</p>
              <p className="text-white/50 sports-font text-sm">Waiting for other players...</p>
            </div>
            {waitingFor.length > 0 && (
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
            // Only reveal busted status on your own row — opponents just see ✓
            const showBusted = isMe && !!lineup?.isBusted;

            return (
              <div
                key={player.id}
                className={`p-3 rounded border-2 transition ${
                  isMe ? 'border-[#d4af37] bg-[#1a1a1a]' : 'border-white/10 bg-black/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className={`font-semibold text-sm ${isMe ? 'text-[#d4af37]' : 'text-white/60'}`}>
                    {player.player_name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {showBusted ? (
                      <span className="text-[9px] text-red-400 sports-font uppercase tracking-wider px-1.5 py-0.5 bg-red-900/30 border border-red-500/30 rounded">BUSTED</span>
                    ) : hasPicked ? (
                      <span className="text-emerald-400 text-sm">✓</span>
                    ) : (
                      <span className="text-yellow-400 text-sm">⏳</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1 mb-2 text-xs">
                  {visiblePicks.map((selected, idx) => (
                    <div key={idx} className={`flex justify-between ${isMe && selected.statValue === 0 ? 'text-red-300' : 'text-white/70'}`}>
                      <div className="flex-1 min-w-0">
                        <span className={`truncate text-xs ${isMe && selected.statValue === 0 ? 'text-red-400' : ''}`}>{selected.playerName}</span>
                        <span className={`ml-1 text-[10px] ${isMe && selected.statValue === 0 ? 'text-red-400/70' : 'text-white/40'}`}>({selected.selectedYear}, {selected.team})</span>
                      </div>
                      {isMe && (
                        <span className={`font-semibold ml-1 flex-shrink-0 ${selected.statValue === 0 ? 'text-red-400' : 'text-[#d4af37]'}`}>
                          {selected.statValue}
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
                    <span className={`font-semibold ${showBusted ? 'text-red-500' : 'text-white'}`}>
                      {lineup?.totalStat ?? 0}
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

    return (
      <div className="h-[100dvh] bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden">
        {/* Green felt background */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
        />

        {/* ── Header ── */}
        <header className="relative z-10 flex-shrink-0 bg-black/60 border-b-2 border-white/10 backdrop-blur-sm">
          <div className="px-4 py-2 flex items-center justify-between border-b border-white/5">
            <h1 className="retro-title text-xl text-[#d4af37]">Lineup Is Right</h1>
            <div className="px-3 py-1 bg-[#ec4899]/20 border border-[#ec4899]/50 rounded-sm">
              <span className="retro-title text-sm text-[#ec4899]">Round {currentRound} / {totalRounds}</span>
            </div>
          </div>
          {/* Team + compact stats row */}
          <div className="flex items-center gap-3 px-4 py-2">
            <motion.div
              key={currentTeam + currentRound}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex items-center gap-2"
            >
              {isDivisionRound(currentTeam) ? (
                <div className="px-4 py-1.5 rounded border-2 bg-black border-[#d4af37]/60">
                  <p className="sports-font text-[8px] text-white/50 tracking-widest uppercase leading-none mb-0.5">Division</p>
                  <p className="retro-title text-base font-bold text-[#d4af37] leading-tight">
                    {currentTeam}
                  </p>
                  <p className="sports-font text-[8px] text-white/35 leading-none mt-0.5">
                    {(NFL_DIVISIONS[currentTeam] ?? []).join(' · ')}
                  </p>
                </div>
              ) : (
                <div
                  className="px-4 py-1.5 rounded border-2 bg-black"
                  style={{ borderColor: getTeamColor(selectedSport, currentTeam) }}
                >
                  <p className="sports-font text-[8px] text-white/50 tracking-widest uppercase leading-none mb-0.5">Team</p>
                  <p className="retro-title text-xl font-bold" style={{ color: getTeamColor(selectedSport, currentTeam) }}>
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
              <div className={`border px-3 py-1.5 rounded-sm text-center ${
                myLineup?.isBusted
                  ? 'bg-red-900/20 border-red-500/50'
                  : 'bg-[#d4af37]/10 border-[#d4af37]/40'
              }`}>
                <div className="sports-font text-[7px] text-white/30 tracking-widest uppercase">You</div>
                <p className={`retro-title text-lg leading-none ${myLineup?.isBusted ? 'text-red-400' : 'text-[#d4af37]'}`}>
                  {myLineup?.totalStat ?? 0}
                </p>
              </div>
              {/* Remaining to cap */}
              <div className={`border px-3 py-1.5 rounded-sm text-center ${
                myLineup?.isBusted
                  ? 'bg-red-900/20 border-red-500/50'
                  : 'bg-[#111] border-white/10'
              }`}>
                <div className="sports-font text-[7px] text-white/30 tracking-widest uppercase">Left</div>
                <p className={`retro-title text-lg leading-none ${myLineup?.isBusted ? 'text-red-400' : 'text-white'}`}>
                  {myLineup?.isBusted ? '—' : targetCap - (myLineup?.totalStat ?? 0)}
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
    const everyoneBusted = players.length > 0 && players.every(p => (allLineups[p.player_id] as any)?.isBusted);

    const sortedLineups = players
      .map((p) => ({
        ...p,
        lineup: (allLineups[p.player_id] || { playerId: p.player_id, playerName: p.player_name, selectedPlayers: [], totalStat: 0, isBusted: false, isFinished: false }) as PlayerLineup,
      }))
      .sort((a, b) => {
        if (everyoneBusted) {
          // All busted: least over the cap wins (lowest total stat)
          return a.lineup.totalStat - b.lineup.totalStat;
        }
        // Normal: non-busted beat busted; among non-busted, highest total wins
        if (a.lineup.isBusted && !b.lineup.isBusted) return 1;
        if (!a.lineup.isBusted && b.lineup.isBusted) return -1;
        return b.lineup.totalStat - a.lineup.totalStat;
      });

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
            {everyoneBusted && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-center">
                <p className="sports-font text-[10px] text-red-400 tracking-widest uppercase">Everyone busted — least over wins</p>
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
                    </div>
                    <div className="text-right">
                      <p
                        className={`retro-title text-3xl ${
                          item.lineup.isBusted ? 'text-red-500' : 'text-[#d4af37]'
                        }`}
                      >
                        {item.lineup.totalStat}
                      </p>
                      {!item.lineup.isBusted && (
                        <p className="text-xs text-white/40">
                          {Math.abs(item.lineup.totalStat - targetCap)} away
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs mb-3 border-t border-white/10 pt-3">
                    {item.lineup.selectedPlayers.map((selected, pidx) => (
                      <div key={pidx} className={`flex justify-between ${selected.statValue === 0 ? 'text-red-300' : 'text-white/70'}`}>
                        <div className="flex-1">
                          <span className={`truncate ${selected.statValue === 0 ? 'text-red-400' : ''}`}>{pidx + 1}. {selected.playerName}</span>
                          <span className={`ml-2 block text-[11px] ${selected.statValue === 0 ? 'text-red-400/70' : 'text-white/40'}`}>({selected.selectedYear}, {selected.team})</span>
                        </div>
                        <span className={`font-semibold ml-2 ${selected.statValue === 0 ? 'text-red-400' : 'text-[#d4af37]'}`}>{selected.statValue}</span>
                      </div>
                    ))}
                  </div>

                  {item.lineup.isBusted && (
                    <div className="text-red-400 text-xs font-semibold bg-red-900/20 px-3 py-2 rounded border border-red-500/30">
                      BUSTED - Exceeded {targetCap}
                    </div>
                  )}
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
