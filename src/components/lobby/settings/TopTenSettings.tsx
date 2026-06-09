import { useEffect } from 'react';
import { Row, Chips, Chip, selectCls } from './SettingsHelpers';
import { teams } from '../../../data/teams';
import { nflTeams } from '../../../data/nfl-teams';

interface Props {
  sport: 'nba' | 'nfl';
  onSportChange: (s: 'nba' | 'nfl') => void;
  showSportToggle?: boolean;
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
  maxStrikes?: number;
  onMaxStrikesChange?: (n: number) => void;
  turnTimer?: number;
  onTurnTimerChange?: (n: number) => void;
  pinnedDivision: string | null;
  onPinnedDivisionChange: (v: string | null) => void;
  pinnedTeam: string | null;
  onPinnedTeamChange: (v: string | null) => void;
}

// Returns unique conferences in order from the team list
function getConferences(sport: 'nba' | 'nfl'): string[] {
  const list = sport === 'nba' ? teams : nflTeams;
  const seen = new Set<string>();
  for (const t of list) if (!seen.has(t.conference)) seen.add(t.conference);
  return Array.from(seen);
}

// Returns unique divisions per conference
function getDivisionsByConference(sport: 'nba' | 'nfl'): { conference: string; divisions: string[] }[] {
  const list = sport === 'nba' ? teams : nflTeams;
  const map = new Map<string, Set<string>>();
  for (const t of list) {
    if (!map.has(t.conference)) map.set(t.conference, new Set());
    map.get(t.conference)!.add(t.division);
  }
  return Array.from(map.entries()).map(([conference, divSet]) => ({ conference, divisions: Array.from(divSet) }));
}

export function TopTenSettings({
  sport, onSportChange,
  showSportToggle = true,
  roundType, onRoundTypeChange,
  divisionMode, onDivisionModeChange,
  minYear, onMinYearChange,
  maxYear, onMaxYearChange,
  windowYears, onWindowYearsChange,
  maxStrikes, onMaxStrikesChange,
  turnTimer, onTurnTimerChange,
  pinnedDivision, onPinnedDivisionChange,
  pinnedTeam, onPinnedTeamChange,
}: Props) {
  const sportMin = sport === 'nba' ? 1996 : 1999;
  const sportMax = sport === 'nba' ? 2025 : 2024;
  const yearRange = Array.from({ length: sportMax - sportMin + 1 }, (_, i) => sportMin + i);

  // Reset pins when sport or roundType changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onPinnedDivisionChange(null); onPinnedTeamChange(null); }, [sport, roundType]);

  const divisionGroups = getDivisionsByConference(sport);
  const teamList = sport === 'nba' ? teams : nflTeams;

  return (
    <div className="space-y-2.5">
      {showSportToggle && (
        <Row label="Sport">
          <Chips>
            <Chip active={sport === 'nba'} activeBg="#f15a29" activeText="#fff" onClick={() => onSportChange('nba')}>NBA</Chip>
            <Chip active={sport === 'nfl'} activeBg="#013369" activeText="#fff" onClick={() => onSportChange('nfl')}>NFL</Chip>
          </Chips>
        </Row>
      )}

      <Row label="Round">
        <Chips>
          {(['league', 'division', 'team'] as const).map(t => (
            <Chip key={t} active={roundType === t} activeBg="#70BE5B" activeText="#000" onClick={() => onRoundTypeChange(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Chip>
          ))}
        </Chips>
      </Row>

      {roundType !== 'league' && (
        <Row label="Mode">
          <Chips>
            <Chip active={divisionMode === 'cumulative'} activeBg="#70BE5B" activeText="#000" onClick={() => onDivisionModeChange('cumulative')}>Cumulative</Chip>
            <Chip active={divisionMode === 'single_season'} activeBg="#70BE5B" activeText="#000" onClick={() => onDivisionModeChange('single_season')}>Single Season</Chip>
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
              <Chip key={n} active={windowYears === n} activeBg="#70BE5B" activeText="#000" onClick={() => onWindowYearsChange(n)}>{n}y</Chip>
            ))}
          </Chips>
        </Row>
      )}

      {roundType === 'division' && (
        <Row label="Division">
          <select
            value={pinnedDivision ?? ''}
            onChange={e => onPinnedDivisionChange(e.target.value || null)}
            className={selectCls}
          >
            <option value="">Random</option>
            {divisionGroups.map(({ conference, divisions }) => (
              <optgroup key={conference} label={conference}>
                {divisions.map(div => (
                  <option key={div} value={`${conference}|${div}`}>{div}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Row>
      )}

      {roundType === 'team' && (
        <Row label="Team">
          <select
            value={pinnedTeam ?? ''}
            onChange={e => onPinnedTeamChange(e.target.value || null)}
            className={selectCls}
          >
            <option value="">Random</option>
            {getConferences(sport).map(conf => (
              <optgroup key={conf} label={conf}>
                {teamList.filter(t => t.conference === conf).map(t => (
                  <option key={t.abbreviation} value={t.abbreviation}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Row>
      )}

      {maxStrikes !== undefined && onMaxStrikesChange && (
        <Row label="Strikes">
          <Chips>
            {[1, 2, 3].map(n => (
              <Chip key={n} active={maxStrikes === n} activeBg="#70BE5B" activeText="#000" onClick={() => onMaxStrikesChange!(n)}>{n}</Chip>
            ))}
          </Chips>
        </Row>
      )}

      {turnTimer !== undefined && onTurnTimerChange && (
        <Row label="Timer">
          <Chips>
            {[30, 45, 60, 90].map(n => (
              <Chip key={n} active={turnTimer === n} activeBg="#70BE5B" activeText="#000" onClick={() => onTurnTimerChange!(n)}>{n}s</Chip>
            ))}
          </Chips>
        </Row>
      )}
    </div>
  );
}
