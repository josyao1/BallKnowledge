/**
 * CareerStatsTable.tsx — Animated stat table for Career Arc.
 * Shared by CareerGamePage (solo) and MultiplayerCareerPage.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { formatStat } from './careerColumns';
import { normalizeTeamAbbr } from '../../utils/teamAbbr';
import type { Sport } from '../../types';

interface Props {
  columns: { key: string; label: string }[];
  seasons: any[];
  /** Map of stat key → peak value; cells matching the high are highlighted gold */
  careerHighs: Record<string, number>;
  /** When false, season year cells render as '???' to hide the player's era */
  yearsRevealed: boolean;
  sport: Sport;
}

export function CareerStatsTable({ columns, seasons, careerHighs, yearsRevealed, sport }: Props) {
  return (
    <div className="flex-1 overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-[#333]">
            {columns.map(col => (
              <th key={col.key} className="px-3 py-2 text-left sports-font text-[10px] text-[#888] tracking-wider uppercase whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {seasons.map((season, idx) => (
              <motion.tr
                key={season.season + idx}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  opacity: { duration: 0.3 },
                  y: { type: 'spring', stiffness: 350, damping: 26 },
                }}
                className="border-b border-[#222] hover:bg-[#1a1a1a] row-gold-flash"
              >
                {columns.map(col => {
                  const isHigh = col.key !== 'season' && col.key !== 'team'
                    && careerHighs[col.key] !== undefined
                    && (Number(season[col.key]) || 0) === careerHighs[col.key];
                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-2 sports-font text-xs whitespace-nowrap ${
                        isHigh
                          ? 'text-[#d4af37] bg-[#d4af37]/10 font-bold'
                          : 'text-[var(--vintage-cream)]'
                      }`}
                    >
                      {col.key === 'season'
                        ? (yearsRevealed ? season.season : '???')
                        : col.key === 'team'
                          ? normalizeTeamAbbr(formatStat(col.key, season[col.key]), sport)
                          : formatStat(col.key, season[col.key])
                      }
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
