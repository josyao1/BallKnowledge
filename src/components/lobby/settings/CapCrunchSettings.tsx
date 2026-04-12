/**
 * CapCrunchSettings.tsx — Host settings for the Cap Crunch (lineup-is-right) game mode.
 * Sport, stat category (including NFL career totals), custom cap, hard mode,
 * first-picker assignment, and round count.
 */

import type { Sport } from '../../../types';

const LINEUP_STAT_ABBR: Record<string, string> = {
  random: 'RANDOM',
  pts: 'PTS', ast: 'AST', reb: 'REB', min: 'MIN', pra: 'PRA',
  passing_yards: 'PASS YD', passing_tds: 'PASS TD', interceptions: 'INT',
  rushing_yards: 'RUSH YD', rushing_tds: 'RUSH TD',
  receiving_yards: 'REC YD', receiving_tds: 'REC TD', receptions: 'REC',
  total_gp: 'TOT GP',
  career_passing_yards:   'CAREER PASS YD',
  career_passing_tds:     'CAREER PASS TD',
  career_rushing_yards:   'CAREER RUSH YD',
  career_rushing_tds:     'CAREER RUSH TD',
  career_receiving_yards: 'CAREER REC YD',
  career_receiving_tds:   'CAREER REC TD',
};

const NFL_CAREER_CATS = [
  'career_passing_yards', 'career_passing_tds',
  'career_rushing_yards', 'career_rushing_tds',
  'career_receiving_yards', 'career_receiving_tds',
] as const;

interface Player {
  player_id: string;
  player_name: string;
}

interface Props {
  sport: Sport;
  onSportChange: (s: Sport) => void;
  lineupStat: string;
  onLineupStatChange: (stat: string) => void;
  customCap: number | null;
  onCustomCapChange: (cap: number | null) => void;
  hardMode: boolean;
  onHardModeChange: (on: boolean) => void;
  firstPickerId: string | null;
  onFirstPickerIdChange: (id: string | null) => void;
  totalRounds: number;
  onTotalRoundsChange: (n: number) => void;
  players: Player[];
}

