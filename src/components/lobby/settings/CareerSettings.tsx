/**
 * CareerSettings.tsx — Host settings for the Career Arc game mode.
 * Sport toggle, first-to win target, and era filter (started from / active into).
 */

import { SportToggle } from './SettingsHelpers';
import type { Sport } from '../../../types';

interface Props {
  sport: Sport;
  onSportChange: (s: Sport) => void;
  winTarget: number;
  onWinTargetChange: (n: number) => void;
  careerFrom: number;
  onCareerFromChange: (n: number) => void;
  careerTo: number;
  onCareerToChange: (n: number) => void;
}

export function CareerSettings({ sport, onSportChange, winTarget, onWinTargetChange, careerFrom, onCareerFromChange, careerTo, onCareerToChange }: Props) {
  return (
    <>
      <SportToggle sport={sport} onChange={s => onSportChange(s as Sport)} />

      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">First To</div>
        <div className="flex gap-1.5">
          {[2, 3, 4, 5, 7].map(n => (
            <button
              key={n}
              onClick={() => onWinTargetChange(n)}
              className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                winTarget === n
                  ? 'bg-[#d4af37] text-black'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
            >
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
            <select
              value={careerFrom}
              onChange={e => onCareerFromChange(parseInt(e.target.value))}
              className="w-full bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
            >
              <option value={0}>Any</option>
              {Array.from({ length: 2015 - 1980 + 1 }, (_, i) => 1980 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="sports-font text-[9px] text-[#444] block mb-1">Active into</label>
            <select
              value={careerTo}
              onChange={e => onCareerToChange(parseInt(e.target.value))}
              className="w-full bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
            >
              <option value={0}>Any</option>
              {Array.from({ length: 2026 - 1990 + 1 }, (_, i) => 1990 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
