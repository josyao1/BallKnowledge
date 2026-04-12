/**
 * BoxScoreSettings.tsx — Host settings for the Box Score game mode.
 * Year range, team filter, and timer.
 */

import { TimerPicker } from './SettingsHelpers';
import { ALL_BOX_SCORE_YEARS } from '../../../services/boxScoreData';
import { nflTeams } from '../../../data/nfl-teams';

interface Props {
  boxMinYear: number;
  onBoxMinYearChange: (y: number) => void;
  boxMaxYear: number;
  onBoxMaxYearChange: (y: number) => void;
  boxTeam: string | null;
  onBoxTeamChange: (t: string | null) => void;
  timer: number;
  customTimer: string;
  onTimerSelect: (s: number) => void;
  onCustomTimerChange: (raw: string, clamped: number) => void;
}

export function BoxScoreSettings({
  boxMinYear, onBoxMinYearChange, boxMaxYear, onBoxMaxYearChange,
  boxTeam, onBoxTeamChange, timer, customTimer, onTimerSelect, onCustomTimerChange,
}: Props) {
  return (
    <>
      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Year Range</div>
        <div className="flex items-center gap-2">
          <select
            value={boxMinYear}
            onChange={e => { const v = parseInt(e.target.value); onBoxMinYearChange(v); if (v > boxMaxYear) onBoxMaxYearChange(v); }}
            className="flex-1 bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
          >
            {ALL_BOX_SCORE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-[#444] sports-font text-xs">to</span>
          <select
            value={boxMaxYear}
            onChange={e => { const v = parseInt(e.target.value); onBoxMaxYearChange(v); if (v < boxMinYear) onBoxMinYearChange(v); }}
            className="flex-1 bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
          >
            {ALL_BOX_SCORE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Team Filter</div>
        <select
          value={boxTeam || ''}
          onChange={e => onBoxTeamChange(e.target.value || null)}
          className="w-full bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
        >
          <option value="">Any Team</option>
          {nflTeams.map(t => <option key={t.abbreviation} value={t.abbreviation}>{t.name}</option>)}
        </select>
      </div>

      <TimerPicker
        timer={timer} customTimer={customTimer}
        presets={[90, 120, 150, 180, 240]}
        activeColor="bg-[#f59e0b] text-black"
        onSelect={onTimerSelect}
        onCustomChange={onCustomTimerChange}
      />
    </>
  );
}
