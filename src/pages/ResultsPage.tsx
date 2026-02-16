/**
 * ResultsPage.tsx — Solo results screen shown after a game ends.
 *
 * Displays final stats (score, accuracy, roster coverage, time taken),
 * the full roster with guessed/missed highlights, and options to
 * rematch (same or random team) or exit back to home.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { teams } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import { fetchTeamRoster } from '../services/roster';
import { fetchNFLRosterFromApi, fetchNFLSeasonPlayers } from '../services/nfl-api';
import { fetchSeasonPlayers } from '../services/api';

export function ResultsPage() {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  const [isLoadingRandom, setIsLoadingRandom] = useState(false);

  const {
    selectedTeam,
    selectedSeason,
    currentRoster,
    guessedPlayers,
    incorrectGuesses,
    score,
    sport,
    timerDuration,
    timeRemaining,
    gameMode,
    resetGame,
    resetForRematch,
    setGameConfig,
  } = useGameStore();

  const { hideResultsDuringGame } = useSettingsStore();

  useEffect(() => {
    if (!selectedTeam || !selectedSeason) navigate('/');
  }, [selectedTeam, selectedSeason, navigate]);

  if (!selectedTeam || !selectedSeason) return null;

  // Accuracy = correct guesses / total guess attempts (correct + incorrect).
  // This measures naming precision, not roster coverage.
  const totalNamingAttempts = guessedPlayers.length + incorrectGuesses.length;
  const accuracy = totalNamingAttempts > 0
    ? Math.round((guessedPlayers.length / totalNamingAttempts) * 100)
    : 0;
  
  const timeTaken = timerDuration - timeRemaining;
  const guessedIds = new Set(guessedPlayers.map((p) => p.id));

  const handleExit = () => {
    setIsExiting(true);
    setTimeout(() => {
      resetGame();
      navigate('/');
    }, 900);
  };

  const handleRematch = async () => {
    if (gameMode === 'random') {
      // Start a new random game immediately
      setIsLoadingRandom(true);
      const currentTeams = sport === 'nba' ? teams : nflTeams;
      const minYear = sport === 'nfl' ? 2000 : 2015;
      const maxYear = 2024;

      for (let i = 0; i < 5; i++) {
        const team = currentTeams[Math.floor(Math.random() * currentTeams.length)];
        const year = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
        const season = sport === 'nba' ? `${year}-${String(year + 1).slice(-2)}` : `${year}`;

        try {
          const roster = sport === 'nba'
            ? await fetchTeamRoster(team.abbreviation, season)
            : await fetchNFLRosterFromApi(team.abbreviation, year);

          if (roster?.players?.length) {
            const league = sport === 'nba'
              ? await fetchSeasonPlayers(season)
              : await fetchNFLSeasonPlayers(year);

            setGameConfig(sport, team, season, 'random', timerDuration, roster.players, league?.players || [], hideResultsDuringGame);
            navigate('/game');
            return;
          }
        } catch {
          // Try next team
        }
      }

      // All attempts failed, fall back to home
      setIsLoadingRandom(false);
      resetGame();
      navigate('/');
    } else {
      // Manual mode - replay same team
      setIsExiting(true);
      setTimeout(() => {
        resetForRematch();
        navigate('/game');
      }, 900);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden font-sans p-4 md:p-6">
      
      {/* 1. DEALER SWEEP OVERLAY */}
      <AnimatePresence>
        {isExiting && (
          <div className="fixed inset-0 z-[100] pointer-events-none flex">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ x: '-110%', skewX: '-12deg' }}
                animate={{ x: '130%' }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.645, 0.045, 0.355, 1] }}
                className="absolute inset-y-0 w-full shadow-[20px_0_40px_rgba(0,0,0,0.6)] border-r border-white/10"
                style={{
                  background: i % 2 === 0 
                    ? `linear-gradient(90deg, ${selectedTeam.colors.primary}, ${selectedTeam.colors.secondary})`
                    : '#111',
                  left: `${i * 8}%`,
                  zIndex: 100 - i
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* 2. BACKGROUND FELT */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none" 
        style={{ 
          backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
          background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` 
        }} 
      />

      {/* 3. MAIN UI INTERFACE */}
      <motion.div 
        animate={isExiting ? { opacity: 0, scale: 0.95, filter: 'blur(10px)' } : { opacity: 1, scale: 1 }}
        className="relative z-10 flex flex-col h-full max-w-7xl mx-auto w-full"
      >
        {/* HEADER - Responsive sizing */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-2 border-white/10 pb-4 gap-4">
          <div>
            <div className="sports-font text-[8px] md:text-[10px] tracking-[0.4em] md:tracking-[0.6em] text-white/30 uppercase">Vault Record // Settlement</div>
            <h1 className="retro-title text-4xl md:text-6xl text-white uppercase leading-none">The Final Tab</h1>
          </div>
          <div className="flex flex-col items-start md:items-end w-full md:w-auto">
             <div className="bg-[#111] border border-white/20 px-4 py-1 mb-1 shadow-[4px_4px_0px_rgba(0,0,0,0.5)] w-full md:w-auto text-center">
               <span className="retro-title text-xs md:text-sm tracking-widest text-white/80">
                 {selectedTeam.abbreviation} • {selectedSeason}
               </span>
             </div>
          </div>
        </header>

        {/* MAIN PIT DASHBOARD - Grid to Flex-Col on Mobile */}
        <main className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0 overflow-visible lg:overflow-hidden">
          
          {/* LEFT COLUMN (3/12 Desktop, Full Mobile) */}
          <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">
            
            {/* STATS GRID - 2x2 */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              {[
                { label: 'BANKED', value: score },
                { label: 'ACCURACY', value: `${accuracy}%` },
                { label: 'COLLECTED', value: `${guessedPlayers.length}/${currentRoster.length}` },
                { label: 'CLOCK', value: `${Math.floor(timeTaken / 60)}:${String(timeTaken % 60).padStart(2, '0')}` }
              ].map((stat) => (
                <div key={stat.label} className="bg-[#111] border border-white/5 p-3 md:p-4 rounded-sm shadow-xl relative overflow-hidden">
                  <div className="sports-font text-[7px] md:text-[8px] text-white/30 tracking-widest uppercase mb-1">{stat.label}</div>
                  <div className="retro-title text-xl md:text-2xl text-white">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col gap-2">
              {/* Play Again */}
              <button
                onClick={handleRematch}
                disabled={isExiting || isLoadingRandom}
                className="group relative bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] py-4 md:py-6 rounded-sm shadow-[0_4px_0_#a89860] active:translate-y-1 active:shadow-none disabled:opacity-50"
              >
                <span className="relative z-10 retro-title text-xl md:text-2xl text-black uppercase tracking-widest">
                  {isLoadingRandom ? 'Shuffling...' : 'Play Again'}
                </span>
              </button>

              {/* Exit Game - Back to home */}
              <button
                onClick={handleExit}
                disabled={isExiting || isLoadingRandom}
                className="group relative bg-[#1a1a1a] border border-white/20 py-3 md:py-4 rounded-sm hover:border-white/40 transition-colors disabled:opacity-50"
              >
                <span className="relative z-10 retro-title text-lg md:text-xl text-white/70 uppercase tracking-widest">Exit Game</span>
              </button>
            </div>

            {/* DEAD BETS - Collapsible height on mobile */}
            <div className="h-32 md:h-48 lg:flex-1 bg-black/50 border border-white/5 rounded-sm p-4 flex flex-col overflow-hidden">
              <h2 className="retro-title text-[9px] text-white/40 mb-3 uppercase flex justify-between">Dead Bets <span>// {incorrectGuesses.length}</span></h2>
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-wrap content-start gap-2 pb-2">
                {incorrectGuesses.map((guess, index) => (
                  <span key={index} className="px-2 py-1 bg-[#f0f0f0] text-black sports-font text-[9px] font-bold uppercase border-b-2 border-gray-400">
                    {guess}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: PAYOUT TABLE (9/12 Desktop, Full Mobile) */}
          <div className="lg:col-span-9 bg-black/70 border border-white/10 rounded-sm flex flex-col shadow-2xl overflow-hidden mb-6 lg:mb-0">
            <div className="p-3 md:p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <span className="sports-font text-[9px] tracking-widest text-white/40 uppercase">Roster Ledger</span>
              <span className="retro-title text-[9px] text-white/20 uppercase">Odds: 1:1</span>
            </div>
            
            {/* GRID ADJUSTMENT: 1 col mobile, 2 col tablet, 3 col desktop */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar max-h-[50vh] lg:max-h-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {currentRoster.map((player) => {
                  const wasGuessed = guessedIds.has(player.id);
                  const teamGradient = wasGuessed 
                    ? { background: `linear-gradient(135deg, ${selectedTeam.colors.primary}33 0%, ${selectedTeam.colors.secondary}33 100%)` }
                    : { background: 'transparent' };

                  return (
                    <div
                      key={player.id}
                      className={`relative p-3 md:p-4 border transition-all ${wasGuessed ? 'border-white/20' : 'border-white/5 opacity-30 grayscale-[0.3]'}`}
                      style={teamGradient}
                    >
                      <div className="flex justify-between items-center relative z-10">
                        <div className="overflow-hidden">
                          <div className={`sports-font text-[7px] md:text-[8px] ${wasGuessed ? 'text-white/50' : 'text-white/20'}`}>
                            #{player.number || '??'} // {player.position}
                          </div>
                          <div className={`retro-title text-sm md:text-base truncate ${wasGuessed ? 'text-white' : 'text-white/40'}`}>
                            {player.name}
                          </div>
                        </div>
                        {wasGuessed && (
                          <div className="bg-white text-black text-[7px] px-1 py-0.5 sports-font font-bold shadow-sm">FOUND</div>
                        )}
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