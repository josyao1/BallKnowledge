import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import { isApiAvailable, fetchSeasonPlayers } from '../services/api';
import { isNFLApiAvailable, fetchNFLRosterFromApi, fetchNFLSeasonPlayers } from '../services/nfl-api';
import type { GameMode } from '../types';
import { RouletteOverlay } from '../components/home/RouletteOverlay';

type LoadingStatus = 'idle' | 'checking' | 'fetching' | 'success' | 'error';

type GenericTeam = {
  id: number;
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
};

export function HomePage() {
  const navigate = useNavigate();
  const setGameConfig = useGameStore((state) => state.setGameConfig);
  const { sport, timerDuration, hideResultsDuringGame, setSport } = useSettingsStore();

  const [gameMode, setGameMode] = useState<GameMode>('random');
  const [selectedTeam, setSelectedTeam] = useState<GenericTeam | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showRoulette, setShowRoulette] = useState(false);
  const [preparedGameData, setPreparedGameData] = useState<any>(null);

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
      const available = sport === 'nba' ? await isApiAvailable() : await isNFLApiAvailable();
      setApiOnline(available);
    };
    checkApi();
  }, [sport, warmupComplete]);

  useEffect(() => {
    setSelectedTeam(null);
    setSelectedYear(null);
    if (sport === 'nfl') {
      setRandomMinYear(Math.max(randomMinYear, 2000));
      setRandomMaxYear(Math.min(randomMaxYear, 2024));
    }
  }, [sport]);

  const handleStartGame = async () => {
    setLoadingStatus('checking');
    setStatusMessage('Selecting team...');
    const apiAvailable = sport === 'nba' ? await isApiAvailable() : await isNFLApiAvailable();
    const currentTeams = sport === 'nba' ? teams : nflTeams;
    const currentMinYear = sport === 'nba' ? randomMinYear : Math.max(randomMinYear, 2000);
    const currentMaxYear = sport === 'nba' ? randomMaxYear : Math.min(randomMaxYear, 2024);

    const pickRandomTeamSeason = (): { team: GenericTeam; year: number } | null => {
      if (apiAvailable) {
        const team = currentTeams[Math.floor(Math.random() * currentTeams.length)];
        const year = Math.floor(Math.random() * (currentMaxYear - currentMinYear + 1)) + currentMinYear;
        return { team, year };
      } else {
        if (sport === 'nfl') return null;
        const available: any[] = [];
        Object.entries(rosters).forEach(([abbr, seasons]) => {
          const teamData = teams.find(t => t.abbreviation === abbr);
          if (teamData) {
            Object.keys(seasons).forEach(s => {
              const yr = parseInt(s.split('-')[0]);
              if (yr >= currentMinYear && yr <= currentMaxYear) available.push({ team: teamData, year: yr });
            });
          }
        });
        return available.length ? available[Math.floor(Math.random() * available.length)] : null;
      }
    };

    const attemptLoadRoster = async (team: GenericTeam, year: number) => {
      const season = sport === 'nba' ? `${year}-${String(year + 1).slice(-2)}` : `${year}`;
      setLoadingStatus('fetching');
      try {
        const roster = sport === 'nba' ? await fetchTeamRoster(team.abbreviation, season) : await fetchNFLRosterFromApi(team.abbreviation, year);
        if (!roster?.players?.length) return false;
        const league = sport === 'nba' ? await fetchSeasonPlayers(season) : await fetchNFLSeasonPlayers(year);
        setLoadingStatus('success');
        await new Promise(r => setTimeout(r, 500));
        setPreparedGameData({ sport, team, season, gameMode, timerDuration, players: roster.players, leaguePlayers: league?.players || [], hideResultsDuringGame });
        setShowRoulette(true);
        return true;
      } catch { return false; }
    };

    if (gameMode === 'manual' && selectedTeam && selectedYear) {
      if (!await attemptLoadRoster(selectedTeam, selectedYear)) {
        setLoadingStatus('error');
        setStatusMessage('Roster data not found.');
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const pick = pickRandomTeamSeason();
        if (pick && await attemptLoadRoster(pick.team, pick.year)) return;
      }
      setLoadingStatus('error');
      setStatusMessage('Failed to find roster.');
    }
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#111]">
      <svg style={{ height: 0, width: 0, position: 'absolute' }}>
        <filter id="whiteOutline">
          <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="1" />
          <feFlood floodColor="white" floodOpacity="1" result="WHITE" />
          <feComposite in="WHITE" in2="DILATED" operator="in" result="OUTLINE" />
          <feMerge><feMergeNode in="OUTLINE" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </svg>

      <header className="p-4 flex justify-between items-center border-b-4 border-[#333] z-50 bg-[#111] relative">
        <motion.h1 style={{ filter: 'url(#whiteOutline)' }} className={`retro-title text-3xl ${sport === 'nba' ? 'text-[var(--nba-orange)]' : 'text-[#013369]'}`}>
          {sport === 'nba' ? 'Ball' : 'Pigskin'} Knowledge
        </motion.h1>

        <div className="absolute left-1/2 -translate-x-1/2 flex gap-2">
          {['nba', 'nfl'].map(s => (
            <button key={s} onClick={() => setSport(s as any)} className={`px-4 py-2 rounded-lg sports-font tracking-wider text-xs transition-all ${sport === s ? (s === 'nba' ? 'bg-[var(--nba-orange)]' : 'bg-[#013369]') + ' text-white shadow-lg' : 'bg-[#1a1a1a] text-[#888] border-2 border-[#3d3d3d]'}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${apiOnline ? 'bg-[#22c55e]' : 'bg-[#888]'}`} />
            <span className="text-xs text-[#666] sports-font">{apiOnline ? 'Live API' : 'Offline'}</span>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 border-2 border-[#3d3d3d] rounded-lg">
            <svg className="w-5 h-5 text-[var(--vintage-cream)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </header>

      <motion.div animate={{ y: showRoulette ? '-100vh' : '0vh' }} transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }} className="flex-1 flex flex-col">
        <main className="h-screen w-full flex-shrink-0 flex flex-col items-center justify-center p-4 space-y-6 relative overflow-hidden bg-[#111]">
          {/* Restored Decorative SVGs */}
          <div className="absolute -bottom-5 -left-5 w-70 h-70 opacity-40 pointer-events-none">
            <img src={sport === 'nba' ? "/images/Group 27.svg" : "/images/group23.svg"} alt="" />
          </div>
          <div className="absolute -top-10 -right-10 w-55 h-55 opacity-40 pointer-events-none">
            <img src={sport === 'nba' ? "/images/Group 28.svg" : "/images/g28.svg"} alt="" />
          </div>

          <div className="text-center z-10">
            <h2 className="retro-title text-5xl mb-2 text-[var(--vintage-cream)] uppercase tracking-tight">
              {sport === 'nba' ? 'NBA' : 'NFL'} Roster Royale
            </h2>
            <p className="sports-font text-sm text-[var(--vintage-cream)] tracking-widest opacity-60">
              How well do you know {sport === 'nba' ? 'NBA' : 'NFL'} rosters?
            </p>
          </div>

          {loadingStatus === 'idle' ? (
            <div className="flex flex-col items-center gap-6 z-10 w-full max-w-md">
              <div className="scoreboard-panel p-4 flex gap-3">
                <button onClick={() => setGameMode('random')} className={`px-6 py-2 rounded-lg sports-font text-sm transition-all ${gameMode === 'random' ? (sport === 'nba' ? 'bg-[var(--nba-orange)]' : 'bg-[#013369]') + ' text-white' : 'bg-[#1a1a1a] text-[#888] border-2 border-[#3d3d3d]'}`}>Random</button>
                <button onClick={() => setGameMode('manual')} className={`px-6 py-2 rounded-lg sports-font text-sm transition-all ${gameMode === 'manual' ? (sport === 'nba' ? 'bg-[var(--nba-orange)]' : 'bg-[#013369]') + ' text-white' : 'bg-[#1a1a1a] text-[#888] border-2 border-[#3d3d3d]'}`}>Manual</button>
              </div>

              {gameMode === 'manual' ? (
                <>
                  <TeamSelector selectedTeam={selectedTeam} onSelect={setSelectedTeam} sport={sport} />
                  <YearSelector selectedYear={selectedYear} onSelect={setSelectedYear} minYear={sport === 'nba' ? 1985 : 2000} maxYear={2024} sport={sport} />
                </>
              ) : (
                <div className="scoreboard-panel p-3 w-full text-center">
                  <div className="sports-font text-xs text-[#888] mb-2 tracking-widest">Year Range {sport === 'nfl' && '(2000-2024)'}</div>
                  <div className="flex items-center justify-center gap-3">
                    <select value={randomMinYear} onChange={(e) => setRandomMinYear(parseInt(e.target.value))} className="bg-[#1a1a1a] text-[var(--vintage-cream)] px-3 py-1.5 rounded-lg border-2 border-[#3d3d3d] sports-font text-sm">
                      {Array.from({length: 2024 - (sport === 'nfl' ? 2000 : 1985) + 1}, (_,i) => (sport === 'nfl' ? 2000 : 1985) + i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <span className="text-[#888] sports-font">to</span>
                    <select value={randomMaxYear} onChange={(e) => setRandomMaxYear(parseInt(e.target.value))} className="bg-[#1a1a1a] text-[var(--vintage-cream)] px-3 py-1.5 rounded-lg border-2 border-[#3d3d3d] sports-font text-sm">
                      {Array.from({length: 2024 - (sport === 'nfl' ? 2000 : 1985) + 1}, (_,i) => (sport === 'nfl' ? 2000 : 1985) + i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Restored Action Buttons */}
              <div className="flex flex-wrap gap-3 items-center justify-center">
                <button onClick={handleStartGame} disabled={gameMode === 'manual' && (!selectedTeam || !selectedYear)} className="retro-btn retro-btn-gold px-10 py-3 text-lg disabled:opacity-50">Start Solo</button>
                <button onClick={() => navigate('/lobby/create')} className={`px-5 py-3 rounded-lg sports-font border-2 text-sm transition-all ${sport === 'nba' ? 'border-[var(--nba-orange)] text-[var(--nba-orange)] hover:bg-[var(--nba-orange)] hover:text-white' : 'border-[#013369] text-[#013369] hover:bg-[#013369] hover:text-white'}`}>Create Lobby</button>
                <button onClick={() => navigate('/lobby/join')} className="px-5 py-3 rounded-lg sports-font border-2 border-[#3d3d3d] text-[#888] hover:border-[#555] text-sm">Join Lobby</button>
              </div>
            </div>
          ) : (
            <div className="scoreboard-panel p-6 min-w-[300px] flex flex-col items-center gap-4">
              <div className={`w-8 h-8 border-4 ${sport === 'nba' ? 'border-[var(--nba-orange)]' : 'border-[#013369]'} border-t-transparent rounded-full animate-spin`} />
              <span className="sports-font text-sm text-[var(--vintage-cream)]">{statusMessage}</span>
              {loadingStatus === 'error' && <button onClick={() => setLoadingStatus('idle')} className="text-sm underline text-red-500">Back</button>}
            </div>
          )}
        </main>

        <section className="h-screen w-full flex-shrink-0 flex items-center justify-center relative bg-[#0d2a0b]">
          <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`, background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }} />
          {showRoulette && preparedGameData && (
            <RouletteOverlay winningTeam={preparedGameData.team.name} winningYear={preparedGameData.season} sport={sport} winningTeamData={preparedGameData.team}
              onComplete={() => {
                setGameConfig(preparedGameData.sport, preparedGameData.team, preparedGameData.season, preparedGameData.gameMode, preparedGameData.timerDuration, preparedGameData.players, preparedGameData.leaguePlayers, preparedGameData.hideResultsDuringGame);
                navigate('/game');
              }}
            />
          )}
        </section>
      </motion.div>
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
