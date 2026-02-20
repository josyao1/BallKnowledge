/**
 * MultiplayerLineupIsRightPage.tsx — Multiplayer Lineup Is Right gameplay.
 *
 * Turn-based multiplayer where each player:
 * 1. Gets assigned a random team
 * 2. Searches for and selects a player
 * 3. Selects a year the player was on that team
 * 4. Gets stat value (0 if not on team that year)
 * Goals: reach target cap without exceeding it
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import {
  findLobbyByCode,
  getLobbyPlayers,
} from '../services/lobby';
import {
  selectRandomStatCategory,
  generateTargetCap,
  searchPlayersByNameOnly,
  getPlayerYearsOnTeam,
  getPlayerStatForYearAndTeam,
  addPlayerToLineup,
  calculateLineupStat,
  createPlayerLineup,
  assignRandomTeam,
} from '../services/lineupIsRight';
import { getTeamByAbbreviation } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import type { PlayerLineup, SelectedPlayer, StatCategory } from '../types/lineupIsRight';

type Phase = 'loading' | 'playing' | 'results';

interface PlayerTurnState {
  playerId: string;
  playerName: string;
  lineup: PlayerLineup;
  isCurrentPlayer: boolean;
  isFinished: boolean;
}

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
    // NFL
    const nflTeam = nflTeams.find(t => t.abbreviation === teamAbbr);
    return nflTeam?.colors?.primary || '#003875';
  }
}

export function MultiplayerLineupIsRightPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, currentPlayerId, setLobby, setPlayers } = useLobbyStore();

  const [phase, setPhase] = useState<Phase>('loading');
  const [statCategory, setStatCategory] = useState<StatCategory | null>(null);
  const [targetCap, setTargetCap] = useState<number>(0);
  const [allLineups, setAllLineups] = useState<Record<string, PlayerLineup>>({});
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

  // Current player's turn state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ playerId: string | number; playerName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [currentTeam, setCurrentTeam] = useState('');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [loadingYears, setLoadingYears] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);

  const selectedSport = lobby && (lobby as any).career_state ? ((lobby as any).career_state as any).sport : null;

  useLobbySubscription(lobby?.id || null);

  // Initialize game
  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    const initGame = async () => {
      try {
        const result = await findLobbyByCode(code);
        if (!result.lobby) {
          alert(result.error || 'Lobby not found');
          navigate('/');
          return;
        }

        const foundLobby = result.lobby;
        setLobby(foundLobby);

        const playersResult = await getLobbyPlayers(foundLobby.id);
        const lobbyPlayers = Array.isArray(playersResult) ? playersResult : (playersResult?.players || []);
        if (lobbyPlayers && lobbyPlayers.length > 0) {
          setPlayers(lobbyPlayers);

          // Initialize game if not already initialized
          const careerState = (foundLobby as any).career_state as any;
          if (!careerState.statCategory) {
            setStatCategory(selectRandomStatCategory(careerState.sport));
            setTargetCap(generateTargetCap(careerState.sport, 'pts'));
          } else {
            setStatCategory(careerState.statCategory as StatCategory);
            setTargetCap(careerState.targetCap);
          }

          // Create lineups for all players
          const initialLineups: Record<string, PlayerLineup> = {};
          lobbyPlayers.forEach((p) => {
            initialLineups[p.id] = createPlayerLineup(p.id, p.player_name);
          });
          setAllLineups(initialLineups);

          // Assign team to first player
          const firstTeam = assignRandomTeam(careerState.sport);
          setCurrentTeam(firstTeam);
          setPhase('playing');
        }
      } catch (error) {
        console.error('Error initializing game:', error);
        navigate('/');
      }
    };

    initGame();
  }, [code, navigate, setLobby, setPlayers]);

  const getCurrentPlayer = (): PlayerTurnState | null => {
    if (!players || players.length === 0) return null;

    const player = players[currentPlayerIndex];
    if (!player) return null;

    return {
      playerId: player.id,
      playerName: player.player_name,
      lineup: allLineups[player.id] || createPlayerLineup(player.id, player.player_name),
      isCurrentPlayer: player.id === currentPlayerId,
      isFinished: (allLineups[player.id]?.isFinished) || false,
    };
  };

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
    } catch (error) {
      console.error('Search error:', error);
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
      const years = await getPlayerYearsOnTeam(
        selectedSport!,
        player.playerName,
        currentTeam
      );
      setAvailableYears(years);
    } catch (error) {
      console.error('Error getting years:', error);
      setAvailableYears([]);
    } finally {
      setLoadingYears(false);
    }
  };

  const handleConfirmYear = async () => {
    if (
      !selectedPlayerName ||
      !selectedYear ||
      !selectedSport ||
      !statCategory ||
      currentPlayerIndex >= players.length
    ) {
      return;
    }

    setAddingPlayer(true);
    try {
      const statValue = await getPlayerStatForYearAndTeam(
        selectedSport,
        selectedPlayerName!,
        currentTeam,
        selectedYear,
        statCategory
      );

      const newSelectedPlayer: SelectedPlayer = {
        playerName: selectedPlayerName!,
        team: currentTeam,
        selectedYear,
        playerSeason: null,
        statValue,
      };

      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) return;

      const updated = { ...allLineups[currentPlayer.playerId] };
      const withNewPlayer = addPlayerToLineup(updated, newSelectedPlayer);
      const { total, isBusted } = calculateLineupStat(
        withNewPlayer,
        statCategory,
        targetCap
      );
      withNewPlayer.totalStat = total;
      withNewPlayer.isBusted = isBusted;

      const newAllLineups = { ...allLineups };
      newAllLineups[currentPlayer.playerId] = withNewPlayer;
      setAllLineups(newAllLineups);

      // Check if player's lineup is complete (5 players or busted)
      if (withNewPlayer.selectedPlayers.length === 5 || isBusted) {
        withNewPlayer.isFinished = true;

        // Check if all players are finished
        const allFinished = Object.values(newAllLineups).every(l => l.isFinished);
        if (allFinished) {
          setPhase('results');
        } else {
          // Move to next player
          const nextIndex = currentPlayerIndex + 1;
          if (nextIndex < players.length) {
            setCurrentPlayerIndex(nextIndex);
            const nextTeam = assignRandomTeam(selectedSport);
            setCurrentTeam(nextTeam);
          }
        }
      } else {
        // Same player continues, switch team
        const nextTeam = assignRandomTeam(selectedSport);
        setCurrentTeam(nextTeam);
      }

      // Clear search
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPlayerName(null);
      setSelectedYear('');
      setAvailableYears([]);
    } catch (error) {
      console.error('Error adding player:', error);
    } finally {
      setAddingPlayer(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d2a0b] text-white flex items-center justify-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
            background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)`
          }}
        />
        <div className="relative z-10 text-center">
          <p className="text-xl text-white/80">Loading game...</p>
        </div>
      </div>
    );
  }

  const currentPlayer = getCurrentPlayer();

  if (phase === 'playing' && currentPlayer && statCategory) {
    const isYourTurn = currentPlayer.isCurrentPlayer;

    return (
      <div className="min-h-screen bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden">
        {/* GREEN FELT BACKGROUND */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
            background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)`
          }}
        />

        <header className="relative z-10 bg-black/60 border-b-2 border-white/10 backdrop-blur-sm">
          <div className="px-4 py-2 text-center border-b border-white/5">
            <h1 className="retro-title text-2xl text-[#d4af37]">Lineup Is Right</h1>
          </div>
          {/* Team Display */}
          <motion.div
            key={currentTeam}
            initial={{ opacity: 0, rotateY: -90, x: -100 }}
            animate={{ opacity: 1, rotateY: 0, x: 0 }}
            exit={{ opacity: 0, rotateY: 90, x: 100 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="flex items-center justify-center py-3 px-4"
          >
            <div className="text-center px-8 md:px-12 py-2 md:py-3 rounded-lg border-2 bg-black"
              style={{
                borderColor: getTeamColor(selectedSport, currentTeam),
              }}
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

        <main className="relative z-10 flex-1 w-full px-4 md:px-6 py-3 md:py-4 flex gap-2 md:gap-4 overflow-hidden">
          {/* Left Column - Stats */}
          <div className="w-40 md:w-52 flex flex-col gap-3 md:gap-4">
            <div className="bg-[#111] border border-white/5 px-4 md:px-6 py-4 md:py-6 rounded-sm text-center shadow-xl">
              <div className="sports-font text-[7px] md:text-[8px] text-white/30 tracking-widest uppercase mb-2">Target</div>
              <p className="retro-title text-3xl md:text-4xl text-white">{targetCap}</p>
            </div>
            <div className="bg-[#111] border border-white/5 px-4 md:px-6 py-4 md:py-6 rounded-sm text-center shadow-xl">
              <div className="sports-font text-[7px] md:text-[8px] text-white/30 tracking-widest uppercase mb-2">Category</div>
              <p className="retro-title text-xl md:text-2xl text-white">{getCategoryAbbr(statCategory!)}</p>
            </div>
            <div className="bg-[#111] border border-white/5 px-4 md:px-6 py-4 md:py-6 rounded-sm text-center shadow-xl">
              <div className="sports-font text-[7px] md:text-[8px] text-white/30 tracking-widest uppercase mb-2">Player</div>
              <p className="retro-title text-lg md:text-xl text-[#d4af37] truncate">{currentPlayer.playerName}</p>
            </div>
          </div>

          {/* Middle Column - Player Selection */}
            <div className="flex-1 flex flex-col">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-black/60 border-2 border-white/10 rounded p-6 flex-1 flex flex-col"
              >
              {isYourTurn ? (
                <>
                  {!selectedPlayerName ? (
                    <div>
                      <label className="block sports-font text-[8px] md:text-[10px] tracking-[0.4em] text-white/60 uppercase mb-2 md:mb-4 font-semibold">
                        Search for a player
                      </label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Enter player name..."
                        className="w-full px-3 md:px-4 py-2 md:py-3 bg-[#222] text-white rounded border border-white/10 focus:outline-none focus:border-white/30 mb-2 md:mb-4 text-sm md:text-base"
                      />

                      {loading && <p className="text-white/60 text-sm">Loading...</p>}

                      {searchResults.length > 0 && (
                        <div className="space-y-1 md:space-y-2 max-h-96 overflow-y-auto">
                          {searchResults.map((result, idx) => (
                            <button
                              key={String(result.playerId) + idx}
                              onClick={() => handleSelectPlayer(result)}
                              className="w-full text-left px-2 md:px-4 py-2 md:py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded border border-white/10 transition text-white font-semibold text-sm md:text-base"
                            >
                              {result.playerName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 md:space-y-4 flex flex-col overflow-hidden">
                      <div className="p-2 md:p-4 bg-[#1a1a1a] rounded border border-white/10">
                        <p className="font-semibold text-white text-sm md:text-lg truncate">{selectedPlayerName}</p>
                        <p className="text-[11px] md:text-sm text-white/60">Select any year this player played</p>
                      </div>

                      <div className="flex-1 overflow-hidden">
                        <label className="block sports-font text-[8px] md:text-[10px] tracking-[0.4em] text-white/60 uppercase mb-2 md:mb-3 font-semibold">
                          Select a year
                        </label>
                        {loadingYears ? (
                          <p className="text-white/60 text-sm">Loading years...</p>
                        ) : availableYears.length > 0 ? (
                          <div className="space-y-1 md:space-y-2 overflow-y-auto max-h-40 md:max-h-56">
                            {availableYears.map((year) => (
                              <button
                                key={year}
                                onClick={() => setSelectedYear(year)}
                                className={`w-full px-3 md:px-4 py-1 md:py-2 rounded border transition text-white font-semibold text-sm md:text-base ${
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
                      </div>

                      <div className="flex gap-1 md:gap-2 pt-1 md:pt-4 mt-auto">
                        <button
                          onClick={() => {
                            setSelectedPlayerName(null);
                            setSelectedYear('');
                            setAvailableYears([]);
                          }}
                          className="flex-1 px-3 md:px-4 py-1 md:py-2 bg-[#333] hover:bg-[#444] text-white rounded-sm transition border border-white/10 text-sm md:text-base"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleConfirmYear}
                          disabled={!selectedYear || addingPlayer}
                          className="flex-1 px-3 md:px-4 py-1 md:py-2 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] shadow-[0_2px_0_#a89860] active:translate-y-1 active:shadow-none disabled:opacity-50 text-black font-semibold rounded-sm transition text-sm md:text-base retro-title"
                        >
                          {addingPlayer ? 'Adding...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-lg text-white font-semibold">
                    Waiting for {currentPlayer.playerName} to complete their turn...
                  </p>
                </div>
              )}
            </motion.div>
          </div>

            {/* Sidebar - All Lineups */}
            <div className="w-80 md:w-96 flex flex-col">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-black/60 border-2 border-white/10 rounded p-3 md:p-6 flex-1 overflow-y-auto"
              >
                <h3 className="retro-title text-sm md:text-lg text-[#d4af37] mb-2 md:mb-4">Lineups</h3>
                <div className="space-y-2 md:space-y-4">
                  {players.map((player) => {
                    const lineup = allLineups[player.id];
                    const isActive = player.id === currentPlayer.playerId;

                    return (
                      <div
                        key={player.id}
                        className={`p-2 md:p-4 rounded border-2 transition ${
                          isActive
                            ? 'border-[#d4af37] bg-[#1a1a1a]'
                            : 'border-white/10 bg-black/40'
                        }`}
                      >
                        <p
                          className={`font-semibold mb-1 md:mb-2 text-sm md:text-base ${
                            isActive ? 'text-[#d4af37]' : 'text-white/60'
                          }`}
                        >
                          {player.player_name}
                        </p>
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
                            {lineup?.selectedPlayers.length || 0}/5
                          </span>
                          <span
                            className={`font-semibold ${
                              lineup?.isBusted ? 'text-red-500' : 'text-white'
                            }`}
                          >
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

  if (phase === 'results') {
    const sortedLineups = players
      .map((p) => ({
        ...p,
        lineup: allLineups[p.id],
      }))
      .sort((a, b) => {
        if (a.lineup.isBusted && !b.lineup.isBusted) return 1;
        if (!a.lineup.isBusted && b.lineup.isBusted) return -1;
        return Math.abs(b.lineup.totalStat - targetCap) -
          Math.abs(a.lineup.totalStat - targetCap);
      });

    return (
      <div className="min-h-screen bg-[#111] text-white flex flex-col relative overflow-hidden">
        {/* GREEN FELT BACKGROUND */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
            background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)`
          }}
        />

        <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="retro-title text-2xl text-[#d4af37]">Final Results</div>
            <button onClick={() => navigate('/')} className="px-3 py-1 text-sm bg-[#333] hover:bg-[#444] text-white rounded transition">Home</button>
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

            <div className="mt-8 flex gap-2">
              <button
                onClick={() => navigate('/')}
                className="flex-1 px-6 py-3 bg-[#333] hover:bg-[#444] text-white font-semibold rounded transition border border-white/10"
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
