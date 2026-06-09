import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SettingsModal } from '../components/home/SettingsModal';
import { AboutModal } from '../components/home/AboutModal';
import { GuessPlayerSetup } from '../components/home/GuessPlayerSetup';
import { RosterRoyaleSetup } from '../components/home/RosterRoyaleSetup';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { teams } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import { HOME_TILES, type GenericTeam, type LoadingStatus } from '../data/homeGames';
import { fetchTeamRoster, fetchStaticNFLRoster, fetchStaticSeasonPlayers, fetchStaticNFLSeasonPlayers } from '../services/roster';
import { warmCareerCache } from '../services/careerData';
import { RouletteOverlay } from '../components/home/RouletteOverlay';
import type { GameMode } from '../types';
import type { Sport } from '../types';

type ActivePanel = 'roster' | 'guess-player' | 'guess-player-lobby' | null;
type CapCrunchModalStep = 'sport' | 'settings' | null;

const CAP_CRUNCH_NBA_CATS = ['pts', 'ast', 'reb', 'min', 'pra', 'total_gp', 'total_pts', 'total_reb', 'total_ast', 'total_blk', 'total_3pm', 'total_ftm', 'total_pf'] as const;
const CAP_CRUNCH_NFL_CATS = ['passing_yards', 'passing_tds', 'interceptions', 'rushing_yards', 'rushing_tds', 'receiving_yards', 'receiving_tds', 'receptions', 'fpts', 'total_gp'] as const;
const CAP_CRUNCH_NFL_CAREER_CATS = ['career_passing_yards', 'career_passing_tds', 'career_rushing_yards', 'career_rushing_tds', 'career_receiving_yards', 'career_receiving_tds'] as const;

const getCapCrunchLabel = (category: string) => {
  const labels: Record<string, string> = {
    random: 'RANDOM',
    pts: 'PTS/G', ast: 'AST/G', reb: 'REB/G', min: 'MIN/G', pra: 'PRA/G',
    total_pts: 'TOT PTS', total_reb: 'TOT REB', total_ast: 'TOT AST', total_blk: 'TOT BLK',
    total_3pm: 'TOT 3PM', total_ftm: 'TOT FTM', total_pf: 'TOT PF',
    passing_yards: 'PASS YD', passing_tds: 'PASS TD', interceptions: 'INT',
    rushing_yards: 'RUSH YD', rushing_tds: 'RUSH TD', receiving_yards: 'REC YD',
    receiving_tds: 'REC TD', receptions: 'REC', fpts: 'FPTS', total_gp: 'TOT GP',
    career_passing_yards: 'CAREER PASS YD', career_passing_tds: 'CAREER PASS TD',
    career_rushing_yards: 'CAREER RUSH YD', career_rushing_tds: 'CAREER RUSH TD',
    career_receiving_yards: 'CAREER REC YD', career_receiving_tds: 'CAREER REC TD',
  };

  return labels[category] ?? category.toUpperCase();
};

