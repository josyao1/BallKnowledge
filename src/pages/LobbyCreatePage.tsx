import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { TeamSelector } from '../components/home/TeamSelector';
import { YearSelector } from '../components/home/YearSelector';
import { getStoredPlayerName } from '../services/lobby';
import { teams } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import type { GameMode } from '../types';

type GenericTeam = {
  id: number;
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
};

export function LobbyCreatePage() {
  const navigate = useNavigate();
  const { createLobby, isLoading, error } = useLobbyStore();
  const { sport, setSport } = useSettingsStore();

  const [hostName, setHostName] = useState(getStoredPlayerName() || '');
  const [gameMode, setGameMode] = useState<GameMode>('random');
  const [selectedTeam, setSelectedTeam] = useState<GenericTeam | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [timerSeconds, setTimerSeconds] = useState(30);

  // Random mode year range
  const [randomMinYear, setRandomMinYear] = useState(2015);
  const [randomMaxYear, setRandomMaxYear] = useState(2024);

  const timerDuration = timerMinutes * 60 + timerSeconds;

  const canCreate = hostName.trim() && (
    gameMode === 'random' || (selectedTeam && selectedYear)
  );

  const handleCreate = async () => {
    if (!hostName.trim()) return;

    let teamAbbr: string;
    let season: string;

    if (gameMode === 'random') {
      // Pick random team and year
      const teamList = sport === 'nba' ? teams : nflTeams;
      const minYear = sport === 'nfl' ? Math.max(randomMinYear, 2000) : randomMinYear;
      const maxYear = sport === 'nfl' ? Math.min(randomMaxYear, 2024) : randomMaxYear;

      const randomTeam = teamList[Math.floor(Math.random() * teamList.length)];
      const randomYear = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;

      teamAbbr = randomTeam.abbreviation;
      season = sport === 'nba' ? `${randomYear}-${String(randomYear + 1).slice(-2)}` : `${randomYear}`;
    } else {
      if (!selectedTeam || !selectedYear) return;
      teamAbbr = selectedTeam.abbreviation;
      season = sport === 'nba' ? `${selectedYear}-${String(selectedYear + 1).slice(-2)}` : `${selectedYear}`;
    }

    const lobby = await createLobby(hostName.trim(), sport, teamAbbr, season, timerDuration, gameMode);

    if (lobby) {
      navigate(`/lobby/${lobby.join_code}`);
    }
  };

  const accentColor = sport === 'nba' ? 'var(--nba-orange)' : '#013369';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-6 border-b-4 border-[#333]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="retro-title text-3xl" style={{ color: accentColor }}>
            Create Lobby
          </h1>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-md mx-auto w-full p-6 space-y-5 overflow-y-auto">
        {/* Sport selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="scoreboard-panel p-4"
        >
          <div className="sports-font text-sm text-[#888] text-center mb-3 tracking-widest">
            Select Sport
          </div>
          <div className="flex gap-2 justify-center">
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
          </div>
        </motion.div>

        {/* Host name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="scoreboard-panel p-4"
        >
          <label className="block sports-font text-sm text-[#888] mb-2 tracking-widest">
            Your Name
          </label>
          <input
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full p-3 bg-[#1a1a1a] rounded-lg border-2 border-[#3d3d3d] text-[var(--vintage-cream)] focus:outline-none"
            style={{ borderColor: hostName ? accentColor : undefined }}
          />
        </motion.div>

        {/* Game mode selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="scoreboard-panel p-4"
        >
          <div className="sports-font text-sm text-[#888] text-center mb-3 tracking-widest">
            Roster Selection
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setGameMode('random')}
              className={`px-6 py-2 rounded-lg sports-font tracking-wider transition-all ${
                gameMode === 'random'
                  ? `text-white shadow-lg`
                  : 'bg-[#1a1a1a] text-[#888] border-2 border-[#3d3d3d] hover:border-[#555]'
              }`}
              style={{ backgroundColor: gameMode === 'random' ? accentColor : undefined }}
            >
              Random
            </button>
            <button
              onClick={() => setGameMode('manual')}
              className={`px-6 py-2 rounded-lg sports-font tracking-wider transition-all ${
                gameMode === 'manual'
                  ? `text-white shadow-lg`
                  : 'bg-[#1a1a1a] text-[#888] border-2 border-[#3d3d3d] hover:border-[#555]'
              }`}
              style={{ backgroundColor: gameMode === 'manual' ? accentColor : undefined }}
            >
              Choose Team
            </button>
          </div>
        </motion.div>

        {/* Random year range */}
        <AnimatePresence>
          {gameMode === 'random' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="scoreboard-panel p-4"
            >
              <div className="sports-font text-sm text-[#888] text-center mb-3 tracking-widest">
                Year Range {sport === 'nfl' && '(2000-2024)'}
              </div>
              <div className="flex items-center justify-center gap-3">
                <select
                  value={randomMinYear}
                  onChange={(e) => {
                    const newMin = parseInt(e.target.value);
                    setRandomMinYear(newMin);
                    if (newMin > randomMaxYear) setRandomMaxYear(newMin);
                  }}
                  className="bg-[#1a1a1a] text-[var(--vintage-cream)] px-3 py-2 rounded-lg border-2 border-[#3d3d3d] sports-font focus:outline-none"
                >
                  {Array.from(
                    { length: 2024 - (sport === 'nfl' ? 2000 : 1985) + 1 },
                    (_, i) => (sport === 'nfl' ? 2000 : 1985) + i
                  ).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <span className="text-[#888]">to</span>
                <select
                  value={randomMaxYear}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value);
                    setRandomMaxYear(newMax);
                    if (newMax < randomMinYear) setRandomMinYear(newMax);
                  }}
                  className="bg-[#1a1a1a] text-[var(--vintage-cream)] px-3 py-2 rounded-lg border-2 border-[#3d3d3d] sports-font focus:outline-none"
                >
                  {Array.from(
                    { length: 2024 - (sport === 'nfl' ? 2000 : 1985) + 1 },
                    (_, i) => (sport === 'nfl' ? 2000 : 1985) + i
                  ).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual team/year selection */}
        <AnimatePresence>
          {gameMode === 'manual' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <TeamSelector
                selectedTeam={selectedTeam}
                onSelect={setSelectedTeam}
                sport={sport}
              />
              <YearSelector
                selectedYear={selectedYear}
                onSelect={setSelectedYear}
                minYear={sport === 'nba' ? 1985 : 2000}
                maxYear={2024}
                sport={sport}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timer duration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="scoreboard-panel p-4"
        >
          <div className="sports-font text-sm text-[#888] text-center mb-3 tracking-widest">
            Timer Duration
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <select
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(parseInt(e.target.value))}
                className="bg-[#1a1a1a] text-[var(--vintage-cream)] px-3 py-2 rounded-lg border-2 border-[#3d3d3d] sports-font focus:outline-none"
              >
                {[0, 1, 2, 3, 4, 5].map((min) => (
                  <option key={min} value={min}>{min}</option>
                ))}
              </select>
              <span className="text-[#888] text-sm">min</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(parseInt(e.target.value))}
                className="bg-[#1a1a1a] text-[var(--vintage-cream)] px-3 py-2 rounded-lg border-2 border-[#3d3d3d] sports-font focus:outline-none"
              >
                {[0, 15, 30, 45].map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
              <span className="text-[#888] text-sm">sec</span>
            </div>
          </div>
          <div className="text-center mt-2 scoreboard-number text-xl">
            {timerMinutes}:{String(timerSeconds).padStart(2, '0')}
          </div>
        </motion.div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Create button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={handleCreate}
          disabled={!canCreate || isLoading}
          className="w-full py-4 rounded-lg sports-font text-lg tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: canCreate ? accentColor : '#333',
            color: canCreate ? '#fff' : '#666',
          }}
        >
          {isLoading ? 'Creating...' : 'Create Lobby'}
        </motion.button>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-center text-[#666] text-sm pb-4"
        >
          <p>You'll get a 6-character code to share with friends</p>
        </motion.div>
      </main>
    </div>
  );
}
