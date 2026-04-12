/**
 * LobbyCreatePage.tsx — Multiplayer lobby creation page.
 *
 * Holds all state and the handleCreate async flow. UI panels live in
 * src/components/lobby/create/:
 *
 *   CreateGameTypeSelector    — mode buttons + popular legend
 *   CreateSportSelector       — NBA / NFL toggle
 *   CreateCareerSettings      — career win target
 *   CreateScrambleSettings    — scramble points target + era filter
 *   CreateStartingLineupSettings — starters win target
 *   CreateRosterSettings      — deck mode, scope, year range, team/year, timer
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getStoredPlayerName, updateCareerState } from '../services/lobby';
import { teams, getNBADivisions, getNBATeamsByDivision } from '../data/teams';
import { nflTeams, getNFLDivisions, getNFLTeamsByDivision } from '../data/nfl-teams';
import type { GameMode } from '../types';
import { CreateGameTypeSelector }        from '../components/lobby/create/CreateGameTypeSelector';
import { CreateSportSelector }           from '../components/lobby/create/CreateSportSelector';
import { CreateCareerSettings }          from '../components/lobby/create/CreateCareerSettings';
import { CreateScrambleSettings }        from '../components/lobby/create/CreateScrambleSettings';
import { CreateStartingLineupSettings }  from '../components/lobby/create/CreateStartingLineupSettings';
import { CreateRosterSettings }          from '../components/lobby/create/CreateRosterSettings';

type GenericTeam = {
  id: number;
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
};

const VALID_LOBBY_MODES = ['roster', 'career', 'scramble', 'lineup-is-right', 'box-score', 'starting-lineup'] as const;
type LobbyMode = typeof VALID_LOBBY_MODES[number];

export function LobbyCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { createLobby, isLoading, error } = useLobbyStore();
  const { sport, setSport } = useSettingsStore();

  const [lobbyMode, setLobbyMode] = useState<LobbyMode>(() => {
    const passed = (location.state as any)?.gameType;
    return VALID_LOBBY_MODES.includes(passed) ? passed : 'roster';
  });
  const [winTarget,           setWinTarget]           = useState<3 | 5 | 7 | 10 | 20 | 30>(10);
  const [scrambleWinTarget,   setScrambleWinTarget]   = useState<10 | 20 | 30 | 40 | 50>(20);
  const [scrambleCareerTo,    setScrambleCareerTo]    = useState(0);
  const [hostName,            setHostName]            = useState(getStoredPlayerName() || '');
  const [gameMode,            setGameMode]            = useState<GameMode>('random');
  const [selectionScope,      setSelectionScope]      = useState<'team' | 'division'>('team');
  const [selectedTeam,        setSelectedTeam]        = useState<GenericTeam | null>(null);
  const [selectedYear,        setSelectedYear]        = useState<number | null>(null);
  const [timerMinutes,        setTimerMinutes]        = useState(1);
  const [timerSeconds,        setTimerSeconds]        = useState(30);
  const [customTimerInput,    setCustomTimerInput]    = useState('');
  const [selectedPreset,      setSelectedPreset]      = useState<number | null>(90);
  const [randomMinYear,       setRandomMinYear]       = useState(2015);
  const [randomMaxYear,       setRandomMaxYear]       = useState(2025);

  // Box Score is NFL-only — auto-lock when this mode is selected
  useEffect(() => {
    if (lobbyMode === 'box-score') setSport('nfl');
  }, [lobbyMode]);

  const timerDuration = customTimerInput
    ? Math.max(10, Math.min(600, parseInt(customTimerInput) || 90))
    : timerMinutes * 60 + timerSeconds;

  const canCreate = hostName.trim() && (
    lobbyMode === 'career' ||
    lobbyMode === 'scramble' ||
    lobbyMode === 'lineup-is-right' ||
    lobbyMode === 'box-score' ||
    lobbyMode === 'starting-lineup' ||
    gameMode === 'random' ||
    (selectedTeam && selectedYear)
  );

  const handleCreate = async () => {
    if (!hostName.trim()) return;

    if (lobbyMode === 'career') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'NE';
      const dummySeason   = sport === 'nba' ? '2023-24' : '2023';
      const lobby = await createLobby(hostName.trim(), sport, dummyTeamAbbr, dummySeason, 90, 'random', 2000, 2025, 'career', 'team', null, null);
      if (lobby) {
        await updateCareerState(lobby.id, { win_target: winTarget, round: 0 });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    if (lobbyMode === 'scramble') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'NE';
      const dummySeason   = sport === 'nba' ? '2023-24' : '2023';
      const lobby = await createLobby(hostName.trim(), sport, dummyTeamAbbr, dummySeason, 90, 'random', 2000, 2025, 'scramble', 'team', null, null);
      if (lobby) {
        await updateCareerState(lobby.id, { win_target: scrambleWinTarget, round: 0, career_to: scrambleCareerTo });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    if (lobbyMode === 'box-score') {
      const lobby = await createLobby(hostName.trim(), 'nfl', 'KC', '2024', 120, 'random', 2015, 2024, 'box-score', 'team', null, null);
      if (lobby) {
        await updateCareerState(lobby.id, { type: 'box_score', min_year: 2015, max_year: 2024, team: null });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    if (lobbyMode === 'starting-lineup') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'KC';
      const dummySeason   = sport === 'nba' ? '2024-25' : '2024';
      const lobby = await createLobby(hostName.trim(), sport, dummyTeamAbbr, dummySeason, 90, 'random', 2000, 2025, 'starting-lineup', 'team', null, null);
      if (lobby) {
        await updateCareerState(lobby.id, { win_target: winTarget, round: 0 });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    if (lobbyMode === 'lineup-is-right') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'NE';
      const dummySeason   = sport === 'nba' ? '2023-24' : '2023';
      const lobby = await createLobby(hostName.trim(), sport, dummyTeamAbbr, dummySeason, 90, 'random', 2000, 2025, 'lineup-is-right', 'team', null, null);
      if (lobby) {
        await updateCareerState(lobby.id, { round: 0 });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    // Roster mode
    const minYear = Math.max(randomMinYear, 2000);
    const maxYear = Math.min(randomMaxYear, 2025);
    let teamAbbr: string;
    let season: string;
    let divisionConference: string | null = null;
    let divisionName: string | null = null;

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
        teamAbbr = teamList[Math.floor(Math.random() * teamList.length)].abbreviation;
      }
    } else {
      if (!selectedTeam || !selectedYear) return;
      teamAbbr = selectedTeam.abbreviation;
      season = sport === 'nba' ? `${selectedYear}-${String(selectedYear + 1).slice(-2)}` : `${selectedYear}`;
    }

    const lobby = await createLobby(hostName.trim(), sport, teamAbbr, season, timerDuration, gameMode, minYear, maxYear, 'roster', selectionScope, divisionConference, divisionName);
    if (lobby) navigate(`/lobby/${lobby.join_code}`);
  };

  const handlePresetSelect = (seconds: number) => {
    setSelectedPreset(seconds);
    setCustomTimerInput('');
    setTimerMinutes(Math.floor(seconds / 60));
    setTimerSeconds(seconds % 60);
  };

  const handleCustomTimerChange = (value: string) => {
    setCustomTimerInput(value);
    if (value) setSelectedPreset(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d2a0b] text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
      />

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

      <main className="relative z-10 flex-1 max-w-md mx-auto w-full p-6 space-y-5 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <CreateGameTypeSelector lobbyMode={lobbyMode} onModeChange={setLobbyMode} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <CreateSportSelector sport={sport} lobbyMode={lobbyMode} onSportChange={setSport} />
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

        {/* Mode-specific settings (animated in/out) */}
        <AnimatePresence>
          {lobbyMode === 'career' && (
            <CreateCareerSettings
              winTarget={winTarget}
              onWinTargetChange={(n) => setWinTarget(n as any)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {lobbyMode === 'scramble' && (
            <CreateScrambleSettings
              winTarget={scrambleWinTarget}
              onWinTargetChange={(n) => setScrambleWinTarget(n as any)}
              careerTo={scrambleCareerTo}
              onCareerToChange={setScrambleCareerTo}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {lobbyMode === 'starting-lineup' && (
            <CreateStartingLineupSettings
              winTarget={winTarget}
              onWinTargetChange={(n) => setWinTarget(n as any)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {lobbyMode === 'roster' && (
            <CreateRosterSettings
              sport={sport}
              gameMode={gameMode}
              onGameModeChange={setGameMode}
              selectionScope={selectionScope}
              onSelectionScopeChange={setSelectionScope}
              selectedTeam={selectedTeam}
              onTeamSelect={setSelectedTeam}
              selectedYear={selectedYear}
              onYearSelect={setSelectedYear}
              randomMinYear={randomMinYear}
              onRandomMinYearChange={setRandomMinYear}
              randomMaxYear={randomMaxYear}
              onRandomMaxYearChange={setRandomMaxYear}
              timerDuration={timerDuration}
              customTimerInput={customTimerInput}
              selectedPreset={selectedPreset}
              onPresetSelect={handlePresetSelect}
              onCustomTimerChange={handleCustomTimerChange}
            />
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-red-900/30 border border-red-700 rounded-sm text-red-400 text-sm text-center sports-font"
          >
            {error}
          </motion.div>
        )}

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
