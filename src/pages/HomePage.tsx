/**
 * HomePage.tsx — Landing page with card dealing animation.
 *
 * Deck → click → five game cards fan out. Hovering a card pops it
 * forward and reveals game info + action buttons.
 */

import { useState, useEffect, useRef } from 'react';
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
import { fetchTeamRoster, fetchStaticNFLRoster, fetchStaticSeasonPlayers, fetchStaticNFLSeasonPlayers } from '../services/roster';
import { warmCareerCache } from '../services/careerData';
import type { GameMode } from '../types';
import { RouletteOverlay } from '../components/home/RouletteOverlay';

type LoadingStatus = 'idle' | 'checking' | 'fetching' | 'success' | 'error';

type GenericTeam = {
  id: number;
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
};

type GameCard = {
  id: string;
  abbr: string;
  name: string;
  tagline: string;
  color: string;
  hasSolo: boolean;
  soloPath?: string;
  multiPath?: string;
};

const GAMES: GameCard[] = [
  { id: 'roster',   abbr: 'RR', name: 'Roster Royale',    tagline: 'Name every player from a mystery team & season',      color: '#d4af37', hasSolo: true  },
  { id: 'career',   abbr: 'CA', name: 'Career Arc',        tagline: "Trace a player's career — team by team",              color: '#22c55e', hasSolo: true,  soloPath: '/career'          },
  { id: 'scramble', abbr: 'NS', name: 'Name Scramble',     tagline: 'Unscramble athlete names before time runs out',        color: '#3b82f6', hasSolo: true,  soloPath: '/scramble'        },
  { id: 'lineup',   abbr: 'LR', name: 'Lineup Is Right',   tagline: "Chase the stat cap with a lineup — don't bust",       color: '#ec4899', hasSolo: true,  soloPath: '/lineup-is-right' },
  { id: 'rollcall', abbr: 'RC', name: 'Roll Call',         tagline: 'Everyone shouts out players from the same team',      color: '#a855f7', hasSolo: false, multiPath: '/roll-call/create' },
];

// Fan arc positions: x/y offsets from card center origin, rotation degrees
const FAN_POSITIONS = [
  { x: -224, y: 47, rotate: -24 },
  { x: -114, y: 12, rotate: -12 },
  { x:    0, y:  0, rotate:   0 },
  { x:  114, y: 12, rotate:  12 },
  { x:  224, y: 47, rotate:  24 },
];

