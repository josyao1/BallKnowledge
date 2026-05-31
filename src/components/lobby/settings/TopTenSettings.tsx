import { SportToggle } from './SettingsHelpers';
import { getNBADivisions } from '../../../data/teams';
import { getNFLDivisions } from '../../../data/nfl-teams';

interface Props {
  sport: 'nba' | 'nfl';
  onSportChange: (s: 'nba' | 'nfl') => void;
  roundType: 'league' | 'division' | 'team';
  onRoundTypeChange: (t: 'league' | 'division' | 'team') => void;
  minYear: number;
  onMinYearChange: (n: number) => void;
  maxYear: number;
  onMaxYearChange: (n: number) => void;
  windowYears: number;
  onWindowYearsChange: (n: number) => void;
  maxStrikes: number;
  onMaxStrikesChange: (n: number) => void;
  turnTimer: number;
  onTurnTimerChange: (n: number) => void;
}

export function TopTenSettings({
  sport, onSportChange,
  roundType, onRoundTypeChange,
  minYear, onMinYearChange,
  maxYear, onMaxYearChange,
  windowYears, onWindowYearsChange,
  maxStrikes, onMaxStrikesChange,
  turnTimer, onTurnTimerChange,
}: Props) {
  const nbaDivisions = getNBADivisions();
  const nflDivisions = getNFLDivisions();
  const divisionCount = sport === 'nba' ? nbaDivisions.length : nflDivisions.length;

  const nbaMinYear = 1996;
  const nflMinYear = 1999;
  const sportMin = sport === 'nba' ? nbaMinYear : nflMinYear;
  const sportMax = sport === 'nba' ? 2025 : 2024;

  const btnBase = 'flex-1 py-2 rounded-sm retro-title text-base transition-all';
  const btnActive = 'bg-[#d4af37] text-black';
  const btnInactive = 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]';

  return (
    <>
      <SportToggle sport={sport} onChange={s => onSportChange(s as 'nba' | 'nfl')} />

      {/* Round type */}
      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Round Type</div>
        <div className="flex gap-1.5">
          {(['league', 'division', 'team'] as const).map(t => (
            <button
              key={t}
              onClick={() => onRoundTypeChange(t)}
              className={`${btnBase} ${roundType === t ? btnActive : btnInactive}`}
            >
              {t === 'league' ? 'League' : t === 'division' ? 'Division' : 'Team'}
            </button>
          ))}
        </div>
        {roundType === 'division' && (
          <p className="sports-font text-[9px] text-[#555] mt-1.5">
            {divisionCount} divisions · cumulative totals while on a division team
          </p>
        )}
        {roundType === 'team' && (
          <p className="sports-font text-[9px] text-[#555] mt-1.5">
            Random team · top 6 cumulative leaders (top 10 for fantasy pts)
          </p>
        )}
      </div>

      {/* Year range (league) or window size (division) */}
      {roundType === 'league' ? (
        <div>
          <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Year Range</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="sports-font text-[9px] text-[#444] block mb-1">From</label>
              <select
                value={minYear}
                onChange={e => onMinYearChange(parseInt(e.target.value))}
                className="w-full bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
              >
                {Array.from({ length: sportMax - sportMin + 1 }, (_, i) => sportMin + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="sports-font text-[9px] text-[#444] block mb-1">To</label>
              <select
                value={maxYear}
                onChange={e => onMaxYearChange(parseInt(e.target.value))}
                className="w-full bg-[#111] text-[#ccc] px-2 py-2 rounded-sm border border-[#2a2a2a] sports-font text-sm focus:outline-none focus:border-[#444] appearance-none"
              >
                {Array.from({ length: sportMax - sportMin + 1 }, (_, i) => sportMin + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Year Window</div>
          <div className="flex gap-1.5">
            {[5, 10, 15, 20].map(n => (
              <button
                key={n}
                onClick={() => onWindowYearsChange(n)}
                className={`${btnBase} ${windowYears === n ? btnActive : btnInactive}`}
              >
                {n}y
              </button>
            ))}
          </div>
          <p className="sports-font text-[9px] text-[#555] mt-1.5">Last {windowYears} seasons from current year</p>
        </div>
      )}

      {/* Max strikes */}
      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Max Strikes</div>
        <div className="flex gap-1.5">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => onMaxStrikesChange(n)}
              className={`${btnBase} ${maxStrikes === n ? btnActive : btnInactive}`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="sports-font text-[9px] text-[#555] mt-1.5">Wrong guesses + timeouts before elimination</p>
      </div>

      {/* Turn timer */}
      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Turn Timer</div>
        <div className="flex gap-1.5">
          {[30, 45, 60, 90].map(n => (
            <button
              key={n}
              onClick={() => onTurnTimerChange(n)}
              className={`${btnBase} ${turnTimer === n ? btnActive : btnInactive}`}
            >
              {n}s
            </button>
          ))}
        </div>
      </div>

    </>
  );
}
