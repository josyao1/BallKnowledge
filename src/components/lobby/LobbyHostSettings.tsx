/**
 * LobbyHostSettings.tsx — Expandable settings accordion for the lobby host.
 *
 * Manages all edit state internally and syncs from the `lobby` prop whenever
 * the panel mounts or lobby fields change (so live updates don't clobber
 * in-progress edits). When the host clicks Apply, calls `onApply(values)` —
 * LobbyWaitingPage handles the actual Supabase writes.
 *
 * Game-type-specific form blocks live in ./settings/:
 *   ScrambleSettings, CareerSettings, CapCrunchSettings,
 *   BoxScoreSettings, StartingLineupSettings, RosterSettings
 */

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { SpecialRoundType } from '../../services/capCrunch';
import { motion, AnimatePresence } from 'framer-motion';
import { nflTeams } from '../../data/nfl-teams';
import { teams } from '../../data/teams';
import type { GenericTeam } from '../../data/homeGames';
import type { Sport } from '../../types';
import { ScrambleSettings }       from './settings/ScrambleSettings';
import { CareerSettings }         from './settings/CareerSettings';
import { CapCrunchSettings }      from './settings/CapCrunchSettings';
import { BoxScoreSettings }       from './settings/BoxScoreSettings';
import { StartingLineupSettings } from './settings/StartingLineupSettings';
import { RosterSettings }         from './settings/RosterSettings';
import { FaceRevealSettings }     from './settings/FaceRevealSettings';
import { TopTenSettings }         from './settings/TopTenSettings';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GameTypeValue =
  | 'roster' | 'career' | 'scramble'
  | 'lineup-is-right' | 'box-score' | 'nba-box-score' | 'starting-lineup' | 'face-reveal' | 'top-ten';

/** All current form values, passed to onApply so the parent can write to Supabase. */
export interface HostFormValues {
  gameType: GameTypeValue;
  sport: Sport;
  /** When true, sport is randomized each round (roster mode only) */
  randomSport: boolean;
  /** Manual = host picks a specific team/year; random = randomized each round */
  gameMode: 'random' | 'manual';
  /** Whether the roster challenge pools from one team or an entire division */
  selectionScope: 'team' | 'division';
  team: GenericTeam | null;
  year: number | null;
  timer: number;
  /** Roster/scramble: inclusive lower bound for eligible seasons */
  minYear: number;
  /** Roster/scramble: inclusive upper bound for eligible seasons */
  maxYear: number;
  /** Career/scramble: number of rounds a player must win to claim the match */
  winTarget: number;
  /** Career: earliest birth/draft year to include (0 = no filter) */
  careerFrom: number;
  /** Career/scramble: latest birth/draft year to include (0 = no filter) */
  careerTo: number;
  /** Cap Crunch: forced stat category, or 'random' to pick one each round */
  lineupStat: string;
  /** Cap Crunch: number of pick rounds per game */
  totalRounds: number;
  /** Cap Crunch: fixed target cap value; null = randomly generated each round */
  customCap: number | null;
  /** Cap Crunch: turn-based (one picker at a time) vs simultaneous */
  hardMode: boolean;
  /** Cap Crunch: scores hidden during game; host reveals picks after all rounds */
  blindMode: boolean;
  /** Cap Crunch: seconds allowed per turn (hard mode) or for last player (normal); null = no timer */
  pickTimer: number | null;
  /** Cap Crunch hard mode: player_id of who picks first; null = random */
  firstPickerId: string | null;
  /** Box Score: inclusive lower bound for eligible game dates */
  boxMinYear: number;
  /** Box Score: inclusive upper bound for eligible game dates */
  boxMaxYear: number;
  /** Box Score: filter to a specific team abbreviation; null = any team */
  boxTeam: string | null;
  startingSport: 'nba' | 'nfl';
  /** Face Reveal: seconds per zoom level */
  faceRevealTimer: number;
  /** Face Reveal (NFL): min peak-season yards for offensive players */
  faceRevealMinYards: number;
  /** Face Reveal (NBA): min season MPG to include role players (0 = any) */
  faceRevealMinMpg: number;
  /** Face Reveal (NFL): 'known' = curated allowlist only; 'all' = all positions */
  faceRevealDefenseMode: 'known' | 'all';
  topTenSport: 'nba' | 'nfl';
  topTenRoundType: 'league' | 'division' | 'team';
  topTenDivisionMode: 'cumulative' | 'single_season';
  topTenMinYear: number;
  topTenMaxYear: number;
  topTenWindowYears: number;
  topTenMaxStrikes: number;
  topTenTimer: number;
  topTenPinnedDivision: string | null;
  topTenPinnedTeam: string | null;
  /** Cap Crunch: special round types the host has disabled */
  disabledRoundTypes: SpecialRoundType[];
}

