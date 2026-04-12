/**
 * ScrambleSettings.tsx — Host settings for the Name Scramble game mode.
 * Sport toggle, points target, and career era filter.
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
}

export function ScrambleSettings({ sport, onSportChange, winTarget, onWinTargetChange, careerTo, onCareerToChange }: Props) {
  return (
    <>
      <SportToggle sport={sport} onChange={s => onSportChange(s as Sport)} />

      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Points Target</div>
        <div className="flex gap-1.5">
          {[10, 20, 30, 40, 50].map(n => (
            <button
              key={n}
              onClick={() => onWinTargetChange(n)}
              className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                winTarget === n
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
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
    </>
  );
}
