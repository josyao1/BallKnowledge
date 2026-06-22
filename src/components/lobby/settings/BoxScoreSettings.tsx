import { Row, Chips, Chip, selectCls, TimerPicker } from './SettingsHelpers';
import { ALL_BOX_SCORE_YEARS } from '../../../services/boxScoreData';
import { ALL_NBA_BOX_SCORE_YEARS } from '../../../services/nbaBoxScoreData';
import { nflTeams } from '../../../data/nfl-teams';
import { teams as nbaTeams } from '../../../data/teams';

interface Props {
  sport: 'nba' | 'nfl';
  onSportChange: (s: 'nba' | 'nfl') => void;
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

const AMBER = '#f59e0b';

export function BoxScoreSettings({
  sport,
  onSportChange,
  boxMinYear,
  onBoxMinYearChange,
  boxMaxYear,
  onBoxMaxYearChange,
  boxTeam,
  onBoxTeamChange,
  timer,
  customTimer,
  onTimerSelect,
  onCustomTimerChange,
}: Props) {
  const years = sport === 'nba' ? ALL_NBA_BOX_SCORE_YEARS : ALL_BOX_SCORE_YEARS;
  const teamList = sport === 'nba' ? nbaTeams : nflTeams;

  return (
    <div className="space-y-2.5">
      <Row label="League">
        <Chips>
          {(['nfl', 'nba'] as const).map((s) => (
            <Chip
              key={s}
              active={sport === s}
              activeBg={AMBER}
              activeText="#000"
              onClick={() => {
                onSportChange(s);
                onBoxTeamChange(null);
              }}
            >
              {s.toUpperCase()}
            </Chip>
          ))}
        </Chips>
      </Row>

      <Row label="Years">
        <div className="flex items-center gap-1.5">
          <select
            value={boxMinYear}
            onChange={(e) => {
              const v = +e.target.value;
              onBoxMinYearChange(v);
              if (v > boxMaxYear) onBoxMaxYearChange(v);
            }}
            className={selectCls}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="capcrunch-kicker text-[9px] text-[#333]">→</span>
          <select
            value={boxMaxYear}
            onChange={(e) => {
              const v = +e.target.value;
              onBoxMaxYearChange(v);
              if (v < boxMinYear) onBoxMinYearChange(v);
            }}
            className={selectCls}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </Row>

      <Row label="Team">
        <select
          value={boxTeam || ''}
          onChange={(e) => onBoxTeamChange(e.target.value || null)}
          className={selectCls}
        >
          <option value="">Any Team</option>
          {teamList.map((t) => (
            <option key={t.abbreviation} value={t.abbreviation}>
              {t.name}
            </option>
          ))}
        </select>
      </Row>

      <TimerPicker
        timer={timer}
        customTimer={customTimer}
        presets={[90, 120, 150, 180, 240]}
        activeColor="bg-[#f59e0b] text-black"
        onSelect={onTimerSelect}
        onCustomChange={onCustomTimerChange}
      />
    </div>
  );
}
