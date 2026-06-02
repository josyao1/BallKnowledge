import { SportToggle, Row, Chips, Chip, selectCls } from './SettingsHelpers';
import type { Sport } from '../../../types';

interface Props {
  sport: Sport;
  onSportChange: (s: Sport) => void;
  winTarget: number;
  onWinTargetChange: (n: number) => void;
  careerTo: number;
  onCareerToChange: (n: number) => void;
}

const TO_YEARS = Array.from({ length: 2024 - 2000 + 1 }, (_, i) => 2000 + i);

export function ScrambleSettings({ sport, onSportChange, winTarget, onWinTargetChange, careerTo, onCareerToChange }: Props) {
  return (
    <div className="space-y-2.5">
      <SportToggle sport={sport} onChange={s => onSportChange(s as Sport)} />

      <Row label="Target">
        <Chips>
          {[10, 20, 30, 40, 50].map(n => (
            <Chip key={n} active={winTarget === n} activeBg="#3b82f6" activeText="#fff"
              onClick={() => onWinTargetChange(n)}>
              {n}
            </Chip>
          ))}
        </Chips>
      </Row>

      <Row label="Era">
        <select value={careerTo} onChange={e => onCareerToChange(+e.target.value)} className={selectCls}>
          <option value={0}>Any Era</option>
          {TO_YEARS.map(y => <option key={y} value={y}>Into {y}+</option>)}
        </select>
      </Row>
    </div>
  );
}
