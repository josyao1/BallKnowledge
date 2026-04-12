/**
 * RosterSettings.tsx — Host settings for the Roster Challenge game mode.
 *
 * Sport (NBA / NFL / Random), selection mode (random vs manual), scope
 * (team vs division), team + year pickers for manual mode, year range for
 * random mode, and a timer picker.
 */

import { TeamSelector } from '../../home/TeamSelector';
import { YearSelector } from '../../home/YearSelector';
import { TimerPicker } from './SettingsHelpers';
import type { GenericTeam } from '../../../data/homeGames';
import type { Sport } from '../../../types';

interface Props {
  sport: Sport;
  randomSport: boolean;
  onSportChange: (s: Sport | 'random') => void;
  gameMode: 'random' | 'manual';
  onGameModeChange: (m: 'random' | 'manual') => void;
  selectionScope: 'team' | 'division';
  onSelectionScopeChange: (sc: 'team' | 'division') => void;
  team: GenericTeam | null;
  onTeamChange: (t: GenericTeam | null) => void;
  year: number | null;
  onYearChange: (y: number | null) => void;
  minYear: number;
  onMinYearChange: (y: number) => void;
  maxYear: number;
  onMaxYearChange: (y: number) => void;
  timer: number;
  customTimer: string;
  onTimerSelect: (s: number) => void;
  onCustomTimerChange: (raw: string, clamped: number) => void;
}

export function RosterSettings({
  sport, randomSport, onSportChange,
  gameMode, onGameModeChange,
  selectionScope, onSelectionScopeChange,
  team, onTeamChange, year, onYearChange,
  minYear, onMinYearChange, maxYear, onMaxYearChange,
  timer, customTimer, onTimerSelect, onCustomTimerChange,
}: Props) {
  return (
    <>
      {/* Sport: NBA / NFL / Random */}
      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Sport</div>
        <div className="flex gap-1.5">
          {(['nba', 'nfl', 'random'] as const).map(s => (
            <button
              key={s}
              onClick={() => onSportChange(s)}
              className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                (s === 'random' && randomSport) || (s !== 'random' && !randomSport && sport === s)
                  ? s === 'nba' ? 'bg-[#f15a29] text-white'
                    : s === 'nfl' ? 'bg-[#013369] text-white'
                    : 'bg-[#d4af37] text-black'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
            >
              {s === 'random' ? '?' : s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {randomSport ? (
        <div className="text-center sports-font text-[10px] text-[#444] tracking-wider">
          Sport and team will be randomly selected
        </div>
      ) : (
        <>
          {/* Random vs Manual selection */}
          <div>
            <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Selection</div>
            <div className="flex gap-1.5">
              {(['random', 'manual'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => onGameModeChange(m)}
                  className={`flex-1 py-2 rounded-sm sports-font text-xs tracking-wider uppercase transition-all ${
                    gameMode === m
                      ? 'bg-[#d4af37] text-black'
                      : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Scope: team vs division (random mode only) */}
          {gameMode === 'random' && (
            <div>
              <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Scope</div>
              <div className="flex gap-1.5">
                {(['team', 'division'] as const).map(sc => (
                  <button
                    key={sc}
                    onClick={() => onSelectionScopeChange(sc)}
                    className={`flex-1 py-2 rounded-sm sports-font text-xs tracking-wider uppercase transition-all ${
                      selectionScope === sc
                        ? 'bg-[#d4af37] text-black'
                        : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
                    }`}
                  >
                    {sc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual: team + year pickers */}
          {gameMode === 'manual' && (
            <div className="space-y-3">
              <TeamSelector selectedTeam={team} onSelect={onTeamChange} sport={sport} />
              <YearSelector selectedYear={year} onSelect={onYearChange} minYear={2000} maxYear={2025} sport={sport} />
            </div>
          )}

          {/* Random: year range */}
          {gameMode === 'random' && (
            <div>
              <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Year Range</div>
              <div className="flex items-center gap-2">
                <select
                  value={minYear}
                  onChange={e => onMinYearChange(parseInt(e.target.value))}
                  className="flex-1 bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
                >
                  {Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <span className="text-[#444] sports-font text-xs">to</span>
                <select
                  value={maxYear}
                  onChange={e => onMaxYearChange(parseInt(e.target.value))}
                  className="flex-1 bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
                >
                  {Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}
        </>
      )}

      <TimerPicker
        timer={timer} customTimer={customTimer}
        presets={[60, 90, 120, 180, 300]}
        activeColor="bg-[#d4af37] text-black"
        onSelect={onTimerSelect}
        onCustomChange={onCustomTimerChange}
      />
    </>
  );
}
