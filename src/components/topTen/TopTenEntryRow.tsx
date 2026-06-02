import { motion } from 'framer-motion';
import { PlayerHeadshot } from '../capCrunch/PlayerHeadshot';
import { TeamLogo } from '../TeamLogo';
import { formatStat } from '../../services/topTen';
import type { TopTenEntry, StatCategoryDef } from '../../services/topTen';

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(w => !SUFFIXES.has(w.toLowerCase().replace(/\./g, '')))
    .map(w => w[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .join('.');
}

interface Props {
  entry: TopTenEntry;
  index: number;
  /** Was this slot correctly guessed during the game. */
  wasGuessed: boolean;
  /** Reveal all entries (solo end state, results page). */
  gameOver?: boolean;
  /** Show team logo hint before the slot is guessed (division mode). */
  showTeamHint?: boolean;
  /** Show player initials as hint (division/team rounds where team is already known). */
  showInitialsHint?: boolean;
  sport: 'nba' | 'nfl';
  categoryKey: string;
  catDef?: StatCategoryDef;
  statShortLabel?: string;
  /** Trigger a shake animation on this row (solo: just guessed). */
  justGuessed?: boolean;
}

export function TopTenEntryRow({
  entry, index, wasGuessed, gameOver = false, showTeamHint = false,
  showInitialsHint = false, sport, categoryKey, catDef, statShortLabel,
  justGuessed = false,
}: Props) {
  const showInfo = wasGuessed || gameOver;
  const dimmed   = gameOver && !wasGuessed;
  const initials = showInitialsHint && !showInfo ? getInitials(entry.playerName) : '';

  return (
    <motion.div
      initial={false}
      animate={justGuessed ? { x: [0, -3, 3, -2, 2, 0] } : {}}
      transition={{ duration: 0.35 }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border transition-colors ${
        wasGuessed
          ? 'bg-emerald-950/40 border-emerald-700/35'
          : gameOver
          ? 'bg-[#111] border-white/5'
          : 'bg-[#0b0b0b] border-white/4'
      }`}
    >
      <span className="sports-font text-[10px] text-white/20 w-4 text-right shrink-0 tabular-nums">
        #{index + 1}
      </span>

      <div
        className={`w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 transition-all duration-500 ${
          wasGuessed ? 'ring-emerald-500/40' : 'ring-white/5'
        }`}
        style={{
          filter:  showInfo ? 'none' : 'blur(14px) saturate(0) brightness(0.45)',
          opacity: showInfo ? (dimmed ? 0.4 : 1) : 0.6,
        }}
      >
        <PlayerHeadshot playerId={entry.playerId} sport={sport} className="w-9 h-9 object-cover" />
      </div>

      <div className="flex-1 min-w-0">
        {showInfo ? (
          <>
            <p className={`retro-title text-sm leading-tight truncate ${
              wasGuessed ? 'text-emerald-300' : 'text-white/40'
            }`}>
              {entry.playerName}
            </p>
            <div className={`flex items-center gap-1.5 mt-0.5 ${dimmed ? 'opacity-40' : ''}`}>
              <TeamLogo abbr={entry.team} sport={sport} size={18} />
              <p className="sports-font text-[9px] text-white/40">{entry.year}</p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            {showTeamHint && <TeamLogo abbr={entry.team} sport={sport} size={18} />}
            {initials ? (
              <p className="retro-title text-sm text-white/28 tracking-wider">{initials}</p>
            ) : (
              <p className="sports-font text-[10px] text-white/20 tracking-[0.2em]">???</p>
            )}
          </div>
        )}
      </div>

      {showInfo && catDef && (
        <span className={`sports-font text-xs shrink-0 tabular-nums ${
          wasGuessed ? 'text-[#22c55e]' : 'text-white/20'
        }`}>
          {formatStat(entry.stat, categoryKey)}{' '}
          <span className="text-[9px] opacity-60">{statShortLabel}</span>
        </span>
      )}
    </motion.div>
  );
}
