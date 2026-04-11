/**
 * LobbyHostSettings.tsx — Expandable settings accordion for the lobby host.
 *
 * Manages all edit state internally and syncs from the `lobby` prop whenever
 * the panel is not open (so live lobby changes don't clobber in-progress edits).
 * When the host clicks Apply, calls `onApply(values)` with the current form
 * values — LobbyWaitingPage handles the actual Supabase writes.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamSelector } from '../home/TeamSelector';
import { YearSelector } from '../home/YearSelector';
import { nflTeams } from '../../data/nfl-teams';
import { teams } from '../../data/teams';
import { ALL_BOX_SCORE_YEARS } from '../../services/boxScoreData';
import type { GenericTeam } from '../../data/homeGames';
import type { Sport } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GameTypeValue =
  | 'roster' | 'career' | 'scramble'
  | 'lineup-is-right' | 'box-score' | 'starting-lineup';

/** All current form values, passed to onApply so the parent can write to Supabase. */
export interface HostFormValues {
  gameType: GameTypeValue;
  sport: Sport;
  randomSport: boolean;
  gameMode: 'random' | 'manual';
  selectionScope: 'team' | 'division';
  team: GenericTeam | null;
  year: number | null;
  timer: number;
  minYear: number;
  maxYear: number;
  winTarget: number;
  careerFrom: number;
  careerTo: number;
  lineupStat: string;
  totalRounds: number;
  customCap: number | null;
  hardMode: boolean;
  firstPickerId: string | null;
  boxMinYear: number;
  boxMaxYear: number;
  boxTeam: string | null;
  startingSport: 'nba' | 'nfl';
}

interface Props {
  lobby: any;
  players: { player_id: string; player_name: string }[];
  onApply: (values: HostFormValues) => Promise<void>;
}

// Abbreviated display labels for Cap Crunch stat categories
const LINEUP_STAT_ABBR: Record<string, string> = {
  random: 'RANDOM',
  pts: 'PTS', ast: 'AST', reb: 'REB', min: 'MIN', pra: 'PRA',
  passing_yards: 'PASS YD', passing_tds: 'PASS TD', interceptions: 'INT',
  rushing_yards: 'RUSH YD', rushing_tds: 'RUSH TD',
  receiving_yards: 'REC YD', receiving_tds: 'REC TD', receptions: 'REC',
  total_gp: 'TOT GP',
  career_passing_yards:   'CAREER PASS YD',
  career_passing_tds:     'CAREER PASS TD',
  career_rushing_yards:   'CAREER RUSH YD',
  career_rushing_tds:     'CAREER RUSH TD',
  career_receiving_yards: 'CAREER REC YD',
  career_receiving_tds:   'CAREER REC TD',
};

const NFL_CAREER_CATS = [
  'career_passing_yards', 'career_passing_tds',
  'career_rushing_yards', 'career_rushing_tds',
  'career_receiving_yards', 'career_receiving_tds',
] as const;

