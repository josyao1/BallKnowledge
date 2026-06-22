import { SportToggle, Row, Chips, Chip, selectCls } from './SettingsHelpers';
import type { Sport } from '../../../types';

interface Props {
  sport: Sport;
  onSportChange: (s: Sport) => void;
  winTarget: number;
  onWinTargetChange: (n: number) => void;
  careerTo: number;
  onCareerToChange: (n: number) => void;
  minMpg: number;
  onMinMpgChange: (n: number) => void;
  minYards: number;
  onMinYardsChange: (n: number) => void;
  includeDefense: boolean;
  onIncludeDefenseChange: (v: boolean) => void;
}

const TO_YEARS = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i);

const CYAN = '#22d3ee';

export function ScrambleSettings({
  sport,
  onSportChange,
  winTarget,
  onWinTargetChange,
  careerTo,
  onCareerToChange,
  minMpg,
  onMinMpgChange,
  minYards,
  onMinYardsChange,
  includeDefense,
  onIncludeDefenseChange,
}: Props) {
  return (
    <div className="space-y-2.5">
      <SportToggle sport={sport} onChange={(s) => onSportChange(s as Sport)} />

      <Row label="Target">
        <Chips>
          {[10, 20, 30, 40, 50].map((n) => (
            <Chip
              key={n}
              active={winTarget === n}
              activeBg="#3b82f6"
              activeText="#fff"
              onClick={() => onWinTargetChange(n)}
            >
              {n}
            </Chip>
          ))}
        </Chips>
      </Row>

      <Row label="Era">
        <select
          value={careerTo}
          onChange={(e) => onCareerToChange(+e.target.value)}
          className={selectCls}
        >
          <option value={0}>Any Era</option>
          {TO_YEARS.map((y) => (
            <option key={y} value={y}>
              Into {y}+
            </option>
          ))}
        </select>
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

      {sport === 'nfl' && (
        <Row label="Defense">
          <Chips>
            <Chip
              active={includeDefense}
              activeBg={CYAN}
              activeText="#111"
              onClick={() => onIncludeDefenseChange(true)}
            >
              On
            </Chip>
            <Chip
              active={!includeDefense}
              activeBg={CYAN}
              activeText="#111"
              onClick={() => onIncludeDefenseChange(false)}
            >
              Off
            </Chip>
          </Chips>
        </Row>
      )}
    </div>
  );
}
