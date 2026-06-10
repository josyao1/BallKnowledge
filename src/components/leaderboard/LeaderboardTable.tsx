import { motion } from 'framer-motion';
import type { LeaderboardEntry } from '../../types/database';
import { getTeamByAbbreviation } from '../../data/teams';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  highlightUserId?: string;
  showTeam?: boolean;
}

export function LeaderboardTable({ entries, highlightUserId, showTeam = true }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-white/40 capcrunch-kicker py-8">
        No scores yet. Be the first!
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-white/10">
      <table className="w-full">
        <thead>
          <tr className="bg-black/40 text-white/40 capcrunch-kicker text-[10px] tracking-widest uppercase text-sm">
            <th className="px-4 py-3 text-left w-12">#</th>
            <th className="px-4 py-3 text-left">Player</th>
            {showTeam && <th className="px-4 py-3 text-left">Team</th>}
            <th className="px-4 py-3 text-right">Score</th>
            <th className="px-4 py-3 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const team = getTeamByAbbreviation(entry.team_abbreviation);
            const isHighlighted = highlightUserId && entry.id === highlightUserId;

            return (
              <motion.tr
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`border-t border-white/5 ${
                  isHighlighted ? 'bg-[#d4af37]/10' : 'hover:bg-white/5'
                }`}
              >
                <td className="px-4 py-3">
                  <span className={`capcrunch-title font-bold ${
                    entry.rank === 1 ? 'text-[#d4af37]' :
                    entry.rank === 2 ? 'text-white/60' :
                    entry.rank === 3 ? 'text-amber-600' :
                    'text-white/30'
                  }`}>
                    {entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="capcrunch-kicker text-white">
                    {entry.username || 'Anonymous'}
                  </span>
                </td>
                {showTeam && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: team?.colors.primary || '#666' }}
                      />
                      <span className="capcrunch-kicker text-white/60">
                        {entry.team_abbreviation} {entry.season}
                      </span>
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 text-right capcrunch-title text-white">
                  {entry.score}
                </td>
                <td className="px-4 py-3 text-right capcrunch-kicker text-white/40">
                  {Math.round(entry.percentage)}%
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