export function CapCrunchSettings({
  sport, onSportChange, lineupStat, onLineupStatChange,
  customCap, onCustomCapChange, hardMode, onHardModeChange,
  firstPickerId, onFirstPickerIdChange, totalRounds, onTotalRoundsChange, players,
}: Props) {
  const nbaCats = ['pts', 'ast', 'reb', 'min', 'pra', 'total_gp'];
  const nflCats = ['passing_yards', 'passing_tds', 'interceptions', 'rushing_yards', 'rushing_tds', 'receiving_yards', 'receiving_tds', 'receptions', 'total_gp'];

  return (
    <>
      {/* Sport */}
      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Sport</div>
        <div className="flex gap-1.5">
          {(['nba', 'nfl'] as const).map(s => (
            <button
              key={s}
              onClick={() => { onSportChange(s); onLineupStatChange('random'); onCustomCapChange(null); }}
              className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                sport === s
                  ? s === 'nba' ? 'bg-[#f15a29] text-white' : 'bg-[#013369] text-white'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Stat category */}
      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Stat Category</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(['random', ...(sport === 'nba' ? nbaCats : nflCats)] as string[]).map(cat => (
            <button
              key={cat}
              onClick={() => { onLineupStatChange(cat); if (cat === 'random') onCustomCapChange(null); }}
              className={`px-2.5 py-1.5 rounded-sm sports-font text-[10px] tracking-wider transition-all ${
                lineupStat === cat
                  ? cat === 'random' ? 'bg-[#d4af37] text-black' : 'bg-[#ec4899] text-white'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
            >
              {LINEUP_STAT_ABBR[cat] || cat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* NFL career totals sub-section */}
        {sport === 'nfl' && (
          <div>
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-[#1e1e1e]" />
              <span className="sports-font text-[8px] text-[#444] tracking-[0.3em] uppercase">Career Totals</span>
              <div className="flex-1 h-px bg-[#1e1e1e]" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  const pick = NFL_CAREER_CATS[Math.floor(Math.random() * NFL_CAREER_CATS.length)];
                  onLineupStatChange(pick);
                  onCustomCapChange(null);
                }}
                className="px-2.5 py-1.5 rounded-sm sports-font text-[10px] tracking-wider transition-all bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]"
              >
                RANDOM
              </button>
              {NFL_CAREER_CATS.map(cat => (
                <button
                  key={cat}
                  onClick={() => { onLineupStatChange(cat); onCustomCapChange(null); }}
                  className={`px-2.5 py-1.5 rounded-sm sports-font text-[10px] tracking-wider transition-all ${
                    lineupStat === cat
                      ? 'bg-[#ec4899] text-white'
                      : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
                  }`}
                >
                  {LINEUP_STAT_ABBR[cat]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Custom cap */}
      <div className="border-t border-[#1a1a1a] pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="sports-font text-[10px] text-[#777] tracking-widest uppercase">Target Cap</div>
            <div className="sports-font text-[9px] text-[#444] mt-0.5">
              {lineupStat === 'random' ? 'Select a stat to set a cap' : 'Players must stay under this number'}
            </div>
          </div>
          <input
            type="number" min={1}
            disabled={lineupStat === 'random'}
            value={lineupStat === 'random' ? '' : (customCap ?? '')}
            placeholder="AUTO"
            onChange={e => {
              const v = e.target.value === '' ? null : parseInt(e.target.value);
              onCustomCapChange(v && !isNaN(v) && v > 0 ? v : null);
            }}
            className={`w-24 text-center bg-[#111] border rounded-sm retro-title text-base py-1.5 focus:outline-none transition-all ${
              lineupStat === 'random'
                ? 'border-[#1a1a1a] text-[#333] cursor-not-allowed placeholder-[#222]'
                : 'border-[#2a2a2a] text-[#d4af37] focus:border-[#d4af37] placeholder-[#444]'
            }`}
          />
        </div>
      </div>

      {/* Hard mode */}
      <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-4">
        <div>
          <div className="sports-font text-[10px] text-[#777] tracking-widest uppercase">Hard Mode</div>
          <div className="sports-font text-[9px] text-[#444] mt-0.5">Pick one at a time; locks globally</div>
        </div>
        <button
          onClick={() => { onHardModeChange(!hardMode); onFirstPickerIdChange(null); }}
          className={`px-4 py-1.5 rounded-sm retro-title text-sm tracking-wider transition-all ${
            hardMode ? 'bg-[#c8102e] text-white' : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a]'
          }`}
        >
          {hardMode ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* First picker — hard mode only */}
      {hardMode && players.length > 1 && (
        <div className="border-t border-[#1a1a1a] pt-4">
          <div className="sports-font text-[10px] text-[#777] tracking-widest uppercase mb-2">First Pick</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onFirstPickerIdChange(null)}
              className={`px-2.5 py-1.5 rounded-sm sports-font text-[10px] tracking-wider transition-all ${
                firstPickerId === null
                  ? 'bg-[#d4af37] text-black'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
            >
              AUTO
            </button>
            {players.map(p => (
              <button
                key={p.player_id}
                onClick={() => onFirstPickerIdChange(p.player_id)}
                className={`px-2.5 py-1.5 rounded-sm sports-font text-[10px] tracking-wider transition-all ${
                  firstPickerId === p.player_id
                    ? 'bg-[#c8102e] text-white'
                    : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
                }`}
              >
                {p.player_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Round count */}
      <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-4">
        <div>
          <div className="sports-font text-[10px] text-[#777] tracking-widest uppercase">Rounds</div>
          <div className="sports-font text-[9px] text-[#444] mt-0.5">Picks per player</div>
        </div>
        <div className="flex gap-1">
          {[3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button
              key={n}
              onClick={() => onTotalRoundsChange(n)}
              className={`w-6 h-6 rounded-sm sports-font text-[10px] transition ${
                totalRounds === n
                  ? 'bg-[#d4af37] text-black font-bold'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