export function HomePage() {
  const navigate = useNavigate();
  const setGameConfig = useGameStore((state) => state.setGameConfig);
  const { sport, timerDuration, hideResultsDuringGame, setSport } = useSettingsStore();

  // Career Arc filter
  const [careerActiveYear, setCareerActiveYear] = useState<number | null>(null);

  // Roster Royale setup
  const [gameMode, setGameMode] = useState<GameMode>('random');
  const [selectedTeam, setSelectedTeam] = useState<GenericTeam | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [randomMinYear, setRandomMinYear] = useState(2015);
  const [randomMaxYear, setRandomMaxYear] = useState(2025);
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [isDealt, setIsDealt] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [tappedCard, setTappedCard] = useState<string | null>(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [preparedGameData, setPreparedGameData] = useState<any>(null);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [showWarmup] = useState(false);
  const [warmupComplete, setWarmupComplete] = useState(true);

  // Debounce hover to prevent bounce when mouse passes between overlapping cards
  const hoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHoveredCardDebounced = (id: string | null) => {
    if (id !== null) {
      // Entering a card — cancel any pending clear and immediately show
      if (hoverClearTimer.current) clearTimeout(hoverClearTimer.current);
      setHoveredCard(id);
    } else {
      // Leaving a card — wait 120ms before clearing (absorbs inter-card gaps)
      hoverClearTimer.current = setTimeout(() => setHoveredCard(null), 120);
    }
  };

  const handleWarmupReady = () => { setApiOnline(true); setWarmupComplete(true); };
  const handleWarmupSkip  = () => { setApiOnline(false); setWarmupComplete(true); };

  useEffect(() => {
    if (!warmupComplete) return;
    setApiOnline(true);
    warmCareerCache(sport);
  }, [sport, warmupComplete]);

  useEffect(() => {
    setSelectedTeam(null);
    setSelectedYear(null);
    if (sport === 'nfl') {
      setRandomMinYear(Math.max(randomMinYear, 2000));
      setRandomMaxYear(Math.min(randomMaxYear, 2025));
    }
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
        let players, league;
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

  const sportArtA = sport === 'nba' ? '/images/Group 27.svg' : '/images/group23.svg';
  const sportArtB = sport === 'nba' ? '/images/Group 28.svg' : '/images/g28.svg';
  const deckArt   = sport === 'nba' ? '/images/Group 29.svg' : '/images/g29.svg';

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

      {/* ── Header ── */}
      <header className="p-4 flex justify-between items-center border-b-4 border-[#333] z-50 bg-[#111] relative gap-2">
        <div className="flex-1 min-w-0">
          <motion.h1
            style={{ filter: 'url(#whiteOutline)' }}
            className={`retro-title text-xl sm:text-2xl md:text-3xl truncate ${sport === 'nba' ? 'text-[var(--nba-orange)]' : 'text-[#013369]'}`}
          >
            {sport === 'nba' ? <>Ball <span className="xs:inline">Knowledge</span></> : <>Pigskin <span className="xs:inline">Knowledge</span></>}
          </motion.h1>
        </div>

        <div className="flex shrink-0 gap-1 sm:gap-2 bg-[#1a1a1a] p-1 rounded-xl border border-[#3d3d3d]">
          {(['nba', 'nfl'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSport(s)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sports-font tracking-wider text-[10px] sm:text-xs transition-all ${
                sport === s
                  ? (s === 'nba' ? 'bg-[var(--nba-orange)]' : 'bg-[#013369]') + ' text-white shadow-lg'
                  : 'text-[#666] hover:text-[#888]'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex-1 flex justify-end items-center gap-1.5 md:gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/20 border border-white/5">
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${apiOnline ? 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]' : 'bg-[#888]'}`} />
            <span className="hidden xs:block text-[9px] md:text-[10px] text-[#666] sports-font uppercase tracking-tighter whitespace-nowrap">
              {apiOnline ? 'Live' : 'Offline'}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 md:p-2 border-2 border-[#3d3d3d] rounded-lg hover:bg-[#1a1a1a] transition-colors shrink-0"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5 text-[var(--vintage-cream)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Main / Roulette slide ── */}
      <motion.div
        animate={{ y: showRoulette ? '-100vh' : '0vh' }}
        transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
        className="flex-1 flex flex-col"
      >
        <main className="h-screen w-full flex-shrink-0 flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#111]">

          {/* Decorative background SVGs — always shown */}
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
                className="flex flex-col items-center gap-8 z-10"
              >
                <div className="text-center">
                  <h2 className="retro-title text-4xl sm:text-5xl text-[var(--vintage-cream)] uppercase tracking-tight">
                    Pick a Card
                  </h2>
                  <p className="sports-font text-xs text-[#555] tracking-[0.25em] mt-2 uppercase">
                    {sport === 'nba' ? 'NBA' : 'NFL'} · Click to deal
                  </p>
                </div>

                {/* Deck stack */}
                <motion.button
                  onClick={() => setIsDealt(true)}
                  whileHover={{ y: -8 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative focus:outline-none cursor-pointer"
                  style={{ width: 200, height: 280 }}
                >
                  {/* Offset shadow cards */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-[#d4af37]/25 bg-[#161616]"
                    style={{ transform: 'rotate(8deg) translate(10px, 10px)' }} />
                  <div className="absolute inset-0 rounded-2xl border-2 border-[#d4af37]/45 bg-[#181818]"
                    style={{ transform: 'rotate(4deg) translate(5px, 5px)' }} />
                  {/* Top card — SVG fills the full face */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-[#d4af37] overflow-hidden shadow-2xl">
                    <img
                      src={deckArt}
                      alt=""
                      className="absolute inset-0 w-full h-full"
                      style={{ objectFit: 'cover', objectPosition: 'center' }}
                    />
                    {/* Subtle gold tint overlay */}
                    <div className="absolute inset-0 bg-[#d4af37]/10" />
                    {/* Corner marks */}
                    <div className="absolute top-2.5 left-3 sports-font text-[10px] font-bold text-[#d4af37]/80 z-10 leading-none">BK</div>
                    <div className="absolute bottom-2.5 right-3 sports-font text-[10px] font-bold text-[#d4af37]/80 z-10 rotate-180 leading-none">BK</div>
                  </div>
                </motion.button>
              </motion.div>
            )}

            {/* ── Roster Royale setup ── */}
            {isDealt && selectedCard === 'roster' && (
              <motion.div
                key="roster-setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25 }}
                className="z-10 w-full max-w-md overflow-y-auto max-h-[calc(100vh-120px)]"
              >
                <div className="relative bg-[#141414] border-2 border-[#d4af37] rounded-2xl overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'repeating-linear-gradient(45deg, #d4af37 0, #d4af37 1px, transparent 0, transparent 50%)', backgroundSize: '14px 14px' }} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
                    <img src={deckArt} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
                  </div>

                  <div className="relative z-10 p-5 flex flex-col gap-4">
                    <div className="flex items-center">
                      <button onClick={() => { setSelectedCard(null); setLoadingStatus('idle'); }}
                        className="sports-font text-[10px] text-[#d4af37]/50 hover:text-[#d4af37]/90 tracking-widest uppercase transition">
                        ← Back
                      </button>
                      <div className="flex-1 text-center">
                        <div className="sports-font text-[9px] text-[#d4af37]/50 tracking-[0.3em] uppercase">RR</div>
                        <h2 className="retro-title text-2xl text-[#d4af37] leading-tight">Roster Royale</h2>
                        <p className="sports-font text-[9px] text-[#888] tracking-widest">{sport === 'nba' ? 'NBA' : 'NFL'} Edition</p>
                      </div>
                      <div className="w-12" />
                    </div>
                    <div className="border-t border-[#d4af37]/20" />

                    {loadingStatus === 'idle' ? (
                      <>
                        <div className="flex gap-2 justify-center">
                          {(['random', 'manual'] as const).map(m => (
                            <button key={m} onClick={() => setGameMode(m)}
                              className={`px-5 py-1.5 rounded-lg sports-font text-xs transition-all ${gameMode === m ? 'bg-[#d4af37] text-[#111]' : 'bg-[#1a1a1a] text-[#888] border border-[#3d3d3d]'}`}>
                              {m.charAt(0).toUpperCase() + m.slice(1)}
                            </button>
                          ))}
                        </div>

                        {gameMode === 'manual' ? (
                          <div className="flex flex-col gap-3">
                            <TeamSelector selectedTeam={selectedTeam} onSelect={setSelectedTeam} sport={sport} />
                            <YearSelector selectedYear={selectedYear} onSelect={setSelectedYear} minYear={2000} maxYear={2025} sport={sport} />
                          </div>
                        ) : (
                          <div className="bg-[#1a1a1a]/60 rounded-lg p-3 text-center border border-[#2a2a2a]">
                            <div className="sports-font text-[9px] text-[#888] mb-2 tracking-widest">Year Range</div>
                            <div className="flex items-center justify-center gap-2">
                              <select value={randomMinYear} onChange={e => setRandomMinYear(+e.target.value)} className="bg-[#111] text-[var(--vintage-cream)] px-2 py-1 rounded border border-[#3d3d3d] sports-font text-xs">
                                {Array.from({ length: 26 }, (_, i) => 2000 + i).map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                              <span className="text-[#666] sports-font text-xs">to</span>
                              <select value={randomMaxYear} onChange={e => setRandomMaxYear(+e.target.value)} className="bg-[#111] text-[var(--vintage-cream)] px-2 py-1 rounded border border-[#3d3d3d] sports-font text-xs">
                                {Array.from({ length: 26 }, (_, i) => 2000 + i).map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                            </div>
                          </div>
                        )}

                        <button onClick={() => setShowSettings(true)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1a1a1a]/60 border border-[#2a2a2a] rounded-lg hover:border-[#444] transition-colors group w-full">
                          <svg className="w-3.5 h-3.5 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="sports-font text-sm text-[var(--vintage-cream)]">
                            {Math.floor(timerDuration / 60)}:{String(timerDuration % 60).padStart(2, '0')}
                          </span>
                          <span className="text-[9px] text-[#555] sports-font tracking-wider">TIMER</span>
                          <svg className="w-3 h-3 text-[#555]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>

                        <div className="border-t border-[#d4af37]/20" />
                        <div className="flex flex-wrap gap-2 justify-center">
                          <button onClick={handleStartGame}
                            disabled={gameMode === 'manual' && (!selectedTeam || !selectedYear)}
                            className="retro-btn retro-btn-gold px-8 py-2.5 text-base disabled:opacity-50">
                            Start Solo
                          </button>
                          <button onClick={() => navigate('/lobby/create')}
                            className={`px-4 py-2.5 rounded-lg sports-font border text-xs transition-all ${sport === 'nba' ? 'border-[var(--nba-orange)] text-[var(--nba-orange)] hover:bg-[var(--nba-orange)] hover:text-white' : 'border-[#4a7fb5] text-[#4a7fb5] hover:bg-[#013369] hover:text-white'}`}>
                            Create Lobby
                          </button>
                          <button onClick={() => navigate('/lobby/join')}
                            className="px-4 py-2.5 rounded-lg sports-font border border-[#333] text-[#777] hover:border-[#555] text-xs">
                            Join Lobby
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-4 py-6">
                        <div className="w-8 h-8 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
                        <span className="sports-font text-sm text-[var(--vintage-cream)]">{statusMessage}</span>
                        {loadingStatus === 'error' && <button onClick={() => setLoadingStatus('idle')} className="text-xs underline text-red-500">Back</button>}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Career Arc setup ── */}
            {isDealt && selectedCard === 'career' && (
              <motion.div
                key="career-setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25 }}
                className="z-10 w-full max-w-sm"
              >
                <div className="relative bg-[#141414] border-2 border-[#22c55e] rounded-2xl overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'repeating-linear-gradient(45deg, #22c55e 0, #22c55e 1px, transparent 0, transparent 50%)', backgroundSize: '14px 14px' }} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
                    <img src={sportArtB} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
                  </div>

                  <div className="relative z-10 p-5 flex flex-col gap-4">
                    <div className="flex items-center">
                      <button onClick={() => setSelectedCard(null)}
                        className="sports-font text-[10px] text-[#22c55e]/50 hover:text-[#22c55e]/90 tracking-widest uppercase transition">
                        ← Back
                      </button>
                      <div className="flex-1 text-center">
                        <div className="sports-font text-[9px] text-[#22c55e]/50 tracking-[0.3em] uppercase">CA</div>
                        <h2 className="retro-title text-2xl text-[#22c55e] leading-tight">Career Arc</h2>
                        <p className="sports-font text-[9px] text-[#888] tracking-widest">{sport === 'nba' ? 'NBA' : 'NFL'} Edition</p>
                      </div>
                      <div className="w-12" />
                    </div>
                    <div className="border-t border-[#22c55e]/20" />

                    <div className="flex flex-col gap-2">
                      <div className="sports-font text-[9px] text-[#888] tracking-[0.25em] uppercase text-center">
                        Player must be active into
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([null, 2010, 2015, 2018, 2020, 2022] as (number | null)[]).map(yr => (
                          <button key={yr ?? 'any'} onClick={() => setCareerActiveYear(yr)}
                            className={`py-1.5 rounded-lg sports-font text-[10px] tracking-wider uppercase border transition-all ${
                              careerActiveYear === yr
                                ? 'bg-[#22c55e] text-[#111] border-[#22c55e]'
                                : 'border-[#2a2a2a] text-[#666] hover:border-[#22c55e]/40 hover:text-[#888]'
                            }`}>
                            {yr == null ? 'Any era' : `${yr}+`}
                          </button>
                        ))}
                      </div>
                      {careerActiveYear && (
                        <p className="sports-font text-[9px] text-[#555] text-center">
                          Players who played in {careerActiveYear} or later
                        </p>
                      )}
                    </div>

                    <div className="border-t border-[#22c55e]/20" />
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => navigate('/career', { state: careerActiveYear ? { careerTo: careerActiveYear } : null })}
                        className="px-8 py-2.5 rounded-lg sports-font text-xs tracking-wider uppercase border-2 border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-[#111] transition-all">
                        Start Solo
                      </button>
                      <button onClick={() => navigate('/lobby/create')}
                        className="px-4 py-2.5 rounded-lg sports-font border border-[#333] text-[#777] hover:border-[#555] text-xs">
                        Lobby
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Fan arc (dealt, no sub-panel open) ── */}
            {isDealt && selectedCard === null && (
              <motion.div
                key="fan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center gap-6 z-10 w-full"
              >
                {/* Fan container — cards are absolutely positioned relative to this */}
                <div
                  className="relative flex justify-center items-end w-full"
                  style={{ height: 360, overflow: 'visible' }}
                  onClick={() => setTappedCard(null)}
                >
                  {GAMES.map((game, i) => {
                    const fp = FAN_POSITIONS[i];
                    const isActive = hoveredCard === game.id || tappedCard === game.id;

                    return (
                      <motion.div
                        key={game.id}
                        // Initial deal: cards fly in from above with stagger
                        initial={{ x: fp.x, y: -380, rotate: (i - 2) * 14, opacity: 0 }}
                        animate={{ x: fp.x, y: isActive ? fp.y - 100 : fp.y, rotate: isActive ? 0 : fp.rotate, scale: isActive ? 1.08 : 1, opacity: 1 }}
                        // Hover: pop up, straighten, slight scale
                        whileHover={{ y: fp.y - 100, rotate: 0, scale: 1.08, transition: { type: 'spring', stiffness: 380, damping: 28 } }}
                        transition={{ delay: i * 0.09, type: 'spring', stiffness: 220, damping: 26 }}
                        onHoverStart={() => setHoveredCardDebounced(game.id)}
                        onHoverEnd={() => setHoveredCardDebounced(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTappedCard(prev => prev === game.id ? null : game.id);
                        }}
                        className="absolute bottom-0 cursor-pointer"
                        style={{ width: 165, height: 235, zIndex: isActive ? 20 : i + 1 }}
                      >
                        {/* Card face — sport art full bleed with game color border */}
                        <div className="w-full h-full rounded-xl border-2 overflow-hidden relative shadow-xl bg-[#0e0e0e]"
                          style={{ borderColor: game.color }}>
                          <img
                            src={deckArt}
                            alt=""
                            className="absolute inset-0 w-full h-full"
                            style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.8 }}
                          />
                          {/* Subtle dark overlay so corners are readable */}
                          <div className="absolute inset-0 bg-black/20" />
                          {/* Corner abbr */}
                          <div className="absolute top-2 left-2.5 sports-font text-[11px] font-bold leading-none z-10" style={{ color: game.color, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                            {game.abbr}
                          </div>
                          <div className="absolute bottom-2 right-2.5 rotate-180 sports-font text-[11px] font-bold leading-none z-10" style={{ color: `${game.color}80`, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                            {game.abbr}
                          </div>

                          {/* Hover / tap info panel — slides up from bottom */}
                          <AnimatePresence>
                            {isActive && (
                              <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                className="absolute inset-0 flex flex-col justify-end p-2.5"
                                style={{ background: 'linear-gradient(to top, rgba(14,14,14,0.97) 60%, rgba(14,14,14,0.7) 100%)' }}
                              >
                                <h3 className="retro-title text-base leading-tight" style={{ color: game.color }}>
                                  {game.name}
                                </h3>
                                <p className="sports-font text-[9px] text-[#888] mt-1 leading-snug">
                                  {game.tagline}
                                </p>
                                <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                                  {game.hasSolo && (
                                    <button
                                      onClick={() => {
                                        if (game.id === 'roster' || game.id === 'career') {
                                          setSelectedCard(game.id);
                                          setTappedCard(null);
                                        } else if (game.soloPath) {
                                          navigate(game.soloPath);
                                        }
                                      }}
                                      className="flex-1 py-1.5 rounded sports-font text-[9px] tracking-wider uppercase border hover:opacity-70 transition-opacity"
                                      style={{ borderColor: game.color, color: game.color }}
                                    >
                                      Solo
                                    </button>
                                  )}
                                  <button
                                    onClick={() => navigate(game.multiPath ?? '/lobby/create')}
                                    className="flex-1 py-1.5 rounded sports-font text-[9px] tracking-wider uppercase border border-[#444] text-[#999] hover:border-[#666] hover:text-[#ccc] transition-colors"
                                  >
                                    {game.hasSolo ? 'Lobby' : 'Play'}
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <button
                  onClick={() => navigate('/lobby/join')}
                  className="sports-font text-[10px] text-[#444] hover:text-[#777] tracking-widest uppercase transition z-10"
                >
                  Join existing lobby →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Roulette section */}
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
                setGameConfig(preparedGameData.sport, preparedGameData.team, preparedGameData.season, preparedGameData.gameMode, preparedGameData.timerDuration, preparedGameData.players, preparedGameData.leaguePlayers, preparedGameData.hideResultsDuringGame);
                navigate('/game');
              }}
            />
          )}
        </section>
      </motion.div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showWarmup && <ServerWarmup sport={sport} onReady={handleWarmupReady} onSkip={handleWarmupSkip} />}
    </div>
  );
}
