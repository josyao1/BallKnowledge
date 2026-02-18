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
import { getStoredPlayerName, updateCareerState } from '../services/lobby';
import { teams, getNBADivisions, getNBATeamsByDivision } from '../data/teams';
import { nflTeams, getNFLDivisions, getNFLTeamsByDivision } from '../data/nfl-teams';
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

  const [lobbyMode, setLobbyMode] = useState<'roster' | 'career'>('roster');
  const [winTarget, setWinTarget] = useState<3 | 5 | 7>(3);
  const [hostName, setHostName] = useState(getStoredPlayerName() || '');
  const [gameMode, setGameMode] = useState<GameMode>('random');
  const [selectionScope, setSelectionScope] = useState<'team' | 'division'>('team');
  const [selectedTeam, setSelectedTeam] = useState<GenericTeam | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [customTimerInput, setCustomTimerInput] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(90);

  const [randomMinYear, setRandomMinYear] = useState(2015);
  const [randomMaxYear, setRandomMaxYear] = useState(2024);

  const timerDuration = customTimerInput
    ? Math.max(10, Math.min(600, parseInt(customTimerInput) || 90))
    : timerMinutes * 60 + timerSeconds;

  const canCreate = hostName.trim() && (
    lobbyMode === 'career' ||
    gameMode === 'random' ||
    (selectedTeam && selectedYear)
  );

  const handleCreate = async () => {
    if (!hostName.trim()) return;

    // Career mode: create a career lobby
    if (lobbyMode === 'career') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'NE';
      const dummySeason = sport === 'nba' ? '2023-24' : '2023';
      const lobby = await createLobby(
        hostName.trim(), sport, dummyTeamAbbr, dummySeason,
        90, 'random', 2000, 2024, 'career', 'team', null, null
      );
      if (lobby) {
        // Initialize career_state with win_target
        await updateCareerState(lobby.id, { win_target: winTarget, round: 0 });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    // Roster mode
    let teamAbbr: string;
    let season: string;
    let divisionConference: string | null = null;
    let divisionName: string | null = null;

    const minYear = sport === 'nfl' ? Math.max(randomMinYear, 2000) : randomMinYear;
    const maxYear = sport === 'nfl' ? Math.min(randomMaxYear, 2024) : randomMaxYear;

    if (gameMode === 'random') {
      const randomYear = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
      season = sport === 'nba' ? `${randomYear}-${String(randomYear + 1).slice(-2)}` : `${randomYear}`;

      if (selectionScope === 'division') {
        const allDivisions = sport === 'nba' ? getNBADivisions() : getNFLDivisions();
        const randomDiv = allDivisions[Math.floor(Math.random() * allDivisions.length)];
        divisionConference = randomDiv.conference;
        divisionName = randomDiv.division;

        const divTeams = sport === 'nba'
          ? getNBATeamsByDivision(randomDiv.conference, randomDiv.division)
          : getNFLTeamsByDivision(randomDiv.conference as 'AFC' | 'NFC', randomDiv.division);
        teamAbbr = divTeams[0]?.abbreviation || (sport === 'nba' ? teams : nflTeams)[0].abbreviation;
      } else {
        const teamList = sport === 'nba' ? teams : nflTeams;
        const randomTeam = teamList[Math.floor(Math.random() * teamList.length)];
        teamAbbr = randomTeam.abbreviation;
      }
    } else {
      if (!selectedTeam || !selectedYear) return;
      teamAbbr = selectedTeam.abbreviation;
      season = sport === 'nba' ? `${selectedYear}-${String(selectedYear + 1).slice(-2)}` : `${selectedYear}`;
    }

    const lobby = await createLobby(
      hostName.trim(), sport, teamAbbr, season, timerDuration, gameMode, minYear, maxYear,
      'roster', selectionScope, divisionConference, divisionName
    );

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
        {/* Game Type */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/50 border border-white/10 rounded-sm p-4"
        >
          <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
            Game Type
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setLobbyMode('roster')}
              className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                lobbyMode === 'roster'
                  ? 'bg-[#d4af37] text-black shadow-lg font-bold'
                  : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
              }`}
            >
              Roster
            </button>
            <button
              onClick={() => setLobbyMode('career')}
              className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                lobbyMode === 'career'
                  ? 'bg-[#22c55e] text-black shadow-lg font-bold'
                  : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
              }`}
            >
              Career
            </button>
          </div>
        </motion.div>

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

        {/* Career mode: win target */}
        <AnimatePresence>
          {lobbyMode === 'career' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-black/50 border border-[#22c55e]/30 rounded-sm p-4"
            >
              <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
                Win Target
              </div>
              <div className="flex gap-2 justify-center">
                {([3, 5, 7] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setWinTarget(n)}
                    className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                      winTarget === n
                        ? 'bg-[#22c55e] text-black shadow-lg font-bold'
                        : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
                    }`}
                  >
                    {n} Wins
                  </button>
                ))}
              </div>
              <div className="text-center text-white/30 text-[10px] sports-font tracking-wider mt-2">
                First player to {winTarget} wins takes the match
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Roster-only settings */}
        <AnimatePresence>
          {lobbyMode === 'roster' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              {/* Game mode selection */}
              <div className="bg-black/50 border border-white/10 rounded-sm p-4">
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
              </div>

              {/* Scope toggle */}
              {gameMode === 'random' && (
                <div className="bg-black/50 border border-white/10 rounded-sm p-4">
                  <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
                    Scope
                  </div>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setSelectionScope('team')}
                      className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                        selectionScope === 'team'
                          ? 'bg-[#d4af37] text-black shadow-lg font-bold'
                          : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
                      }`}
                    >
                      Team
                    </button>
                    <button
                      onClick={() => setSelectionScope('division')}
                      className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
                        selectionScope === 'division'
                          ? 'bg-[#d4af37] text-black shadow-lg font-bold'
                          : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
                      }`}
                    >
                      Division
                    </button>
                  </div>
                  {selectionScope === 'division' && (
                    <div className="text-center text-white/30 text-[10px] sports-font tracking-wider mt-2">
                      Random division — name players from all 4 teams
                    </div>
                  )}
                </div>
              )}

              {/* Random year range */}
              {gameMode === 'random' && (
                <div className="bg-black/50 border border-white/10 rounded-sm p-4">
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
                </div>
              )}

              {/* Manual team/year selection */}
              {gameMode === 'manual' && (
                <div className="space-y-4">
                  <TeamSelector selectedTeam={selectedTeam} onSelect={setSelectedTeam} sport={sport} />
                  <YearSelector selectedYear={selectedYear} onSelect={setSelectedYear} minYear={sport === 'nba' ? 1985 : 2000} maxYear={2024} sport={sport} />
                </div>
              )}

              {/* Timer duration */}
              <div
                className="bg-black/50 border border-white/10 rounded-sm p-4"
              >
          <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
            Round Timer
          </div>
          {/* Preset buttons */}
          <div className="flex flex-wrap justify-center gap-2 mb-3">
            {[60, 90, 120, 180, 300].map((seconds) => (
              <button
                key={seconds}
                onClick={() => {
                  setSelectedPreset(seconds);
                  setCustomTimerInput('');
                  setTimerMinutes(Math.floor(seconds / 60));
                  setTimerSeconds(seconds % 60);
                }}
                className={`px-3 py-1.5 rounded-sm sports-font text-sm transition-all ${
                  selectedPreset === seconds && !customTimerInput
                    ? 'bg-[#d4af37] text-black font-bold'
                    : 'bg-black/40 text-white/40 border border-white/10 hover:border-white/30'
                }`}
              >
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
              </button>
            ))}
          </div>
          {/* Custom input */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-white/40 text-[10px] sports-font tracking-wider">CUSTOM:</span>
            <input
              type="number"
              value={customTimerInput}
              onChange={(e) => {
                setCustomTimerInput(e.target.value);
                if (e.target.value) setSelectedPreset(null);
              }}
              placeholder="sec"
              min={10}
              max={600}
              className="w-20 px-2 py-1.5 bg-[#111] rounded-sm border border-white/20 text-white text-center sports-font focus:outline-none focus:border-[#d4af37]"
            />
            {customTimerInput && (
              <span className="text-white/50 sports-font text-sm">
                = {Math.floor(timerDuration / 60)}:{String(timerDuration % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          <div className="text-center mt-2 retro-title text-2xl text-white">
            {Math.floor(timerDuration / 60)}:{String(timerDuration % 60).padStart(2, '0')}
          </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
