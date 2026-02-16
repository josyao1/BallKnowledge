/**
 * LobbyCreatePage.tsx — Multiplayer lobby creation page.
 *
 * Allows the host to set their name, choose sport/game mode/team/timer,
 * and open a new lobby. On success, navigates to the waiting room.
 */

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

    // Pass year range for random mode replays
    const minYear = sport === 'nfl' ? Math.max(randomMinYear, 2000) : randomMinYear;
    const maxYear = sport === 'nfl' ? Math.min(randomMaxYear, 2024) : randomMaxYear;

    const lobby = await createLobby(hostName.trim(), sport, teamAbbr, season, timerDuration, gameMode, minYear, maxYear);

    if (lobby) {
      navigate(`/lobby/${lobby.join_code}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d2a0b] text-white relative overflow-hidden">
      {/* Green felt background */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
      />

      {/* Header */}
      <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="retro-title text-3xl text-[#d4af37]">Open Table</h1>
            <p className="sports-font text-[9px] text-white/30 tracking-[0.4em] uppercase">Host a Private Game</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 max-w-md mx-auto w-full p-6 space-y-5 overflow-y-auto">
        {/* Sport selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/50 border border-white/10 rounded-sm p-4"
        >
          <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
            Select League
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setSport('nba')}
              className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                sport === 'nba'
                  ? 'bg-[#d4af37] text-black shadow-lg font-bold'
                  : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
              }`}
            >
              NBA
            </button>
            <button
              onClick={() => setSport('nfl')}
              className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                sport === 'nfl'
                  ? 'bg-[#d4af37] text-black shadow-lg font-bold'
                  : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
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
          className="bg-black/50 border border-white/10 rounded-sm p-4"
        >
          <label className="block sports-font text-[10px] text-white/40 mb-2 tracking-[0.3em] uppercase">
            Dealer Name
          </label>
          <input
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full p-3 bg-[#111] rounded-sm border-2 border-white/20 text-white focus:outline-none focus:border-[#d4af37] transition-colors sports-font"
          />
        </motion.div>

        {/* Game mode selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-black/50 border border-white/10 rounded-sm p-4"
        >
          <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
            Deck Selection
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setGameMode('random')}
              className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                gameMode === 'random'
                  ? 'bg-[#d4af37] text-black shadow-lg font-bold'
                  : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
              }`}
            >
              Random
            </button>
            <button
              onClick={() => setGameMode('manual')}
              className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                gameMode === 'manual'
                  ? 'bg-[#d4af37] text-black shadow-lg font-bold'
                  : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
              }`}
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
              className="bg-black/50 border border-white/10 rounded-sm p-4"
            >
              <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
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
                  className="bg-[#111] text-white px-3 py-2 rounded-sm border border-white/20 sports-font focus:outline-none focus:border-[#d4af37]"
                >
                  {Array.from(
                    { length: 2024 - (sport === 'nfl' ? 2000 : 1985) + 1 },
                    (_, i) => (sport === 'nfl' ? 2000 : 1985) + i
                  ).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <span className="text-white/40 sports-font">to</span>
                <select
                  value={randomMaxYear}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value);
                    setRandomMaxYear(newMax);
                    if (newMax < randomMinYear) setRandomMinYear(newMax);
                  }}
                  className="bg-[#111] text-white px-3 py-2 rounded-sm border border-white/20 sports-font focus:outline-none focus:border-[#d4af37]"
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
              <TeamSelector selectedTeam={selectedTeam} onSelect={setSelectedTeam} sport={sport} />
              <YearSelector selectedYear={selectedYear} onSelect={setSelectedYear} minYear={sport === 'nba' ? 1985 : 2000} maxYear={2024} sport={sport} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timer duration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-black/50 border border-white/10 rounded-sm p-4"
        >
          <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
            Round Timer
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <select
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(parseInt(e.target.value))}
                className="bg-[#111] text-white px-3 py-2 rounded-sm border border-white/20 sports-font focus:outline-none focus:border-[#d4af37]"
              >
                {[0, 1, 2, 3, 4, 5].map((min) => (
                  <option key={min} value={min}>{min}</option>
                ))}
              </select>
              <span className="text-white/40 text-sm sports-font">min</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(parseInt(e.target.value))}
                className="bg-[#111] text-white px-3 py-2 rounded-sm border border-white/20 sports-font focus:outline-none focus:border-[#d4af37]"
              >
                {[0, 15, 30, 45].map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
              <span className="text-white/40 text-sm sports-font">sec</span>
            </div>
          </div>
          <div className="text-center mt-2 retro-title text-2xl text-white">
            {timerMinutes}:{String(timerSeconds).padStart(2, '0')}
          </div>
        </motion.div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-red-900/30 border border-red-700 rounded-sm text-red-400 text-sm text-center sports-font"
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
          className="w-full py-4 rounded-sm retro-title text-xl tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1"
        >
          {isLoading ? 'Opening Table...' : 'Open Table'}
        </motion.button>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-center text-white/30 text-[10px] pb-4 sports-font tracking-widest uppercase"
        >
          <p>You'll get a 6-character code to share</p>
        </motion.div>
      </main>
    </div>
  );
}
