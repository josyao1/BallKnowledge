import { SportToggle, Row, Chips, Chip, selectCls } from './SettingsHelpers';
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
  minMpg: number;
  onMinMpgChange: (n: number) => void;
  defenseMode: 'known' | 'all';
  onDefenseModeChange: (m: 'known' | 'all') => void;
}

const TO_YEARS = Array.from({ length: 2024 - 2000 + 1 }, (_, i) => 2000 + i);
const CYAN = '#06b6d4';

export function FaceRevealSettings({
  sport, onSportChange,
  winTarget, onWinTargetChange,
  careerTo, onCareerToChange,
  faceRevealTimer, onFaceRevealTimerChange,
  minYards, onMinYardsChange,
  minMpg, onMinMpgChange,
  defenseMode, onDefenseModeChange,
}: Props) {
  return (
    <div className="space-y-2.5">
      <SportToggle sport={sport} onChange={s => onSportChange(s as Sport)} />

      <Row label="Target">
        <Chips>
          {[20, 25, 30, 40, 50].map(n => (
            <Chip key={n} active={winTarget === n} activeBg={CYAN} activeText="#111"
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

      {sport === 'nfl' && (
        <Row label="Defense">
          <Chips>
            {(['known', 'all'] as const).map(m => (
              <Chip key={m} active={defenseMode === m} activeBg={CYAN} activeText="#111"
                onClick={() => onDefenseModeChange(m)}>
                {m === 'known' ? 'Well Known' : 'All'}
              </Chip>
            ))}
          </Chips>
        </Row>
      )}

      {sport === 'nfl' && (
        <Row label="Yards">
          <Chips>
            {([{ label: 'Any', value: 0 }, { label: '500+', value: 500 }, { label: '1000+', value: 1000 }]).map(opt => (
              <Chip key={opt.value} active={minYards === opt.value} activeBg={CYAN} activeText="#111"
                onClick={() => onMinYardsChange(opt.value)}>
                {opt.label}
              </Chip>
            ))}
          </Chips>
        </Row>
      )}

      {sport === 'nba' && (
        <Row label="MPG">
          <Chips>
            {([{ label: 'Any', value: 0 }, { label: '15+', value: 15 }, { label: '20+', value: 20 }, { label: '25+', value: 25 }]).map(opt => (
              <Chip key={opt.value} active={minMpg === opt.value} activeBg={CYAN} activeText="#111"
                onClick={() => onMinMpgChange(opt.value)}>
                {opt.label}
              </Chip>
            ))}
          </Chips>
        </Row>
      )}

      <Row label="Timer">
        <Chips>
          {[30, 45, 60, 90].map(n => (
            <Chip key={n} active={faceRevealTimer === n} activeBg={CYAN} activeText="#111"
              onClick={() => onFaceRevealTimerChange(n)}>
              {n}s
            </Chip>
          ))}
        </Chips>
      </Row>
    </div>
  );
}
