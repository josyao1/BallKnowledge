import { TeamSelector } from '../../home/TeamSelector';
import { YearSelector } from '../../home/YearSelector';
import { Row, Chips, Chip, selectCls, TimerPicker } from './SettingsHelpers';
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

const YEAR_RANGE = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i);

export function RosterSettings({
  sport, randomSport, onSportChange,
  gameMode, onGameModeChange,
  selectionScope, onSelectionScopeChange,
  team, onTeamChange, year, onYearChange,
  minYear, onMinYearChange, maxYear, onMaxYearChange,
  timer, customTimer, onTimerSelect, onCustomTimerChange,
}: Props) {
  return (
    <div className="space-y-2.5">

      {/* Sport: NBA / NFL / Random */}
      <Row label="Sport">
        <Chips>
          <Chip active={!randomSport && sport === 'nba'} activeBg="#f15a29" activeText="#fff"
            onClick={() => onSportChange('nba')}>NBA</Chip>
          <Chip active={!randomSport && sport === 'nfl'} activeBg="#013369" activeText="#fff"
            onClick={() => onSportChange('nfl')}>NFL</Chip>
          <Chip active={randomSport} activeBg="#FDF100" activeText="#000"
            onClick={() => onSportChange('random')}>?</Chip>
        </Chips>
      </Row>

      {randomSport ? (
        <p className="capcrunch-kicker text-[9px] text-[#444] tracking-wider pl-[68px]">
          Sport + team randomised each round
        </p>
      ) : (
        <>
          <Row label="Pick">
            <Chips>
              <Chip active={gameMode === 'random'} onClick={() => onGameModeChange('random')}>Random</Chip>
              <Chip active={gameMode === 'manual'} onClick={() => onGameModeChange('manual')}>Manual</Chip>
            </Chips>
          </Row>

          {gameMode === 'random' && (
            <Row label="Scope">
              <Chips>
                <Chip active={selectionScope === 'team'} onClick={() => onSelectionScopeChange('team')}>Team</Chip>
                <Chip active={selectionScope === 'division'} onClick={() => onSelectionScopeChange('division')}>Division</Chip>
              </Chips>
            </Row>
          )}

          {gameMode === 'random' && (
            <Row label="Years">
              <div className="flex items-center gap-1.5">
                <select value={minYear} onChange={e => onMinYearChange(+e.target.value)} className={selectCls}>
                  {YEAR_RANGE.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <span className="capcrunch-kicker text-[9px] text-[#333]">→</span>
                <select value={maxYear} onChange={e => onMaxYearChange(+e.target.value)} className={selectCls}>
                  {YEAR_RANGE.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </Row>
          )}

          {/* Manual pickers — these are full custom components, keep as-is */}
          {gameMode === 'manual' && (
            <div className="space-y-3 pl-[68px]">
              <TeamSelector selectedTeam={team} onSelect={onTeamChange} sport={sport} />
              <YearSelector selectedYear={year} onSelect={onYearChange} minYear={2000} maxYear={2025} sport={sport} />
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

    </div>
  );
}
