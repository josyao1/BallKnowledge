/**
 * SoloCapCrunchPage.tsx — Solo Cap Crunch gameplay.
 *
 * Single-player mode where each turn:
 * 1. A random team is assigned
 * 2. Player searches for and selects a player
 * 3. Player selects a year they were on that team
 * 4. Player's stat value is awarded (0 if not on team that year)
 * 5. Goal: reach a target cap without exceeding it
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  SpinningNumber,
  getTotalColor,
  getRemainingColor,
} from '../../components/capCrunch/SpinningNumber';
import { FlipReveal } from '../../components/capCrunch/FlipReveal';
import { PlayerHeadshot } from '../../components/capCrunch/PlayerHeadshot';
import { TeamSlotMachine } from '../../components/capCrunch/TeamSlotMachine';
import { ConferenceRoundCard } from '../../components/capCrunch/ConferenceRoundCard';
import { DivisionDraftRoundCard } from '../../components/capCrunch/DivisionDraftRoundCard';
import { TeammateRoundCard } from '../../components/capCrunch/TeammateRoundCard';
import { NameMatchRoundCard } from '../../components/capCrunch/NameMatchRoundCard';
import { WildcardRoundCard } from '../../components/capCrunch/WildcardRoundCard';
import {
  fmt,
  getCategoryAbbr,
  getPickErrorMessage,
  getPickBadgeLabel,
} from '../../components/capCrunch/capCrunchUtils';
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
  isTeammateRound,
  parseTeammateRound,
  isNameMatchRound,
  parseNameRound,
  isWildcardRound,
  NFL_DIVISIONS,
  findOptimalLastPick,
  isCareerStat,
  isHWFilter,
  formatHeightInches,
  classifySpecialRoundType,
  advanceSpecialRoundCycle,
} from '../../services/capCrunch';
import {
  HEIGHT_THRESHOLD_NBA,
  HEIGHT_THRESHOLD_NFL,
  WEIGHT_THRESHOLD,
} from '../../services/capCrunchData';
import type { OptimalPick, HWFilter, SpecialRoundType } from '../../services/capCrunch';
import type { Sport } from '../../types';
import type { PlayerLineup, StatCategory } from '../../types/capCrunch';
import { GradWeekOverlay, GradBanner, isGradWeek } from '../../components/GradWeekOverlay';
import type { DailyRoundFilter } from '../../services/dailyCapCrunch';

type Phase = 'sport-select' | 'playing' | 'results';

interface DailyModeConfig {
  targetCap: number;
  filters: DailyRoundFilter[];
  dayNumber: number;
}

function draftLabel(code: string): string {
  if (code === 'R1') return '1st Round';
  if (code === 'R2') return '2nd Round';
  if (code === 'R23') return '2nd–3rd Round';
  if (code === 'R47') return '4th Round+';
  return code;
}

function formatPickTeam(team: string): string {
  if (isDivisionDraftRound(team)) {
    const { division, draftRound } = parseDivisionDraftRound(team);
    return `${division} · ${draftLabel(draftRound)}`;
  }
  if (isTeammateRound(team)) {
    const { pickIndex } = parseTeammateRound(team);
    return `Played with Pick ${pickIndex}`;
  }
  if (isNameMatchRound(team)) {
    const { type, pickIndex, proConf } = parseNameRound(team);
    const label = type === 'first' ? 'First Initial' : 'Last Initial';
    return proConf ? `${label}: Pick ${pickIndex} + ${proConf}` : `${label}: Pick ${pickIndex}`;
  }
  return team;
}

export function SoloCapCrunchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const consumedAutoStartRef = useRef(false);

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
  const [searchResults, setSearchResults] = useState<
    Array<{ playerId: string | number; playerName: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | number | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | undefined>(undefined);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [loadingYears, setLoadingYears] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [showExactHit, setShowExactHit] = useState(false);
  const [setupTab, setSetupTab] = useState<'settings' | 'rules'>('settings');
  const [badFlashKey, setBadFlashKey] = useState(0);
  const exactHitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // True once the restore-from-storage effect has finished, so the persist effect
  // doesn't wipe sessionStorage before we've had a chance to read it back.
  const restoredRef = useRef(false);

  // Daily mode: precomputed puzzle config (set via autoStart state; null = regular solo)
  const dailyConfigRef = useRef<DailyModeConfig | null>(null);
  // Daily mode: timestamp when the first pick was confirmed, used for leaderboard tiebreaking
  const dailyGameStartedAtRef = useRef<number | null>(null);
  // Captured at the exact moment the last pick resolves (before any celebration delay)
  const finishedAtMsRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (exactHitTimerRef.current !== null) clearTimeout(exactHitTimerRef.current);
      confettiTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const autoStartState = location.state as {
      autoStart?: boolean;
      selectedSport?: Sport;
      statCategory?: StatCategory | null;
      totalRounds?: number;
      dailyMode?: boolean;
      dayNumber?: number;
      dailyTargetCap?: number;
      dailyFilters?: DailyRoundFilter[];
    } | null;
    if (!autoStartState?.autoStart || phase !== 'sport-select' || consumedAutoStartRef.current)
      return;

    consumedAutoStartRef.current = true;
    const nextSport = autoStartState.selectedSport ?? 'nba';
    const nextRounds = autoStartState.totalRounds ?? 5;
    setSelectedSport(nextSport);
    setTotalRounds(nextRounds);
    const dailyConfig =
      autoStartState.dailyMode &&
      autoStartState.dailyTargetCap !== undefined &&
      autoStartState.dailyFilters &&
      autoStartState.dayNumber !== undefined
        ? {
            targetCap: autoStartState.dailyTargetCap,
            filters: autoStartState.dailyFilters,
            dayNumber: autoStartState.dayNumber,
          }
        : undefined;
    void handleStartGame(nextSport, autoStartState.statCategory ?? null, nextRounds, dailyConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, phase]);

  // Restore game state from sessionStorage on mount.
  // Skip if the page was opened with an explicit autoStart — that launch takes priority.
  useEffect(() => {
    const autoStartState = location.state as { autoStart?: boolean } | null;
    if (!autoStartState?.autoStart) {
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
        } catch {
          /* ignore corrupt data */
        }
      }
    }
    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist game state to sessionStorage whenever it changes.
  // Skip until the restore effect above has run to avoid wiping a valid save on mount.
  // Also skip in daily mode — the daily page handles restart gracefully without session restore.
  useEffect(() => {
    if (!restoredRef.current) return;
    if (dailyConfigRef.current) return;
    if (phase === 'sport-select') {
      sessionStorage.removeItem('soloCapCrunch');
      return;
    }
    sessionStorage.setItem(
      'soloCapCrunch',
      JSON.stringify({
        phase,
        selectedSport,
        totalRounds,
        statCategory,
        hwFilter,
        usedSpecialTypes,
        targetCap,
        currentTeam,
        lineup,
        usedTeams: usedTeamsRef.current,
      }),
    );
  }, [
    phase,
    selectedSport,
    totalRounds,
    statCategory,
    hwFilter,
    usedSpecialTypes,
    targetCap,
    currentTeam,
    lineup,
  ]);

  // Initialize game
  const handleStartGame = async (
    sport: Sport,
    forcedCategory?: StatCategory | null,
    rounds: number = totalRounds,
    dailyConfig?: DailyModeConfig,
  ) => {
    setSelectedSport(sport);
    setTotalRounds(rounds);
    const category = forcedCategory ?? selectRandomStatCategory(sport);

    if (dailyConfig) {
      dailyConfigRef.current = dailyConfig;
      dailyGameStartedAtRef.current = Date.now();
      sessionStorage.removeItem('soloCapCrunch');
      const filter0 = dailyConfig.filters[0];
      usedTeamsRef.current = [filter0.team];
      setStatCategory(category);
      setHwFilter(filter0.hwFilter);
      setUsedSpecialTypes([]);
      setTargetCap(dailyConfig.targetCap);
      setCurrentTeam(filter0.team);
    } else {
      const cap = generateTargetCap(sport, category, rounds);
      const freshUsed: SpecialRoundType[] = [];
      const team = assignRandomTeam(sport, category, undefined, freshUsed);
      const filter = selectRandomHWFilter(sport, team, category, freshUsed);
      const initialUsed = advanceSpecialRoundCycle(
        freshUsed,
        classifySpecialRoundType(team, filter),
      );
      usedTeamsRef.current = [team];
      setStatCategory(category);
      setHwFilter(filter);
      setUsedSpecialTypes(initialUsed);
      setTargetCap(cap);
      setCurrentTeam(team);
    }

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
    const minLen = isNameMatchRound(currentTeam) ? 3 : 2;
    if (!selectedSport || query.trim().length < minLen) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchPlayersByNameOnly(
        selectedSport,
        query,
        statCategory ?? undefined,
      );
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
  const handleSelectPlayer = async (player: {
    playerId: string | number;
    playerName: string;
    position?: string;
  }) => {
    setSelectedPlayerName(player.playerName);
    setSelectedPlayerId(player.playerId);
    setSelectedPosition((player as any).position || undefined);
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
        player.playerId,
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
      const { selectedPlayer: newSelectedPlayer, updatedLineup: updated } = await resolvePickResult(
        {
          sport: selectedSport,
          playerName: selectedPlayerName,
          playerId: selectedPlayerId ?? undefined,
          position: selectedPosition,
          team: currentTeam,
          year: selectedYear,
          statCategory,
          hwFilter,
          lineup,
          targetCap,
          prevPicks: lineup.selectedPlayers,
        },
      );

      setLineup(updated);

      if (newSelectedPlayer.isBust || newSelectedPlayer.statValue === 0)
        setBadFlashKey((k) => k + 1);

      // Exact hit — celebrate and end game early
      if (!newSelectedPlayer.isBust && updated.totalStat === targetCap) {
        finishedAtMsRef.current = Date.now();
        updated.isFinished = true;
        setLineup(updated);
        setShowExactHit(true);
        // Confetti burst
        confetti({
          particleCount: 160,
          spread: 90,
          origin: { y: 0.55 },
          colors: ['#d4af37', '#f5e6c8', '#ffffff', '#facc15', '#fbbf24'],
        });
        confettiTimersRef.current = [
          setTimeout(
            () =>
              confetti({
                particleCount: 60,
                spread: 60,
                origin: { y: 0.4, x: 0.3 },
                colors: ['#d4af37', '#ffffff'],
              }),
            250,
          ),
          setTimeout(
            () =>
              confetti({
                particleCount: 60,
                spread: 60,
                origin: { y: 0.4, x: 0.7 },
                colors: ['#d4af37', '#ffffff'],
              }),
            400,
          ),
        ];
        exactHitTimerRef.current = setTimeout(() => {
          setShowExactHit(false);
          setPhase('results');
        }, 2500);
        return;
      }

      // Always play all picks — no early game-over on bust
      if (updated.selectedPlayers.length === totalRounds) {
        finishedAtMsRef.current = Date.now();
        updated.isFinished = true;
        setPhase('results');
      } else {
        // Switch team for next turn
        const roundIdx = updated.selectedPlayers.length;
        const dc = dailyConfigRef.current;
        if (dc) {
          // Daily mode: use precomputed filter for this round
          const f = dc.filters[roundIdx];
          setCurrentTeam(f.team);
          setHwFilter(f.hwFilter);
        } else {
          // Regular solo: random next round
          const nextTeam = assignRandomTeam(
            selectedSport,
            statCategory,
            usedTeamsRef.current,
            usedSpecialTypes,
            updated.selectedPlayers,
            updated.selectedPlayers.length === totalRounds - 1,
          );
          const nextFilter = selectRandomHWFilter(
            selectedSport,
            nextTeam,
            statCategory,
            usedSpecialTypes,
          );
          const nextUsed = advanceSpecialRoundCycle(
            usedSpecialTypes,
            classifySpecialRoundType(nextTeam, nextFilter),
          );
          usedTeamsRef.current = [...usedTeamsRef.current, nextTeam];
          setCurrentTeam(nextTeam);
          setHwFilter(nextFilter);
          setUsedSpecialTypes(nextUsed);
        }

        // Clear search
        setSearchQuery('');
        setSearchResults([]);
        setSelectedPlayerName(null);
        setSelectedPlayerId(null);
        setSelectedPosition(undefined);
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

  const handleNewGame = () => {
    sessionStorage.removeItem('soloCapCrunch');
    setPhase('sport-select');
    setSelectedSport(null);
    setTotalRounds(5);
    setStatCategory(null);
    setHwFilter(null);
    setUsedSpecialTypes([]);
    setTargetCap(0);
    setCurrentTeam('');
    setLineup(null);
    setOptimalPick(undefined);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPlayerName(null);
    setSelectedPlayerId(null);
    setAvailableYears([]);
    setSelectedYear('');
    setPickError(null);
    usedTeamsRef.current = [];
  };

  // In daily mode, navigate to the dedicated results page instead of showing inline results
  useEffect(() => {
    if (phase !== 'results' || !lineup || !statCategory || !selectedSport) return;
    const dc = dailyConfigRef.current;
    if (!dc) return;
    navigate('/daily/cap-crunch/results', {
      state: {
        dayNumber: dc.dayNumber,
        sport: selectedSport,
        statCategory,
        targetCap,
        roundFilters: dc.filters,
        lineup,
        startedAtMs: dailyGameStartedAtRef.current ?? Date.now(),
        finishedAtMs: finishedAtMsRef.current ?? Date.now(),
      },
      replace: true,
    });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute optimal last pick hint when results phase is reached
  useEffect(() => {
    if (phase !== 'results' || !lineup || !statCategory || !selectedSport) return;
    if (dailyConfigRef.current) return; // daily navigates away; no hint needed
    const picks = lineup.selectedPlayers;
    if (picks.length === 0) return;
    const lastPick = picks[picks.length - 1];
    // For bust picks, the total was reverted so totalBeforeLast == lineup.totalStat
    const totalBeforeLast = lastPick.isBust
      ? lineup.totalStat
      : parseFloat((lineup.totalStat - lastPick.statValue).toFixed(1));
    const remainingBudget = parseFloat((targetCap - totalBeforeLast).toFixed(1));
    setOptimalPick(undefined); // reset to loading
    findOptimalLastPick(
      selectedSport,
      lastPick.team,
      statCategory,
      remainingBudget,
      lastPick.isBust ? 0 : lastPick.statValue,
      undefined,
      hwFilter,
      picks,
    )
      .then((result) => setOptimalPick(result ?? null))
      .catch(() => setOptimalPick(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === 'sport-select') {
    return (
      <div className="min-h-screen capcrunch-shell text-white flex flex-col overflow-hidden relative">
        <header className="relative z-10 p-6 border-b border-white/10 capcrunch-panel">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="capcrunch-title text-2xl text-[#FDF100]">Cap Crunch</div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 capcrunch-btn-secondary capcrunch-title text-sm transition"
            >
              Back
            </button>
          </div>
        </header>

        <main className="relative z-10 flex-1 flex items-center justify-center p-4 md:p-6">
          <div className="w-full max-w-6xl">
            <div className="mb-4 flex justify-center lg:hidden">
              <div className="inline-flex border border-white/10 bg-black/20">
                <button
                  onClick={() => setSetupTab('settings')}
                  className={`px-4 py-2 capcrunch-kicker transition ${setupTab === 'settings' ? 'bg-[#FDF100] text-black' : 'text-white/60'}`}
                >
                  Settings
                </button>
                <button
                  onClick={() => setSetupTab('rules')}
                  className={`px-4 py-2 capcrunch-kicker transition ${setupTab === 'rules' ? 'bg-[#68BBE5] text-black' : 'text-white/60'}`}
                >
                  Rules
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${setupTab !== 'settings' ? 'hidden lg:block' : ''} capcrunch-panel p-5 md:p-6`}
              >
                <h2 className="capcrunch-title text-4xl md:text-5xl mb-3 text-white">
                  {selectedSport ? `${selectedSport.toUpperCase()} Settings` : 'Game Settings'}
                </h2>
                <p className="capcrunch-kicker text-[10px] text-white/50 tracking-widest mb-6">
                  CHOOSE STAT CATEGORY
                </p>

                <div
                  className={`flex flex-col items-center gap-4 w-full transition ${!selectedSport ? 'opacity-40 blur-[2px] pointer-events-none select-none' : ''}`}
                >
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => handleStartGame(selectedSport as Sport, null, totalRounds)}
                      className="px-4 py-2 capcrunch-kicker text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                    >
                      RANDOM
                    </button>
                    {((selectedSport ?? 'nba') === 'nba'
                      ? ([
                          'pts',
                          'ast',
                          'reb',
                          'min',
                          'pra',
                          'total_gp',
                          'total_pts',
                          'total_reb',
                          'total_ast',
                          'total_blk',
                          'total_3pm',
                          'total_ftm',
                          'total_pf',
                        ] as const)
                      : ([
                          'passing_yards',
                          'passing_tds',
                          'interceptions',
                          'rushing_yards',
                          'rushing_tds',
                          'receiving_yards',
                          'receiving_tds',
                          'receptions',
                          'fpts',
                          'total_gp',
                        ] as const)
                    ).map((cat) => (
                      <button
                        key={cat}
                        onClick={() =>
                          handleStartGame((selectedSport ?? 'nba') as Sport, cat, totalRounds)
                        }
                        className="px-4 py-2 capcrunch-kicker text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                      >
                        {getCategoryAbbr(cat)}
                      </button>
                    ))}
                  </div>

                  {(selectedSport ?? 'nba') === 'nfl' && (
                    <div className="w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="capcrunch-kicker text-[9px] text-white/40 tracking-[0.3em] uppercase">
                          Career Totals
                        </span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button
                          onClick={() => {
                            const careerCats = [
                              'career_passing_yards',
                              'career_passing_tds',
                              'career_rushing_yards',
                              'career_rushing_tds',
                              'career_receiving_yards',
                              'career_receiving_tds',
                            ] as const;
                            handleStartGame(
                              (selectedSport ?? 'nfl') as Sport,
                              careerCats[Math.floor(Math.random() * careerCats.length)],
                              totalRounds,
                            );
                          }}
                          className="px-4 py-2 capcrunch-kicker text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                        >
                          RANDOM
                        </button>
                        {(
                          [
                            'career_passing_yards',
                            'career_passing_tds',
                            'career_rushing_yards',
                            'career_rushing_tds',
                            'career_receiving_yards',
                            'career_receiving_tds',
                          ] as const
                        ).map((cat) => (
                          <button
                            key={cat}
                            onClick={() =>
                              handleStartGame((selectedSport ?? 'nfl') as Sport, cat, totalRounds)
                            }
                            className="px-4 py-2 capcrunch-kicker text-xs bg-black/50 border border-white/20 text-white/70 hover:border-white/60 hover:text-white transition"
                          >
                            {getCategoryAbbr(cat)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`flex items-center gap-3 justify-center mt-6 mb-4 transition ${!selectedSport ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <span className="capcrunch-kicker text-[10px] text-white/50 tracking-widest">
                    ROUNDS
                  </span>
                  <div className="flex gap-1">
                    {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => setTotalRounds(n)}
                        className={`w-8 h-8 capcrunch-kicker text-xs transition ${
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

                {selectedSport && (
                  <button
                    onClick={() => setSelectedSport(null)}
                    className="capcrunch-kicker text-[10px] text-white/40 hover:text-white/70 transition tracking-widest"
                  >
                    ← CHANGE SPORT
                  </button>
                )}
              </motion.section>

              <motion.aside
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`${setupTab !== 'rules' ? 'hidden lg:block' : ''} capcrunch-panel p-5 md:p-6`}
              >
                <h3 className="capcrunch-title text-lg text-[#FDF100] mb-3">How to Play</h3>
                <ul className="text-sm text-white/80 space-y-2.5 text-left">
                  <li>
                    <span className="text-[#d4af37] font-bold">Goal:</span> Build a {totalRounds}
                    -pick lineup whose combined stat reaches — but doesn't exceed — the target cap
                  </li>
                  <li>
                    <span className="text-[#d4af37] font-bold">Each pick:</span> A filter is shown
                    (team, division, or special round). Search any player — if they qualify, their
                    stat adds to your total
                  </li>
                  <li>
                    <span className="text-emerald-400 font-bold">Single-season stat:</span> Choose a
                    year — that season's stat for the shown team counts
                  </li>
                  <li>
                    <span className="text-emerald-400 font-bold">Total GP (NBA):</span> No year
                    needed — their career games played with that specific team counts
                  </li>
                  <li>
                    <span className="text-emerald-400 font-bold">Career stats (NFL):</span> No year
                    needed — the team shown is just a qualifier (player must have played there at
                    some point). Their <em>full career total</em> across all teams counts
                  </li>
                  <li>
                    <span className="text-red-400 font-bold">Bust:</span> A pick that pushes you
                    over the cap scores 0 and your total reverts. You always play all {totalRounds}{' '}
                    picks!
                  </li>
                  <li>
                    <span className="text-white/60 font-bold">Special rounds:</span> Filters can be
                    a division, a college + pro conference combo, a teammate round, or more.
                  </li>
                  <li>
                    <span className="text-[#d4af37] font-bold">Tiebreaker:</span> Fewest busts wins;
                    then oldest average pick year
                  </li>
                </ul>
              </motion.aside>
            </div>
          </div>
        </main>

        {!selectedSport && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm p-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="capcrunch-panel w-full max-w-4xl p-6 md:p-10"
            >
              <div className="mb-8">
                <p className="home-kicker text-[#bfbfbf] mb-3">Cap Crunch</p>
                <h2 className="capcrunch-title text-4xl md:text-6xl text-white mb-3">
                  Pick a Sport
                </h2>
                <p className="capcrunch-body text-white/60 text-sm md:text-base">
                  Choose a league and then the settings screen underneath will unlock.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 border border-white/10">
                <button
                  onClick={() => setSelectedSport('nba')}
                  className="group relative min-h-[220px] border-b md:border-b-0 md:border-r border-white/10 bg-white/[0.03] p-6 text-left transition hover:bg-[#FDF100]/10"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-[#FDF100]" />
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <span className="capcrunch-kicker text-[#FDF100]">Basketball</span>
                      <h3 className="capcrunch-title mt-4 text-3xl text-white">NBA</h3>
                      <p className="capcrunch-body mt-3 max-w-sm text-sm text-white/65">
                        Per-game stats, team career games played, and a quicker high-volume scoring
                        style.
                      </p>
                    </div>
                    <span className="capcrunch-kicker text-white/70 group-hover:text-white">
                      Continue
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedSport('nfl')}
                  className="group relative min-h-[220px] bg-white/[0.03] p-6 text-left transition hover:bg-[#68BBE5]/10"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-[#68BBE5]" />
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <span className="capcrunch-kicker text-[#68BBE5]">Football</span>
                      <h3 className="capcrunch-title mt-4 text-3xl text-white">NFL</h3>
                      <p className="capcrunch-body mt-3 max-w-sm text-sm text-white/65">
                        Season stats plus career stat variants with broader qualifier and
                        special-round combinations.
                      </p>
                    </div>
                    <span className="capcrunch-kicker text-white/70 group-hover:text-white">
                      Continue
                    </span>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'playing' && lineup && selectedSport && statCategory) {
    return (
      <motion.div
        animate={showExactHit ? { x: [0, -10, 10, -7, 7, -4, 4, 0] } : {}}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className="min-h-screen capcrunch-shell text-white flex flex-col relative overflow-hidden"
      >
        <GradWeekOverlay />
        {/* GREEN FELT BACKGROUND */}
        {/* EXACT HIT CELEBRATION OVERLAY */}
        {showExactHit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(212,175,55,0.35) 0%, rgba(0,0,0,0.9) 100%)',
            }}
          >
            {/* Radiating rings */}
            {[0, 0.25, 0.5].map((delay, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-[#d4af37]/70 pointer-events-none"
                style={{
                  width: 160,
                  height: 160,
                  marginLeft: -80,
                  marginTop: -80,
                  left: '50%',
                  top: '50%',
                }}
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
                className="capcrunch-title text-6xl md:text-8xl text-[#FDF100] mb-2"
                style={{
                  textShadow: '0 0 40px rgba(253,241,0,0.55), 0 0 100px rgba(226,0,138,0.28)',
                }}
              >
                EXACT!
              </motion.div>
              <div className="capcrunch-kicker text-xl md:text-2xl text-white mb-1">
                Perfect score
              </div>
              <div className="capcrunch-title text-3xl md:text-4xl text-[#68BBE5]">{targetCap}</div>
            </motion.div>
          </motion.div>
        )}

        <header className="relative z-10 capcrunch-panel border-b border-white/10">
          <div className="px-3 sm:px-4 py-2 flex items-center justify-between border-b border-white/5">
            <button
              onClick={() => {
                if (addingPlayer) return;
                navigate('/');
              }}
              className="capcrunch-kicker text-[10px] text-white/40 hover:text-white/70 tracking-widest uppercase transition"
            >
              ← Back
            </button>
            <h1 className="capcrunch-title text-lg sm:text-2xl text-[#FDF100]">
              {dailyConfigRef.current
                ? `Daily Cap Crunch #${dailyConfigRef.current.dayNumber}`
                : `Cap Crunch${isGradWeek() ? ' 🎓' : ''}`}
            </h1>
            <div className="w-10 sm:w-16" />
          </div>
          {/* Team / Division / Conference Display */}
          <div className="flex items-center justify-center py-3 px-3 sm:px-4">
            {isDivisionDraftRound(currentTeam) ? (
              (() => {
                const { division, draftRound } = parseDivisionDraftRound(currentTeam);
                return (
                  <motion.div
                    key={currentTeam}
                    initial={{ opacity: 0, rotateY: -90 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    style={{ perspective: 600 }}
                  >
                    <DivisionDraftRoundCard
                      division={division}
                      draftRound={draftRound}
                      sport={selectedSport!}
                      size="lg"
                    />
                  </motion.div>
                );
              })()
            ) : isConferenceRound(currentTeam) ? (
              (() => {
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
              })()
            ) : isDivisionRound(currentTeam) ? (
              <motion.div
                key={currentTeam}
                initial={{ opacity: 0, rotateY: -90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 90 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                style={{ perspective: 600 }}
                className="text-center px-8 md:px-12 py-2 md:py-3 border-2 bg-black/70 border-[#FDF100]/60 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
              >
                <p className="capcrunch-kicker text-[8px] md:text-[10px] text-white/60 tracking-[0.4em] uppercase mb-1">
                  Division
                </p>
                <p className="capcrunch-title text-2xl md:text-4xl tracking-tight text-[#FDF100]">
                  {currentTeam}
                </p>
                <p className="capcrunch-kicker text-[9px] text-white/35 mt-1">
                  {(NFL_DIVISIONS[currentTeam] ?? []).join(' · ')}
                </p>
              </motion.div>
            ) : isWildcardRound(currentTeam) ? (
              <WildcardRoundCard key={currentTeam} size="lg" />
            ) : isNameMatchRound(currentTeam) ? (
              (() => {
                const { type, pickIndex, proConf } = parseNameRound(currentTeam);
                return (
                  <NameMatchRoundCard
                    key={currentTeam}
                    nameType={type}
                    pickIndex={pickIndex}
                    proConf={proConf}
                    size="lg"
                  />
                );
              })()
            ) : isTeammateRound(currentTeam) ? (
              (() => {
                const { pickIndex } = parseTeammateRound(currentTeam);
                return <TeammateRoundCard key={currentTeam} pickIndex={pickIndex} size="lg" />;
              })()
            ) : (
              <div className="flex flex-col items-center gap-2">
                <TeamSlotMachine sport={selectedSport!} team={currentTeam} size="lg" />
                {isHWFilter(hwFilter) && (
                  <div className="px-3 py-1 border border-[#68BBE5]/40 bg-[#68BBE5]/10 text-[#68BBE5] capcrunch-kicker text-[9px] md:text-[10px]">
                    {hwFilter === 'height_above'
                      ? `Above ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)}`
                      : hwFilter === 'height_below'
                        ? `Below ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)}`
                        : hwFilter === 'weight_above'
                          ? `Above ${WEIGHT_THRESHOLD} lbs`
                          : `Below ${WEIGHT_THRESHOLD} lbs`}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Mobile stat strip — compact 4-across row */}
          <div className="lg:hidden grid grid-cols-4 border-t border-white/10">
            <div
              className="px-2 py-2 text-center border-r border-white/10"
              style={{ borderLeftWidth: 3, borderLeftColor: '#FDF100' }}
            >
              <div className="capcrunch-kicker text-[7px] text-white/30 mb-0.5">Target</div>
              <p className="capcrunch-title text-sm text-white leading-none">{targetCap}</p>
            </div>
            <div
              className="px-2 py-2 text-center border-r border-white/10"
              style={{ borderLeftWidth: 3, borderLeftColor: '#68BBE5' }}
            >
              {isCareerStatRound && (
                <div className="capcrunch-kicker text-[6px] text-[#68BBE5] mb-0.5">Career</div>
              )}
              {!isCareerStatRound && (
                <div className="capcrunch-kicker text-[7px] text-white/30 mb-0.5">Stat</div>
              )}
              <p className="capcrunch-title text-sm text-white leading-none">
                {isCareerStatRound
                  ? getCategoryAbbr(statCategory!).replace('CAREER ', '')
                  : getCategoryAbbr(statCategory!)}
              </p>
            </div>
            <div
              className="px-2 py-2 text-center border-r border-white/10"
              style={{ borderLeftWidth: 3, borderLeftColor: '#E2008A' }}
            >
              <div className="capcrunch-kicker text-[7px] text-white/30 mb-0.5">Total</div>
              <SpinningNumber
                value={fmt(lineup.totalStat)}
                className="capcrunch-title text-sm leading-none"
                color={getTotalColor(lineup.totalStat, targetCap)}
                flashKey={badFlashKey}
              />
            </div>
            <div
              className="px-2 py-2 text-center"
              style={{ borderLeftWidth: 3, borderLeftColor: '#70BE5B' }}
            >
              <div className="capcrunch-kicker text-[7px] text-white/30 mb-0.5">Left</div>
              <SpinningNumber
                value={fmt(targetCap - lineup.totalStat)}
                className="capcrunch-title text-sm leading-none"
                color={getRemainingColor(lineup.totalStat, targetCap)}
                flashKey={badFlashKey}
              />
            </div>
          </div>
          {/* Mobile cap progress strip */}
          <div className="lg:hidden w-full h-0.5 bg-white/10">
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

        <main className="relative z-10 flex-1 w-full px-2 sm:px-3 md:px-6 py-2 md:py-4 flex flex-col lg:flex-row gap-2 md:gap-4 overflow-hidden">
          {/* Left Column - Stats (desktop only) */}
          <div className="hidden lg:flex w-44 flex-shrink-0 flex-col gap-3">
            <div
              className="capcrunch-metric px-6 py-6 text-center shadow-xl flex flex-col justify-center"
              style={{ borderLeftColor: '#FDF100' }}
            >
              <div className="capcrunch-kicker text-[8px] text-white/30 tracking-widest uppercase mb-2">
                Target
              </div>
              <p className="capcrunch-title text-4xl text-white">{targetCap}</p>
            </div>
            <div
              className="capcrunch-metric px-6 py-6 text-center shadow-xl flex flex-col justify-center"
              style={{ borderLeftColor: '#68BBE5' }}
            >
              {isCareerStatRound && (
                <div className="capcrunch-kicker text-[8px] text-[#68BBE5] mb-1">Career</div>
              )}
              {!isCareerStatRound && (
                <div className="capcrunch-kicker text-[8px] text-white/30 tracking-widest uppercase mb-2">
                  Category
                </div>
              )}
              <p className="capcrunch-title text-2xl text-white">
                {isCareerStatRound
                  ? getCategoryAbbr(statCategory!).replace('CAREER ', '')
                  : getCategoryAbbr(statCategory!)}
              </p>
            </div>
            <div
              className="capcrunch-metric px-6 py-6 text-center shadow-xl"
              style={{ borderLeftColor: '#E2008A' }}
            >
              <div className="capcrunch-kicker text-[8px] text-white/30 tracking-widest uppercase mb-1">
                Total
              </div>
              <SpinningNumber
                value={fmt(lineup.totalStat)}
                className="capcrunch-title text-4xl"
                color={getTotalColor(lineup.totalStat, targetCap)}
                flashKey={badFlashKey}
              />
              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="capcrunch-kicker text-[8px] text-[#d4af37]/50 tracking-widest uppercase mb-0.5">
                  Remaining
                </div>
                <SpinningNumber
                  value={fmt(targetCap - lineup.totalStat)}
                  className="capcrunch-title text-3xl"
                  color={getRemainingColor(lineup.totalStat, targetCap)}
                  flashKey={badFlashKey}
                />
              </div>
              {(lineup.bustCount ?? 0) > 0 && (
                <p className="capcrunch-kicker text-[7px] text-red-400/70 tracking-wide mt-1 uppercase">
                  {lineup.bustCount} Bust{lineup.bustCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div
              className="capcrunch-metric px-3 py-2 shadow-xl"
              style={{ borderLeftColor: '#70BE5B' }}
            >
              <div className="capcrunch-kicker text-[6px] text-white/30 tracking-widest uppercase mb-1.5">
                Cap
              </div>
              <div className="w-full h-2 bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full"
                  animate={{
                    width: `${Math.min((lineup.totalStat / targetCap) * 100, 100)}%`,
                    backgroundColor: getTotalColor(lineup.totalStat, targetCap),
                  }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="capcrunch-kicker text-[6px] text-white/20">0</span>
                <span className="capcrunch-kicker text-[6px] text-white/20">{targetCap}</span>
              </div>
            </div>
          </div>

          {/* Middle Column - Player Selection */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="capcrunch-panel p-3 md:p-6 flex-1 flex flex-col min-h-0"
            >
              {!selectedPlayerName ? (
                <div className="flex flex-col h-full">
                  <label className="block capcrunch-kicker text-[8px] md:text-[10px] tracking-[0.4em] text-white/60 uppercase mb-2 md:mb-4 font-semibold">
                    Search for a player
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Enter player name..."
                    className="w-full px-2 md:px-4 py-2 md:py-3 bg-black/35 text-white border border-[#68BBE5]/25 focus:outline-none focus:border-[#68BBE5]/60 mb-2 md:mb-4 text-xs md:text-base capcrunch-body"
                  />

                  {loading && <p className="text-white/60 text-xs md:text-sm">Loading...</p>}
                  {!loading && searchQuery.length >= 2 && searchResults.length === 0 && (
                    <p className="text-white/30 text-[9px] capcrunch-kicker mt-1">
                      No results — player may be too recent, have limited stats, or try a different
                      spelling.
                    </p>
                  )}

                  {searchResults.length > 0 && (
                    <div className="space-y-1 md:space-y-2 overflow-y-auto flex-1 min-h-0">
                      {searchResults.map((result, idx) => (
                        <button
                          key={String(result.playerId) + idx}
                          onClick={() => handleSelectPlayer(result)}
                          className="w-full text-left px-2 md:px-4 py-1 md:py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 transition text-white font-semibold text-xs md:text-base capcrunch-body"
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
                  <div className="p-2 md:p-4 bg-white/[0.03] border border-white/10">
                    <p className="capcrunch-title text-xs md:text-lg text-white truncate">
                      {selectedPlayerName}
                    </p>
                    <p className="text-[10px] md:text-sm text-white/60">
                      {isNameMatchRound(currentTeam)
                        ? (() => {
                            const { type, pickIndex, proConf } = parseNameRound(currentTeam);
                            const refName =
                              lineup.selectedPlayers[pickIndex - 1]?.playerName ??
                              `Pick ${pickIndex}`;
                            const parts = refName.split(' ');
                            const SUFFIXES = new Set([
                              'Jr',
                              'Sr',
                              'II',
                              'III',
                              'IV',
                              'V',
                              'Jr.',
                              'Sr.',
                            ]);
                            const filtered = parts.filter((p) => !SUFFIXES.has(p));
                            const required =
                              type === 'first'
                                ? parts[0]
                                : (filtered[filtered.length - 1] ?? parts[parts.length - 1]);
                            return `${isCareerStatRound ? 'Total career stats' : 'All career GP'} — ${type} initial must be "${(required[0] ?? '').toUpperCase()}"${proConf ? ` + played for ${proConf}` : ''}`;
                          })()
                        : isCareerStatRound
                          ? `Total career stats (all teams) — must have played for ${currentTeam} at some point`
                          : `Will count all career GP with ${currentTeam}`}
                      {isHWFilter(hwFilter) &&
                        ` — ${hwFilter === 'height_above' ? `above ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)} tall` : hwFilter === 'height_below' ? `below ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)} tall` : hwFilter === 'weight_above' ? `above ${WEIGHT_THRESHOLD} lbs` : `below ${WEIGHT_THRESHOLD} lbs`}`}
                    </p>
                  </div>
                  <div className="flex-1 flex items-center justify-center text-center">
                    <p className="text-white/30 capcrunch-kicker text-xs leading-relaxed">
                      {isNameMatchRound(currentTeam) ? (
                        <>
                          Career stats — no team constraint
                          <br />
                          initial match is the only requirement
                        </>
                      ) : (
                        <>
                          Games played across every season
                          <br />
                          this player was on the team
                        </>
                      )}
                    </p>
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
                      className="flex-1 px-2 md:px-4 py-1 md:py-2 capcrunch-btn-secondary text-white/80 font-semibold transition text-xs md:text-base capcrunch-title"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConfirmYear}
                      disabled={addingPlayer}
                      className="flex-1 px-2 md:px-4 py-1 md:py-2 capcrunch-btn-primary disabled:opacity-50 text-black font-semibold transition text-xs md:text-base capcrunch-title"
                    >
                      {addingPlayer ? 'Adding...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              ) : (
                // ── Normal mode: pick a year ──
                <div className="space-y-2 md:space-y-4 flex flex-col flex-1 overflow-hidden">
                  <div className="p-2 md:p-4 bg-white/[0.03] border border-white/10">
                    <p className="capcrunch-title text-xs md:text-lg text-white truncate">
                      {selectedPlayerName}
                    </p>
                    <p className="text-[10px] md:text-sm text-white/60">
                      Select any year this player played
                    </p>
                  </div>

                  <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    <div className="flex items-baseline justify-between mb-2 md:mb-3 flex-shrink-0">
                      <label className="block capcrunch-kicker text-[7px] md:text-[10px] tracking-[0.4em] text-white/60 uppercase font-semibold">
                        Select a year
                      </label>
                      {selectedSport === 'nfl' && !isCareerStatRound && (
                        <span className="text-white/25 text-[7px] capcrunch-kicker tracking-wide">
                          through 2025
                        </span>
                      )}
                    </div>
                    {loadingYears ? (
                      <p className="text-white/60 text-xs md:text-sm">Loading years...</p>
                    ) : availableYears.length > 0 ? (
                      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 md:space-y-2">
                        {availableYears.map((year) => (
                          <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`w-full px-2 md:px-4 py-1 md:py-2 border transition text-white font-semibold text-xs md:text-base ${
                              selectedYear === year
                                ? 'bg-[#FDF100] text-black border-[#FDF100]'
                                : 'bg-white/[0.03] border-white/10 hover:border-[#68BBE5]/40'
                            }`}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-red-400 text-xs md:text-sm">
                        No data found — player may be too recent, have limited stats, or try a
                        different spelling.
                      </p>
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
                      className="flex-1 px-2 md:px-4 py-1 md:py-2 capcrunch-btn-secondary text-white/80 font-semibold transition text-xs md:text-base capcrunch-title"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConfirmYear}
                      disabled={!selectedYear || addingPlayer}
                      className="flex-1 px-2 md:px-4 py-1 md:py-2 capcrunch-btn-primary disabled:opacity-50 text-black font-semibold transition text-xs md:text-base capcrunch-title"
                    >
                      {addingPlayer ? 'Adding...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar - Lineup Preview */}
          <div className="w-full lg:w-80 lg:flex-shrink-0 flex flex-col min-h-[220px] lg:min-h-0">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="capcrunch-panel p-3 md:p-6 flex flex-col flex-1 overflow-hidden"
            >
              <h3 className="capcrunch-title text-xs md:text-lg text-[#FDF100] mb-2 md:mb-4">
                Your Lineup
              </h3>
              <div className="space-y-1 md:space-y-2 flex-1 overflow-y-auto">
                {Array.from({ length: totalRounds }).map((_, idx) => {
                  const pick =
                    idx < lineup.selectedPlayers.length ? lineup.selectedPlayers[idx] : null;
                  const isBad = pick ? pick.isBust || pick.neverOnTeam : false;
                  return (
                    <motion.div
                      key={idx}
                      animate={isBad && pick ? { x: ['0%', '-8%', '8%', '-5%', '5%', '0%'] } : {}}
                      transition={{ duration: 0.35, ease: 'easeInOut' }}
                      className={`px-2 md:px-3 py-1 md:py-2 border text-[9px] md:text-xs leading-tight ${
                        pick
                          ? isBad
                            ? 'bg-red-900/40 border-red-500/60'
                            : 'bg-white/[0.04] border-[#70BE5B]/40'
                          : 'bg-white/[0.02] border-dashed border-white/10'
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
                                <PlayerHeadshot
                                  playerId={pick.playerId}
                                  sport={selectedSport as 'nba' | 'nfl'}
                                  className={`w-5 h-5 rounded-full object-cover bg-white/5${isBad ? ' grayscale' : ''}`}
                                />
                                {isBad && (
                                  <div className="absolute inset-0 rounded-full bg-red-500/30" />
                                )}
                              </div>
                              <p className="font-semibold truncate text-[9px] md:text-xs">
                                {idx + 1}. <FlipReveal text={pick.playerName} />
                              </p>
                              {isBad && (
                                <span className="text-[7px] bg-red-600 text-white px-1 shrink-0">
                                  {getPickBadgeLabel(pick)}
                                </span>
                              )}
                            </div>
                            <p
                              className={isBad ? 'text-red-400/70' : 'text-white/60'}
                              style={{ fontSize: '0.5rem' }}
                            >
                              {formatPickTeam(pick.team)} • {pick.selectedYear}
                              {pick.neverOnTeam && (
                                <span className="text-orange-400/80 ml-1">
                                  ({getPickErrorMessage(pick)})
                                </span>
                              )}
                            </p>
                            <p
                              className={`font-semibold text-[9px] md:text-xs ${isBad ? 'text-red-400' : pick?.statValue === 0 ? 'text-red-400' : 'text-[#d4af37]'}`}
                            >
                              {pick.isBust
                                ? `${fmt(pick.statValue)} → 0`
                                : `${fmt(pick.statValue)}`}{' '}
                              {getCategoryAbbr(statCategory!)}
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
                <div className="mt-3 md:mt-4 p-2 md:p-3 bg-red-900/30 border border-red-500/40 text-red-400 text-[8px] md:text-xs font-semibold text-center">
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
      <div className="min-h-screen capcrunch-shell text-white flex flex-col relative overflow-hidden p-4 md:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10 flex flex-col h-full max-w-7xl mx-auto w-full"
        >
          <GradBanner />
          {/* HEADER */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-2 border-white/10 pb-4 gap-4 mt-4">
            <div>
              <div className="capcrunch-kicker text-[8px] md:text-[10px] tracking-[0.4em] md:tracking-[0.6em] text-white/30 uppercase">
                Game Result
              </div>
              <h1 className="capcrunch-title text-4xl md:text-6xl text-white leading-none">
                Lineup Score
              </h1>
            </div>
            <div className="flex flex-col items-start md:items-end w-full md:w-auto">
              <div className="capcrunch-panel-soft px-4 py-1 w-full md:w-auto text-center">
                <span className="capcrunch-title text-xs md:text-sm tracking-widest text-white/80">
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
                  {
                    label: 'AWAY',
                    value: fmt(Math.abs(lineup.totalStat - targetCap)),
                    color: lineup.totalStat === targetCap ? 'text-green-400' : 'text-white',
                  },
                  {
                    label: 'BUSTS',
                    value: String(lineup.bustCount ?? 0),
                    color: (lineup.bustCount ?? 0) > 0 ? 'text-red-400' : 'text-white',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="capcrunch-panel-soft p-3 md:p-4 shadow-xl relative overflow-hidden"
                  >
                    <div className="capcrunch-kicker text-[7px] md:text-[8px] text-white/30 tracking-widest uppercase mb-1">
                      {stat.label}
                    </div>
                    <div className={`capcrunch-title text-xl md:text-2xl ${stat.color}`}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* OPTIMAL LAST PICK HINT */}
              {optimalPick &&
                lineup &&
                lineup.selectedPlayers.length > 0 &&
                (() => {
                  const lastPick = lineup.selectedPlayers[lineup.selectedPlayers.length - 1];
                  // For bust picks the total was already reverted, so don't subtract statValue again
                  const totalBeforeLast = lastPick.isBust
                    ? lineup.totalStat
                    : parseFloat((lineup.totalStat - lastPick.statValue).toFixed(1));
                  const wouldFinishAt = parseFloat(
                    (totalBeforeLast + optimalPick.statValue).toFixed(1),
                  );
                  return (
                    <div className="capcrunch-panel-soft p-3 md:p-4">
                      <div className="capcrunch-kicker text-[8px] text-[#d4af37]/60 tracking-widest uppercase mb-2">
                        Optimal Last Pick
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerHeadshot
                            playerId={optimalPick.playerId}
                            sport={selectedSport as 'nba' | 'nfl'}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                          <div className="overflow-hidden">
                            <div className="capcrunch-title text-sm text-white truncate">
                              {optimalPick.playerName}
                            </div>
                            <div className="capcrunch-kicker text-[9px] text-white/40 mt-0.5">
                              {optimalPick.year === 'career'
                                ? isCareerStatRound
                                  ? getCategoryAbbr(statCategory!)
                                  : 'Career GP'
                                : optimalPick.year}{' '}
                              · {optimalPick.team}
                              {optimalPick.college && (
                                <span className="text-[#3b82f6]/60 ml-1">
                                  · {optimalPick.college}
                                </span>
                              )}
                              {optimalPick.draftRound && (
                                <span className="text-[#a855f7]/60 ml-1">
                                  · {optimalPick.draftRound}
                                </span>
                              )}
                              {optimalPick.teammate && (
                                <span className="text-[#22c55e]/60 ml-1">
                                  · played with {optimalPick.teammate}
                                  {optimalPick.teammateYear
                                    ? ` in ${optimalPick.teammateYear}`
                                    : ''}
                                </span>
                              )}
                            </div>
                            <div className="capcrunch-kicker text-[9px] text-white/30 mt-0.5">
                              vs your pick:{' '}
                              {optimalPick.playerName !== lastPick.playerName
                                ? lastPick.playerName
                                : '—'}{' '}
                              ({fmt(lastPick.statValue)})
                            </div>
                            <div className="capcrunch-kicker text-[9px] text-emerald-400/70 mt-1">
                              Would finish: {fmt(wouldFinishAt)} / {targetCap}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="capcrunch-title text-xl text-[#FDF100]">
                            {fmt(optimalPick.statValue)}
                          </div>
                          {optimalPick.statValue > lastPick.statValue && (
                            <div className="capcrunch-kicker text-[8px] text-emerald-400/70">
                              +{fmt(optimalPick.statValue - lastPick.statValue)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* ACTION BUTTONS */}
              <div className="flex flex-col gap-2 md:gap-3">
                <button
                  onClick={handleNewGame}
                  className="group relative capcrunch-btn-primary py-3 md:py-4"
                >
                  <span className="relative z-10 capcrunch-title text-base md:text-lg text-black tracking-widest">
                    Play Again
                  </span>
                </button>

                <button
                  onClick={() => navigate('/')}
                  className="group relative capcrunch-btn-secondary py-2 md:py-3 transition-colors"
                >
                  <span className="relative z-10 capcrunch-title text-base md:text-lg text-white/70 tracking-widest">
                    Exit Game
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN - Lineup Detail */}
            <div className="lg:w-2/3 capcrunch-panel flex flex-col shadow-2xl overflow-hidden">
              <div className="p-3 md:p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                <span className="capcrunch-kicker text-[9px] tracking-widest text-white/40 uppercase">
                  Your Lineup
                </span>
                <span className="capcrunch-title text-[9px] text-white/20">
                  {totalRounds} Slots
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 max-h-96 lg:max-h-none">
                <div className="space-y-2">
                  {(() => {
                    let running = 0;
                    return lineup.selectedPlayers.map((player, idx) => {
                      const totalBefore = running;
                      if (!player.isBust && !player.neverOnTeam) running += player.statValue;
                      const isBust = player.isBust;
                      const isNotOnTeam = !isBust && player.neverOnTeam;
                      const isInvalid = isBust || isNotOnTeam;
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: idx * 0.09,
                            type: 'spring',
                            stiffness: 340,
                            damping: 28,
                          }}
                          className={`relative p-3 md:p-4 border transition-all ${
                            isInvalid ? 'border-red-500/30' : 'border-white/20'
                          }`}
                          style={{
                            background: isInvalid
                              ? 'transparent'
                              : 'linear-gradient(135deg, #d4af3733 0%, #d4af3720 100%)',
                          }}
                        >
                          <div className="flex justify-between items-center relative z-10 gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="relative shrink-0">
                                <PlayerHeadshot
                                  playerId={player.playerId}
                                  sport={selectedSport as 'nba' | 'nfl'}
                                  className={`w-8 h-8 md:w-10 md:h-10 rounded-full object-cover bg-white/5${isInvalid ? ' grayscale' : ''}`}
                                />
                                {isInvalid && (
                                  <div className="absolute inset-0 rounded-full bg-red-500/30" />
                                )}
                              </div>
                              <div className="overflow-hidden flex-1">
                                <div
                                  className={`capcrunch-kicker text-[7px] md:text-[8px] ${isInvalid ? 'text-red-400/50' : 'text-white/50'}`}
                                >
                                  {selectedSport?.toUpperCase()} • {getCategoryAbbr(statCategory!)}
                                </div>
                                <div
                                  className={`capcrunch-title text-sm md:text-base truncate ${isInvalid ? 'text-red-400' : 'text-white'}`}
                                >
                                  {player.playerName}
                                </div>
                                <div
                                  className={`text-xs ${isInvalid ? 'text-red-400/60' : 'text-white/60'}`}
                                >
                                  {formatPickTeam(player.team)} • {player.selectedYear}
                                </div>
                                {isBust && (
                                  <div className="text-[9px] text-red-400/70 mt-0.5">
                                    busted by {fmt(totalBefore + player.statValue - targetCap)}
                                  </div>
                                )}
                                {isNotOnTeam && (
                                  <div className="text-[9px] text-orange-400/70 mt-0.5">
                                    {getPickErrorMessage(player)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p
                                className={`capcrunch-title text-lg md:text-xl ${isInvalid ? 'text-red-400' : player.statValue === 0 ? 'text-red-400' : 'text-[#FDF100]'}`}
                              >
                                {isBust ? `${fmt(player.statValue)}→0` : fmt(player.statValue)}
                              </p>
                              {(isBust || isNotOnTeam) && (
                                <div className="bg-red-700 text-white text-[7px] px-1.5 py-0.5 capcrunch-kicker font-bold shadow-sm mt-1 text-center">
                                  {getPickBadgeLabel(player)}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    });
                  })()}
                </div>
                {/* Cap contribution bar chart */}
                {lineup.selectedPlayers.length > 0 &&
                  (() => {
                    const PICK_COLORS = ['#818cf8', '#34d399', '#fb923c', '#f472b6', '#60a5fa'];
                    const validTotal = lineup.selectedPlayers
                      .filter((p) => !p.isBust && !p.neverOnTeam)
                      .reduce((s, p) => s + p.statValue, 0);
                    if (validTotal === 0) return null;
                    return (
                      <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-white/5 pt-3">
                        <div className="capcrunch-kicker text-[7px] text-white/25 tracking-widest uppercase mb-2">
                          Cap usage
                        </div>
                        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden flex gap-px">
                          {lineup.selectedPlayers.map((p, i) => {
                            const pct =
                              p.isBust || p.neverOnTeam
                                ? 0
                                : Math.min((p.statValue / targetCap) * 100, 100);
                            return (
                              <motion.div
                                key={i}
                                className="h-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{
                                  delay: 0.3 + i * 0.1,
                                  duration: 0.45,
                                  ease: 'easeOut',
                                }}
                                style={{ backgroundColor: PICK_COLORS[i % PICK_COLORS.length] }}
                              />
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                          {lineup.selectedPlayers.map((p, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <div
                                className="w-1.5 h-1.5 rounded-sm shrink-0"
                                style={{
                                  backgroundColor: PICK_COLORS[i % PICK_COLORS.length],
                                  opacity: p.isBust || p.neverOnTeam ? 0.25 : 1,
                                }}
                              />
                              <span className="capcrunch-kicker text-[8px] text-white/35 truncate max-w-[64px]">
                                {p.playerName.split(' ').slice(-1)[0]}
                              </span>
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