export function HomePage() {
  const navigate = useNavigate();
  const setGameConfig = useGameStore((state) => state.setGameConfig);
  const { sport, timerDuration, hideResultsDuringGame } = useSettingsStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [preparedGameData, setPreparedGameData] = useState<any>(null);
  const [skipAnimation, setSkipAnimation] = useState(false);

  const [boxScoreMinYear, setBoxScoreMinYear] = useState<number>(2015);
  const [boxScoreMaxYear, setBoxScoreMaxYear] = useState<number>(2025);
  const [boxScoreTeam, setBoxScoreTeam] = useState<string | null>(null);
  const [rosterSubMode, setRosterSubMode] = useState<'roster' | 'box-score'>('roster');
  const [gameMode, setGameMode] = useState<GameMode>('random');
  const [selectedTeam, setSelectedTeam] = useState<GenericTeam | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [randomMinYear, setRandomMinYear] = useState(2015);
  const [randomMaxYear, setRandomMaxYear] = useState(2025);
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [capCrunchStep, setCapCrunchStep] = useState<CapCrunchModalStep>(null);
  const [capCrunchSport, setCapCrunchSport] = useState<Sport | null>(null);
  const [capCrunchRounds, setCapCrunchRounds] = useState(5);
  const [capCrunchTab, setCapCrunchTab] = useState<'settings' | 'rules'>('settings');

  useEffect(() => {
    warmCareerCache(sport);
  }, [sport]);

  const handleStartGame = async () => {
    setLoadingStatus('checking');
    setStatusMessage('Selecting team...');
    const shouldSkipAnimation = gameMode === 'manual';
    setSkipAnimation(shouldSkipAnimation);

    const currentTeams = sport === 'nba' ? teams : nflTeams;
    const currentMinYear = Math.max(randomMinYear, 2000);
    const currentMaxYear = Math.min(randomMaxYear, 2025);

    const pickRandomTeamSeason = () => {
      const team = currentTeams[Math.floor(Math.random() * currentTeams.length)];
      const year = Math.floor(Math.random() * (currentMaxYear - currentMinYear + 1)) + currentMinYear;
      return { team, year };
    };

    const attemptLoadRoster = async (team: GenericTeam, year: number) => {
      const season = sport === 'nba' ? `${year}-${String(year + 1).slice(-2)}` : `${year}`;
      setLoadingStatus('fetching');
      try {
        let players;
        let league;
        if (sport === 'nba') {
          const roster = await fetchTeamRoster(team.abbreviation, season);
          if (!roster?.players?.length) return false;
          players = roster.players;
          league = await fetchStaticSeasonPlayers(season) ?? [];
        } else {
          const nflPlayers = await fetchStaticNFLRoster(team.abbreviation, year);
          if (!nflPlayers?.length) return false;
          players = nflPlayers;
          league = await fetchStaticNFLSeasonPlayers(year) ?? [];
        }
        setLoadingStatus('success');
        await new Promise((resolve) => setTimeout(resolve, 500));
        setPreparedGameData({ sport, team, season, gameMode, timerDuration, players, leaguePlayers: league, hideResultsDuringGame });
        setShowRoulette(true);
        return true;
      } catch {
        return false;
      }
    };

    if (gameMode === 'manual' && selectedTeam && selectedYear) {
      if (!await attemptLoadRoster(selectedTeam, selectedYear)) {
        setLoadingStatus('error');
        setStatusMessage('Roster data not found.');
      }
      return;
    }

    for (let index = 0; index < 5; index += 1) {
      const pick = pickRandomTeamSeason();
      if (pick && await attemptLoadRoster(pick.team, pick.year)) return;
    }

    setLoadingStatus('error');
    setStatusMessage('Failed to find roster.');
  };

  const openTile = (tileId: string, mode: 'solo' | 'lobby') => {
    if (tileId === 'coming-soon') return;

    if (tileId === 'roster') {
      setActivePanel('roster');
      return;
    }

    if (tileId === 'guess-player') {
      setActivePanel(mode === 'lobby' ? 'guess-player-lobby' : 'guess-player');
      return;
    }

    if (tileId === 'cap-crunch' && mode === 'solo') {
      setCapCrunchSport(null);
      setCapCrunchRounds(5);
      setCapCrunchTab('settings');
      setCapCrunchStep('sport');
      return;
    }

    const lobbyModeMap: Record<string, string> = {
      'cap-crunch': 'lineup-is-right',
      'starting-lineup': 'starting-lineup',
      'rollcall': 'roll-call',
      'top-ten': 'top-ten',
    };

    const soloPathMap: Record<string, string> = {
      'cap-crunch': '/lineup-is-right',
      'starting-lineup': '/starting-lineup',
      'top-ten': '/top-ten',
    };

    if (mode === 'solo' && soloPathMap[tileId]) {
      navigate(soloPathMap[tileId]);
      return;
    }

    if (tileId === 'rollcall') {
      navigate('/roll-call/create');
      return;
    }

    navigate('/lobby/create', { state: { gameType: lobbyModeMap[tileId] ?? 'roster' } });
  };

  const launchCapCrunch = (selectedSport: Sport, statCategory: string | null) => {
    navigate('/lineup-is-right', {
      state: {
        autoStart: true,
        selectedSport,
        statCategory,
        totalRounds: capCrunchRounds,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#000] text-[#f1f1ef] home-chalkboard">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-6 sm:gap-4 sm:pb-8">
          <div className="min-w-0 flex-1">
            <h1 className="home-display truncate text-2xl leading-[0.98] text-white sm:text-4xl lg:text-5xl">
              Ball Knowledge
            </h1>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-3">
            <button
              onClick={() => navigate('/lobby/join')}
              className="border border-[#FDF100]/60 bg-[#FDF100]/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#f5f5f2] transition hover:border-[#FDF100] hover:bg-[#FDF100]/18 sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.25em]"
            >
              Join Lobby
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="border border-[#68BBE5]/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#bfe8ff] transition hover:border-[#68BBE5] hover:bg-[#68BBE5]/10 hover:text-white sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.25em]"
            >
              Settings
            </button>
            <button
              onClick={() => setShowAbout(true)}
              className="border border-[#E2008A]/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#ffc2ea] transition hover:border-[#E2008A] hover:bg-[#E2008A]/10 hover:text-white sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.25em]"
            >
              About
            </button>
          </div>
        </header>

        <main className="flex-1 py-8">
          <div className="mb-8 flex items-center gap-3">
            <span className="h-px w-10 bg-[#FDF100]/80" />
            <span className="h-px w-16 bg-[#68BBE5]/70" />
            <span className="h-px w-8 bg-[#E2008A]/70" />
            <span className="h-px w-12 bg-[#70BE5B]/70" />
          </div>

          <div className="home-grid-shell">
            {HOME_TILES.filter((tile) => tile.id === 'cap-crunch').map((tile) => (
              <motion.article
                key={tile.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className={`group relative overflow-hidden border-b border-white/12 ${tile.disabled ? 'bg-white/[0.015]' : 'bg-white/[0.03]'}`}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(circle at top right, ${tile.accent}33, transparent 35%)` }}
                />
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: `linear-gradient(90deg, transparent 0%, ${tile.accent} 45%, transparent 100%)` }}
                />
                <div className="absolute inset-0" style={{ backgroundColor: tile.accent, opacity: tile.disabled ? 0.08 : 0.2 }} />
                <img
                  src={tile.image}
                  alt={tile.name}
                  className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${tile.disabled ? 'opacity-20 saturate-50' : 'opacity-40 group-hover:scale-[1.03] group-hover:opacity-48'}`}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.82)_72%)]" />

                <div className="relative flex h-full min-h-[300px] flex-col justify-between p-5 sm:min-h-[360px] sm:p-7 lg:min-h-[380px]">
                  <div className="flex items-start gap-3">
                    <div className="max-w-[75%]">
                      {tile.popularLabel && (
                        <span
                          className="mb-4 inline-flex border px-3 py-1 text-[10px] uppercase tracking-[0.3em]"
                          style={{ borderColor: `${tile.accent}88`, color: tile.accent, backgroundColor: `${tile.accent}1a` }}
                        >
                          {tile.popularLabel}
                        </span>
                      )}
                      <h2 className={`home-tile-title text-3xl sm:text-4xl ${tile.disabled ? 'text-white/72' : 'text-white'}`}>{tile.name}</h2>
                      <p className={`home-body mt-3 max-w-2xl text-sm leading-6 sm:text-base ${tile.disabled ? 'text-[#d7d7d3]/70' : 'text-[#d7d7d3]'}`}>
                        {tile.taglineBySport?.[sport] ?? tile.tagline}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {tile.hasSolo && !tile.disabled && (
                      <button
                        onClick={() => openTile(tile.id, 'solo')}
                        className="border px-5 py-2.5 text-[11px] uppercase tracking-[0.24em] text-white transition hover:bg-white/8"
                        style={{ borderColor: `${tile.accent}80` }}
                      >
                        {tile.id === 'roster' || tile.id === 'guess-player' ? 'Open' : 'Solo'}
                      </button>
                    )}
                    {tile.disabled ? (
                        <span className="border border-white/10 bg-white/[0.02] px-5 py-2.5 text-[11px] uppercase tracking-[0.24em] text-[#d0d0cc]/75">
                          Coming Soon
                        </span>
                    ) : (
                      <button
                        onClick={() => openTile(tile.id, 'lobby')}
                        className="border border-white/14 px-5 py-2.5 text-[11px] uppercase tracking-[0.24em] text-[#d0d0cc] transition hover:border-white/35 hover:bg-white/8 hover:text-white"
                      >
                        {tile.hasSolo ? 'Lobby' : 'Play'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}

            <div className="grid grid-cols-2 lg:grid-cols-3">
              {HOME_TILES.filter((tile) => tile.id !== 'cap-crunch').map((tile) => (
                <motion.article
                  key={tile.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className={`group relative overflow-hidden border-r border-t border-white/12 even:border-r-0 lg:[&:nth-child(3n)]:border-r-0 ${tile.disabled ? 'bg-white/[0.015]' : 'bg-white/[0.03]'}`}
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: `radial-gradient(circle at top right, ${tile.accent}33, transparent 35%)` }}
                  />
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ background: `linear-gradient(90deg, transparent 0%, ${tile.accent} 45%, transparent 100%)` }}
                  />
                  <div className="absolute inset-0" style={{ backgroundColor: tile.accent, opacity: tile.disabled ? 0.08 : 0.2 }} />
                  <img
                    src={tile.image}
                    alt={tile.name}
                    className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${tile.disabled ? 'opacity-20 saturate-50' : 'opacity-40 group-hover:scale-[1.03] group-hover:opacity-48'}`}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.82)_72%)]" />

                  <div className="relative flex h-full min-h-[240px] flex-col justify-between p-4 sm:min-h-[280px] sm:p-5 lg:min-h-[220px]">
                    <div className="flex items-start gap-3">
                      <div className="max-w-[70%]">
                        {tile.popularLabel && (
                          <span
                            className="mb-3 inline-flex border px-3 py-1 text-[10px] uppercase tracking-[0.3em]"
                            style={{ borderColor: `${tile.accent}88`, color: tile.accent, backgroundColor: `${tile.accent}1a` }}
                          >
                            {tile.popularLabel}
                          </span>
                        )}
                        <h2 className={`home-tile-title text-xl sm:text-2xl ${tile.disabled ? 'text-white/72' : 'text-white'}`}>{tile.name}</h2>
                        <p className={`home-body mt-2 text-xs leading-5 sm:text-sm ${tile.disabled ? 'text-[#d7d7d3]/70' : 'text-[#d7d7d3]'}`}>
                          {tile.taglineBySport?.[sport] ?? tile.tagline}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {tile.hasSolo && !tile.disabled && (
                        <button
                          onClick={() => openTile(tile.id, 'solo')}
                          className="border px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-white transition hover:bg-white/8"
                          style={{ borderColor: `${tile.accent}80` }}
                        >
                          {tile.id === 'roster' || tile.id === 'guess-player' ? 'Open' : 'Solo'}
                        </button>
                      )}
                      {tile.disabled ? (
                        <span className="border border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-[#d0d0cc]/75">
                          Coming Soon
                        </span>
                      ) : (
                        <button
                          onClick={() => openTile(tile.id, 'lobby')}
                          className="border border-white/14 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-[#d0d0cc] transition hover:border-white/35 hover:bg-white/8 hover:text-white"
                        >
                          {tile.hasSolo ? 'Lobby' : 'Play'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activePanel === 'roster' && (
              <motion.div
                key="roster-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.24 }}
                className="mt-8"
              >
                <RosterRoyaleSetup
                  sport={sport}
                  deckArt="/images/home/roster-royale.svg"
                  rosterSubMode={rosterSubMode}
                  setRosterSubMode={setRosterSubMode}
                  boxScoreMinYear={boxScoreMinYear}
                  setBoxScoreMinYear={setBoxScoreMinYear}
                  boxScoreMaxYear={boxScoreMaxYear}
                  setBoxScoreMaxYear={setBoxScoreMaxYear}
                  boxScoreTeam={boxScoreTeam}
                  setBoxScoreTeam={setBoxScoreTeam}
                  gameMode={gameMode}
                  setGameMode={setGameMode}
                  selectedTeam={selectedTeam}
                  setSelectedTeam={setSelectedTeam}
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                  randomMinYear={randomMinYear}
                  setRandomMinYear={setRandomMinYear}
                  randomMaxYear={randomMaxYear}
                  setRandomMaxYear={setRandomMaxYear}
                  timerDuration={timerDuration}
                  loadingStatus={loadingStatus}
                  setLoadingStatus={setLoadingStatus}
                  statusMessage={statusMessage}
                  onBack={() => {
                    setActivePanel(null);
                    setLoadingStatus('idle');
                  }}
                  onStartGame={handleStartGame}
                  onOpenSettings={() => setShowSettings(true)}
                />
              </motion.div>
            )}

            {(activePanel === 'guess-player' || activePanel === 'guess-player-lobby') && (
              <motion.div
                key="guess-player-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.24 }}
                className="mt-8"
              >
                <GuessPlayerSetup
                  sport={sport}
                  mode={activePanel === 'guess-player-lobby' ? 'lobby' : 'solo'}
                  onBack={() => setActivePanel(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {showRoulette && preparedGameData && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <RouletteOverlay
            winningTeam={preparedGameData.team.name}
            winningYear={preparedGameData.season}
            sport={sport}
            winningTeamData={preparedGameData.team}
            skipAnimation={skipAnimation}
            onComplete={() => {
              setGameConfig(
                preparedGameData.sport,
                preparedGameData.team,
                preparedGameData.season,
                preparedGameData.gameMode,
                preparedGameData.timerDuration,
                preparedGameData.players,
                preparedGameData.leaguePlayers,
                preparedGameData.hideResultsDuringGame,
              );
              navigate('/game');
            }}
          />
        </section>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {capCrunchStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          {capCrunchStep === 'sport' && (
            <div className="capcrunch-panel w-full max-w-4xl p-6 md:p-10">
              <div className="mb-8">
                <p className="home-kicker text-[#bfbfbf] mb-3">Cap Crunch</p>
                <h2 className="capcrunch-title text-4xl md:text-6xl text-white mb-3">Pick a Sport</h2>
                <p className="capcrunch-body text-white/60 text-sm md:text-base">Choose a league, then configure the solo game without leaving the homepage.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 border border-white/10">
                <button
                  onClick={() => { setCapCrunchSport('nba'); setCapCrunchStep('settings'); }}
                  className="group relative min-h-[220px] border-b md:border-b-0 md:border-r border-white/10 bg-white/[0.03] p-6 text-left transition hover:bg-[#FDF100]/10"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-[#FDF100]" />
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <span className="capcrunch-kicker text-[#FDF100]">Basketball</span>
                      <h3 className="capcrunch-title mt-4 text-3xl text-white">NBA</h3>
                      <p className="capcrunch-body mt-3 max-w-sm text-sm text-white/65">Per-game categories and team-based career games played.</p>
                    </div>
                    <span className="capcrunch-kicker text-white/70 group-hover:text-white">Continue</span>
                  </div>
                </button>
                <button
                  onClick={() => { setCapCrunchSport('nfl'); setCapCrunchStep('settings'); }}
                  className="group relative min-h-[220px] bg-white/[0.03] p-6 text-left transition hover:bg-[#68BBE5]/10"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-[#68BBE5]" />
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <span className="capcrunch-kicker text-[#68BBE5]">Football</span>
                      <h3 className="capcrunch-title mt-4 text-3xl text-white">NFL</h3>
                      <p className="capcrunch-body mt-3 max-w-sm text-sm text-white/65">Season and career stat variants with broader qualifier rounds.</p>
                    </div>
                    <span className="capcrunch-kicker text-white/70 group-hover:text-white">Continue</span>
                  </div>
                </button>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setCapCrunchStep(null)}
                  className="px-4 py-2 capcrunch-btn-secondary capcrunch-title text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {capCrunchStep === 'settings' && capCrunchSport && (
            <div className="w-full max-w-6xl">
              <div className="mb-4 flex justify-center lg:hidden">
                <div className="inline-flex border border-white/10 bg-black/20">
                  <button
                    onClick={() => setCapCrunchTab('settings')}
                    className={`px-4 py-2 capcrunch-kicker transition ${capCrunchTab === 'settings' ? 'bg-[#FDF100] text-black' : 'text-white/60'}`}
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => setCapCrunchTab('rules')}
                    className={`px-4 py-2 capcrunch-kicker transition ${capCrunchTab === 'rules' ? 'bg-[#68BBE5] text-black' : 'text-white/60'}`}
                  >
                    Rules
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <section className={`${capCrunchTab !== 'settings' ? 'hidden lg:block' : ''} capcrunch-panel p-5 md:p-6`}>
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <p className="home-kicker text-[#bfbfbf] mb-2">Cap Crunch</p>
                      <h2 className="capcrunch-title text-4xl md:text-5xl text-white">{capCrunchSport.toUpperCase()} Settings</h2>
                    </div>
                    <button
                      onClick={() => setCapCrunchStep('sport')}
                      className="px-4 py-2 capcrunch-btn-secondary capcrunch-title text-sm"
                    >
                      Change Sport
                    </button>
                  </div>

                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button
                        onClick={() => launchCapCrunch(capCrunchSport, null)}
                        className="px-4 py-2 rounded-sm sports-font text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                      >
                        RANDOM
                      </button>
                      {(capCrunchSport === 'nba' ? CAP_CRUNCH_NBA_CATS : CAP_CRUNCH_NFL_CATS).map((category) => (
                        <button
                          key={category}
                          onClick={() => launchCapCrunch(capCrunchSport, category)}
                          className="px-4 py-2 rounded-sm sports-font text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                        >
                          {getCapCrunchLabel(category)}
                        </button>
                      ))}
                    </div>

                    {capCrunchSport === 'nfl' && (
                      <div className="w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-px bg-white/10" />
                          <span className="sports-font text-[9px] text-white/40 tracking-[0.3em] uppercase">Career Totals</span>
                          <div className="flex-1 h-px bg-white/10" />
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          <button
                            onClick={() => launchCapCrunch(capCrunchSport, CAP_CRUNCH_NFL_CAREER_CATS[Math.floor(Math.random() * CAP_CRUNCH_NFL_CAREER_CATS.length)])}
                            className="px-4 py-2 rounded-sm sports-font text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                          >
                            RANDOM
                          </button>
                          {CAP_CRUNCH_NFL_CAREER_CATS.map((category) => (
                            <button
                              key={category}
                              onClick={() => launchCapCrunch(capCrunchSport, category)}
                              className="px-4 py-2 rounded-sm sports-font text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                            >
                              {getCapCrunchLabel(category)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 justify-center mt-6">
                    <span className="sports-font text-[10px] text-white/50 tracking-widest">ROUNDS</span>
                    <div className="flex gap-1">
                      {[3, 4, 5, 6, 7, 8, 9, 10].map((rounds) => (
                        <button
                          key={rounds}
                          onClick={() => setCapCrunchRounds(rounds)}
                          className={`w-8 h-8 rounded-sm sports-font text-xs transition ${
                            capCrunchRounds === rounds
                              ? 'bg-[#d4af37] text-black font-bold'
                              : 'bg-black/50 border border-white/20 text-white/50 hover:text-white hover:border-white/40'
                          }`}
                        >
                          {rounds}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <aside className={`${capCrunchTab !== 'rules' ? 'hidden lg:block' : ''} capcrunch-panel p-5 md:p-6`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="capcrunch-title text-lg text-[#FDF100]">How to Play</h3>
                    <button
                      onClick={() => setCapCrunchStep(null)}
                      className="px-4 py-2 capcrunch-btn-secondary capcrunch-title text-sm"
                    >
                      Close
                    </button>
                  </div>
                  <ul className="text-sm text-white/80 space-y-2.5 text-left">
                    <li><span className="text-[#d4af37] font-bold">Goal:</span> Build a lineup whose combined stat reaches — but does not exceed — the target cap.</li>
                    <li><span className="text-[#d4af37] font-bold">Each pick:</span> A filter is shown. Search any qualifying player and their value gets added to your total.</li>
                    <li><span className="text-emerald-400 font-bold">Season stats:</span> Pick a year and that team-season value counts.</li>
                    <li><span className="text-emerald-400 font-bold">Career variants:</span> Some modes count career totals without needing a year.</li>
                    <li><span className="text-red-400 font-bold">Busts:</span> A pick that pushes you over the cap scores 0 and your total reverts.</li>
                    <li><span className="text-white/60 font-bold">Special rounds:</span> Filters can be team, division, conference, draft, teammate, or more.</li>
                    <li><span className="text-[#d4af37] font-bold">Tiebreaker:</span> Fewest busts wins; then oldest average pick year.</li>
                  </ul>
                </aside>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
