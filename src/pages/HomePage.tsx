import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { TeamSelector } from '../components/home/TeamSelector';
import { YearSelector } from '../components/home/YearSelector';
import { SettingsModal } from '../components/home/SettingsModal';
import { ServerWarmup } from '../components/home/ServerWarmup';
import { teams } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import { rosters } from '../data/rosters';
import { fetchTeamRoster } from '../services/roster';
import { isApiAvailable, resetApiAvailability, fetchSeasonPlayers } from '../services/api';
import { isNFLApiAvailable, resetNFLApiAvailability, fetchNFLRosterFromApi, fetchNFLSeasonPlayers } from '../services/nfl-api';
import type { GameMode } from '../types';

type LoadingStatus = 'idle' | 'checking' | 'fetching' | 'success' | 'error';

// Generic team type that works with both NBA and NFL
type GenericTeam = {
  id: number;
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
};

export function HomePage() {
  const navigate = useNavigate();
  const setGameConfig = useGameStore((state) => state.setGameConfig);
  const { sport, timerDuration, yearRange, hideResultsDuringGame, setSport } = useSettingsStore();

  const [gameMode, setGameMode] = useState<GameMode>('random');
  const [selectedTeam, setSelectedTeam] = useState<GenericTeam | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Random mode year range
  const [randomMinYear, setRandomMinYear] = useState(2015);
  const [randomMaxYear, setRandomMaxYear] = useState(2024);

  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [showWarmup, setShowWarmup] = useState(true);
  const [warmupComplete, setWarmupComplete] = useState(false);

  // Show warmup screen on initial load
  const handleWarmupReady = () => {
    setApiOnline(true);
    setWarmupComplete(true);
    setShowWarmup(false);
  };

  const handleWarmupSkip = () => {
    setApiOnline(false);
    setWarmupComplete(true);
    setShowWarmup(false);
  };

  // Re-check API when sport changes (after initial warmup)
  useEffect(() => {
    if (!warmupComplete) return;

    const checkApi = async () => {
      if (sport === 'nba') {
        const available = await isApiAvailable();
        setApiOnline(available);
      } else {
        const available = await isNFLApiAvailable();
        setApiOnline(available);
      }
    };
    checkApi();
  }, [sport, warmupComplete]);

  // Reset selection when sport changes
  useEffect(() => {
    setSelectedTeam(null);
    setSelectedYear(null);
    // Reset year range to appropriate defaults for the sport
    if (sport === 'nfl') {
      setRandomMinYear(Math.max(randomMinYear, 2000));
      setRandomMaxYear(Math.min(randomMaxYear, 2024));
    }
  }, [sport]);

  const MAX_RETRIES = 5;

  const handleStartGame = async () => {
    setLoadingStatus('checking');
    setStatusMessage('Selecting team...');

    const apiAvailable = sport === 'nba' ? await isApiAvailable() : await isNFLApiAvailable();
    let retryCount = 0;

    // Get the appropriate team list and year range based on sport
    const currentTeams = sport === 'nba' ? teams : nflTeams;
    const currentMinYear = sport === 'nba' ? randomMinYear : Math.max(randomMinYear, 2000);
    const currentMaxYear = sport === 'nba' ? randomMaxYear : Math.min(randomMaxYear, 2024);

    // Helper to pick a random team/season
    const pickRandomTeamSeason = (): { team: GenericTeam; year: number } | null => {
      if (apiAvailable) {
        const randomTeamIndex = Math.floor(Math.random() * currentTeams.length);
        const team = currentTeams[randomTeamIndex];
        const year = Math.floor(Math.random() * (currentMaxYear - currentMinYear + 1)) + currentMinYear;
        return { team, year };
      } else {
        // API offline: pick only from available static data (NBA only for now)
        if (sport === 'nfl') {
          // NFL requires API
          return null;
        }

        const availableTeamSeasons: { team: GenericTeam; season: string }[] = [];

        for (const [abbr, seasons] of Object.entries(rosters)) {
          const teamData = teams.find(t => t.abbreviation === abbr);
          if (teamData) {
            for (const season of Object.keys(seasons)) {
              const seasonYear = parseInt(season.split('-')[0]);
              if (seasonYear >= currentMinYear && seasonYear <= currentMaxYear) {
                availableTeamSeasons.push({ team: teamData, season });
              }
            }
          }
        }

        if (availableTeamSeasons.length === 0) {
          return null;
        }

        const randomChoice = availableTeamSeasons[Math.floor(Math.random() * availableTeamSeasons.length)];
        return { team: randomChoice.team, year: parseInt(randomChoice.season.split('-')[0]) };
      }
    };

    // Try to load a roster (with retries for random mode)
    const attemptLoadRoster = async (team: GenericTeam, year: number): Promise<boolean> => {
      const season = sport === 'nba' ? `${year}-${String(year + 1).slice(-2)}` : `${year}`;

      setStatusMessage(`Loading ${team.abbreviation} ${season} roster...`);
      setLoadingStatus('fetching');

      try {
        let players: { id: number | string; name: string; position?: string; number?: string; ppg?: number; isLowScorer?: boolean; unit?: string }[] = [];
        let fromApi = false;
        let cached = false;

        if (sport === 'nba') {
          const result = await fetchTeamRoster(team.abbreviation, season);
          if (result.players.length === 0) {
            return false;
          }
          players = result.players;
          fromApi = result.fromApi;
          cached = result.cached;
        } else {
          // NFL
          const result = await fetchNFLRosterFromApi(team.abbreviation, year);
          if (!result || result.players.length === 0) {
            return false;
          }
          players = result.players;
          fromApi = true;
          cached = result.cached;
        }

        // Fetch league-wide players for autocomplete
        setStatusMessage('Loading player database...');
        let leaguePlayers: { id: number | string; name: string }[] = [];

        if (sport === 'nba') {
          const leagueResult = await fetchSeasonPlayers(season);
          if (leagueResult && leagueResult.players.length > 0) {
            leaguePlayers = leagueResult.players;
          }
        } else {
          const leagueResult = await fetchNFLSeasonPlayers(year);
          if (leagueResult && leagueResult.players.length > 0) {
            leaguePlayers = leagueResult.players;
          }
        }

        setLoadingStatus('success');
        setStatusMessage(
          fromApi
            ? cached
              ? 'Loaded from cache!'
              : `Fetched from ${sport.toUpperCase()} API!`
            : 'Using local data'
        );

        // Brief delay to show success message
        await new Promise((resolve) => setTimeout(resolve, 500));

        setGameConfig(sport, team, season, gameMode, timerDuration, players, leaguePlayers, hideResultsDuringGame);
        navigate('/game');
        return true;
      } catch (error) {
        console.error('Error fetching roster:', error);
        return false;
      }
    };

    // Manual mode - no retries, just try once
    if (gameMode === 'manual') {
      if (!selectedTeam || !selectedYear) {
        setLoadingStatus('idle');
        return;
      }

      const success = await attemptLoadRoster(selectedTeam, selectedYear);
      if (!success) {
        setLoadingStatus('error');
        setStatusMessage(`No roster data found for ${selectedTeam.name} ${selectedYear}-${String(selectedYear + 1).slice(-2)}`);
      }
      return;
    }

    // Random mode - retry with different teams if needed
    while (retryCount < MAX_RETRIES) {
      const pick = pickRandomTeamSeason();

      if (!pick) {
        setLoadingStatus('error');
        setStatusMessage(`No offline data available for ${randomMinYear}-${randomMaxYear}.`);
        return;
      }

      const success = await attemptLoadRoster(pick.team, pick.year);

      if (success) {
        return; // Successfully loaded, game started
      }

      // Failed - retry with a new random pick
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        setStatusMessage(`Roster unavailable, trying another (${retryCount}/${MAX_RETRIES})...`);
        setLoadingStatus('checking');
        await new Promise((resolve) => setTimeout(resolve, 800)); // Brief pause before retry
      }
    }

    // Exhausted all retries
    setLoadingStatus('error');
    setStatusMessage(`Couldn't find available roster after ${MAX_RETRIES} attempts. Try a different year range.`);
  };

  const handleRetry = () => {
    if (sport === 'nba') {
      resetApiAvailability();
    } else {
      resetNFLApiAvailability();
    }
    setLoadingStatus('idle');
    setStatusMessage('');
  };

  const isLoading = loadingStatus === 'checking' || loadingStatus === 'fetching';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b-4 border-[#333]">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`retro-title text-4xl ${sport === 'nba' ? 'text-[var(--nba-orange)]' : 'text-[#013369]'}`}
        >
          {sport === 'nba' ? 'Ball' : 'Pigskin'} Knowledge
        </motion.h1>
        <div className="flex items-center gap-3">
          {/* API Status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                apiOnline === null
                  ? 'bg-[#666]'
                  : apiOnline
                  ? 'bg-[#22c55e]'
                  : 'bg-[#888]'
              }`}
            />
            <span className="text-xs text-[#666] sports-font">
              {apiOnline === null ? 'Checking...' : apiOnline ? 'Live API' : 'Offline Mode'}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 hover:bg-[#2a2a2a] rounded-lg transition-colors border-2 border-[#3d3d3d]"
          >
            <svg className="w-6 h-6 text-[var(--vintage-cream)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {/* Title section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-4"
        >
          <h2 className="retro-title text-6xl md:text-7xl mb-4 text-[var(--vintage-cream)]">
            {sport === 'nba' ? 'NBA' : 'NFL'} Roster
            <span className="block text-[var(--nba-gold)]">Trivia</span>
          </h2>
          <p className="sports-font text-lg text-[#888] tracking-wider">
            How well do you know {sport === 'nba' ? 'NBA' : 'NFL'} rosters?
          </p>
        </motion.div>

        {/* Sport selection */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex gap-2"
        >
          <button
            onClick={() => setSport('nba')}
            className={`px-6 py-2 rounded-lg sports-font tracking-wider transition-all ${
              sport === 'nba'
                ? 'bg-[var(--nba-orange)] text-white shadow-lg'
                : 'bg-[#1a1a1a] text-[#888] border-2 border-[#3d3d3d] hover:border-[#555]'
            }`}
          >
            NBA
          </button>
          <button
            onClick={() => setSport('nfl')}
            className={`px-6 py-2 rounded-lg sports-font tracking-wider transition-all ${
              sport === 'nfl'
                ? 'bg-[#013369] text-white shadow-lg'
                : 'bg-[#1a1a1a] text-[#888] border-2 border-[#3d3d3d] hover:border-[#555]'
            }`}
          >
            NFL
          </button>
        </motion.div>

        {/* Decorative ball - basketball for NBA, football for NFL */}
        {sport === 'nba' ? (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: isLoading ? 360 : 0 }}
            transition={{
              type: isLoading ? 'tween' : 'spring',
              delay: isLoading ? 0 : 0.2,
              duration: isLoading ? 1 : undefined,
              repeat: isLoading ? Infinity : 0,
              ease: isLoading ? 'linear' : undefined,
            }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--nba-orange)] to-[#c44a1f] flex items-center justify-center shadow-lg relative"
          >
            <div className="absolute w-full h-[3px] bg-[#1a1a1a] rounded-full"></div>
            <div className="absolute w-[3px] h-full bg-[#1a1a1a] rounded-full"></div>
            <div className="absolute w-16 h-16 border-[3px] border-[#1a1a1a] rounded-full"></div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: isLoading ? 360 : 0 }}
            transition={{
              type: isLoading ? 'tween' : 'spring',
              delay: isLoading ? 0 : 0.2,
              duration: isLoading ? 1 : undefined,
              repeat: isLoading ? Infinity : 0,
              ease: isLoading ? 'linear' : undefined,
            }}
            className="w-24 h-14 rounded-[50%] bg-gradient-to-br from-[#8B4513] to-[#5D3A1A] flex items-center justify-center shadow-lg relative overflow-hidden"
          >
            {/* Football laces */}
            <div className="absolute w-[3px] h-8 bg-white rounded-full"></div>
            <div className="absolute w-3 h-[2px] bg-white rounded-full -translate-y-2"></div>
            <div className="absolute w-3 h-[2px] bg-white rounded-full -translate-y-0.5"></div>
            <div className="absolute w-3 h-[2px] bg-white rounded-full translate-y-1"></div>
            <div className="absolute w-3 h-[2px] bg-white rounded-full translate-y-2.5"></div>
          </motion.div>
        )}

        {/* Loading Status */}
        <AnimatePresence mode="wait">
          {loadingStatus !== 'idle' && (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="scoreboard-panel p-4 min-w-[300px]"
            >
              <div className="flex items-center justify-center gap-3">
                {isLoading && (
                  <div className={`w-4 h-4 border-2 ${sport === 'nba' ? 'border-[var(--nba-orange)]' : 'border-[#013369]'} border-t-transparent rounded-full animate-spin`} />
                )}
                {loadingStatus === 'success' && (
                  <div className="text-[#22c55e]">✓</div>
                )}
                {loadingStatus === 'error' && (
                  <div className="text-[var(--nba-red)]">✗</div>
                )}
                <span
                  className={`sports-font text-sm ${
                    loadingStatus === 'error' ? 'text-[var(--nba-red)]' : 'text-[var(--vintage-cream)]'
                  }`}
                >
                  {statusMessage}
                </span>
              </div>
              {loadingStatus === 'error' && (
                <button
                  onClick={handleRetry}
                  className={`mt-3 w-full text-center text-sm ${sport === 'nba' ? 'text-[var(--nba-orange)]' : 'text-[#013369]'} hover:underline`}
                >
                  Try Again
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game mode selection */}
        {loadingStatus === 'idle' && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="scoreboard-panel p-6"
            >
              <div className="sports-font text-sm text-[#888] text-center mb-4 tracking-widest">
                Select Game Mode
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setGameMode('random')}
                  className={`px-8 py-3 rounded-lg sports-font tracking-wider transition-all ${
                    gameMode === 'random'
                      ? `${sport === 'nba' ? 'bg-[var(--nba-orange)]' : 'bg-[#013369]'} text-white shadow-lg`
                      : 'bg-[#1a1a1a] text-[#888] border-2 border-[#3d3d3d] hover:border-[#555]'
                  }`}
                >
                  Random
                </button>
                <button
                  onClick={() => setGameMode('manual')}
                  className={`px-8 py-3 rounded-lg sports-font tracking-wider transition-all ${
                    gameMode === 'manual'
                      ? `${sport === 'nba' ? 'bg-[var(--nba-orange)]' : 'bg-[#013369]'} text-white shadow-lg`
                      : 'bg-[#1a1a1a] text-[#888] border-2 border-[#3d3d3d] hover:border-[#555]'
                  }`}
                >
                  Choose Team
                </button>
              </div>
            </motion.div>

            {/* Random year range selection */}
            <AnimatePresence>
              {gameMode === 'random' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full max-w-md"
                >
                  <div className="scoreboard-panel p-4">
                    <div className="sports-font text-sm text-[#888] text-center mb-3 tracking-widest">
                      Year Range {sport === 'nfl' && '(2000-2024)'}
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <select
                        value={randomMinYear}
                        onChange={(e) => {
                          const newMin = parseInt(e.target.value);
                          setRandomMinYear(newMin);
                          if (newMin > randomMaxYear) {
                            setRandomMaxYear(newMin);
                          }
                        }}
                        className={`retro-select bg-[#1a1a1a] text-[var(--vintage-cream)] px-4 py-2 rounded-lg border-2 border-[#3d3d3d] sports-font focus:outline-none ${sport === 'nba' ? 'focus:border-[var(--nba-orange)]' : 'focus:border-[#013369]'}`}
                      >
                        {Array.from(
                          { length: 2024 - (sport === 'nfl' ? 2000 : 1985) + 1 },
                          (_, i) => (sport === 'nfl' ? 2000 : 1985) + i
                        ).map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                      <span className="text-[#888] sports-font">to</span>
                      <select
                        value={randomMaxYear}
                        onChange={(e) => {
                          const newMax = parseInt(e.target.value);
                          setRandomMaxYear(newMax);
                          if (newMax < randomMinYear) {
                            setRandomMinYear(newMax);
                          }
                        }}
                        className={`retro-select bg-[#1a1a1a] text-[var(--vintage-cream)] px-4 py-2 rounded-lg border-2 border-[#3d3d3d] sports-font focus:outline-none ${sport === 'nba' ? 'focus:border-[var(--nba-orange)]' : 'focus:border-[#013369]'}`}
                      >
                        {Array.from(
                          { length: 2024 - (sport === 'nfl' ? 2000 : 1985) + 1 },
                          (_, i) => (sport === 'nfl' ? 2000 : 1985) + i
                        ).map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Manual selection */}
            <AnimatePresence>
              {gameMode === 'manual' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full max-w-md space-y-4"
                >
                  <TeamSelector
                    selectedTeam={selectedTeam}
                    onSelect={setSelectedTeam}
                    sport={sport}
                  />
                  <YearSelector
                    selectedYear={selectedYear}
                    onSelect={setSelectedYear}
                    minYear={sport === 'nba' ? yearRange.min : 2000}
                    maxYear={sport === 'nba' ? yearRange.max : 2024}
                    sport={sport}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Start button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStartGame}
              disabled={isLoading || (gameMode === 'manual' && (!selectedTeam || !selectedYear))}
              className="retro-btn retro-btn-gold px-16 py-4 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Solo Game
            </motion.button>

            {/* Multiplayer buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="flex gap-3"
            >
              <button
                onClick={() => navigate('/lobby/create')}
                className={`px-6 py-3 rounded-lg sports-font tracking-wider transition-all border-2 ${
                  sport === 'nba'
                    ? 'border-[var(--nba-orange)] text-[var(--nba-orange)] hover:bg-[var(--nba-orange)] hover:text-white'
                    : 'border-[#013369] text-[#013369] hover:bg-[#013369] hover:text-white'
                }`}
              >
                Create Lobby
              </button>
              <button
                onClick={() => navigate('/lobby/join')}
                className="px-6 py-3 rounded-lg sports-font tracking-wider transition-all border-2 border-[#3d3d3d] text-[#888] hover:border-[#555] hover:text-[var(--vintage-cream)]"
              >
                Join Lobby
              </button>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="vintage-card p-4 max-w-md text-center"
            >
              <p className="text-[#aaa] text-sm">
                {apiOnline
                  ? `Any ${sport.toUpperCase()} team available (${gameMode === 'random' ? `${randomMinYear}-${randomMaxYear}` : sport === 'nba' ? '1985-2024' : '2000-2024'})`
                  : sport === 'nba' ? 'Limited rosters available in offline mode' : 'NFL requires Live API connection'}
              </p>
              <div className="mt-3 flex justify-center items-center gap-2">
                <span className="sports-font text-xs text-[#666]">Timer:</span>
                <span className="scoreboard-number text-lg">
                  {Math.floor(timerDuration / 60)}:{String(timerDuration % 60).padStart(2, '0')}
                </span>
              </div>
            </motion.div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 text-center border-t-4 border-[#333]">
        <p className="sports-font text-xs text-[#555] tracking-widest">
          Test your {sport === 'nba' ? 'NBA' : 'NFL'} knowledge
        </p>
      </footer>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Server Warmup */}
      {showWarmup && (
        <ServerWarmup
          sport={sport}
          onReady={handleWarmupReady}
          onSkip={handleWarmupSkip}
        />
      )}
    </div>
  );
}
