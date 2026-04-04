import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamLogo } from '../TeamLogo';
import { getTeamByAbbreviation } from '../../data/teams';
import { nflTeams } from '../../data/nfl-teams';

const NBA_ABBRS = [
  'BOS','BKN','NYK','PHI','TOR','CHI','CLE','DET','IND','MIL',
  'ATL','CHA','MIA','ORL','WAS','DEN','MIN','OKC','POR','UTA',
  'GSW','LAC','LAL','PHX','SAC','DAL','HOU','MEM','NOP','SAS',
];
const NFL_ABBRS = [
  'BUF','MIA','NE','NYJ','BAL','CIN','CLE','PIT','HOU','IND',
  'JAX','TEN','DEN','KC','LV','LAC','DAL','NYG','PHI','WAS',
  'CHI','DET','GB','MIN','ATL','CAR','NO','TB','ARI','LAR','SF','SEA',
];

function getTeamColor(sport: 'nba' | 'nfl', abbr: string): string {
  if (sport === 'nba') {
    const t = getTeamByAbbreviation(abbr);
    return t?.colors?.primary ?? '#ffffff';
  }
  const t = nflTeams.find(t => t.abbreviation === abbr);
  return t?.colors?.primary ?? '#ffffff';
}

function pickRandom<T>(arr: T[], exclude?: T): T {
  const pool = exclude !== undefined ? arr.filter(x => x !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface TeamSlotMachineProps {
  sport: 'nba' | 'nfl';
  /** The real team to land on */
  team: string;
  size?: 'sm' | 'lg';
}

/**
 * Displays a random "spin" through several team logos/abbrevs/colors before
 * settling on the real team. Re-triggers whenever `team` changes.
 */
export function TeamSlotMachine({ sport, team, size = 'lg' }: TeamSlotMachineProps) {
  const pool = sport === 'nba' ? NBA_ABBRS : NFL_ABBRS;
  const [displayed, setDisplayed] = useState(team);
  const [settled, setSettled] = useState(true);
  const prevTeamRef = useRef(team);
  // Tracks the last team that fully landed (never a mid-spin intermediate)
  const settledTeamRef = useRef(team);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (team === prevTeamRef.current) return;
    prevTeamRef.current = team;

    // Cancel any in-progress spin before starting a new one
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);

    // Build sequence from the last fully-settled team so we always exclude it
    const count = 6;
    const sequence: string[] = [];
    let last = settledTeamRef.current;
    for (let i = 0; i < count; i++) {
      const next = pickRandom(pool, last);
      sequence.push(next);
      last = next;
    }
    sequence.push(team);

    setSettled(false);

    // Intervals: start fast (80ms), slow slightly toward end
    const delays = [80, 80, 100, 120, 150, 190, 0];
    let i = 0;

    function step() {
      setDisplayed(sequence[i]);
      i++;
      if (i < sequence.length) {
        timeoutRef.current = setTimeout(step, delays[i] ?? 0);
      } else {
        settledTeamRef.current = team;
        setSettled(true);
      }
    }
    timeoutRef.current = setTimeout(step, delays[0]);

    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [team]);

  const color = getTeamColor(sport, displayed);
  const logoSize = size === 'lg' ? 52 : 36;
  const textClass = size === 'lg'
    ? 'retro-title text-2xl md:text-4xl font-bold tracking-tight'
    : 'retro-title text-xl md:text-3xl font-bold leading-tight';
  // Fixed min-width prevents the card from shifting as team abbrevs change width
  const minWidth = size === 'lg' ? 'min-w-[160px]' : 'min-w-[130px]';

  return (
    <motion.div
      className={`flex items-center gap-2 px-3 py-2 md:py-3 rounded-lg border-2 bg-black ${minWidth}`}
      animate={{ borderColor: color }}
      transition={{ duration: settled ? 0.4 : 0.05, ease: 'easeOut' }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={displayed}
          initial={{ opacity: 0, y: settled ? 0 : -20, scale: settled ? 0.85 : 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: settled ? 0 : 20, scale: 0.9 }}
          transition={
            settled
              ? { type: 'spring', stiffness: 300, damping: 22 }
              : { duration: 0.06 }
          }
          className="flex items-center gap-2 md:gap-3"
        >
          <TeamLogo sport={sport} abbr={displayed} size={logoSize} />
          <motion.p
            className={textClass}
            animate={{ color }}
            transition={{ duration: settled ? 0.4 : 0.05 }}
          >
            {displayed}
          </motion.p>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
