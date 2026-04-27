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

import { useState, useEffect } from 'react';
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

// ── Types ─────────────────────────────────────────────────────────────────────

export type GameTypeValue =
  | 'roster' | 'career' | 'scramble'
  | 'lineup-is-right' | 'box-score' | 'starting-lineup';

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
}

interface Props {
  lobby: any;
  players: { player_id: string; player_name: string }[];
  onApply: (values: HostFormValues) => Promise<void>;
}

export function LobbyHostSettings({ lobby, players, onApply }: Props) {
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
  const [editStartingSport,  setEditStartingSport]  = useState<'nba' | 'nfl'>('nfl');

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
    setEditBoxMinYear(cs.min_year || 2015);
    setEditBoxMaxYear(cs.max_year || 2024);
    setEditBoxTeam(cs.team || null);
    setEditStartingSport((cs.sport as 'nba' | 'nfl') || 'nfl');

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
        <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-sm p-4 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#1f1f1f]" />
            <span className="sports-font text-[9px] text-[#555] tracking-[0.35em] uppercase">Host Settings</span>
            <div className="h-px flex-1 bg-[#1f1f1f]" />
          </div>

          {/* Mode selector */}
          <div>
            <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Mode</div>
            <select
              value={editGameType}
              onChange={e => setEditGameType(e.target.value as GameTypeValue)}
              className="w-full bg-[#111] text-[#ccc] px-3 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
            >
              <option value="roster">★ Roster Challenge</option>
              <option value="career">Career Arc</option>
              <option value="scramble">Name Scramble</option>
              <option value="lineup-is-right">★ Cap Crunch</option>
              <option value="box-score">Box Score</option>
              <option value="starting-lineup">Starters</option>
            </select>
          </div>

          {/* Game-type-specific settings */}
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
            />
          )}

          {editGameType === 'box-score' && (
            <BoxScoreSettings
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
            className="w-full py-2.5 rounded-sm retro-title text-base tracking-wider transition-all disabled:opacity-40 bg-[#d4af37] text-black hover:bg-[#e0be4a] active:scale-[0.98]"
          >
            Apply
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
