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
import { useLobbyStore } from '../../stores/lobbyStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getStoredPlayerName, updateCareerState } from '../../services/lobby';
import { teams } from '../../data/teams';
import { nflTeams } from '../../data/nfl-teams';
import { CreateGameTypeSelector } from '../../components/lobby/create/CreateGameTypeSelector';
import { CreateSportSelector } from '../../components/lobby/create/CreateSportSelector';
import { CreateCareerSettings } from '../../components/lobby/create/CreateCareerSettings';
import { CreateScrambleSettings } from '../../components/lobby/create/CreateScrambleSettings';
import { CreateStartingLineupSettings } from '../../components/lobby/create/CreateStartingLineupSettings';

const VALID_LOBBY_MODES = [
  'roster',
  'career',
  'scramble',
  'lineup-is-right',
  'box-score',
  'starting-lineup',
  'face-reveal',
  'top-ten',
] as const;
type LobbyMode = (typeof VALID_LOBBY_MODES)[number];

export function LobbyCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { createLobby, isLoading, error } = useLobbyStore();
  const { sport, setSport } = useSettingsStore();

  const [lobbyMode, setLobbyMode] = useState<LobbyMode>(() => {
    const passed = (location.state as any)?.gameType;
    if (passed === 'nba-box-score') return 'box-score';
    return VALID_LOBBY_MODES.includes(passed) ? passed : 'roster';
  });
  const [winTarget, setWinTarget] = useState<3 | 5 | 7 | 10 | 20 | 30>(10);
  const [scrambleWinTarget, setScrambleWinTarget] = useState<10 | 20 | 30 | 40 | 50>(20);
  const [scrambleCareerTo, setScrambleCareerTo] = useState(0);
  const [hostName, setHostName] = useState(getStoredPlayerName() || '');

  // If arriving from NBA box score home card, pre-select NBA
  useEffect(() => {
    if ((location.state as any)?.gameType === 'nba-box-score') setSport('nba');
  }, []);

  const canCreate = !!hostName.trim();

  const handleCreate = async () => {
    if (!hostName.trim()) return;

    if (lobbyMode === 'career') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'NE';
      const dummySeason = sport === 'nba' ? '2023-24' : '2023';
      const lobby = await createLobby(
        hostName.trim(),
        sport,
        dummyTeamAbbr,
        dummySeason,
        90,
        'random',
        2000,
        2025,
        'career',
        'team',
        null,
        null,
      );
      if (lobby) {
        await updateCareerState(lobby.id, {
          win_target: winTarget,
          round: 0,
          min_mpg: 0,
          min_yards: 0,
        });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    if (lobbyMode === 'scramble') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'NE';
      const dummySeason = sport === 'nba' ? '2023-24' : '2023';
      const lobby = await createLobby(
        hostName.trim(),
        sport,
        dummyTeamAbbr,
        dummySeason,
        90,
        'random',
        2000,
        2025,
        'scramble',
        'team',
        null,
        null,
      );
      if (lobby) {
        await updateCareerState(lobby.id, {
          win_target: scrambleWinTarget,
          round: 0,
          career_to: scrambleCareerTo,
          min_mpg: 0,
          min_yards: 0,
          include_defense: true,
        });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    if (lobbyMode === 'box-score') {
      if (sport === 'nba') {
        const lobby = await createLobby(
          hostName.trim(),
          'nba',
          'LAL',
          '2024-25',
          120,
          'random',
          2014,
          2025,
          'nba-box-score',
          'team',
          null,
          null,
        );
        if (lobby) {
          await updateCareerState(lobby.id, {
            type: 'nba_box_score',
            min_year: 2014,
            max_year: 2025,
            team: null,
          });
          navigate(`/lobby/${lobby.join_code}`);
        }
      } else {
        const lobby = await createLobby(
          hostName.trim(),
          'nfl',
          'KC',
          '2025',
          120,
          'random',
          2015,
          2025,
          'box-score',
          'team',
          null,
          null,
        );
        if (lobby) {
          await updateCareerState(lobby.id, {
            type: 'box_score',
            min_year: 2015,
            max_year: 2025,
            team: null,
          });
          navigate(`/lobby/${lobby.join_code}`);
        }
      }
      return;
    }

    if (lobbyMode === 'starting-lineup') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'KC';
      const dummySeason = sport === 'nba' ? '2024-25' : '2024';
      const lobby = await createLobby(
        hostName.trim(),
        sport,
        dummyTeamAbbr,
        dummySeason,
        90,
        'random',
        2000,
        2025,
        'starting-lineup',
        'team',
        null,
        null,
      );
      if (lobby) {
        await updateCareerState(lobby.id, { win_target: winTarget, round: 0 });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    if (lobbyMode === 'face-reveal') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'NE';
      const dummySeason = sport === 'nba' ? '2023-24' : '2023';
      const lobby = await createLobby(
        hostName.trim(),
        sport,
        dummyTeamAbbr,
        dummySeason,
        90,
        'random',
        2000,
        2025,
        'face-reveal',
        'team',
        null,
        null,
      );
      if (lobby) {
        await updateCareerState(lobby.id, {
          win_target: 30,
          career_to: 0,
          timer: 60,
          min_yards: 0,
          min_mpg: 0,
          defense_mode: 'known',
          round: 0,
        });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    if (lobbyMode === 'top-ten') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'KC';
      const dummySeason = sport === 'nba' ? '2024-25' : '2024';
      const lobby = await createLobby(
        hostName.trim(),
        sport,
        dummyTeamAbbr,
        dummySeason,
        90,
        'random',
        2000,
        2025,
        'top-ten',
        'team',
        null,
        null,
      );
      if (lobby) {
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    if (lobbyMode === 'lineup-is-right') {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'NE';
      const dummySeason = sport === 'nba' ? '2023-24' : '2023';
      const lobby = await createLobby(
        hostName.trim(),
        sport,
        dummyTeamAbbr,
        dummySeason,
        90,
        'random',
        2000,
        2025,
        'lineup-is-right',
        'team',
        null,
        null,
      );
      if (lobby) {
        await updateCareerState(lobby.id, { round: 0 });
        navigate(`/lobby/${lobby.join_code}`);
      }
      return;
    }

    // Roster mode — defaults, host configures everything in the waiting room
    const teamList = sport === 'nba' ? teams : nflTeams;
    const teamAbbr = teamList[Math.floor(Math.random() * teamList.length)].abbreviation;
    const season = sport === 'nba' ? '2024-25' : '2024';
    const lobby = await createLobby(
      hostName.trim(),
      sport,
      teamAbbr,
      season,
      90,
      'random',
      2015,
      2025,
      'roster',
      'team',
      null,
      null,
    );
    if (lobby) navigate(`/lobby/${lobby.join_code}`);
  };

  return (
    <div className="min-h-screen flex flex-col home-chalkboard text-white">
      <header className="capcrunch-panel border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="capcrunch-kicker text-[10px] text-white/40 hover:text-white/70 transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="capcrunch-title text-3xl text-white">Open Table</h1>
            <p className="capcrunch-kicker text-[9px] text-white/30">Host a Private Game</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-6 space-y-5 overflow-y-auto">
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
          className="capcrunch-panel p-4"
        >
          <label className="block capcrunch-kicker text-[10px] text-white/40 mb-2">Your Name</label>
          <input
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full p-3 bg-black/40 border border-white/20 text-white focus:outline-none focus:border-[#FDF100] transition-colors capcrunch-kicker"
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

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-red-900/30 border border-red-700 text-red-400 text-sm text-center capcrunch-kicker"
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
          className="w-full py-4 capcrunch-btn-primary capcrunch-title text-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Opening Table...' : 'Open Table'}
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-center text-white/30 text-[10px] pb-4 capcrunch-kicker"
        >
          <p>You'll get a 6-character code to share</p>
        </motion.div>
      </main>
    </div>
  );
}