export interface SettingsRef {
  getValues: () => HostFormValues;
}

interface Props {
  lobby: any;
  players: { player_id: string; player_name: string }[];
  onApply: (values: HostFormValues) => Promise<void>;
}

export const LobbyHostSettings = forwardRef<SettingsRef, Props>(function LobbyHostSettings({ lobby, players, onApply }, ref) {
  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editGameType,       setEditGameType]       = useState<GameTypeValue>('roster');
  const [editSport,          setEditSport]          = useState<Sport>('nba');
  const [editRandomSport,    setEditRandomSport]    = useState(false);
  const [editGameMode,       setEditGameMode]       = useState<'random' | 'manual'>('manual');
  const [editSelectionScope, setEditSelectionScope] = useState<'team' | 'division'>('team');
  const [editTeam,           setEditTeam]           = useState<GenericTeam | null>(null);
  const [editYear,           setEditYear]           = useState<number | null>(null);
  const [editTimer,          setEditTimer]          = useState(90);
  const [editCustomTimer,    setEditCustomTimer]    = useState('');
  const [editMinYear,        setEditMinYear]        = useState(2015);
  const [editMaxYear,        setEditMaxYear]        = useState(2025);
  const [editWinTarget,      setEditWinTarget]      = useState(3);
  const [editCareerFrom,     setEditCareerFrom]     = useState(0);
  const [editCareerTo,       setEditCareerTo]       = useState(0);
  const [editLineupStat,     setEditLineupStat]     = useState('random');
  const [editTotalRounds,    setEditTotalRounds]    = useState(5);
  const [editCustomCap,      setEditCustomCap]      = useState<number | null>(null);
  const [editHardMode,       setEditHardMode]       = useState(false);
  const [editBlindMode,      setEditBlindMode]      = useState(false);
  const [editPickTimer,      setEditPickTimer]      = useState<number | null>(null);
  const [editFirstPickerId,  setEditFirstPickerId]  = useState<string | null>(null);
  const [editBoxMinYear,     setEditBoxMinYear]     = useState(2015);
  const [editBoxMaxYear,     setEditBoxMaxYear]     = useState(2024);
  const [editBoxTeam,        setEditBoxTeam]        = useState<string | null>(null);
  const [editBoxSport,       setEditBoxSport]       = useState<'nba' | 'nfl'>('nfl');
  const [editStartingSport,  setEditStartingSport]  = useState<'nba' | 'nfl'>('nfl');
  const [editFaceRevealTimer,       setEditFaceRevealTimer]       = useState(60);
  const [editFaceRevealMinYards,    setEditFaceRevealMinYards]    = useState(0);
  const [editFaceRevealMinMpg,      setEditFaceRevealMinMpg]      = useState(0);
  const [editFaceRevealDefenseMode, setEditFaceRevealDefenseMode] = useState<'known' | 'all'>('known');
  const [editTopTenSport,        setEditTopTenSport]        = useState<'nba' | 'nfl'>('nba');
  const [editTopTenRoundType,    setEditTopTenRoundType]    = useState<'league' | 'division' | 'team'>('league');
  const [editTopTenDivisionMode, setEditTopTenDivisionMode] = useState<'cumulative' | 'single_season'>('cumulative');
  const [editTopTenMinYear,      setEditTopTenMinYear]      = useState(2015);
  const [editTopTenMaxYear,      setEditTopTenMaxYear]      = useState(2025);
  const [editTopTenWindowYears,  setEditTopTenWindowYears]  = useState(10);
  const [editTopTenMaxStrikes,      setEditTopTenMaxStrikes]      = useState(2);
  const [editTopTenTimer,           setEditTopTenTimer]           = useState(45);
  const [editTopTenPinnedDivision,  setEditTopTenPinnedDivision]  = useState<string | null>(null);
  const [editTopTenPinnedTeam,      setEditTopTenPinnedTeam]      = useState<string | null>(null);
  const [editDisabledRoundTypes,    setEditDisabledRoundTypes]    = useState<SpecialRoundType[]>([]);

  useImperativeHandle(ref, () => ({
    getValues: (): HostFormValues => ({
      gameType: editGameType, sport: editSport, randomSport: editRandomSport,
      gameMode: editGameMode, selectionScope: editSelectionScope,
      team: editTeam, year: editYear, timer: editTimer,
      minYear: editMinYear, maxYear: editMaxYear, winTarget: editWinTarget,
      careerFrom: editCareerFrom, careerTo: editCareerTo,
      lineupStat: editLineupStat, totalRounds: editTotalRounds,
      customCap: editCustomCap, hardMode: editHardMode, blindMode: editBlindMode,
      pickTimer: editPickTimer, firstPickerId: editFirstPickerId,
      boxMinYear: editBoxMinYear, boxMaxYear: editBoxMaxYear, boxTeam: editBoxTeam,
      startingSport: editStartingSport,
      faceRevealTimer: editFaceRevealTimer, faceRevealMinYards: editFaceRevealMinYards,
      faceRevealMinMpg: editFaceRevealMinMpg, faceRevealDefenseMode: editFaceRevealDefenseMode,
      topTenSport: editTopTenSport, topTenRoundType: editTopTenRoundType,
      topTenDivisionMode: editTopTenDivisionMode,
      topTenMinYear: editTopTenMinYear, topTenMaxYear: editTopTenMaxYear,
      topTenWindowYears: editTopTenWindowYears, topTenMaxStrikes: editTopTenMaxStrikes,
      topTenTimer: editTopTenTimer,
      topTenPinnedDivision: editTopTenPinnedDivision,
      topTenPinnedTeam: editTopTenPinnedTeam,
      disabledRoundTypes: editDisabledRoundTypes,
    }),
  }));

  // Sync form state from lobby whenever the settings panel mounts / lobby changes.
  useEffect(() => {
    if (!lobby) return;
    const lobbySport = lobby.sport as Sport;
    setEditGameType((lobby.game_type as GameTypeValue) || 'roster');
    setEditSport(lobbySport);
    setEditRandomSport(false);
    setEditGameMode(lobby.game_mode as 'random' | 'manual');
    setEditSelectionScope((lobby.selection_scope as 'team' | 'division') || 'team');
    setEditTimer(lobby.timer_duration);
    setEditCustomTimer('');
    setEditMinYear(lobby.min_year || 2000);
    setEditMaxYear(lobby.max_year || 2025);

    const cs = (lobby.career_state as any) || {};
    setEditWinTarget(cs.win_target || 3);
    setEditCareerFrom(cs.career_from || 0);
    setEditCareerTo(cs.career_to || 0);
    setEditLineupStat((cs.forcedStatCategory as string) || 'random');
    setEditCustomCap((cs.forcedTargetCap as number | null) || null);
    setEditHardMode((cs.hardMode as boolean) || false);
    setEditBlindMode((cs.blindMode as boolean) || false);
    setEditPickTimer((cs.pickTimer as number | null) ?? null);
    setEditFirstPickerId((cs.firstPickerId as string) || null);
    setEditTotalRounds((cs.totalRounds as number) || 5);
    const isNBABox = lobby.game_type === 'nba-box-score';
    setEditBoxSport(isNBABox ? 'nba' : 'nfl');
    setEditBoxMinYear(cs.min_year || (isNBABox ? 2014 : 2015));
    setEditBoxMaxYear(cs.max_year || 2025);
    setEditBoxTeam(cs.team || null);
    setEditStartingSport((cs.sport as 'nba' | 'nfl') || 'nfl');
    setEditFaceRevealTimer((cs.timer as number) || 60);
    setEditFaceRevealMinYards((cs.min_yards as number) || 0);
    setEditFaceRevealMinMpg((cs.min_mpg as number) || 0);
    setEditFaceRevealDefenseMode((cs.defense_mode as 'known' | 'all') || 'known');
    setEditTopTenSport((cs.top_ten_sport as 'nba' | 'nfl') || lobbySport as 'nba' | 'nfl');
    setEditTopTenRoundType((cs.top_ten_round_type as 'league' | 'division' | 'team') || 'league');
    setEditTopTenDivisionMode((cs.top_ten_division_mode as 'cumulative' | 'single_season') || 'cumulative');
    setEditTopTenMinYear((cs.top_ten_min_year as number) || (lobbySport === 'nba' ? 1996 : 1999));
    setEditTopTenMaxYear((cs.top_ten_max_year as number) || 2025);
    setEditTopTenWindowYears((cs.top_ten_window_years as number) || 10);
    setEditTopTenMaxStrikes((cs.max_strikes as number) || 2);
    setEditTopTenTimer((cs.turn_timer as number) || 45);
    setEditTopTenPinnedDivision((cs.top_ten_pinned_division as string | null) || null);
    setEditTopTenPinnedTeam((cs.top_ten_pinned_team as string | null) || null);
    setEditDisabledRoundTypes((cs.disabledRoundTypes as SpecialRoundType[]) || []);

    const teamList = lobbySport === 'nba' ? teams : nflTeams;
    setEditTeam(teamList.find(t => t.abbreviation === lobby.team_abbreviation) || null);

    const yearMatch = lobby.season?.match(/^(\d{4})/);
    setEditYear(yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear());
  }, [lobby?.id, lobby?.sport, lobby?.game_mode, lobby?.timer_duration,
      lobby?.team_abbreviation, lobby?.season, lobby?.min_year, lobby?.max_year,
      lobby?.game_type, lobby?.career_state]);

  // ── Sport change handler (Roster mode: handles NBA / NFL / Random) ─────────
  const handleSportChange = (newSport: Sport | 'random') => {
    if (newSport === 'random') {
      setEditRandomSport(true);
      setEditGameMode('random');
      setEditTeam(null);
      setEditYear(null);
    } else {
      setEditRandomSport(false);
      setEditSport(newSport);
      setEditTeam(null);
      setEditYear(null);
      if (newSport === 'nfl') {
        setEditMinYear(prev => Math.max(prev, 2000));
        setEditMaxYear(prev => Math.min(prev, 2024));
      }
    }
  };

  function handleBoxSportChange(s: 'nba' | 'nfl') {
    setEditBoxSport(s);
    setEditBoxTeam(null);
    setEditBoxMinYear(s === 'nba' ? 2014 : 2015);
    setEditBoxMaxYear(s === 'nba' ? 2025 : 2024);
    setEditGameType(s === 'nba' ? 'nba-box-score' : 'box-score');
  }

  function handleTopTenSportChange(s: 'nba' | 'nfl') {
    setEditTopTenSport(s);
    const minBound = s === 'nba' ? 1996 : 1999;
    const maxBound = s === 'nba' ? 2025 : 2024;
    setEditTopTenMinYear(prev => Math.max(minBound, Math.min(prev, maxBound)));
    setEditTopTenMaxYear(prev => Math.max(minBound, Math.min(prev, maxBound)));
  }

  const handleApply = () => {
    onApply({
      gameType: editGameType, sport: editSport, randomSport: editRandomSport,
      gameMode: editGameMode, selectionScope: editSelectionScope,
      team: editTeam, year: editYear, timer: editTimer,
      minYear: editMinYear, maxYear: editMaxYear, winTarget: editWinTarget,
      careerFrom: editCareerFrom, careerTo: editCareerTo,
      lineupStat: editLineupStat, totalRounds: editTotalRounds,
      customCap: editCustomCap, hardMode: editHardMode, blindMode: editBlindMode,
      pickTimer: editPickTimer, firstPickerId: editFirstPickerId, boxMinYear: editBoxMinYear,
      boxMaxYear: editBoxMaxYear, boxTeam: editBoxTeam,
      startingSport: editStartingSport,
      faceRevealTimer: editFaceRevealTimer,
      faceRevealMinYards: editFaceRevealMinYards,
      faceRevealMinMpg: editFaceRevealMinMpg,
      faceRevealDefenseMode: editFaceRevealDefenseMode,
      topTenSport: editTopTenSport,
      topTenRoundType: editTopTenRoundType,
      topTenDivisionMode: editTopTenDivisionMode,
      topTenMinYear: editTopTenMinYear,
      topTenMaxYear: editTopTenMaxYear,
      topTenWindowYears: editTopTenWindowYears,
      topTenMaxStrikes: editTopTenMaxStrikes,
      topTenTimer: editTopTenTimer,
      topTenPinnedDivision: editTopTenPinnedDivision,
      topTenPinnedTeam: editTopTenPinnedTeam,
      disabledRoundTypes: editDisabledRoundTypes,
    });
  };

  const applyDisabled = editGameType === 'roster'
    && editGameMode === 'manual'
    && !editRandomSport
    && (!editTeam || !editYear);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="capcrunch-panel p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/8" />
            <span className="capcrunch-kicker text-[9px] text-white/30">Host Settings</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          {/* Mode selector */}
          <div>
            <div className="capcrunch-kicker text-[9px] text-white/30 mb-1.5">Mode</div>
            <div className="relative">
              <select
                value={editGameType === 'nba-box-score' ? 'box-score' : editGameType}
                onChange={e => {
                  const v = e.target.value as GameTypeValue;
                  setEditGameType(v);
                  if (v === 'box-score') { setEditBoxSport('nfl'); setEditBoxMinYear(2015); setEditBoxMaxYear(2024); setEditBoxTeam(null); }
                }}
                className="w-full bg-black/40 text-white/80 px-3 py-2 pr-8 border border-white/15 sports-font text-sm focus:outline-none focus:border-white/30 appearance-none cursor-pointer transition-colors hover:border-white/25"
              >
                <option value="roster">★ Roster Challenge</option>
                <option value="career">Career Arc</option>
                <option value="scramble">Name Scramble</option>
                <option value="face-reveal">Face Reveal</option>
                <option value="lineup-is-right">★ Cap Crunch</option>
                <option value="box-score">Box Score</option>
                <option value="starting-lineup">Starters</option>
                <option value="top-ten">Top Ten</option>
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Game-type-specific settings */}
          {editGameType === 'face-reveal' && (
            <FaceRevealSettings
              sport={editSport} onSportChange={setEditSport}
              winTarget={editWinTarget} onWinTargetChange={setEditWinTarget}
              careerTo={editCareerTo} onCareerToChange={setEditCareerTo}
              faceRevealTimer={editFaceRevealTimer} onFaceRevealTimerChange={setEditFaceRevealTimer}
              minYards={editFaceRevealMinYards} onMinYardsChange={setEditFaceRevealMinYards}
              minMpg={editFaceRevealMinMpg} onMinMpgChange={setEditFaceRevealMinMpg}
              defenseMode={editFaceRevealDefenseMode} onDefenseModeChange={setEditFaceRevealDefenseMode}
            />
          )}

          {editGameType === 'scramble' && (
            <ScrambleSettings
              sport={editSport} onSportChange={setEditSport}
              winTarget={editWinTarget} onWinTargetChange={setEditWinTarget}
              careerTo={editCareerTo} onCareerToChange={setEditCareerTo}
            />
          )}

          {editGameType === 'career' && (
            <CareerSettings
              sport={editSport} onSportChange={setEditSport}
              winTarget={editWinTarget} onWinTargetChange={setEditWinTarget}
              careerFrom={editCareerFrom} onCareerFromChange={setEditCareerFrom}
              careerTo={editCareerTo} onCareerToChange={setEditCareerTo}
            />
          )}

          {editGameType === 'lineup-is-right' && (
            <CapCrunchSettings
              sport={editSport} onSportChange={setEditSport}
              lineupStat={editLineupStat} onLineupStatChange={setEditLineupStat}
              customCap={editCustomCap} onCustomCapChange={setEditCustomCap}
              hardMode={editHardMode} onHardModeChange={setEditHardMode}
              blindMode={editBlindMode} onBlindModeChange={setEditBlindMode}
              pickTimer={editPickTimer} onPickTimerChange={setEditPickTimer}
              firstPickerId={editFirstPickerId} onFirstPickerIdChange={setEditFirstPickerId}
              totalRounds={editTotalRounds} onTotalRoundsChange={setEditTotalRounds}
              players={players}
              disabledRoundTypes={editDisabledRoundTypes}
              onDisabledRoundTypesChange={setEditDisabledRoundTypes}
            />
          )}

          {(editGameType === 'box-score' || editGameType === 'nba-box-score') && (
            <BoxScoreSettings
              sport={editBoxSport} onSportChange={handleBoxSportChange}
              boxMinYear={editBoxMinYear} onBoxMinYearChange={setEditBoxMinYear}
              boxMaxYear={editBoxMaxYear} onBoxMaxYearChange={setEditBoxMaxYear}
              boxTeam={editBoxTeam} onBoxTeamChange={setEditBoxTeam}
              timer={editTimer} customTimer={editCustomTimer}
              onTimerSelect={s => { setEditTimer(s); setEditCustomTimer(''); }}
              onCustomTimerChange={(raw, clamped) => { setEditCustomTimer(raw); if (raw) setEditTimer(clamped); }}
            />
          )}

          {editGameType === 'starting-lineup' && (
            <StartingLineupSettings
              startingSport={editStartingSport} onStartingSportChange={setEditStartingSport}
              winTarget={editWinTarget} onWinTargetChange={setEditWinTarget}
            />
          )}

          {editGameType === 'top-ten' && (
            <TopTenSettings
              sport={editTopTenSport} onSportChange={handleTopTenSportChange}
              roundType={editTopTenRoundType} onRoundTypeChange={setEditTopTenRoundType}
              divisionMode={editTopTenDivisionMode} onDivisionModeChange={setEditTopTenDivisionMode}
              minYear={editTopTenMinYear} onMinYearChange={setEditTopTenMinYear}
              maxYear={editTopTenMaxYear} onMaxYearChange={setEditTopTenMaxYear}
              windowYears={editTopTenWindowYears} onWindowYearsChange={setEditTopTenWindowYears}
              maxStrikes={editTopTenMaxStrikes} onMaxStrikesChange={setEditTopTenMaxStrikes}
              turnTimer={editTopTenTimer} onTurnTimerChange={setEditTopTenTimer}
              pinnedDivision={editTopTenPinnedDivision} onPinnedDivisionChange={setEditTopTenPinnedDivision}
              pinnedTeam={editTopTenPinnedTeam} onPinnedTeamChange={setEditTopTenPinnedTeam}
            />
          )}

          {editGameType === 'roster' && (
            <RosterSettings
              sport={editSport} randomSport={editRandomSport} onSportChange={handleSportChange}
              gameMode={editGameMode} onGameModeChange={setEditGameMode}
              selectionScope={editSelectionScope} onSelectionScopeChange={setEditSelectionScope}
              team={editTeam} onTeamChange={setEditTeam}
              year={editYear} onYearChange={setEditYear}
              minYear={editMinYear} onMinYearChange={setEditMinYear}
              maxYear={editMaxYear} onMaxYearChange={setEditMaxYear}
              timer={editTimer} customTimer={editCustomTimer}
              onTimerSelect={s => { setEditTimer(s); setEditCustomTimer(''); }}
              onCustomTimerChange={(raw, clamped) => { setEditCustomTimer(raw); if (raw) setEditTimer(clamped); }}
            />
          )}

          <button
            onClick={handleApply}
            disabled={applyDisabled}
            className="w-full py-2.5 capcrunch-btn-primary capcrunch-title text-base disabled:opacity-30"
          >
            Apply
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});
