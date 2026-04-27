/**
 * HomePage.tsx — Landing page orchestrator.
 *
 * Holds all shared state and async logic. Renders the header, deck/fan/setup
 * panels, roulette transition, and modals. The heavy JSX lives in sub-components:
 *
 *   GameFanArc        — fanned card display after the deck is dealt
 *   RosterRoyaleSetup — setup panel for Roster Royale (and Box Score on NFL)
 *   CareerArcSetup    — setup panel for Career Arc
 *   ScrambleSetup     — setup panel for Name Scramble
 *   AboutModal        — about overlay linked from the header
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { SettingsModal } from '../components/home/SettingsModal';
import { AboutModal } from '../components/home/AboutModal';
import { GameFanArc } from '../components/home/GameFanArc';
import { RosterRoyaleSetup } from '../components/home/RosterRoyaleSetup';
import { GuessPlayerSetup } from '../components/home/GuessPlayerSetup';
import { RouletteOverlay } from '../components/home/RouletteOverlay';
import { teams } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import { FAN_POSITIONS } from '../data/homeGames';
import type { GenericTeam, LoadingStatus } from '../data/homeGames';
import { fetchTeamRoster, fetchStaticNFLRoster, fetchStaticSeasonPlayers, fetchStaticNFLSeasonPlayers } from '../services/roster';
import { warmCareerCache } from '../services/careerData';
import type { GameMode } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const setGameConfig = useGameStore((state) => state.setGameConfig);
  const { sport, timerDuration, hideResultsDuringGame, setSport } = useSettingsStore();

  // ── Filter state ──────────────────────────────────────────────────────────
  // Box Score filters (NFL only)
  const [boxScoreMinYear, setBoxScoreMinYear] = useState<number>(2015);
  const [boxScoreMaxYear, setBoxScoreMaxYear] = useState<number>(2024);
  const [boxScoreTeam,    setBoxScoreTeam]    = useState<string | null>(null);

  // ── Roster Royale state ───────────────────────────────────────────────────
  const [rosterSubMode,  setRosterSubMode]  = useState<'roster' | 'box-score'>('roster');
  const [gameMode,       setGameMode]       = useState<GameMode>('random');
  const [selectedTeam,   setSelectedTeam]   = useState<GenericTeam | null>(null);
  const [selectedYear,   setSelectedYear]   = useState<number | null>(null);
  const [randomMinYear,  setRandomMinYear]  = useState(2015);
  const [randomMaxYear,  setRandomMaxYear]  = useState(2025);
  const [loadingStatus,  setLoadingStatus]  = useState<LoadingStatus>('idle');
  const [statusMessage,  setStatusMessage]  = useState('');

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showSettings,    setShowSettings]    = useState(false);
  const [showAbout,       setShowAbout]       = useState(false);
  const [isDealt,         setIsDealt]         = useState(false);
  const [selectedCard,    setSelectedCard]    = useState<string | null>(null);
  const [hoveredCard,     setHoveredCard]     = useState<string | null>(null);
  const [tappedCard,      setTappedCard]      = useState<string | null>(null);
  const [showRoulette,    setShowRoulette]    = useState(false);
  const [preparedGameData, setPreparedGameData] = useState<any>(null);
  const [skipAnimation,   setSkipAnimation]   = useState(false);

  // ── Responsive fan scaling ────────────────────────────────────────────────
  // Track viewport width to scale card dimensions down on mobile.
  // Detect touch-primary devices to skip whileHover entirely (prevents stuck cards).
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    setIsTouchDevice(mq.matches);
    const update = () => setVw(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Scale thresholds: <400 → 0.52, <500 → 0.63, <640 → 0.77, else full size
  const fanScale        = vw < 400 ? 0.52 : vw < 500 ? 0.63 : vw < 640 ? 0.77 : 1;
  const cardW           = Math.round(165 * fanScale);
  const cardH           = Math.round(235 * fanScale);
  const containerH      = Math.round(360 * fanScale);
  const popDist         = Math.round(100 * fanScale);
  const fanToJoinGap    = Math.round(42  * fanScale);
  const deckYOffset     = Math.round(50  * fanScale);
  const scaledPositions = FAN_POSITIONS.map(fp => ({
    x: Math.round(fp.x * fanScale),
    y: Math.round(fp.y * fanScale),
    rotate: fp.rotate,
  }));

  // Debounce hover to prevent bounce when the mouse passes between overlapping cards
  const hoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHoveredCardDebounced = (id: string | null) => {
    if (id !== null) {
      if (hoverClearTimer.current) clearTimeout(hoverClearTimer.current);
      setHoveredCard(id);
    } else {
      // Wait 120 ms before clearing — absorbs inter-card gaps
      hoverClearTimer.current = setTimeout(() => setHoveredCard(null), 120);
    }
  };

  // ── Side-effects ──────────────────────────────────────────────────────────
  useEffect(() => { warmCareerCache(sport); }, [sport]);

  useEffect(() => {
    setSelectedTeam(null);
    setSelectedYear(null);
    if (sport === 'nba') setRosterSubMode('roster');
    if (sport === 'nfl') {
      setRandomMinYear(Math.max(randomMinYear, 2000));
      setRandomMaxYear(Math.min(randomMaxYear, 2025));
    }
  }, [sport]);

  // ── Roster Royale game start ──────────────────────────────────────────────
  const handleStartGame = async () => {
    setLoadingStatus('checking');
    setStatusMessage('Selecting team...');
    const shouldSkipAnimation = gameMode === 'manual';
    setSkipAnimation(shouldSkipAnimation);

    const currentTeams  = sport === 'nba' ? teams : nflTeams;
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
        let players, league;
        if (sport === 'nba') {
          const roster = await fetchTeamRoster(team.abbreviation, season);
          if (!roster?.players?.length) return false;
          players = roster.players;
          league  = await fetchStaticSeasonPlayers(season) ?? [];
        } else {
          const nflPlayers = await fetchStaticNFLRoster(team.abbreviation, year);
          if (!nflPlayers?.length) return false;
          players = nflPlayers;
          league  = await fetchStaticNFLSeasonPlayers(year) ?? [];
        }
        setLoadingStatus('success');
        await new Promise(r => setTimeout(r, 500));
        setPreparedGameData({ sport, team, season, gameMode, timerDuration, players, leaguePlayers: league, hideResultsDuringGame });
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

  // ── Derived values ────────────────────────────────────────────────────────
  const sportArtA = sport === 'nba' ? '/images/Group 27.svg'      : '/images/group23.svg';
  const sportArtB = sport === 'nba' ? '/images/Group 28.svg'      : '/images/g28.svg';
  const deckArt   = sport === 'nba' ? '/images/Group 29 (2).svg'  : '/images/Group 29 (1).svg';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#111]">
      {/* SVG filter used by the title text for the white outline effect */}
      <svg style={{ height: 0, width: 0, position: 'absolute' }}>
        <filter id="whiteOutline">
          <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="1" />
          <feFlood floodColor="white" floodOpacity="1" result="WHITE" />
          <feComposite in="WHITE" in2="DILATED" operator="in" result="OUTLINE" />
          <feMerge><feMergeNode in="OUTLINE" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </svg>

      {/* ── Header ── */}
      <header className="p-4 flex justify-between items-center border-b-4 border-[#333] z-50 bg-[#111] relative gap-2">
        <div className="flex-1 min-w-0">
          <motion.h1
            style={{ filter: 'url(#whiteOutline)' }}
            className={`retro-title text-xl sm:text-2xl md:text-3xl truncate ${sport === 'nba' ? 'text-[var(--nba-orange)]' : 'text-[#013369]'}`}
          >
            <>Ball <span className="xs:inline">Knowledge</span></>
          </motion.h1>
        </div>

        {/* NBA / NFL sport toggle */}
        <div className="flex shrink-0 border-2 border-[#2a2a2a] overflow-hidden rounded-sm">
          {(['nba', 'nfl'] as const).map((s, i) => {
            const isActive = sport === s;
            const activeBg = s === 'nba' ? '#f15a29' : '#013369';
            return (
              <motion.button
                key={s}
                onClick={() => setSport(s)}
                className={`relative px-4 sm:px-5 py-1.5 sm:py-2 retro-title text-lg sm:text-xl tracking-wider cursor-pointer overflow-hidden ${i === 0 ? 'border-r-2 border-[#2a2a2a]' : ''}`}
                animate={{ backgroundColor: isActive ? activeBg : '#0a0a0a', color: isActive ? '#ffffff' : '#2e2e2e' }}
                transition={{ duration: 0.08 }}
                whileTap={{ scale: 0.92, transition: { duration: 0.08 } }}
              >
                <motion.span
                  key={`${s}-${isActive}`}
                  initial={{ rotateX: -90, opacity: 0 }}
                  animate={{ rotateX: 0, opacity: 1 }}
                  transition={{ duration: 0.28, ease: [0.2, 0.9, 0.25, 1.05] }}
                  style={{ display: 'block', transformPerspective: 320 }}
                >
                  {s.toUpperCase()}
                </motion.span>
              </motion.button>
            );
          })}
        </div>

        {/* About button */}
        <div className="flex-1 flex justify-end items-center">
          <button
            onClick={() => setShowAbout(true)}
            className="p-1.5 md:p-2 text-[#444] hover:text-[#888] transition-colors shrink-0"
            title="About"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Main content — slides up when roulette fires ── */}
      <motion.div
        animate={{ y: showRoulette ? '-100vh' : '0vh' }}
        transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
        className="flex-1 flex flex-col"
      >
        <main className="h-screen w-full flex-shrink-0 flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#111]">

          {/* Decorative background SVGs */}
          <div className="absolute bottom-15 left-1 w-70 h-70 opacity-40 pointer-events-none">
            <img src={sportArtA} alt="" />
          </div>
          <div className="absolute -top-10 -right-10 w-55 h-55 opacity-40 pointer-events-none">
            <img src={sportArtB} alt="" />
          </div>

          <AnimatePresence mode="wait">

            {/* ── Deck (pre-deal) ── */}
            {!isDealt && (
              <motion.div
                key="deck"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                className="flex flex-col items-center z-10"
                style={{ gap: Math.round(32 * fanScale), transform: `translateY(-${deckYOffset}px)` }}
              >
                <div className="text-center">
                  <h2
                    className="retro-title text-[var(--vintage-cream)] uppercase tracking-tight"
                    style={{ fontSize: Math.max(22, Math.round(40 * fanScale)) }}
                  >
                    Pick a Card
                  </h2>
                  <p
                    className="sports-font text-[#555] tracking-[0.25em] mt-1.5 uppercase"
                    style={{ fontSize: Math.max(9, Math.round(12 * fanScale)) }}
                  >
                    {sport === 'nba' ? 'NBA' : 'NFL'} · Click to deal
                  </p>
                </div>

                {/* Deck stack — click to deal the fan */}
                <motion.button
                  onClick={() => setIsDealt(true)}
                  whileHover={{ y: -8 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative focus:outline-none cursor-pointer"
                  style={{ width: Math.round(200 * fanScale), height: Math.round(280 * fanScale) }}
                >
                  <div className="absolute inset-0 rounded-2xl border-2 border-[#ffffff]/25 bg-[#161616]"
                    style={{ transform: `rotate(8deg) translate(${Math.round(10 * fanScale)}px, ${Math.round(10 * fanScale)}px)` }} />
                  <div className="absolute inset-0 rounded-2xl border-2 border-[#ffffff]/45 bg-[#181818]"
                    style={{ transform: `rotate(4deg) translate(${Math.round(5 * fanScale)}px, ${Math.round(5 * fanScale)}px)` }} />
                  <div className="absolute inset-0 rounded-2xl border-2 border-[#ffffff] overflow-hidden shadow-2xl">
                    <img
                      src={deckArt}
                      alt=""
                      className="absolute inset-0 w-full h-full"
                      style={{ objectFit: 'cover', objectPosition: 'center' }}
                    />
                  </div>
                </motion.button>
              </motion.div>
            )}

            {/* ── Roster Royale setup panel ── */}
            {isDealt && selectedCard === 'roster' && (
              <RosterRoyaleSetup
                sport={sport}
                deckArt={deckArt}
                rosterSubMode={rosterSubMode}     setRosterSubMode={setRosterSubMode}
                boxScoreMinYear={boxScoreMinYear}  setBoxScoreMinYear={setBoxScoreMinYear}
                boxScoreMaxYear={boxScoreMaxYear}  setBoxScoreMaxYear={setBoxScoreMaxYear}
                boxScoreTeam={boxScoreTeam}        setBoxScoreTeam={setBoxScoreTeam}
                gameMode={gameMode}                setGameMode={setGameMode}
                selectedTeam={selectedTeam}        setSelectedTeam={setSelectedTeam}
                selectedYear={selectedYear}        setSelectedYear={setSelectedYear}
                randomMinYear={randomMinYear}      setRandomMinYear={setRandomMinYear}
                randomMaxYear={randomMaxYear}      setRandomMaxYear={setRandomMaxYear}
                timerDuration={timerDuration}
                loadingStatus={loadingStatus}      setLoadingStatus={setLoadingStatus}
                statusMessage={statusMessage}
                onBack={() => { setSelectedCard(null); setLoadingStatus('idle'); }}
                onStartGame={handleStartGame}
                onOpenSettings={() => setShowSettings(true)}
              />
            )}

            {/* ── Guess the Player setup panel ── */}
            {isDealt && selectedCard === 'guess-player' && (
              <GuessPlayerSetup
                sport={sport}
                onBack={() => setSelectedCard(null)}
              />
            )}

            {/* ── Fan arc (dealt, no setup panel open) ── */}
            {isDealt && selectedCard === null && (
              <GameFanArc
                sport={sport}
                cardW={cardW}               cardH={cardH}
                containerH={containerH}     popDist={popDist}
                fanToJoinGap={fanToJoinGap} fanScale={fanScale}
                scaledPositions={scaledPositions}
                deckYOffset={deckYOffset}
                isTouchDevice={isTouchDevice}
                hoveredCard={hoveredCard}   tappedCard={tappedCard}
                setHoveredCardDebounced={setHoveredCardDebounced}
                setTappedCard={setTappedCard}
                onCardSelect={id => setSelectedCard(id)}
              />
            )}

          </AnimatePresence>
        </main>

        {/* Roulette slide — renders below main, revealed by the slide-up animation */}
        <section className="h-screen w-full flex-shrink-0 flex items-center justify-center relative bg-[#0d2a0b]">
          <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)' }} />
          {showRoulette && preparedGameData && (
            <RouletteOverlay
              winningTeam={preparedGameData.team.name}
              winningYear={preparedGameData.season}
              sport={sport}
              winningTeamData={preparedGameData.team}
              skipAnimation={skipAnimation}
              onComplete={() => {
                setGameConfig(
                  preparedGameData.sport, preparedGameData.team, preparedGameData.season,
                  preparedGameData.gameMode, preparedGameData.timerDuration,
                  preparedGameData.players, preparedGameData.leaguePlayers,
                  preparedGameData.hideResultsDuringGame,
                );
                navigate('/game');
              }}
            />
          )}
        </section>
      </motion.div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showAbout    && <AboutModal   onClose={() => setShowAbout(false)} />}
    </div>
  );
}