export function LobbyHostSettings({ lobby, players, onApply }: Props) {
  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editGameType,        setEditGameType]        = useState<GameTypeValue>('roster');
  const [editSport,           setEditSport]           = useState<Sport>('nba');
  const [editRandomSport,     setEditRandomSport]     = useState(false);
  const [editGameMode,        setEditGameMode]        = useState<'random' | 'manual'>('manual');
  const [editSelectionScope,  setEditSelectionScope]  = useState<'team' | 'division'>('team');
  const [editTeam,            setEditTeam]            = useState<GenericTeam | null>(null);
  const [editYear,            setEditYear]            = useState<number | null>(null);
  const [editTimer,           setEditTimer]           = useState(90);
  const [editCustomTimer,     setEditCustomTimer]     = useState('');
  const [editMinYear,         setEditMinYear]         = useState(2015);
  const [editMaxYear,         setEditMaxYear]         = useState(2025);
  const [editWinTarget,       setEditWinTarget]       = useState(3);
  const [editCareerFrom,      setEditCareerFrom]      = useState(0);
  const [editCareerTo,        setEditCareerTo]        = useState(0);
  const [editLineupStat,      setEditLineupStat]      = useState('random');
  const [editTotalRounds,     setEditTotalRounds]     = useState(5);
  const [editCustomCap,       setEditCustomCap]       = useState<number | null>(null);
  const [editHardMode,        setEditHardMode]        = useState(false);
  const [editFirstPickerId,   setEditFirstPickerId]   = useState<string | null>(null);
  const [editBoxMinYear,      setEditBoxMinYear]      = useState(2015);
  const [editBoxMaxYear,      setEditBoxMaxYear]      = useState(2024);
  const [editBoxTeam,         setEditBoxTeam]         = useState<string | null>(null);
  const [editStartingSport,   setEditStartingSport]   = useState<'nba' | 'nfl'>('nfl');

  // Sync form state from lobby whenever the settings panel mounts / lobby changes.
  // This keeps the form fresh after another player changes lobby data.
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
    setEditFirstPickerId((cs.firstPickerId as string) || null);
    setEditTotalRounds((cs.totalRounds as number) || 5);
    setEditBoxMinYear(cs.min_year || 2015);
    setEditBoxMaxYear(cs.max_year || 2024);
    setEditBoxTeam(cs.team || null);
    setEditStartingSport((cs.sport as 'nba' | 'nfl') || 'nfl');

    const teamList = lobbySport === 'nba' ? teams : nflTeams;
    const foundTeam = teamList.find(t => t.abbreviation === lobby.team_abbreviation);
    setEditTeam(foundTeam || null);

    const yearMatch = lobby.season?.match(/^(\d{4})/);
    setEditYear(yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear());
  }, [lobby?.id, lobby?.sport, lobby?.game_mode, lobby?.timer_duration,
      lobby?.team_abbreviation, lobby?.season, lobby?.min_year, lobby?.max_year,
      lobby?.game_type, lobby?.career_state]);

  // ── Sport change handler ───────────────────────────────────────────────────
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

  // ── Apply ──────────────────────────────────────────────────────────────────
  const handleApply = () => {
    onApply({
      gameType: editGameType,
      sport: editSport,
      randomSport: editRandomSport,
      gameMode: editGameMode,
      selectionScope: editSelectionScope,
      team: editTeam,
      year: editYear,
      timer: editTimer,
      minYear: editMinYear,
      maxYear: editMaxYear,
      winTarget: editWinTarget,
      careerFrom: editCareerFrom,
      careerTo: editCareerTo,
      lineupStat: editLineupStat,
      totalRounds: editTotalRounds,
      customCap: editCustomCap,
      hardMode: editHardMode,
      firstPickerId: editFirstPickerId,
      boxMinYear: editBoxMinYear,
      boxMaxYear: editBoxMaxYear,
      boxTeam: editBoxTeam,
      startingSport: editStartingSport,
    });
  };

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

          {/* ── Scramble settings ── */}
          {editGameType === 'scramble' && (
            <>
              <SportToggle sport={editSport} onChange={s => setEditSport(s as Sport)} />

              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Points Target</div>
                <div className="flex gap-1.5">
                  {[10, 20, 30, 40, 50].map(n => (
                    <button key={n} onClick={() => setEditWinTarget(n)}
                      className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${editWinTarget === n ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Career Era</div>
                <select value={editCareerTo} onChange={e => setEditCareerTo(parseInt(e.target.value))}
                  className="w-full bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none">
                  <option value={0}>Any Era</option>
                  {Array.from({ length: 2024 - 2000 + 1 }, (_, i) => 2000 + i).map(y => (
                    <option key={y} value={y}>Active into {y}+</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* ── Career settings ── */}
          {editGameType === 'career' && (
            <>
              <SportToggle sport={editSport} onChange={s => setEditSport(s as Sport)} />

              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">First To</div>
                <div className="flex gap-1.5">
                  {[2, 3, 4, 5, 7].map(n => (
                    <button key={n} onClick={() => setEditWinTarget(n)}
                      className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${editWinTarget === n ? 'bg-[#d4af37] text-black' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Era Filter</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="sports-font text-[9px] text-[#444] block mb-1">Started from</label>
                    <select value={editCareerFrom} onChange={e => setEditCareerFrom(parseInt(e.target.value))}
                      className="w-full bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none">
                      <option value={0}>Any</option>
                      {Array.from({ length: 2015 - 1980 + 1 }, (_, i) => 1980 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sports-font text-[9px] text-[#444] block mb-1">Active into</label>
                    <select value={editCareerTo} onChange={e => setEditCareerTo(parseInt(e.target.value))}
                      className="w-full bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none">
                      <option value={0}>Any</option>
                      {Array.from({ length: 2026 - 1990 + 1 }, (_, i) => 1990 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Cap Crunch (Lineup Is Right) settings ── */}
          {editGameType === 'lineup-is-right' && (
            <>
              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Sport</div>
                <div className="flex gap-1.5">
                  {(['nba', 'nfl'] as const).map(s => (
                    <button key={s}
                      onClick={() => { setEditSport(s); setEditLineupStat('random'); setEditCustomCap(null); }}
                      className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${editSport === s ? (s === 'nba' ? 'bg-[#f15a29] text-white' : 'bg-[#013369] text-white') : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stat category */}
              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Stat Category</div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(['random', ...(editSport === 'nba'
                    ? ['pts', 'ast', 'reb', 'min', 'pra', 'total_gp']
                    : ['passing_yards', 'passing_tds', 'interceptions', 'rushing_yards', 'rushing_tds', 'receiving_yards', 'receiving_tds', 'receptions', 'total_gp']
                  )] as string[]).map(cat => (
                    <button key={cat}
                      onClick={() => { setEditLineupStat(cat); if (cat === 'random') setEditCustomCap(null); }}
                      className={`px-2.5 py-1.5 rounded-sm sports-font text-[10px] tracking-wider transition-all ${editLineupStat === cat ? (cat === 'random' ? 'bg-[#d4af37] text-black' : 'bg-[#ec4899] text-white') : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                      {LINEUP_STAT_ABBR[cat] || cat.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* NFL career totals sub-section */}
                {editSport === 'nfl' && (
                  <div>
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-[#1e1e1e]" />
                      <span className="sports-font text-[8px] text-[#444] tracking-[0.3em] uppercase">Career Totals</span>
                      <div className="flex-1 h-px bg-[#1e1e1e]" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => {
                          const pick = NFL_CAREER_CATS[Math.floor(Math.random() * NFL_CAREER_CATS.length)];
                          setEditLineupStat(pick);
                          setEditCustomCap(null);
                        }}
                        className="px-2.5 py-1.5 rounded-sm sports-font text-[10px] tracking-wider transition-all bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]"
                      >
                        RANDOM
                      </button>
                      {NFL_CAREER_CATS.map(cat => (
                        <button key={cat}
                          onClick={() => { setEditLineupStat(cat); setEditCustomCap(null); }}
                          className={`px-2.5 py-1.5 rounded-sm sports-font text-[10px] tracking-wider transition-all ${editLineupStat === cat ? 'bg-[#ec4899] text-white' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                          {LINEUP_STAT_ABBR[cat]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom cap */}
              <div className="border-t border-[#1a1a1a] pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="sports-font text-[10px] text-[#777] tracking-widest uppercase">Target Cap</div>
                    <div className="sports-font text-[9px] text-[#444] mt-0.5">
                      {editLineupStat === 'random' ? 'Select a stat to set a cap' : 'Players must stay under this number'}
                    </div>
                  </div>
                  <input
                    type="number" min={1}
                    disabled={editLineupStat === 'random'}
                    value={editLineupStat === 'random' ? '' : (editCustomCap ?? '')}
                    placeholder="AUTO"
                    onChange={e => {
                      const v = e.target.value === '' ? null : parseInt(e.target.value);
                      setEditCustomCap(v && !isNaN(v) && v > 0 ? v : null);
                    }}
                    className={`w-24 text-center bg-[#111] border rounded-sm retro-title text-base py-1.5 focus:outline-none transition-all ${editLineupStat === 'random' ? 'border-[#1a1a1a] text-[#333] cursor-not-allowed placeholder-[#222]' : 'border-[#2a2a2a] text-[#d4af37] focus:border-[#d4af37] placeholder-[#444]'}`}
                  />
                </div>
              </div>

              {/* Hard mode */}
              <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-4">
                <div>
                  <div className="sports-font text-[10px] text-[#777] tracking-widest uppercase">Hard Mode</div>
                  <div className="sports-font text-[9px] text-[#444] mt-0.5">Pick one at a time; locks globally</div>
                </div>
                <button
                  onClick={() => { setEditHardMode(prev => !prev); setEditFirstPickerId(null); }}
                  className={`px-4 py-1.5 rounded-sm retro-title text-sm tracking-wider transition-all ${editHardMode ? 'bg-[#c8102e] text-white' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a]'}`}>
                  {editHardMode ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* First pick selector — hard mode only */}
              {editHardMode && players.length > 1 && (
                <div className="border-t border-[#1a1a1a] pt-4">
                  <div className="sports-font text-[10px] text-[#777] tracking-widest uppercase mb-2">First Pick</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setEditFirstPickerId(null)}
                      className={`px-2.5 py-1.5 rounded-sm sports-font text-[10px] tracking-wider transition-all ${editFirstPickerId === null ? 'bg-[#d4af37] text-black' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                      AUTO
                    </button>
                    {players.map(p => (
                      <button key={p.player_id} onClick={() => setEditFirstPickerId(p.player_id)}
                        className={`px-2.5 py-1.5 rounded-sm sports-font text-[10px] tracking-wider transition-all ${editFirstPickerId === p.player_id ? 'bg-[#c8102e] text-white' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                        {p.player_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Round count */}
              <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-4">
                <div>
                  <div className="sports-font text-[10px] text-[#777] tracking-widest uppercase">Rounds</div>
                  <div className="sports-font text-[9px] text-[#444] mt-0.5">Picks per player</div>
                </div>
                <div className="flex gap-1">
                  {[3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setEditTotalRounds(n)}
                      className={`w-6 h-6 rounded-sm sports-font text-[10px] transition ${editTotalRounds === n ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Box Score settings ── */}
          {editGameType === 'box-score' && (
            <>
              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Year Range</div>
                <div className="flex items-center gap-2">
                  <select value={editBoxMinYear}
                    onChange={e => { const v = parseInt(e.target.value); setEditBoxMinYear(v); if (v > editBoxMaxYear) setEditBoxMaxYear(v); }}
                    className="flex-1 bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none">
                    {ALL_BOX_SCORE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <span className="text-[#444] sports-font text-xs">to</span>
                  <select value={editBoxMaxYear}
                    onChange={e => { const v = parseInt(e.target.value); setEditBoxMaxYear(v); if (v < editBoxMinYear) setEditBoxMinYear(v); }}
                    className="flex-1 bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none">
                    {ALL_BOX_SCORE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Team Filter</div>
                <select value={editBoxTeam || ''} onChange={e => setEditBoxTeam(e.target.value || null)}
                  className="w-full bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none">
                  <option value="">Any Team</option>
                  {nflTeams.map(t => <option key={t.abbreviation} value={t.abbreviation}>{t.name}</option>)}
                </select>
              </div>

              <TimerPicker
                timer={editTimer} customTimer={editCustomTimer}
                presets={[90, 120, 150, 180, 240]}
                activeColor="bg-[#f59e0b] text-black"
                onSelect={(s) => { setEditTimer(s); setEditCustomTimer(''); }}
                onCustomChange={(raw, clamped) => { setEditCustomTimer(raw); if (raw) setEditTimer(clamped); }}
              />
            </>
          )}

          {/* ── Starting Lineup settings ── */}
          {editGameType === 'starting-lineup' && (
            <>
              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Sport</div>
                <div className="flex gap-1.5">
                  {(['nfl', 'nba'] as const).map(s => (
                    <button key={s} onClick={() => setEditStartingSport(s)}
                      className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${editStartingSport === s ? (s === 'nba' ? 'bg-[#f15a29] text-white' : 'bg-[#013369] text-white') : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">First To</div>
                <div className="flex gap-1.5">
                  {[10, 20, 30].map(n => (
                    <button key={n} onClick={() => setEditWinTarget(n)}
                      className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${editWinTarget === n ? 'bg-[#16a34a] text-white' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Roster settings ── */}
          {editGameType === 'roster' && (
            <>
              {/* Sport: NBA / NFL / Random */}
              <div>
                <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Sport</div>
                <div className="flex gap-1.5">
                  {(['nba', 'nfl', 'random'] as const).map(s => (
                    <button key={s} onClick={() => handleSportChange(s)}
                      className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                        (s === 'random' && editRandomSport) || (s !== 'random' && !editRandomSport && editSport === s)
                          ? s === 'nba' ? 'bg-[#f15a29] text-white' : s === 'nfl' ? 'bg-[#013369] text-white' : 'bg-[#d4af37] text-black'
                          : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
                      }`}>
                      {s === 'random' ? '?' : s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {editRandomSport ? (
                <div className="text-center sports-font text-[10px] text-[#444] tracking-wider">
                  Sport and team will be randomly selected
                </div>
              ) : (
                <>
                  {/* Random vs Manual */}
                  <div>
                    <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Selection</div>
                    <div className="flex gap-1.5">
                      {(['random', 'manual'] as const).map(m => (
                        <button key={m} onClick={() => setEditGameMode(m)}
                          className={`flex-1 py-2 rounded-sm sports-font text-xs tracking-wider uppercase transition-all ${editGameMode === m ? 'bg-[#d4af37] text-black' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scope: team vs division (random mode only) */}
                  {editGameMode === 'random' && (
                    <div>
                      <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Scope</div>
                      <div className="flex gap-1.5">
                        {(['team', 'division'] as const).map(sc => (
                          <button key={sc} onClick={() => setEditSelectionScope(sc)}
                            className={`flex-1 py-2 rounded-sm sports-font text-xs tracking-wider uppercase transition-all ${editSelectionScope === sc ? 'bg-[#d4af37] text-black' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
                            {sc}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual: team + year pickers */}
                  {editGameMode === 'manual' && (
                    <div className="space-y-3">
                      <TeamSelector selectedTeam={editTeam} onSelect={setEditTeam} sport={editSport} />
                      <YearSelector selectedYear={editYear} onSelect={setEditYear} minYear={2000} maxYear={2025} sport={editSport} />
                    </div>
                  )}

                  {/* Random: year range */}
                  {editGameMode === 'random' && (
                    <div>
                      <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Year Range</div>
                      <div className="flex items-center gap-2">
                        <select value={editMinYear} onChange={e => setEditMinYear(parseInt(e.target.value))}
                          className="flex-1 bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none">
                          {Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <span className="text-[#444] sports-font text-xs">to</span>
                        <select value={editMaxYear} onChange={e => setEditMaxYear(parseInt(e.target.value))}
                          className="flex-1 bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none">
                          {Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}

              <TimerPicker
                timer={editTimer} customTimer={editCustomTimer}
                presets={[60, 90, 120, 180, 300]}
                activeColor="bg-[#d4af37] text-black"
                onSelect={(s) => { setEditTimer(s); setEditCustomTimer(''); }}
                onCustomChange={(raw, clamped) => { setEditCustomTimer(raw); if (raw) setEditTimer(clamped); }}
              />
            </>
          )}

          {/* Apply button */}
          <button
            onClick={handleApply}
            disabled={editGameType === 'roster' && editGameMode === 'manual' && !editRandomSport && (!editTeam || !editYear)}
            className="w-full py-2.5 rounded-sm retro-title text-base tracking-wider transition-all disabled:opacity-40 bg-[#d4af37] text-black hover:bg-[#e0be4a] active:scale-[0.98]"
          >
            Apply
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Local helper components ────────────────────────────────────────────────────

function SportToggle({ sport, onChange }: { sport: string; onChange: (s: string) => void }) {
  return (
    <div>
      <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Sport</div>
      <div className="flex gap-1.5">
        {(['nba', 'nfl'] as const).map(s => (
          <button key={s} onClick={() => onChange(s)}
            className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${sport === s ? (s === 'nba' ? 'bg-[#f15a29] text-white' : 'bg-[#013369] text-white') : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
            {s.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TimerPickerProps {
  timer: number;
  customTimer: string;
  presets: number[];
  activeColor: string;
  onSelect: (seconds: number) => void;
  onCustomChange: (raw: string, clamped: number) => void;
}

function TimerPicker({ timer, customTimer, presets, activeColor, onSelect, onCustomChange }: TimerPickerProps) {
  return (
    <div>
      <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Timer</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presets.map(s => (
          <button key={s} onClick={() => onSelect(s)}
            className={`flex-1 py-2 rounded-sm sports-font text-xs transition-all ${timer === s && !customTimer ? activeColor : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'}`}>
            {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#444] text-[10px] sports-font tracking-wider">Custom:</span>
        <input
          type="number"
          value={customTimer}
          onChange={e => {
            const raw = e.target.value;
            const clamped = Math.max(10, Math.min(600, parseInt(raw) || 90));
            onCustomChange(raw, clamped);
          }}
          placeholder="sec" min={10} max={600}
          className="w-20 px-2 py-1.5 bg-[#111] rounded-sm border border-[#2a2a2a] text-[#ccc] text-center sports-font text-sm focus:outline-none focus:border-[#444]"
        />
        {customTimer && (
          <span className="text-[#666] sports-font text-sm">
            = {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
          </span>
        )}
      </div>
    </div>
  );
}
