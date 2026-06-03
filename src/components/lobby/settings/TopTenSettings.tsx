import { Row, Chips, Chip, selectCls } from './SettingsHelpers';

interface Props {
  sport: 'nba' | 'nfl';
  onSportChange: (s: 'nba' | 'nfl') => void;
  roundType: 'league' | 'division' | 'team';
  onRoundTypeChange: (t: 'league' | 'division' | 'team') => void;
  divisionMode: 'cumulative' | 'single_season';
  onDivisionModeChange: (m: 'cumulative' | 'single_season') => void;
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
  divisionMode, onDivisionModeChange,
  minYear, onMinYearChange,
  maxYear, onMaxYearChange,
  windowYears, onWindowYearsChange,
  maxStrikes, onMaxStrikesChange,
  turnTimer, onTurnTimerChange,
}: Props) {
  const sportMin = sport === 'nba' ? 1996 : 1999;
  const sportMax = sport === 'nba' ? 2025 : 2024;
  const yearRange = Array.from({ length: sportMax - sportMin + 1 }, (_, i) => sportMin + i);

  return (
    <div className="space-y-2.5">
      <Row label="Sport">
        <Chips>
          <Chip active={sport === 'nba'} activeBg="#f15a29" activeText="#fff" onClick={() => onSportChange('nba')}>NBA</Chip>
          <Chip active={sport === 'nfl'} activeBg="#013369" activeText="#fff" onClick={() => onSportChange('nfl')}>NFL</Chip>
        </Chips>
      </Row>

      <Row label="Round">
        <Chips>
          {(['league', 'division', 'team'] as const).map(t => (
            <Chip key={t} active={roundType === t} onClick={() => onRoundTypeChange(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Chip>
          ))}
        </Chips>
      </Row>

      {roundType !== 'league' && (
        <Row label="Mode">
          <Chips>
            <Chip active={divisionMode === 'cumulative'} onClick={() => onDivisionModeChange('cumulative')}>Cumulative</Chip>
            <Chip active={divisionMode === 'single_season'} onClick={() => onDivisionModeChange('single_season')}>Single Season</Chip>
          </Chips>
        </Row>
      )}

      {roundType === 'league' ? (
        <Row label="Years">
          <div className="flex items-center gap-1.5">
            <select value={minYear} onChange={e => onMinYearChange(+e.target.value)} className={selectCls}>
              {yearRange.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="sports-font text-[9px] text-[#333]">→</span>
            <select value={maxYear} onChange={e => onMaxYearChange(+e.target.value)} className={selectCls}>
              {yearRange.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </Row>
      ) : (
        <Row label="Window">
          <Chips>
            {[5, 10, 15, 20].map(n => (
              <Chip key={n} active={windowYears === n} onClick={() => onWindowYearsChange(n)}>{n}y</Chip>
            ))}
          </Chips>
        </Row>
      )}

      <Row label="Strikes">
        <Chips>
          {[1, 2, 3].map(n => (
            <Chip key={n} active={maxStrikes === n} onClick={() => onMaxStrikesChange(n)}>{n}</Chip>
          ))}
        </Chips>
      </Row>

      <Row label="Timer">
        <Chips>
          {[30, 45, 60, 90].map(n => (
            <Chip key={n} active={turnTimer === n} onClick={() => onTurnTimerChange(n)}>{n}s</Chip>
          ))}
        </Chips>
      </Row>
    </div>
  );
}
