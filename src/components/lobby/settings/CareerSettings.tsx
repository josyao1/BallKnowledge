import { SportToggle, Row, Chips, Chip, selectCls } from './SettingsHelpers';
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

const FROM_YEARS = Array.from({ length: 2015 - 1980 + 1 }, (_, i) => 1980 + i);
const TO_YEARS   = Array.from({ length: 2026 - 1990 + 1 }, (_, i) => 1990 + i);

export function CareerSettings({ sport, onSportChange, winTarget, onWinTargetChange, careerFrom, onCareerFromChange, careerTo, onCareerToChange }: Props) {
  return (
    <div className="space-y-2.5">
      <SportToggle sport={sport} onChange={s => onSportChange(s as Sport)} />

      <Row label="First To">
        <Chips>
          {[2, 3, 4, 5, 7].map(n => (
            <Chip key={n} active={winTarget === n} onClick={() => onWinTargetChange(n)}>{n}</Chip>
          ))}
        </Chips>
      </Row>

      <Row label="Era">
        <div className="flex items-center gap-1.5">
          <span className="capcrunch-kicker text-[8px] text-[#444]">From</span>
          <select value={careerFrom} onChange={e => onCareerFromChange(+e.target.value)} className={selectCls}>
            <option value={0}>Any</option>
            {FROM_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="capcrunch-kicker text-[8px] text-[#333]">→</span>
          <span className="capcrunch-kicker text-[8px] text-[#444]">To</span>
          <select value={careerTo} onChange={e => onCareerToChange(+e.target.value)} className={selectCls}>
            <option value={0}>Any</option>
            {TO_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </Row>
    </div>
  );
}
