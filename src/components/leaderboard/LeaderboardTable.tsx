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
      <div className="text-center text-gray-400 py-8">
        No scores yet. Be the first!
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-700">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-800 text-gray-400 text-sm">
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
                className={`border-t border-gray-700 ${
                  isHighlighted ? 'bg-indigo-900/30' : 'hover:bg-gray-800/50'
                }`}
              >
                <td className="px-4 py-3">
                  <span className={`font-bold ${
                    entry.rank === 1 ? 'text-yellow-400' :
                    entry.rank === 2 ? 'text-gray-300' :
                    entry.rank === 3 ? 'text-amber-600' :
                    'text-gray-500'
                  }`}>
                    {entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-white">
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
                      <span className="text-gray-300">
                        {entry.team_abbreviation} {entry.season}
                      </span>
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 text-right font-mono text-white">
                  {entry.score}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-400">
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
