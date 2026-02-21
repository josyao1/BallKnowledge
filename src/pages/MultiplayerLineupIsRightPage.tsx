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
} from '../services/lobby';
import {
  searchPlayersByNameOnly,
  getPlayerYearsOnTeam,
  getPlayerStatForYearAndTeam,
  addPlayerToLineup,
  calculateLineupStat,
  assignRandomTeam,
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
        const newTeam = assignRandomTeam(cs.sport || 'nba');
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

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
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
    setSelectedPlayerName(player.playerName);
    setSelectedYear('');
    setAvailableYears([]);

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

  const handleConfirmYear = async () => {
    if (!selectedPlayerName || !selectedYear || !selectedSport || !statCategory || !lobby || !currentPlayerId) return;

    addingPlayerRef.current = true;
    setAddingPlayer(true);
    try {
      const statValue = await getPlayerStatForYearAndTeam(
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
        selectedYear,
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

    return (
      <div className="min-h-screen bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden">
        {/* Green felt background */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
        />

        <header className="relative z-10 bg-black/60 border-b-2 border-white/10 backdrop-blur-sm">
          <div className="px-4 py-2 flex items-center justify-between border-b border-white/5">
            <h1 className="retro-title text-2xl text-[#d4af37]">Lineup Is Right</h1>
            <div className="px-3 py-1 bg-[#ec4899]/20 border border-[#ec4899]/50 rounded-sm">
              <span className="retro-title text-sm text-[#ec4899]">Round {currentRound} / {totalRounds}</span>
            </div>
          </div>
          {/* Team Display — same for all players */}
          <motion.div
            key={currentTeam + currentRound}
            initial={{ opacity: 0, rotateY: -90, x: -100 }}
            animate={{ opacity: 1, rotateY: 0, x: 0 }}
            exit={{ opacity: 0, rotateY: 90, x: 100 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="flex items-center justify-center py-3 px-4"
          >
            <div
              className="text-center px-8 md:px-12 py-2 md:py-3 rounded-lg border-2 bg-black"
              style={{ borderColor: getTeamColor(selectedSport, currentTeam) }}
            >
              <p className="sports-font text-[8px] md:text-[10px] text-white/60 tracking-[0.4em] uppercase mb-1">Current Team</p>
              <p
                className="retro-title text-2xl md:text-4xl font-bold tracking-tight"
                style={{ color: getTeamColor(selectedSport, currentTeam) }}
              >
                {currentTeam}
              </p>
            </div>
          </motion.div>
        </header>

        <main className="relative z-10 flex-1 w-full px-2 md:px-6 py-2 md:py-4 flex flex-col lg:flex-row gap-2 md:gap-4 overflow-hidden">
          {/* Left Column - Stats */}
          <div className="w-full sm:w-1/3 lg:w-40 lg:flex-shrink-0 flex flex-row lg:flex-col gap-2 md:gap-3">
            <div className="flex-1 sm:flex-none bg-[#111] border border-white/5 px-3 md:px-6 py-3 md:py-6 rounded-sm text-center shadow-xl">
              <div className="sports-font text-[6px] md:text-[8px] text-white/30 tracking-widest uppercase mb-1 md:mb-2">Target</div>
              <p className="retro-title text-2xl md:text-4xl text-white">{targetCap}</p>
            </div>
            <div className="flex-1 sm:flex-none bg-[#111] border border-white/5 px-3 md:px-6 py-3 md:py-6 rounded-sm text-center shadow-xl">
              <div className="sports-font text-[6px] md:text-[8px] text-white/30 tracking-widest uppercase mb-1 md:mb-2">Category</div>
              <p className="retro-title text-lg md:text-2xl text-white">{getCategoryAbbr(statCategory!)}</p>
            </div>
          </div>

          {/* Middle Column - Pick UI or Waiting */}
          <div className="flex-1 flex flex-col min-h-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-black/60 border-2 border-white/10 rounded p-3 md:p-6 flex-1 flex flex-col min-h-0"
            >
              {myLineup?.isFinished ? (
                /* Busted — sitting out remaining rounds */
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <p className="text-2xl text-red-400 retro-title">BUSTED</p>
                  <p className="text-white/50 sports-font text-sm">You exceeded the cap. Sit tight while others finish the round.</p>
                </div>
              ) : canPickThisRound ? (
                /* Active pick UI */
                <>
                  {!selectedPlayerName ? (
                    <div className="flex flex-col h-full">
                      <label className="block sports-font text-[8px] md:text-[10px] tracking-[0.4em] text-white/60 uppercase mb-2 md:mb-4 font-semibold">
                        Search for a player
                      </label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Enter player name..."
                        className="w-full px-2 md:px-4 py-2 md:py-3 bg-[#222] text-white rounded border border-white/10 focus:outline-none focus:border-white/30 mb-2 md:mb-4 text-xs md:text-base"
                      />

                      {loading && <p className="text-white/60 text-xs md:text-sm">Loading...</p>}

                      {searchResults.length > 0 && (
                        <div className="space-y-1 md:space-y-2 overflow-y-auto flex-1 min-h-0">
                          {searchResults.map((result, idx) => (
                            <button
                              key={String(result.playerId) + idx}
                              onClick={() => handleSelectPlayer(result)}
                              className="w-full text-left px-2 md:px-4 py-1 md:py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded border border-white/10 transition text-white font-semibold text-xs md:text-base"
                            >
                              {result.playerName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 md:space-y-4 flex flex-col flex-1 overflow-hidden">
                      <div className="p-2 md:p-4 bg-[#1a1a1a] rounded border border-white/10">
                        <p className="font-semibold text-white text-xs md:text-lg truncate">{selectedPlayerName}</p>
                        <p className="text-[10px] md:text-sm text-white/60">Select any year this player played</p>
                      </div>

                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-baseline justify-between mb-2 md:mb-3">
                          <label className="block sports-font text-[7px] md:text-[10px] tracking-[0.4em] text-white/60 uppercase font-semibold">
                            Select a year
                          </label>
                          {selectedSport === 'nfl' && (
                            <span className="text-white/25 text-[7px] sports-font tracking-wide">through 2024</span>
                          )}
                        </div>
                        {loadingYears ? (
                          <p className="text-white/60 text-xs md:text-sm">Loading years...</p>
                        ) : availableYears.length > 0 ? (
                          <div className="space-y-1 md:space-y-2 overflow-y-auto max-h-40 md:max-h-56">
                            {availableYears.map((year) => (
                              <button
                                key={year}
                                onClick={() => setSelectedYear(year)}
                                className={`w-full px-2 md:px-4 py-1 md:py-2 rounded border transition text-white font-semibold text-xs md:text-base ${
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
                          <p className="text-red-400 text-xs md:text-sm">No playing years found for this player</p>
                        )}
                      </div>

                      <div className="flex gap-1 md:gap-2 mt-2 md:mt-auto">
                        <button
                          onClick={() => {
                            setSelectedPlayerName(null);
                            setSelectedYear('');
                            setAvailableYears([]);
                          }}
                          className="flex-1 px-2 md:px-4 py-1 md:py-2 bg-[#333] hover:bg-[#444] text-white rounded-sm transition border border-white/10 text-xs md:text-base"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleConfirmYear}
                          disabled={!selectedYear || addingPlayer}
                          className="flex-1 px-2 md:px-4 py-1 md:py-2 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] shadow-[0_2px_0_#a89860] active:translate-y-1 active:shadow-none disabled:opacity-50 text-black font-semibold rounded-sm transition text-xs md:text-base retro-title"
                        >
                          {addingPlayer ? 'Adding...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Pick submitted — waiting for others */
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
          </div>

          {/* Sidebar - All Lineups */}
          <div className="w-full sm:w-1/3 lg:w-80 lg:flex-shrink-0 flex flex-col">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/60 border-2 border-white/10 rounded p-2 md:p-6 flex-1 overflow-y-auto"
            >
              <h3 className="retro-title text-xs md:text-lg text-[#d4af37] mb-2 md:mb-4">Lineups</h3>
              <div className="space-y-1 md:space-y-4">
                {players.map((player) => {
                  const lineup = allLineups[player.player_id] as (PlayerLineup & { hasPickedThisRound?: boolean }) | undefined;
                  const hasPicked = lineup?.hasPickedThisRound || lineup?.isFinished;
                  const isMe = player.player_id === currentPlayerId;

                  return (
                    <div
                      key={player.id}
                      className={`p-1 md:p-4 rounded border text-[8px] md:text-sm transition ${
                        isMe
                          ? 'border-[#d4af37] bg-[#1a1a1a]'
                          : 'border-white/10 bg-black/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-semibold text-[8px] md:text-base ${isMe ? 'text-[#d4af37]' : 'text-white/60'}`}>
                          {player.player_name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {lineup?.isBusted ? (
                            <span className="text-[9px] text-red-400 sports-font uppercase tracking-wider px-1.5 py-0.5 bg-red-900/30 border border-red-500/30 rounded">BUSTED</span>
                          ) : hasPicked ? (
                            <span className="text-emerald-400 text-sm" title="Picked">✓</span>
                          ) : (
                            <span className="text-yellow-400 text-sm" title="Still picking">⏳</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 mb-2 md:mb-3 text-[10px] md:text-xs">
                        {lineup &&
                          lineup.selectedPlayers.map((selected, idx) => (
                            <div key={idx} className={`flex justify-between ${selected.statValue === 0 ? 'text-red-300' : 'text-white/70'}`}>
                              <div className="flex-1 min-w-0">
                                <span className={`truncate text-[10px] md:text-xs ${selected.statValue === 0 ? 'text-red-400' : ''}`}>{selected.playerName}</span>
                                <span className={`ml-1 block text-[9px] md:text-[10px] ${selected.statValue === 0 ? 'text-red-400/70' : 'text-white/40'}`}>({selected.selectedYear}, {selected.team})</span>
                              </div>
                              <span className={`font-semibold ml-1 flex-shrink-0 ${selected.statValue === 0 ? 'text-red-400' : 'text-[#d4af37]'}`}>
                                {selected.statValue}
                              </span>
                            </div>
                          ))}
                      </div>
                      <div className="flex justify-between text-[10px] md:text-xs border-t border-white/10 pt-1 md:pt-2">
                        <span className="text-white/40">
                          {lineup?.selectedPlayers.length || 0}/{totalRounds}
                        </span>
                        <span className={`font-semibold ${lineup?.isBusted ? 'text-red-500' : 'text-white'}`}>
                          {lineup?.totalStat || 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  // ── Results screen ─────────────────────────────────────────────────────────
  if (phase === 'results') {
    const sortedLineups = players
      .map((p) => ({
        ...p,
        lineup: (allLineups[p.player_id] || { playerId: p.player_id, playerName: p.player_name, selectedPlayers: [], totalStat: 0, isBusted: false, isFinished: false }) as PlayerLineup,
      }))
      .sort((a, b) => {
        // Non-busted beat busted; among non-busted, highest total wins
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

            <div className="mt-8">
              <button
                onClick={() => navigate('/')}
                className="w-full py-4 rounded-sm retro-title text-lg tracking-wider bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1 transition-all"
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
