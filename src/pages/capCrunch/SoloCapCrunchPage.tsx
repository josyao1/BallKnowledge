/**
 * SoloLineupIsRightPage.tsx — Solo "Lineup Is Right" gameplay.
 *
 * Single-player mode where each turn:
 * 1. A random team is assigned
 * 2. Player searches for and selects a player
 * 3. Player selects a year they were on that team
 * 4. Player's stat value is awarded (0 if not on team that year)
 * 5. Goal: reach a target cap without exceeding it
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { SpinningNumber, getTotalColor, getRemainingColor } from '../../components/capCrunch/SpinningNumber';
import { FlipReveal } from '../../components/capCrunch/FlipReveal';
import { PlayerHeadshot } from '../../components/capCrunch/PlayerHeadshot';
import { TeamSlotMachine } from '../../components/capCrunch/TeamSlotMachine';
import { ConferenceRoundCard } from '../../components/capCrunch/ConferenceRoundCard';
import { DivisionDraftRoundCard } from '../../components/capCrunch/DivisionDraftRoundCard';
import { fmt, getCategoryAbbr, getPickErrorMessage, getPickBadgeLabel } from '../../components/capCrunch/capCrunchUtils';
import {
  selectRandomStatCategory,
  selectRandomHWFilter,
  generateTargetCap,
  searchPlayersByNameOnly,
  getPlayerYearsOnTeam,
  resolvePickResult,
  assignRandomTeam,
  isDivisionRound,
  isConferenceRound,
  parseConferenceRound,
  isDivisionDraftRound,
  parseDivisionDraftRound,
  NFL_DIVISIONS,
  findOptimalLastPick,
  isCareerStat,
  isHWFilter,
  formatHeightInches,
  classifySpecialRoundType,
  advanceSpecialRoundCycle,
} from '../../services/capCrunch';
import { HEIGHT_THRESHOLD_NBA, HEIGHT_THRESHOLD_NFL, WEIGHT_THRESHOLD } from '../../services/capCrunchData';
import type { OptimalPick, HWFilter, SpecialRoundType } from '../../services/capCrunch';
import type { Sport } from '../../types';
import type { PlayerLineup, StatCategory } from '../../types/capCrunch';

type Phase = 'sport-select' | 'playing' | 'results';

function draftLabel(code: string): string {
  if (code === 'R1')  return '1st Round';
  if (code === 'R2')  return '2nd Round';
  if (code === 'R23') return '2nd–3rd Round';
  if (code === 'R47') return '4th–7th Round';
  return code;
}

function formatPickTeam(team: string): string {
  if (isDivisionDraftRound(team)) {
    const { division, draftRound } = parseDivisionDraftRound(team);
    return `${division} · ${draftLabel(draftRound)}`;
  }
  return team;
}




export function SoloCapCrunchPage() {
  const navigate = useNavigate();

  // Setup
  const [phase, setPhase] = useState<Phase>('sport-select');
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [totalRounds, setTotalRounds] = useState(5);

  // Game state
  const [statCategory, setStatCategory] = useState<StatCategory | null>(null);
  const [hwFilter, setHwFilter] = useState<HWFilter | null>(null);
  const [usedSpecialTypes, setUsedSpecialTypes] = useState<SpecialRoundType[]>([]);
  const [targetCap, setTargetCap] = useState<number>(0);
  const [lineup, setLineup] = useState<PlayerLineup | null>(null);
  const [currentTeam, setCurrentTeam] = useState<string>('');

  // Results hint
  const [optimalPick, setOptimalPick] = useState<OptimalPick | null | undefined>(undefined);

  // Track teams used this game to avoid repeats
  const usedTeamsRef = useRef<string[]>([]);

  // Playing phase state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ playerId: string | number; playerName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | number | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [loadingYears, setLoadingYears] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [showExactHit, setShowExactHit] = useState(false);
  const [badFlashKey, setBadFlashKey] = useState(0);
  const exactHitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // True once the restore-from-storage effect has finished, so the persist effect
  // doesn't wipe sessionStorage before we've had a chance to read it back.
  const restoredRef = useRef(false);

  useEffect(() => {
    return () => {
      if (exactHitTimerRef.current !== null) clearTimeout(exactHitTimerRef.current);
      confettiTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Restore game state from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('soloCapCrunch');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.phase && s.phase !== 'sport-select') {
          setPhase(s.phase);
          setSelectedSport(s.selectedSport);
          setTotalRounds(s.totalRounds ?? 5);
          setStatCategory(s.statCategory);
          setHwFilter(s.hwFilter ?? null);
          setUsedSpecialTypes(s.usedSpecialTypes ?? []);
          setTargetCap(s.targetCap);
          setCurrentTeam(s.currentTeam);
          setLineup(s.lineup);
          usedTeamsRef.current = s.usedTeams ?? [];
        }
      } catch { /* ignore corrupt data */ }
    }
    restoredRef.current = true;
  }, []);

  // Persist game state to sessionStorage whenever it changes.
  // Skip until the restore effect above has run to avoid wiping a valid save on mount.
  useEffect(() => {
    if (!restoredRef.current) return;
    if (phase === 'sport-select') {
      sessionStorage.removeItem('soloCapCrunch');
      return;
    }
    sessionStorage.setItem('soloCapCrunch', JSON.stringify({
      phase, selectedSport, totalRounds, statCategory, hwFilter, usedSpecialTypes, targetCap, currentTeam, lineup,
      usedTeams: usedTeamsRef.current,
    }));
  }, [phase, selectedSport, totalRounds, statCategory, hwFilter, usedSpecialTypes, targetCap, currentTeam, lineup]);

  // Initialize game
  const handleStartGame = async (sport: Sport, forcedCategory?: StatCategory | null, rounds: number = totalRounds) => {
    setSelectedSport(sport);
    setTotalRounds(rounds);
    const category = forcedCategory ?? selectRandomStatCategory(sport);
    const cap = generateTargetCap(sport, category);
    const freshUsed: SpecialRoundType[] = []; // reset cycle on new game
    const team = assignRandomTeam(sport, category, undefined, freshUsed);
    const filter = selectRandomHWFilter(sport, team, category, freshUsed);
    const initialUsed = advanceSpecialRoundCycle(freshUsed, classifySpecialRoundType(team, filter));
    usedTeamsRef.current = [team];

    setStatCategory(category);
    setHwFilter(filter);
    setUsedSpecialTypes(initialUsed);
    setTargetCap(cap);
    setCurrentTeam(team);
    setLineup({
      playerId: 'solo',
      playerName: 'You',
      selectedPlayers: [],
      totalStat: 0,
      bustCount: 0,
      isFinished: false,
    });
    setPhase('playing');
  };

  // Search for players
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!selectedSport || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchPlayersByNameOnly(selectedSport, query, statCategory ?? undefined);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setPickError('Player search failed — please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const isTotalGP = statCategory === 'total_gp';
  const isCareerStatRound = statCategory ? isCareerStat(statCategory) : false;
  const isNoYearSelect = isTotalGP || isCareerStatRound;

  // Select a player from search results
  const handleSelectPlayer = async (player: { playerId: string | number; playerName: string }) => {
    setSelectedPlayerName(player.playerName);
    setSelectedPlayerId(player.playerId);
    setSelectedYear('');
    setAvailableYears([]);


    // total_gp and career stat modes: no year needed — go straight to confirm
    if (isNoYearSelect) return;

    // Get years this player was on the current team
    setLoadingYears(true);
    try {
      const years = await getPlayerYearsOnTeam(
        selectedSport!,
        player.playerName,
        currentTeam,
        player.playerId
      );
      setAvailableYears(years);
    } catch (error) {
      console.error('Error getting years:', error);
      setAvailableYears([]);
    } finally {
      setLoadingYears(false);
    }
  };

  // Confirm year selection (or career GP) and add player to lineup
  const handleConfirmYear = async () => {
    if (!selectedPlayerName || !lineup || !selectedSport || !statCategory) return;
    if (!isNoYearSelect && !selectedYear) return;

    setAddingPlayer(true);
    try {
      const { selectedPlayer: newSelectedPlayer, updatedLineup: updated } = await resolvePickResult({
        sport: selectedSport,
        playerName: selectedPlayerName,
        playerId: selectedPlayerId ?? undefined,
        team: currentTeam,
        year: selectedYear,
        statCategory,
        hwFilter,
        lineup,
        targetCap,
      });

      setLineup(updated);

      if (newSelectedPlayer.isBust || newSelectedPlayer.statValue === 0) setBadFlashKey(k => k + 1);

      // Exact hit — celebrate and end game early
      if (!newSelectedPlayer.isBust && updated.totalStat === targetCap) {
        updated.isFinished = true;
        setLineup(updated);
        setShowExactHit(true);
        // Confetti burst
        confetti({ particleCount: 160, spread: 90, origin: { y: 0.55 }, colors: ['#d4af37', '#f5e6c8', '#ffffff', '#facc15', '#fbbf24'] });
        confettiTimersRef.current = [
          setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.4, x: 0.3 }, colors: ['#d4af37', '#ffffff'] }), 250),
          setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.4, x: 0.7 }, colors: ['#d4af37', '#ffffff'] }), 400),
        ];
        exactHitTimerRef.current = setTimeout(() => {
          setShowExactHit(false);
          setPhase('results');
        }, 2500);
        return;
      }

      // Always play all picks — no early game-over on bust
      if (updated.selectedPlayers.length === totalRounds) {
        updated.isFinished = true;
        setPhase('results');
      } else {
        // Switch team for next turn — no repeats; advance special round cycle
        const nextTeam = assignRandomTeam(selectedSport, statCategory, usedTeamsRef.current, usedSpecialTypes);
        const nextFilter = selectRandomHWFilter(selectedSport, nextTeam, statCategory, usedSpecialTypes);
        const nextUsed = advanceSpecialRoundCycle(usedSpecialTypes, classifySpecialRoundType(nextTeam, nextFilter));
        usedTeamsRef.current = [...usedTeamsRef.current, nextTeam];
        setCurrentTeam(nextTeam);
        setHwFilter(nextFilter);
        setUsedSpecialTypes(nextUsed);

        // Clear search
        setSearchQuery('');
        setSearchResults([]);
        setSelectedPlayerName(null);
        setSelectedPlayerId(null);
        setSelectedYear('');
        setAvailableYears([]);
    
      }
    } catch (error) {
      console.error('Error adding player:', error);
      setPickError('Something went wrong adding that player. Please try again.');
    } finally {
      setAddingPlayer(false);
    }
  };

  // Compute optimal last pick hint when results phase is reached
  useEffect(() => {
    if (phase !== 'results' || !lineup || !statCategory || !selectedSport) return;
    const picks = lineup.selectedPlayers;
    if (picks.length === 0) return;
    const lastPick = picks[picks.length - 1];
    // For bust picks, the total was reverted so totalBeforeLast == lineup.totalStat
    const totalBeforeLast = lastPick.isBust
      ? lineup.totalStat
      : parseFloat((lineup.totalStat - lastPick.statValue).toFixed(1));
    const remainingBudget = parseFloat((targetCap - totalBeforeLast).toFixed(1));
    setOptimalPick(undefined); // reset to loading
    findOptimalLastPick(selectedSport, lastPick.team, statCategory, remainingBudget, lastPick.isBust ? 0 : lastPick.statValue)
      .then(result => setOptimalPick(result ?? null))
      .catch(() => setOptimalPick(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === 'sport-select') {
    return (
      <div className="min-h-screen bg-[#0d2a0b] text-white flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`, background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }} />
        
        <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="retro-title text-2xl text-[#d4af37]">Cap Crunch</div>
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white/70 font-semibold rounded transition border border-white/20 hover:border-white/40">Back</button>
          </div>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {!selectedSport ? (
              <>
                <h2 className="retro-title text-5xl md:text-6xl mb-12 text-white uppercase">Select Sport</h2>
                <div className="flex flex-col gap-4 w-96">
                  <button
                    onClick={() => setSelectedSport('nba')}
                    className="px-8 py-6 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] hover:from-[#fef3e0] hover:to-[#e5d4b0] text-black font-bold rounded-sm transition shadow-[0_4px_0_#a89860] active:translate-y-1 active:shadow-none text-2xl retro-title"
                  >
                    NBA
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => setSelectedSport('nfl')}
                      className="w-full px-8 py-6 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] hover:from-[#fef3e0] hover:to-[#e5d4b0] text-black font-bold rounded-sm transition shadow-[0_4px_0_#a89860] active:translate-y-1 active:shadow-none text-2xl retro-title"
                    >
                      NFL
                    </button>
                    <p className="text-white/30 text-[10px] sports-font tracking-widest">DATA THROUGH 2025 SEASON</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="retro-title text-5xl md:text-6xl mb-3 text-white uppercase">{selectedSport.toUpperCase()}</h2>
                <p className="sports-font text-[10px] text-white/50 tracking-widest mb-6">CHOOSE STAT CATEGORY</p>
                <div className="flex flex-col items-center gap-4 w-full max-w-sm mb-4">
                  {/* Random + regular stats */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => handleStartGame(selectedSport, null, totalRounds)}
                      className="px-4 py-2 rounded-sm sports-font text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                    >
                      RANDOM
                    </button>
                    {(selectedSport === 'nba'
                      ? (['pts', 'ast', 'reb', 'min', 'pra', 'total_gp', 'total_pts', 'total_reb', 'total_ast', 'total_blk', 'total_3pm', 'total_ftm', 'total_pf'] as const)
                      : (['passing_yards', 'passing_tds', 'interceptions', 'rushing_yards', 'rushing_tds', 'receiving_yards', 'receiving_tds', 'receptions', 'fpts', 'total_gp'] as const)
                    ).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => handleStartGame(selectedSport, cat, totalRounds)}
                        className="px-4 py-2 rounded-sm sports-font text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                      >
                        {getCategoryAbbr(cat)}
                      </button>
                    ))}
                  </div>
                  {/* Career Totals section (NFL only) */}
                  {selectedSport === 'nfl' && (
                    <div className="w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="sports-font text-[9px] text-white/40 tracking-[0.3em] uppercase">Career Totals</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button
                          onClick={() => {
                            const careerCats = ['career_passing_yards', 'career_passing_tds', 'career_rushing_yards', 'career_rushing_tds', 'career_receiving_yards', 'career_receiving_tds'] as const;
                            handleStartGame(selectedSport, careerCats[Math.floor(Math.random() * careerCats.length)], totalRounds);
                          }}
                          className="px-4 py-2 rounded-sm sports-font text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                        >
                          RANDOM
                        </button>
                        {(['career_passing_yards', 'career_passing_tds', 'career_rushing_yards', 'career_rushing_tds', 'career_receiving_yards', 'career_receiving_tds'] as const).map((cat) => (
                          <button
                            key={cat}
                            onClick={() => handleStartGame(selectedSport, cat, totalRounds)}
                            className="px-4 py-2 rounded-sm sports-font text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                          >
                            {getCategoryAbbr(cat)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Round count selector */}
                <div className="flex items-center gap-3 justify-center mt-2 mb-6">
                  <span className="sports-font text-[10px] text-white/50 tracking-widest">ROUNDS</span>
                  <div className="flex gap-1">
                    {[3,4,5,6,7,8,9,10].map(n => (
                      <button
                        key={n}
                        onClick={() => setTotalRounds(n)}
                        className={`w-7 h-7 rounded-sm sports-font text-xs transition ${
                          totalRounds === n
                            ? 'bg-[#d4af37] text-black font-bold'
                            : 'bg-black/50 border border-white/20 text-white/50 hover:text-white hover:border-white/40'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSport(null)}
                  className="sports-font text-[10px] text-white/40 hover:text-white/70 transition tracking-widest"
                >
                  ← BACK TO SPORTS
                </button>
              </>
            )}
          </motion.div>

          {/* Rules Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#111] border border-white/10 rounded-sm p-6 max-w-lg shadow-xl"
          >
            <h3 className="retro-title text-lg text-[#d4af37] mb-3">How to Play</h3>
            <ul className="text-sm text-white/80 space-y-2.5 text-left">
              <li><span className="text-[#d4af37] font-bold">Goal:</span> Build a lineup whose combined stat reaches — but doesn't exceed — the target cap</li>
              <li><span className="text-[#d4af37] font-bold">Each pick:</span> A random team is shown. Search <em>any</em> player by name and choose a year they were active</li>
              <li><span className="text-emerald-400 font-bold">Hit:</span> Player was on that team that year → their stat adds to your total</li>
              <li><span className="text-red-400 font-bold">Miss:</span> Player wasn't on that team that year → you get 0 for that pick</li>
              <li><span className="text-white font-bold">{totalRounds} picks max.</span> If a pick pushes you over the cap it <span className="text-red-400 font-bold">busts</span> — that pick counts as 0 and your score reverts. You always play all {totalRounds} picks!</li>
              <li><span className="text-[#d4af37] font-bold">Tiebreaker:</span> Fewest busts wins; then oldest average pick year</li>
            </ul>
          </motion.div>
        </main>
      </div>
    );
  }

  if (phase === 'playing' && lineup && selectedSport && statCategory) {
    return (
      <motion.div
        animate={showExactHit ? { x: [0, -10, 10, -7, 7, -4, 4, 0] } : {}}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className="min-h-screen bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden"
      >
        {/* GREEN FELT BACKGROUND */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
            background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)`
          }}
        />

        {/* EXACT HIT CELEBRATION OVERLAY */}
        {showExactHit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.35) 0%, rgba(0,0,0,0.9) 100%)' }}
          >
            {/* Radiating rings */}
            {[0, 0.25, 0.5].map((delay, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-[#d4af37]/70 pointer-events-none"
                style={{ width: 160, height: 160, marginLeft: -80, marginTop: -80, left: '50%', top: '50%' }}
                initial={{ scale: 0.4, opacity: 0.9 }}
                animate={{ scale: 5, opacity: 0 }}
                transition={{ duration: 1.4, ease: 'easeOut', delay }}
              />
            ))}
            {/* Text content */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.05 }}
              className="text-center relative z-10"
            >
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 0.6, delay: 0.5, repeat: 2, ease: 'easeInOut' }}
                className="retro-title text-6xl md:text-8xl text-[#d4af37] mb-2"
                style={{ textShadow: '0 0 40px #d4af37, 0 0 100px #d4af37bb' }}
              >
                EXACT!
              </motion.div>
              <div className="sports-font text-xl md:text-2xl text-white tracking-widest uppercase mb-1">Perfect score</div>
              <div className="retro-title text-3xl md:text-4xl text-[#d4af37]">{targetCap}</div>
            </motion.div>
          </motion.div>
        )}

        <header className="relative z-10 bg-black/60 border-b-2 border-white/10 backdrop-blur-sm">
          <div className="px-4 py-2 flex items-center justify-between border-b border-white/5">
            <button
              onClick={() => {
                if (addingPlayer) return;
                setPhase('sport-select');
                setLineup(null);
                setStatCategory(null);
                setSelectedPlayerName(null);
                setSelectedPlayerId(null);
                setSearchQuery('');
                setSearchResults([]);
                setSelectedYear('');
                setAvailableYears([]);
                setPickError(null);
                usedTeamsRef.current = [];
              }}
              className="sports-font text-[10px] text-white/40 hover:text-white/70 tracking-widest uppercase transition"
            >
              ← Back
            </button>
            <h1 className="retro-title text-2xl text-[#d4af37]">Cap Crunch</h1>
            <div className="w-16" />
          </div>
          {/* Team / Division / Conference Display */}
          <div className="flex items-center justify-center py-3 px-4">
            {isDivisionDraftRound(currentTeam) ? (() => {
              const { division, draftRound } = parseDivisionDraftRound(currentTeam);
              return (
                <motion.div
                  key={currentTeam}
                  initial={{ opacity: 0, rotateY: -90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                  style={{ perspective: 600 }}
                >
                  <DivisionDraftRoundCard division={division} draftRound={draftRound} sport={selectedSport!} size="lg" />
                </motion.div>
              );
            })() : isConferenceRound(currentTeam) ? (() => {
              const { college: confName, nflConf } = parseConferenceRound(currentTeam);
              return (
              <motion.div
                key={currentTeam}
                initial={{ opacity: 0, rotateY: -90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                style={{ perspective: 600 }}
              >
                <ConferenceRoundCard confName={confName} nflConf={nflConf} size="lg" />
              </motion.div>
              );
            })() : isDivisionRound(currentTeam) ? (
              <motion.div
                key={currentTeam}
                initial={{ opacity: 0, rotateY: -90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 90 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                style={{ perspective: 600 }}
                className="text-center px-8 md:px-12 py-2 md:py-3 rounded-lg border-2 bg-black border-[#d4af37]/60"
              >
                <p className="sports-font text-[8px] md:text-[10px] text-white/60 tracking-[0.4em] uppercase mb-1">Division</p>
                <p className="retro-title text-2xl md:text-4xl font-bold tracking-tight text-[#d4af37]">
                  {currentTeam}
                </p>
                <p className="sports-font text-[9px] text-white/35 mt-1">
                  {(NFL_DIVISIONS[currentTeam] ?? []).join(' · ')}
                </p>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <TeamSlotMachine sport={selectedSport!} team={currentTeam} size="lg" />
                {isHWFilter(hwFilter) && (
                  <div className="px-3 py-1 rounded border border-[#d4af37]/40 bg-[#d4af37]/10 text-[#d4af37] sports-font text-[9px] md:text-[10px] tracking-widest uppercase">
                    {hwFilter === 'height_above' ? `Above ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)}`
                    : hwFilter === 'height_below' ? `Below ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)}`
                    : hwFilter === 'weight_above' ? `Above ${WEIGHT_THRESHOLD} lbs`
                    : `Below ${WEIGHT_THRESHOLD} lbs`}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Mobile cap progress strip */}
          <div className="lg:hidden w-full h-1 bg-white/10">
            <motion.div
              className="h-full"
              animate={{
                width: `${Math.min((lineup.totalStat / targetCap) * 100, 100)}%`,
                backgroundColor: getTotalColor(lineup.totalStat, targetCap),
              }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </header>

        <main className="relative z-10 flex-1 w-full px-2 md:px-6 py-2 md:py-4 flex flex-col lg:flex-row gap-2 md:gap-4 overflow-hidden">
          {/* Left Column - Stats */}
          <div className="w-full sm:w-1/3 lg:w-40 lg:flex-shrink-0 flex flex-row lg:flex-col gap-2 md:gap-3">
            <div className="flex-1 sm:flex-none bg-[#111] border border-white/5 px-3 md:px-6 py-3 md:py-6 rounded-sm text-center shadow-xl">
              <div className="sports-font text-[6px] md:text-[8px] text-white/30 tracking-widest uppercase mb-1 md:mb-2">Target</div>
              <p className="retro-title text-2xl md:text-4xl text-white">{targetCap}</p>
            </div>
            <div className="flex-1 sm:flex-none bg-[#111] border border-white/5 px-3 md:px-6 py-3 md:py-6 rounded-sm text-center shadow-xl">
              <div className="sports-font text-[6px] md:text-[8px] text-white/30 tracking-widest uppercase mb-1 md:mb-2">{isCareerStatRound ? 'Career' : 'Category'}</div>
              <p className="retro-title text-lg md:text-2xl text-white">
                {isCareerStatRound ? getCategoryAbbr(statCategory!).replace('CAREER ', '') : getCategoryAbbr(statCategory!)}
              </p>
            </div>
            <div className="flex-1 sm:flex-none bg-[#111] border border-white/5 px-3 md:px-6 py-3 md:py-6 rounded-sm text-center shadow-xl">
              <div className="sports-font text-[6px] md:text-[8px] text-white/30 tracking-widest uppercase mb-1">Total</div>
              <SpinningNumber
                value={fmt(lineup.totalStat)}
                className="retro-title text-2xl md:text-4xl"
                color={getTotalColor(lineup.totalStat, targetCap)}
                flashKey={badFlashKey}
              />
              <div className="mt-2 md:mt-3 border-t border-white/10 pt-2 md:pt-3">
                <div className="sports-font text-[6px] md:text-[8px] text-[#d4af37]/50 tracking-widest uppercase mb-0.5">Remaining</div>
                <SpinningNumber
                  value={fmt(targetCap - lineup.totalStat)}
                  className="retro-title text-xl md:text-3xl"
                  color={getRemainingColor(lineup.totalStat, targetCap)}
                  flashKey={badFlashKey}
                />
              </div>
              {(lineup.bustCount ?? 0) > 0 && (
                <p className="sports-font text-[7px] text-red-400/70 tracking-wide mt-1 uppercase">{lineup.bustCount} Bust{lineup.bustCount !== 1 ? 's' : ''}</p>
              )}
            </div>

            {/* Cap fill bar — desktop only; mobile uses the strip in the header */}
            <div className="hidden lg:block bg-[#111] border border-white/5 px-3 py-2 rounded-sm shadow-xl">
              <div className="sports-font text-[6px] text-white/30 tracking-widest uppercase mb-1.5">Cap</div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  animate={{
                    width: `${Math.min((lineup.totalStat / targetCap) * 100, 100)}%`,
                    backgroundColor: getTotalColor(lineup.totalStat, targetCap),
                  }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="sports-font text-[6px] text-white/20">0</span>
                <span className="sports-font text-[6px] text-white/20">{targetCap}</span>
              </div>
            </div>
          </div>

          {/* Middle Column - Player Selection */}
          <div className="flex-1 flex flex-col min-h-0">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-black/60 border-2 border-white/10 rounded p-3 md:p-6 flex-1 flex flex-col min-h-0"
              >
                {!selectedPlayerName ? (
                  <div className="flex flex-col h-full">
                    <label className="block sports-font text-[8px] md:text-[10px] tracking-[0.4em] text-white/60 uppercase mb-2 md:mb-4 font-semibold">
                      Search for a player
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Enter player name..."
                      className="w-full px-2 md:px-4 py-2 md:py-3 bg-[#222] text-white rounded border border-white/10 focus:outline-none focus:border-white/30 mb-2 md:mb-4 text-xs md:text-base"
                    />

                    {loading && <p className="text-white/60 text-xs md:text-sm">Loading...</p>}
                    {!loading && searchQuery.length >= 2 && searchResults.length === 0 && (
                      <p className="text-white/30 text-[9px] sports-font mt-1">No results — player may be too recent, have limited stats, or try a different spelling.</p>
                    )}

                    {searchResults.length > 0 && (
                      <div className="space-y-1 md:space-y-2 overflow-y-auto flex-1 min-h-0">
                        {searchResults.map((result, idx) => (
                          <button
                            key={String(result.playerId) + idx}
                            onClick={() => handleSelectPlayer(result)}
                            className="w-full text-left px-2 md:px-4 py-1 md:py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded border border-white/10 transition text-white font-semibold text-xs md:text-base"
                          >
                            {result.playerName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : isNoYearSelect ? (
                  // ── Total GP / Career stat mode: no year needed ──
                  <div className="space-y-2 md:space-y-4 flex flex-col flex-1">
                    <div className="p-2 md:p-4 bg-[#1a1a1a] rounded border border-white/10">
                      <p className="retro-title text-xs md:text-lg text-white truncate">{selectedPlayerName}</p>
                      <p className="text-[10px] md:text-sm text-white/60">
                        {isCareerStatRound
                          ? `Total career stats (all teams) — must have played for ${currentTeam} at some point`
                          : `Will count all career GP with ${currentTeam}`}
                        {isHWFilter(hwFilter) && ` — ${hwFilter === 'height_above' ? `above ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)} tall` : hwFilter === 'height_below' ? `below ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)} tall` : hwFilter === 'weight_above' ? `above ${WEIGHT_THRESHOLD} lbs` : `below ${WEIGHT_THRESHOLD} lbs`}`}
                      </p>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-center">
                      <p className="text-white/30 sports-font text-xs leading-relaxed">
                        Games played across every season<br />this player was on the team
                      </p>
                    </div>
                    {pickError && <p className="text-red-400 text-xs mt-1">{pickError}</p>}
                    <div className="flex gap-1 md:gap-2">
                      <button
                        onClick={() => { setSelectedPlayerName(null); setSelectedPlayerId(null); setSelectedYear(''); setAvailableYears([]); }}
                        className="flex-1 px-2 md:px-4 py-1 md:py-2 bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] shadow-[0_2px_0_#1a1a1a] active:translate-y-1 active:shadow-none text-white/80 font-semibold rounded-sm transition text-xs md:text-base retro-title"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleConfirmYear}
                        disabled={addingPlayer}
                        className="flex-1 px-2 md:px-4 py-1 md:py-2 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] shadow-[0_2px_0_#a89860] active:translate-y-1 active:shadow-none disabled:opacity-50 text-black font-semibold rounded-sm transition text-xs md:text-base retro-title"
                      >
                        {addingPlayer ? 'Adding...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // ── Normal mode: pick a year ──
                  <div className="space-y-2 md:space-y-4 flex flex-col flex-1 overflow-hidden">
                    <div className="p-2 md:p-4 bg-[#1a1a1a] rounded border border-white/10">
                      <p className="retro-title text-xs md:text-lg text-white truncate">{selectedPlayerName}</p>
                      <p className="text-[10px] md:text-sm text-white/60">Select any year this player played</p>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-baseline justify-between mb-2 md:mb-3">
                        <label className="block sports-font text-[7px] md:text-[10px] tracking-[0.4em] text-white/60 uppercase font-semibold">
                          Select a year
                        </label>
                        {selectedSport === 'nfl' && !isCareerStatRound && (
                          <span className="text-white/25 text-[7px] sports-font tracking-wide">through 2025</span>
                        )}
                      </div>
                      {loadingYears ? (
                        <p className="text-white/60 text-xs md:text-sm">Loading years...</p>
                      ) : availableYears.length > 0 ? (
                        <div className="max-h-40 md:max-h-56 overflow-y-auto space-y-1 md:space-y-2">
                          {availableYears.map((year) => (
                            <button
                              key={year}
                              onClick={() => setSelectedYear(year)}
                              className={`w-full px-2 md:px-4 py-1 md:py-2 rounded border transition text-white font-semibold text-xs md:text-base ${
                                selectedYear === year
                                  ? 'bg-[#d4af37] text-black border-[#d4af37]'
                                  : 'bg-[#1a1a1a] border-white/10 hover:border-white/20'
                              }`}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-red-400 text-xs md:text-sm">No data found — player may be too recent, have limited stats, or try a different spelling.</p>
                      )}
                    </div>

                    {pickError && <p className="text-red-400 text-xs mt-1">{pickError}</p>}
                    <div className="flex gap-1 md:gap-2">
                      <button
                        onClick={() => {
                          setSelectedPlayerName(null);
                          setSelectedPlayerId(null);
                          setSelectedYear('');
                          setAvailableYears([]);
                        }}
                        className="flex-1 px-2 md:px-4 py-1 md:py-2 bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] shadow-[0_2px_0_#1a1a1a] active:translate-y-1 active:shadow-none text-white/80 font-semibold rounded-sm transition text-xs md:text-base retro-title"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleConfirmYear}
                        disabled={!selectedYear || addingPlayer}
                        className="flex-1 px-2 md:px-4 py-1 md:py-2 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] shadow-[0_2px_0_#a89860] active:translate-y-1 active:shadow-none disabled:opacity-50 text-black font-semibold rounded-sm transition text-xs md:text-base retro-title"
                      >
                        {addingPlayer ? 'Adding...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
          </div>

          {/* Sidebar - Lineup Preview */}
          <div className="w-full sm:w-1/3 lg:w-80 lg:flex-shrink-0 flex flex-col">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/60 border-2 border-white/10 rounded p-3 md:p-6 flex flex-col flex-1 overflow-hidden"
            >
                <h3 className="retro-title text-xs md:text-lg text-[#d4af37] mb-2 md:mb-4">Your Lineup</h3>
                <div className="space-y-1 md:space-y-2 flex-1 overflow-y-auto">
                  {Array.from({ length: totalRounds }).map((_, idx) => {
                    const pick = idx < lineup.selectedPlayers.length ? lineup.selectedPlayers[idx] : null;
                    const isBad = pick ? (pick.isBust || pick.neverOnTeam || pick.statValue === 0) : false;
                    return (
                      <motion.div
                        key={idx}
                        animate={isBad && pick ? { x: ['0%', '-8%', '8%', '-5%', '5%', '0%'] } : {}}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                        className={`px-2 md:px-3 py-1 md:py-2 rounded border text-[9px] md:text-xs leading-tight ${
                          pick
                            ? isBad
                              ? 'bg-red-900/40 border-red-500/60'
                              : 'bg-[#1a3a1a] border-[#4a7a4a]'
                            : 'bg-[#1a1a1a] border-dashed border-white/10'
                        }`}
                      >
                        <AnimatePresence mode="wait">
                          {pick ? (
                            <motion.div
                              key={pick.playerName}
                              initial={{ opacity: 0, x: -14 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              className={isBad ? 'text-red-300' : 'text-white'}
                            >
                              <div className="flex items-center gap-1">
                                <div className="relative shrink-0">
                                  <PlayerHeadshot playerId={pick.playerId} sport={selectedSport as 'nba' | 'nfl'} className={`w-5 h-5 rounded-full object-cover bg-white/5${isBad ? ' grayscale' : ''}`} />
                                  {isBad && <div className="absolute inset-0 rounded-full bg-red-500/30" />}
                                </div>
                                <p className="font-semibold truncate text-[9px] md:text-xs">
                                  {idx + 1}. <FlipReveal text={pick.playerName} />
                                </p>
                                {pick.isBust && <span className="text-[7px] bg-red-600 text-white px-1 rounded shrink-0">BUST</span>}
                              </div>
                              <p className={isBad ? 'text-red-400/70' : 'text-white/60'} style={{fontSize: '0.5rem'}}>
                                {formatPickTeam(pick.team)} • {pick.selectedYear}
                                {pick.neverOnTeam && (
                                  <span className="text-orange-400/80 ml-1">({getPickErrorMessage(pick)})</span>
                                )}
                              </p>
                              <p className={`font-semibold text-[9px] md:text-xs ${isBad ? 'text-red-400' : 'text-[#d4af37]'}`}>
                                {pick.isBust ? `${fmt(pick.statValue)} → 0` : `${fmt(pick.statValue)}`} {getCategoryAbbr(statCategory!)}
                              </p>
                            </motion.div>
                          ) : (
                            <motion.span
                              key={`empty-${idx}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-white/40 text-[9px] md:text-xs"
                            >
                              Slot {idx + 1}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>

                {(lineup.bustCount ?? 0) > 0 && (
                  <div className="mt-3 md:mt-4 p-2 md:p-3 bg-red-900/30 border border-red-500/40 rounded text-red-400 text-[8px] md:text-xs font-semibold text-center">
                    {lineup.bustCount} BUST{lineup.bustCount !== 1 ? 'S' : ''} — each counted as 0
                  </div>
                )}
            </motion.div>
          </div>
        </main>
      </motion.div>
    );
  }

  if (phase === 'results' && lineup && statCategory) {
    return (
      <div className="min-h-screen bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden p-4 md:p-6">
        {/* BACKGROUND FELT */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
            background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)`
          }}
        />

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10 flex flex-col h-full max-w-7xl mx-auto w-full"
        >
          {/* HEADER */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-2 border-white/10 pb-4 gap-4">
            <div>
              <div className="sports-font text-[8px] md:text-[10px] tracking-[0.4em] md:tracking-[0.6em] text-white/30 uppercase">Game Result</div>
              <h1 className="retro-title text-4xl md:text-6xl text-white uppercase leading-none">Lineup Score</h1>
            </div>
            <div className="flex flex-col items-start md:items-end w-full md:w-auto">
              <div className="bg-[#111] border border-white/20 px-4 py-1 shadow-[4px_4px_0px_rgba(0,0,0,0.5)] w-full md:w-auto text-center">
                <span className="retro-title text-xs md:text-sm tracking-widest text-white/80">
                  {getCategoryAbbr(statCategory)}
                </span>
              </div>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
            {/* LEFT COLUMN - Stats */}
            <div className="lg:w-1/3 flex flex-col gap-4">
              {/* STATS GRID - 2x2 */}
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                {[
                  { label: 'YOUR SCORE', value: fmt(lineup.totalStat), color: 'text-white' },
                  { label: 'TARGET CAP', value: String(targetCap), color: 'text-white' },
                  { label: 'AWAY', value: fmt(Math.abs(lineup.totalStat - targetCap)), color: lineup.totalStat === targetCap ? 'text-green-400' : 'text-white' },
                  { label: 'BUSTS', value: String(lineup.bustCount ?? 0), color: (lineup.bustCount ?? 0) > 0 ? 'text-red-400' : 'text-white' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#111] border border-white/5 p-3 md:p-4 rounded-sm shadow-xl relative overflow-hidden">
                    <div className="sports-font text-[7px] md:text-[8px] text-white/30 tracking-widest uppercase mb-1">{stat.label}</div>
                    <div className={`retro-title text-xl md:text-2xl ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* OPTIMAL LAST PICK HINT */}
              {optimalPick && lineup && lineup.selectedPlayers.length > 0 && (() => {
                const lastPick = lineup.selectedPlayers[lineup.selectedPlayers.length - 1];
                // For bust picks the total was already reverted, so don't subtract statValue again
                const totalBeforeLast = lastPick.isBust
                  ? lineup.totalStat
                  : parseFloat((lineup.totalStat - lastPick.statValue).toFixed(1));
                const wouldFinishAt = parseFloat((totalBeforeLast + optimalPick.statValue).toFixed(1));
                return (
                  <div className="bg-black/60 border border-[#d4af37]/30 rounded-sm p-3 md:p-4">
                    <div className="sports-font text-[8px] text-[#d4af37]/60 tracking-widest uppercase mb-2">Optimal Last Pick</div>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <PlayerHeadshot playerId={optimalPick.playerId} sport={selectedSport as 'nba' | 'nfl'} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <div className="overflow-hidden">
                        <div className="retro-title text-sm text-white truncate">{optimalPick.playerName}</div>
                        <div className="sports-font text-[9px] text-white/40 mt-0.5">
                          {optimalPick.year === 'career' ? (isCareerStatRound ? getCategoryAbbr(statCategory!) : 'Career GP') : optimalPick.year} · {optimalPick.team}
                          {optimalPick.college && (
                            <span className="text-[#3b82f6]/60 ml-1">· {optimalPick.college}</span>
                          )}
                          {optimalPick.draftRound && (
                            <span className="text-[#a855f7]/60 ml-1">· {optimalPick.draftRound}</span>
                          )}
                        </div>
                        <div className="sports-font text-[9px] text-white/30 mt-0.5">
                          vs your pick: {optimalPick.playerName !== lastPick.playerName ? lastPick.playerName : '—'} ({fmt(lastPick.statValue)})
                        </div>
                        <div className="sports-font text-[9px] text-emerald-400/70 mt-1">
                          Would finish: {fmt(wouldFinishAt)} / {targetCap}
                        </div>
                      </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="retro-title text-xl text-[#d4af37]">{fmt(optimalPick.statValue)}</div>
                        {optimalPick.statValue > lastPick.statValue && (
                          <div className="sports-font text-[8px] text-emerald-400/70">+{fmt(optimalPick.statValue - lastPick.statValue)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ACTION BUTTONS */}
              <div className="flex flex-col gap-2 md:gap-3">
                <button
                  onClick={() => {
                    setPhase('sport-select');
                    setLineup(null);
                    setSelectedSport(null);
                    setSearchQuery('');
                    setSearchResults([]);
                    setSelectedPlayerName(null);
                    setSelectedPlayerId(null);
                    setSelectedYear('');
                    setAvailableYears([]);
                  }}
                  className="group relative bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] py-3 md:py-4 rounded-sm shadow-[0_4px_0_#a89860] active:translate-y-1 active:shadow-none"
                >
                  <span className="relative z-10 retro-title text-base md:text-lg text-black uppercase tracking-widest">
                    Play Again
                  </span>
                </button>

                <button
                  onClick={() => navigate('/')}
                  className="group relative bg-[#1a1a1a] border border-white/20 py-2 md:py-3 rounded-sm hover:border-white/40 transition-colors"
                >
                  <span className="relative z-10 retro-title text-base md:text-lg text-white/70 uppercase tracking-widest">Exit Game</span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN - Lineup Detail */}
            <div className="lg:w-2/3 bg-black/70 border border-white/10 rounded-sm flex flex-col shadow-2xl overflow-hidden">
              <div className="p-3 md:p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                <span className="sports-font text-[9px] tracking-widest text-white/40 uppercase">Your Lineup</span>
                <span className="retro-title text-[9px] text-white/20 uppercase">{totalRounds} Slots</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 md:p-6 max-h-96 lg:max-h-none">
                <div className="space-y-2">
                {lineup.selectedPlayers.map((player, idx) => {
                  const isBust = player.isBust;
                  const isNotOnTeam = !isBust && player.neverOnTeam;
                  const isMiss = !isBust && !isNotOnTeam && player.statValue === 0;
                  const isInvalid = isBust || isMiss || isNotOnTeam;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.09, type: 'spring', stiffness: 340, damping: 28 }}
                      className={`relative p-3 md:p-4 border transition-all ${
                        isInvalid ? 'border-red-500/30' : 'border-white/20'
                      }`}
                      style={{
                        background: isInvalid
                          ? 'transparent'
                          : 'linear-gradient(135deg, #d4af3733 0%, #d4af3720 100%)'
                      }}
                    >
                      <div className="flex justify-between items-center relative z-10 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <PlayerHeadshot playerId={player.playerId} sport={selectedSport as 'nba' | 'nfl'} className={`w-8 h-8 md:w-10 md:h-10 rounded-full object-cover bg-white/5${isInvalid ? ' grayscale' : ''}`} />
                            {isInvalid && <div className="absolute inset-0 rounded-full bg-red-500/30" />}
                          </div>
                          <div className="overflow-hidden flex-1">
                          <div className={`sports-font text-[7px] md:text-[8px] ${isInvalid ? 'text-red-400/50' : 'text-white/50'}`}>
                            {selectedSport?.toUpperCase()} • {getCategoryAbbr(statCategory!)}
                          </div>
                          <div className={`retro-title text-sm md:text-base truncate ${isInvalid ? 'text-red-400' : 'text-white'}`}>
                            {player.playerName}
                          </div>
                          <div className={`text-xs ${isInvalid ? 'text-red-400/60' : 'text-white/60'}`}>
                            {formatPickTeam(player.team)} • {player.selectedYear}
                          </div>
                          {isBust && (
                            <div className="text-[9px] text-red-400/70 mt-0.5">Exceeded cap — scored 0, total reverted</div>
                          )}
                          {isNotOnTeam && (
                            <div className="text-[9px] text-orange-400/70 mt-0.5">
                              {getPickErrorMessage(player)}
                            </div>
                          )}
                        </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`retro-title text-lg md:text-xl ${isInvalid ? 'text-red-400' : 'text-[#d4af37]'}`}>
                            {isBust ? `${fmt(player.statValue)}→0` : fmt(player.statValue)}
                          </p>
                          {(isBust || isNotOnTeam || isMiss) && <div className="bg-red-700 text-white text-[7px] px-1.5 py-0.5 sports-font font-bold shadow-sm mt-1">{getPickBadgeLabel(player)}</div>}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {/* Cap contribution bar chart */}
              {lineup.selectedPlayers.length > 0 && (() => {
                const PICK_COLORS = ['#818cf8', '#34d399', '#fb923c', '#f472b6', '#60a5fa'];
                const validTotal = lineup.selectedPlayers
                  .filter(p => !p.isBust && !p.neverOnTeam)
                  .reduce((s, p) => s + p.statValue, 0);
                if (validTotal === 0) return null;
                return (
                  <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-white/5 pt-3">
                    <div className="sports-font text-[7px] text-white/25 tracking-widest uppercase mb-2">Cap usage</div>
                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden flex gap-px">
                      {lineup.selectedPlayers.map((p, i) => {
                        const pct = p.isBust || p.neverOnTeam ? 0 : Math.min((p.statValue / targetCap) * 100, 100);
                        return (
                          <motion.div
                            key={i}
                            className="h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: 0.3 + i * 0.1, duration: 0.45, ease: 'easeOut' }}
                            style={{ backgroundColor: PICK_COLORS[i % PICK_COLORS.length] }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                      {lineup.selectedPlayers.map((p, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: PICK_COLORS[i % PICK_COLORS.length], opacity: p.isBust || p.neverOnTeam ? 0.25 : 1 }} />
                          <span className="sports-font text-[8px] text-white/35 truncate max-w-[64px]">{p.playerName.split(' ').slice(-1)[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            </div>
          </main>
        </motion.div>
      </div>
    );
  }

  return null;
}
