import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getDayNumber,
  generateDailyPuzzle,
  getExistingEntry,
} from '../../services/dailyCapCrunch';
import type { Sport } from '../../types';

export default function DailyCapCrunchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sport = (location.state as { sport?: Sport } | null)?.sport ?? 'nba';
  const startedRef = useRef(false);

  // ?reset skips the already-played guard so the game can be replayed for testing.
  // ?day=N overrides the day number so you can preview a specific puzzle.
  const params = new URLSearchParams(location.search);
  const resetMode = params.has('reset');
  const rawDay = params.has('day') ? parseInt(params.get('day')!, 10) : null;
  const dayOverride = rawDay !== null && !isNaN(rawDay) ? rawDay : null;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function init() {
      const dayNumber = dayOverride ?? getDayNumber();
      const puzzle = generateDailyPuzzle(sport, dayNumber);

      // Skip the already-played check when ?reset is set (testing/replay mode)
      if (!resetMode) {
        const existing = await getExistingEntry(dayNumber, sport);
        if (existing) {
          navigate('/daily/cap-crunch/results', {
            replace: true,
            state: {
              alreadyPlayed: true,
              existingEntry: existing,
              dayNumber,
              sport,
              statCategory: puzzle.statCategory,
              targetCap: puzzle.targetCap,
            },
          });
          return;
        }
      }

      // Launch SoloCapCrunchPage in daily mode
      navigate('/lineup-is-right', {
        replace: true,
        state: {
          autoStart: true,
          selectedSport: sport,
          statCategory: puzzle.statCategory,
          totalRounds: 5,
          dailyMode: true,
          dayNumber: puzzle.dayNumber,
          dailyTargetCap: puzzle.targetCap,
          dailyFilters: puzzle.roundFilters,
        },
      });
    }

    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen home-chalkboard flex items-center justify-center">
      <p className="capcrunch-kicker text-white/50">Loading today's puzzle…</p>
    </div>
  );
}
