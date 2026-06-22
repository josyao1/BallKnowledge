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
  minMpg: number;
  onMinMpgChange: (n: number) => void;
  minYards: number;
  onMinYardsChange: (n: number) => void;
}

const FROM_YEARS = Array.from({ length: 2015 - 1980 + 1 }, (_, i) => 1980 + i);
const TO_YEARS = Array.from({ length: 2026 - 1990 + 1 }, (_, i) => 1990 + i);

const CYAN = '#22d3ee';

export function CareerSettings({
  sport,
  onSportChange,
  winTarget,
  onWinTargetChange,
  careerFrom,
  onCareerFromChange,
  careerTo,
  onCareerToChange,
  minMpg,
  onMinMpgChange,
  minYards,
  onMinYardsChange,
}: Props) {
  return (
    <div className="space-y-2.5">
      <SportToggle sport={sport} onChange={(s) => onSportChange(s as Sport)} />

      <Row label="First To">
        <Chips>
          {[2, 3, 4, 5, 7].map((n) => (
            <Chip key={n} active={winTarget === n} onClick={() => onWinTargetChange(n)}>
              {n}
            </Chip>
          ))}
        </Chips>
      </Row>

      <Row label="Era">
        <div className="flex items-center gap-1.5">
          <span className="capcrunch-kicker text-[8px] text-[#444]">From</span>
          <select
            value={careerFrom}
            onChange={(e) => onCareerFromChange(+e.target.value)}
            className={selectCls}
          >
            <option value={0}>Any</option>
            {FROM_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="capcrunch-kicker text-[8px] text-[#333]">→</span>
          <span className="capcrunch-kicker text-[8px] text-[#444]">To</span>
          <select
            value={careerTo}
            onChange={(e) => onCareerToChange(+e.target.value)}
            className={selectCls}
          >
            <option value={0}>Any</option>
            {TO_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </Row>

      {sport === 'nba' && (
        <Row label="MPG">
          <Chips>
            {[
              { label: 'Any', value: 0 },
              { label: '15+', value: 15 },
              { label: '20+', value: 20 },
              { label: '25+', value: 25 },
            ].map((opt) => (
              <Chip
                key={opt.value}
                active={minMpg === opt.value}
                activeBg={CYAN}
                activeText="#111"
                onClick={() => onMinMpgChange(opt.value)}
              >
                {opt.label}
              </Chip>
            ))}
          </Chips>
        </Row>
      )}

      {sport === 'nfl' && (
        <Row label="Yards">
          <Chips>
            {[
              { label: 'Any', value: 0 },
              { label: '500+', value: 500 },
              { label: '1000+', value: 1000 },
            ].map((opt) => (
              <Chip
                key={opt.value}
                active={minYards === opt.value}
                activeBg={CYAN}
                activeText="#111"
                onClick={() => onMinYardsChange(opt.value)}
              >
                {opt.label}
              </Chip>
            ))}
          </Chips>
        </Row>
      )}
    </div>
  );
}
