/**
 * SoloLineupIsRightPage.tsx — Solo "Lineup Is Right" gameplay.
 *
 * Single-player mode where each turn:
 * 1. A random team is assigned
 * 2. Player searches for and selects a player
 * 3. Player selects a year they were on that team
 * 4. Player's stat value is awarded (0 if not on team that year)
 * 5. Goal: reach a target cap without exceeding it
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  selectRandomStatCategory,
  generateTargetCap,
  searchPlayersByNameOnly,
  getPlayerYearsOnTeam,
  getPlayerStatForYearAndTeam,
  addPlayerToLineup,
  calculateLineupStat,
  assignRandomTeam,
} from '../services/lineupIsRight';
import { getTeamByAbbreviation } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import type { Sport } from '../types';
import type { PlayerLineup, SelectedPlayer, StatCategory } from '../types/lineupIsRight';

type Phase = 'sport-select' | 'playing' | 'results';

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

function getTeamColor(sport: Sport, teamAbbr: string): string {
  if (sport === 'nba') {
    const team = getTeamByAbbreviation(teamAbbr);
    return team?.colors.primary || '#666666';
  } else {
    // NFL - return a default color for now (can be enhanced with NFL team colors)
    const nflTeam = nflTeams.find(t => t.abbreviation === teamAbbr);
    return nflTeam?.colors?.primary || '#003875';
  }
}

export function SoloLineupIsRightPage() {
  const navigate = useNavigate();

  // Setup
  const [phase, setPhase] = useState<Phase>('sport-select');
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);

  // Game state
  const [statCategory, setStatCategory] = useState<StatCategory | null>(null);
  const [targetCap, setTargetCap] = useState<number>(0);
  const [lineup, setLineup] = useState<PlayerLineup | null>(null);
  const [currentTeam, setCurrentTeam] = useState<string>('');

  // Playing phase state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ playerId: string | number; playerName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [loadingYears, setLoadingYears] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);

  // Initialize game
  const handleStartGame = async (sport: Sport) => {
    setSelectedSport(sport);
    const category = selectRandomStatCategory(sport);
    const cap = generateTargetCap(sport, category);
    const team = assignRandomTeam(sport);

    setStatCategory(category);
    setTargetCap(cap);
    setCurrentTeam(team);
    setLineup({
      playerId: 'solo',
      playerName: 'You',
      selectedPlayers: [],
      totalStat: 0,
      isBusted: false,
      isFinished: false,
    });
    setPhase('playing');
  };

  // Search for players
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

  // Select a player from search results
  const handleSelectPlayer = async (player: { playerId: string | number; playerName: string }) => {
    setSelectedPlayerName(player.playerName);
    setSelectedYear('');
    setAvailableYears([]);

    // Get years this player was on the current team
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

  // Confirm year selection and add player to lineup
  const handleConfirmYear = async () => {
    if (!selectedPlayerName || !selectedYear || !lineup || !selectedSport || !statCategory) {
      return;
    }

    setAddingPlayer(true);
    try {
      // Get the stat value for this player in this year on this team
      const statValue = await getPlayerStatForYearAndTeam(
        selectedSport,
        selectedPlayerName!,
        currentTeam,
        selectedYear,
        statCategory
      );

      // Create selected player object
      const newSelectedPlayer: SelectedPlayer = {
        playerName: selectedPlayerName!,
        team: currentTeam,
        selectedYear,
        playerSeason: null,
        statValue,
      };

      // Add to lineup
      const updated = addPlayerToLineup(lineup, newSelectedPlayer);
      const { total, isBusted } = calculateLineupStat(updated, statCategory, targetCap);
      updated.totalStat = total;
      updated.isBusted = isBusted;

      setLineup(updated);

      // Check if done (5 picks filled or busted)
      if (updated.selectedPlayers.length === 5 || isBusted) {
        updated.isFinished = true;
        setPhase('results');
      } else {
        // Switch team for next turn
        const nextTeam = assignRandomTeam(selectedSport);
        setCurrentTeam(nextTeam);

        // Clear search
        setSearchQuery('');
        setSearchResults([]);
        setSelectedPlayerName(null);
        setSelectedYear('');
        setAvailableYears([]);
      }
    } catch (error) {
      console.error('Error adding player:', error);
    } finally {
      setAddingPlayer(false);
    }
  };

  if (phase === 'sport-select') {
    return (
      <div className="min-h-screen bg-[#0d2a0b] text-white flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`, background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }} />
        
        <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="retro-title text-2xl text-[#d4af37]">Lineup Is Right</div>
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white/70 font-semibold rounded transition border border-white/20 hover:border-white/40">Back</button>
          </div>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h2 className="retro-title text-5xl md:text-6xl mb-12 text-white uppercase">Select Sport</h2>
            <div className="flex flex-col gap-4 w-96">
              <button
                onClick={() => handleStartGame('nba')}
                className="px-8 py-6 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] hover:from-[#fef3e0] hover:to-[#e5d4b0] text-black font-bold rounded-sm transition shadow-[0_4px_0_#a89860] active:translate-y-1 active:shadow-none text-2xl retro-title"
              >
                NBA
              </button>
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => handleStartGame('nfl')}
                  className="w-full px-8 py-6 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] hover:from-[#fef3e0] hover:to-[#e5d4b0] text-black font-bold rounded-sm transition shadow-[0_4px_0_#a89860] active:translate-y-1 active:shadow-none text-2xl retro-title"
                >
                  NFL
                </button>
                <p className="text-white/30 text-[10px] sports-font tracking-widest">DATA THROUGH 2024 SEASON · NO 2025</p>
              </div>
            </div>
          </motion.div>

          {/* Rules Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#111] border border-white/10 rounded-sm p-6 max-w-lg shadow-xl"
          >
            <h3 className="retro-title text-lg text-[#d4af37] mb-3">How to Play</h3>
            <ul className="text-sm text-white/80 space-y-2.5 text-left">
              <li><span className="text-[#d4af37] font-bold">Goal:</span> Build a lineup whose combined stat reaches — but doesn't exceed — the target cap</li>
              <li><span className="text-[#d4af37] font-bold">Each pick:</span> A random team is shown. Search <em>any</em> player by name and choose a year they were active</li>
              <li><span className="text-emerald-400 font-bold">Hit:</span> Player was on that team that year → their stat adds to your total</li>
              <li><span className="text-red-400 font-bold">Miss:</span> Player wasn't on that team that year → you get 0 for that pick</li>
              <li><span className="text-white font-bold">5 picks max.</span> Go over the cap at any point and you bust — game over!</li>
            </ul>
          </motion.div>
        </main>
      </div>
    );
  }

  if (phase === 'playing' && lineup && selectedSport && statCategory) {
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
              <div className="sports-font text-[7px] md:text-[8px] text-white/30 tracking-widest uppercase mb-2">Total</div>
              <p className={`retro-title text-3xl md:text-4xl ${lineup.isBusted ? 'text-red-500' : 'text-white'}`}>{lineup.totalStat}</p>
            </div>
          </div>

          {/* Middle Column - Player Selection */}
          <div className="flex-1 flex flex-col">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-black/60 border-2 border-white/10 rounded p-6 flex-1 flex flex-col"
              >
                {!selectedPlayerName ? (
                  <div>
                    <label className="block sports-font text-[10px] tracking-[0.4em] text-white/60 uppercase mb-4 font-semibold">
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
                      <div className="space-y-1 md:space-y-2 overflow-y-auto flex-1">
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
                  <div className="space-y-2 md:space-y-4 flex flex-col flex-1 overflow-hidden">
                    <div className="p-2 md:p-4 bg-[#1a1a1a] rounded border border-white/10">
                      <p className="font-semibold text-white text-sm md:text-lg truncate">{selectedPlayerName}</p>
                      <p className="text-[11px] md:text-sm text-white/60">Select any year this player played</p>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-baseline justify-between mb-2 md:mb-3">
                        <label className="block sports-font text-[8px] md:text-[10px] tracking-[0.4em] text-white/60 uppercase font-semibold">
                          Select a year
                        </label>
                        {selectedSport === 'nfl' && (
                          <span className="text-white/25 text-[8px] sports-font tracking-wide">through 2024</span>
                        )}
                      </div>
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

                    <div className="flex gap-1 md:gap-2 mt-2 md:mt-auto">
                      <button
                        onClick={() => {
                          setSelectedPlayerName(null);
                          setSelectedYear('');
                          setAvailableYears([]);
                        }}
                        className="flex-1 px-3 md:px-4 py-1 md:py-2 bg-[#333] hover:bg-[#444] text-white rounded transition border border-white/10 text-sm md:text-base"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleConfirmYear}
                        disabled={!selectedYear || addingPlayer}
                        className="flex-1 px-3 md:px-4 py-1 md:py-2 bg-[#d4af37] hover:bg-[#e5c158] disabled:opacity-50 text-black font-semibold rounded transition text-sm md:text-base"
                      >
                        {addingPlayer ? 'Adding...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
          </div>

          {/* Sidebar - Lineup Preview */}
          <div className="w-80 md:w-96 flex flex-col">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/60 border-2 border-white/10 rounded p-3 md:p-6 flex flex-col flex-1 overflow-hidden"
            >
                <h3 className="retro-title text-sm md:text-lg text-[#d4af37] mb-2 md:mb-4">Your Lineup</h3>
                <div className="space-y-1 md:space-y-2 flex-1 overflow-y-auto">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`px-2 md:px-3 py-1 md:py-2 rounded border text-[10px] md:text-xs leading-tight ${
                        idx < lineup.selectedPlayers.length
                          ? lineup.selectedPlayers[idx].statValue === 0
                            ? 'bg-red-900/40 border-red-500/60'
                            : 'bg-[#1a3a1a] border-[#4a7a4a]'
                          : 'bg-[#1a1a1a] border-dashed border-white/10'
                      }`}
                    >
                      {idx < lineup.selectedPlayers.length ? (
                        <div className={lineup.selectedPlayers[idx].statValue === 0 ? 'text-red-300' : 'text-white'}>
                          <p className="font-semibold truncate text-[10px] md:text-xs">{idx + 1}. {lineup.selectedPlayers[idx].playerName}</p>
                          <p className={lineup.selectedPlayers[idx].statValue === 0 ? 'text-red-400/70' : 'text-white/60'} style={{fontSize: '0.55rem'}}>{lineup.selectedPlayers[idx].team} • {lineup.selectedPlayers[idx].selectedYear}</p>
                          <p className={`font-semibold text-[10px] md:text-xs ${lineup.selectedPlayers[idx].statValue === 0 ? 'text-red-400' : 'text-[#d4af37]'}`}>{lineup.selectedPlayers[idx].statValue} {getCategoryAbbr(statCategory!)}</p>
                        </div>
                      ) : (
                        <span className="text-white/40 text-[10px] md:text-xs">Slot {idx + 1}</span>
                      )}
                    </div>
                  ))}
                </div>

                {lineup.isBusted && (
                  <div className="mt-4 p-3 bg-red-900/40 border border-red-500/60 rounded text-red-400 text-xs font-semibold text-center">
                    BUSTED! Exceeded {targetCap}
                  </div>
                )}
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'results' && lineup && statCategory) {
    return (
      <div className="min-h-screen bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden p-4 md:p-6">
        {/* BACKGROUND FELT */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
            background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)`
          }}
        />

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10 flex flex-col h-full max-w-7xl mx-auto w-full"
        >
          {/* HEADER */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-2 border-white/10 pb-4 gap-4">
            <div>
              <div className="sports-font text-[8px] md:text-[10px] tracking-[0.4em] md:tracking-[0.6em] text-white/30 uppercase">Game Result</div>
              <h1 className="retro-title text-4xl md:text-6xl text-white uppercase leading-none">Lineup Score</h1>
            </div>
            <div className="flex flex-col items-start md:items-end w-full md:w-auto">
              <div className="bg-[#111] border border-white/20 px-4 py-1 shadow-[4px_4px_0px_rgba(0,0,0,0.5)] w-full md:w-auto text-center">
                <span className="retro-title text-xs md:text-sm tracking-widest text-white/80">
                  {getCategoryAbbr(statCategory)}
                </span>
              </div>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
            {/* LEFT COLUMN - Stats */}
            <div className="lg:w-1/3 flex flex-col gap-4">
              {/* STATS GRID - 2x2 */}
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                {[
                  { label: 'YOUR SCORE', value: lineup.totalStat },
                  { label: 'TARGET CAP', value: targetCap },
                  { label: 'STATUS', value: lineup.isBusted ? 'BUSTED' : 'SUCCESS' },
                  { label: 'PLAYERS', value: `${lineup.selectedPlayers.length}/5` }
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#111] border border-white/5 p-3 md:p-4 rounded-sm shadow-xl relative overflow-hidden">
                    <div className="sports-font text-[7px] md:text-[8px] text-white/30 tracking-widest uppercase mb-1">{stat.label}</div>
                    <div className={`retro-title text-xl md:text-2xl ${
                      stat.label === 'STATUS' 
                        ? (lineup.isBusted ? 'text-red-500' : 'text-green-400')
                        : 'text-white'
                    }`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col gap-2 md:gap-3">
                <button
                  onClick={() => {
                    setPhase('sport-select');
                    setLineup(null);
                    setSelectedSport(null);
                    setSearchQuery('');
                    setSearchResults([]);
                    setSelectedPlayerName(null);
                    setSelectedYear('');
                    setAvailableYears([]);
                  }}
                  className="group relative bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] py-3 md:py-4 rounded-sm shadow-[0_4px_0_#a89860] active:translate-y-1 active:shadow-none"
                >
                  <span className="relative z-10 retro-title text-base md:text-lg text-black uppercase tracking-widest">
                    Play Again
                  </span>
                </button>

                <button
                  onClick={() => navigate('/')}
                  className="group relative bg-[#1a1a1a] border border-white/20 py-2 md:py-3 rounded-sm hover:border-white/40 transition-colors"
                >
                  <span className="relative z-10 retro-title text-base md:text-lg text-white/70 uppercase tracking-widest">Exit Game</span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN - Lineup Detail */}
            <div className="lg:w-2/3 bg-black/70 border border-white/10 rounded-sm flex flex-col shadow-2xl overflow-hidden">
              <div className="p-3 md:p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                <span className="sports-font text-[9px] tracking-widest text-white/40 uppercase">Your Lineup</span>
                <span className="retro-title text-[9px] text-white/20 uppercase">5 Slots</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 md:p-6 max-h-96 lg:max-h-none">
                <div className="space-y-2">
                {lineup.selectedPlayers.map((player, idx) => {
                  const isInvalid = player.statValue === 0;
                  return (
                    <div
                      key={idx}
                      className={`relative p-3 md:p-4 border transition-all ${
                        isInvalid ? 'border-red-500/30 opacity-60 grayscale-[0.3]' : 'border-white/20'
                      }`}
                      style={{
                        background: isInvalid 
                          ? 'transparent' 
                          : 'linear-gradient(135deg, #d4af3733 0%, #d4af3720 100%)'
                      }}
                    >
                      <div className="flex justify-between items-center relative z-10">
                        <div className="overflow-hidden">
                          <div className={`sports-font text-[7px] md:text-[8px] ${
                            isInvalid ? 'text-red-400/50' : 'text-white/50'
                          }`}>
                            {selectedSport?.toUpperCase()} • {statCategory}
                          </div>
                          <div className={`retro-title text-sm md:text-base truncate ${
                            isInvalid ? 'text-red-400' : 'text-white'
                          }`}>
                            {player.playerName}
                          </div>
                          <div className={`text-xs ${
                            isInvalid ? 'text-red-400/60' : 'text-white/60'
                          }`}>
                            {player.team} • {player.selectedYear}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`retro-title text-lg md:text-xl ${
                            isInvalid ? 'text-red-400' : 'text-[#d4af37]'
                          }`}>{player.statValue}</p>
                          {isInvalid && (
                            <div className="bg-red-600 text-white text-[7px] px-1.5 py-0.5 sports-font font-bold shadow-sm mt-1">INVALID</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          </main>
        </motion.div>
      </div>
    );
  }

  return null;
}
