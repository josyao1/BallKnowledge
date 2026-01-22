import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LeaderboardTable } from './LeaderboardTable';
import { getLeaderboard, getGlobalLeaderboard } from '../../services/leaderboard';
import { isSupabaseEnabled } from '../../lib/supabase';
import type { LeaderboardEntry } from '../../types/database';

interface LeaderboardProps {
  teamAbbreviation?: string;
  season?: string;
  title?: string;
}

export function Leaderboard({ teamAbbreviation, season, title }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'team' | 'global'>(
    teamAbbreviation && season ? 'team' : 'global'
  );

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      setError(null);

      const result = view === 'team' && teamAbbreviation && season
        ? await getLeaderboard(teamAbbreviation, season)
        : await getGlobalLeaderboard();

      if (result.error) {
        setError(result.error);
      } else {
        setEntries(result.data || []);
      }

      setLoading(false);
    }

    if (isSupabaseEnabled) {
      fetchLeaderboard();
    } else {
      setLoading(false);
    }
  }, [teamAbbreviation, season, view]);

  if (!isSupabaseEnabled) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-400 mb-2">Leaderboard</h3>
        <p className="text-gray-500 text-sm">
          Leaderboard is not configured. Add Supabase credentials to enable.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">
          {title || 'Leaderboard'}
        </h3>

        {teamAbbreviation && season && (
          <div className="flex gap-2">
            <button
              onClick={() => setView('team')}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                view === 'team'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              This Roster
            </button>
            <button
              onClick={() => setView('global')}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                view === 'global'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              Global
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : error ? (
        <div className="text-center text-red-400 py-8">
          {error}
        </div>
      ) : (
        <LeaderboardTable
          entries={entries}
          showTeam={view === 'global'}
        />
      )}
    </motion.div>
  );
}
