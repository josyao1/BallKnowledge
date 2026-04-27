/**
 * FaceRevealSettings.tsx — Host settings for the Face Reveal game mode.
 * Sport toggle, win target, era filter, and timer per zoom level.
 */

import { SportToggle } from './SettingsHelpers';
import type { Sport } from '../../../types';

interface Props {
  sport: Sport;
  onSportChange: (s: Sport) => void;
  winTarget: number;
  onWinTargetChange: (n: number) => void;
  careerTo: number;
  onCareerToChange: (n: number) => void;
  faceRevealTimer: number;
  onFaceRevealTimerChange: (n: number) => void;
  minYards: number;
  onMinYardsChange: (n: number) => void;
  defenseMode: 'known' | 'all';
  onDefenseModeChange: (m: 'known' | 'all') => void;
}

const TIMER_OPTIONS = [30, 45, 60, 90];
const MIN_YARDS_OPTIONS = [
  { label: 'Any',   value: 0    },
  { label: '500+',  value: 500  },
  { label: '1000+', value: 1000 },
];

export function FaceRevealSettings({
  sport, onSportChange,
  winTarget, onWinTargetChange,
  careerTo, onCareerToChange,
  faceRevealTimer, onFaceRevealTimerChange,
  minYards, onMinYardsChange,
  defenseMode, onDefenseModeChange,
}: Props) {
  return (
    <>
      <SportToggle sport={sport} onChange={s => onSportChange(s as Sport)} />

      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Points Target</div>
        <div className="flex gap-1.5">
          {[10, 15, 20, 25, 30].map(n => (
            <button
              key={n}
              onClick={() => onWinTargetChange(n)}
              className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                winTarget === n
                  ? 'text-[#111]'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
              style={winTarget === n ? { backgroundColor: '#06b6d4' } : {}}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Career Era</div>
        <select
          value={careerTo}
          onChange={e => onCareerToChange(parseInt(e.target.value))}
          className="w-full bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
        >
          <option value={0}>Any Era</option>
          {Array.from({ length: 2024 - 2000 + 1 }, (_, i) => 2000 + i).map(y => (
            <option key={y} value={y}>Active into {y}+</option>
          ))}
        </select>
      </div>

      {sport === 'nfl' && (
        <div>
          <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Defense Pool</div>
          <div className="flex gap-1.5">
            {(['known', 'all'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => onDefenseModeChange(mode)}
                className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                  defenseMode === mode
                    ? 'text-[#111]'
                    : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
                }`}
                style={defenseMode === mode ? { backgroundColor: '#06b6d4' } : {}}
              >
                {mode === 'known' ? 'Well Known' : 'All'}
              </button>
            ))}
          </div>
        </div>
      )}

      {sport === 'nfl' && (
        <div>
          <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Min Season Yards (NFL)</div>
          <div className="flex gap-1.5">
            {MIN_YARDS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onMinYardsChange(opt.value)}
                className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                  minYards === opt.value
                    ? 'text-[#111]'
                    : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
                }`}
                style={minYards === opt.value ? { backgroundColor: '#06b6d4' } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Timer Per Zoom Level</div>
        <div className="flex gap-1.5">
          {TIMER_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => onFaceRevealTimerChange(n)}
              className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                faceRevealTimer === n
                  ? 'text-[#111]'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
              style={faceRevealTimer === n ? { backgroundColor: '#06b6d4' } : {}}
            >
              {n}s
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
