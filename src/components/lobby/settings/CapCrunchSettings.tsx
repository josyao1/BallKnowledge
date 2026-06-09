import type { Sport } from '../../../types';
import type { SpecialRoundType } from '../../../services/capCrunch';
import { Row, Chips, ScrollStrip, Chip, Stepper } from './SettingsHelpers';

const LINEUP_STAT_ABBR: Record<string, string> = {
  random: 'RANDOM',
  pts: 'PTS/G', ast: 'AST/G', reb: 'REB/G', min: 'MIN/G', pra: 'PRA/G',
  total_pts: 'TOT PTS', total_reb: 'TOT REB', total_ast: 'TOT AST', total_blk: 'TOT BLK',
  total_3pm: 'TOT 3PM', total_ftm: 'TOT FTM', total_pf: 'TOT PF',
  passing_yards: 'PASS YD', passing_tds: 'PASS TD', interceptions: 'INT',
  rushing_yards: 'RUSH YD', rushing_tds: 'RUSH TD',
  receiving_yards: 'REC YD', receiving_tds: 'REC TD', receptions: 'REC',
  fpts: 'FPTS',
  total_gp: 'TOT GP',
  career_passing_yards:   'CAREER PASS YD',
  career_passing_tds:     'CAREER PASS TD',
  career_rushing_yards:   'CAREER RUSH YD',
  career_rushing_tds:     'CAREER RUSH TD',
  career_receiving_yards: 'CAREER REC YD',
  career_receiving_tds:   'CAREER REC TD',
};

const NBA_SEASON_CATS = ['pts', 'ast', 'reb', 'min', 'pra', 'total_gp', 'total_pts', 'total_reb', 'total_ast', 'total_blk', 'total_3pm', 'total_ftm', 'total_pf'];
const NFL_SEASON_CATS = ['passing_yards', 'passing_tds', 'interceptions', 'rushing_yards', 'rushing_tds', 'receiving_yards', 'receiving_tds', 'receptions', 'fpts', 'total_gp'];
const NFL_CAREER_CATS = [
  'career_passing_yards', 'career_passing_tds',
  'career_rushing_yards', 'career_rushing_tds',
  'career_receiving_yards', 'career_receiving_tds',
] as const;

const FILTER_LABELS: { type: SpecialRoundType; label: string; tooltip?: string }[] = [
  { type: 'hw_filter',      label: 'H/W' },
  { type: 'division',       label: 'Division' },
  { type: 'division_draft', label: 'Draft' },
  { type: 'conference',     label: 'College' },
  { type: 'teammate',       label: 'Special ?', tooltip: 'Covers Teammate (played-with) and Name Match (first/last initial) rounds' },
];

const PICK_TIMER_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'Off', value: null },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '45s', value: 45 },
  { label: '60s', value: 60 },
];

interface Player { player_id: string; player_name: string; }

interface Props {
  sport: Sport;
  onSportChange: (s: Sport) => void;
  lineupStat: string;
  onLineupStatChange: (stat: string) => void;
  customCap: number | null;
  onCustomCapChange: (cap: number | null) => void;
  hardMode: boolean;
  onHardModeChange: (on: boolean) => void;
  blindMode: boolean;
  onBlindModeChange: (on: boolean) => void;
  pickTimer: number | null;
  onPickTimerChange: (n: number | null) => void;
  firstPickerId: string | null;
  onFirstPickerIdChange: (id: string | null) => void;
  totalRounds: number;
  onTotalRoundsChange: (n: number) => void;
  players: Player[];
  disabledRoundTypes: SpecialRoundType[];
  onDisabledRoundTypesChange: (types: SpecialRoundType[]) => void;
}

export function CapCrunchSettings({
  sport, onSportChange, lineupStat, onLineupStatChange,
  customCap, onCustomCapChange, hardMode, onHardModeChange,
  blindMode, onBlindModeChange, pickTimer, onPickTimerChange,
  firstPickerId, onFirstPickerIdChange, totalRounds, onTotalRoundsChange, players,
  disabledRoundTypes, onDisabledRoundTypesChange,
}: Props) {
  function toggleFilter(type: SpecialRoundType) {
    if (disabledRoundTypes.includes(type)) {
      onDisabledRoundTypesChange(disabledRoundTypes.filter(t => t !== type));
    } else {
      onDisabledRoundTypesChange([...disabledRoundTypes, type]);
    }
  }

  const seasonCats = ['random', ...(sport === 'nba' ? NBA_SEASON_CATS : NFL_SEASON_CATS)];

  return (
    <div className="space-y-2.5">

      {/* Sport */}
      <Row label="Sport">
        <Chips>
          <Chip active={sport === 'nba'} activeBg="#f15a29" activeText="#fff"
            onClick={() => { onSportChange('nba'); onLineupStatChange('random'); onCustomCapChange(null); }}>
            NBA
          </Chip>
          <Chip active={sport === 'nfl'} activeBg="#013369" activeText="#fff"
            onClick={() => { onSportChange('nfl'); onLineupStatChange('random'); onCustomCapChange(null); }}>
            NFL
          </Chip>
        </Chips>
      </Row>

      {/* Stat — scrollable season + career rows */}
      <div className="border-t border-white/8 pt-2.5 space-y-2">
        <Row label="Season">
          <ScrollStrip>
            {seasonCats.map(cat => (
              <Chip
                key={cat}
                active={lineupStat === cat}
                activeBg={cat === 'random' ? '#FDF100' : '#E2008A'}
                onClick={() => { onLineupStatChange(cat); if (cat === 'random') onCustomCapChange(null); }}
              >
                {LINEUP_STAT_ABBR[cat] || cat.toUpperCase()}
              </Chip>
            ))}
          </ScrollStrip>
        </Row>

        {sport === 'nfl' && (
          <Row label="Career">
            <ScrollStrip>
              <Chip
                active={false}
                onClick={() => {
                  const pick = NFL_CAREER_CATS[Math.floor(Math.random() * NFL_CAREER_CATS.length)];
                  onLineupStatChange(pick); onCustomCapChange(null);
                }}
              >
                RND
              </Chip>
              {NFL_CAREER_CATS.map(cat => (
                <Chip key={cat} active={lineupStat === cat} activeBg="#E2008A"
                  onClick={() => { onLineupStatChange(cat); onCustomCapChange(null); }}>
                  {LINEUP_STAT_ABBR[cat]}
                </Chip>
              ))}
            </ScrollStrip>
          </Row>
        )}
      </div>

      {/* Game controls */}
      <div className="border-t border-white/8 pt-2.5 space-y-2">
        <Row label="Rounds">
          <Stepper value={totalRounds} min={3} max={10} onChange={onTotalRoundsChange} />
        </Row>

        <Row label="Cap">
          <input
            type="number" min={1}
            disabled={lineupStat === 'random'}
            value={lineupStat === 'random' ? '' : (customCap ?? '')}
            placeholder="AUTO"
            onChange={e => {
              const v = e.target.value === '' ? null : parseInt(e.target.value);
              onCustomCapChange(v && !isNaN(v) && v > 0 ? v : null);
            }}
            className={`w-20 text-center bg-black/40 border sports-font text-sm py-1 focus:outline-none transition-all ${
              lineupStat === 'random'
                ? 'border-white/5 text-white/15 cursor-not-allowed placeholder-white/10'
                : 'border-white/15 text-[#FDF100]/80 focus:border-[#FDF100]/40 placeholder-white/25'
            }`}
          />
        </Row>

        <Row label="Modes">
          <Chips>
            <Chip active={hardMode} activeBg="#c8102e" activeText="#fff"
              onClick={() => { onHardModeChange(!hardMode); onFirstPickerIdChange(null); }}>
              Hard
            </Chip>
            <Chip active={blindMode} activeBg="#7c3aed" activeText="#fff"
              onClick={() => onBlindModeChange(!blindMode)}>
              Blind
            </Chip>
          </Chips>
        </Row>

        <Row label="Timer">
          <Chips>
            {PICK_TIMER_OPTIONS.map(opt => (
              <Chip key={String(opt.value)} active={pickTimer === opt.value}
                onClick={() => onPickTimerChange(opt.value)}>
                {opt.label}
              </Chip>
            ))}
          </Chips>
        </Row>
      </div>

      {/* Filters + first pick */}
      <div className="border-t border-white/8 pt-2.5 space-y-2">
        <Row label="Filters">
          <Chips>
            {FILTER_LABELS.map(({ type, label, tooltip }) => {
              const isOff = disabledRoundTypes.includes(type);
              return (
                <div key={type} className="relative group">
                  <Chip active={false} dim={isOff} onClick={() => toggleFilter(type)}>
                    {label}
                  </Chip>
                  {tooltip && (
                    <div className="pointer-events-none hidden group-hover:block absolute bottom-full left-0 mb-1.5 w-52 bg-black/90 border border-white/15 px-2.5 py-2 sports-font text-[9px] text-white/50 leading-relaxed z-20 whitespace-normal">
                      {tooltip}
                    </div>
                  )}
                </div>
              );
            })}
          </Chips>
        </Row>

        {hardMode && players.length > 1 && (
          <Row label="First">
            <ScrollStrip>
              <Chip active={firstPickerId === null} onClick={() => onFirstPickerIdChange(null)}>
                AUTO
              </Chip>
              {players.map(p => (
                <Chip key={p.player_id} active={firstPickerId === p.player_id}
                  activeBg="#c8102e" activeText="#fff"
                  onClick={() => onFirstPickerIdChange(p.player_id)}>
                  {p.player_name}
                </Chip>
              ))}
            </ScrollStrip>
          </Row>
        )}
      </div>

    </div>
  );
}
