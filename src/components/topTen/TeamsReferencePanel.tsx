import { motion, AnimatePresence } from 'framer-motion';
import { TeamLogo } from '../TeamLogo';
import { teams } from '../../data/teams';
import { nflTeams } from '../../data/nfl-teams';

export const NBA_BY_DIVISION = (['Eastern', 'Western'] as const).flatMap(conf =>
  (['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest'] as const)
    .map(div => ({ label: `${conf === 'Eastern' ? 'East' : 'West'} · ${div}`, divTeams: teams.filter(t => t.conference === conf && t.division === div) }))
    .filter(g => g.divTeams.length > 0)
);

export const NFL_BY_DIVISION = (['AFC', 'NFC'] as const).flatMap(conf =>
  (['East', 'North', 'South', 'West'] as const).map(div => ({
    label: `${conf} ${div}`,
    divTeams: nflTeams.filter(t => t.conference === conf && t.division === div),
  }))
);

interface Props {
  sport: 'nba' | 'nfl';
  show: boolean;
  onClose: () => void;
}

export function TeamsReferencePanel({ sport, show, onClose }: Props) {
  const groups = sport === 'nfl' ? NFL_BY_DIVISION : NBA_BY_DIVISION;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="border-b border-white/8 bg-[#0a0a0a]/98 z-10 px-4 py-3"
          onClick={onClose}
        >
          <div className="max-w-lg mx-auto grid grid-cols-2 gap-x-6 gap-y-2">
            {groups.map(({ label, divTeams }) => (
              <div key={label}>
                <p className="sports-font text-[8px] text-white/20 tracking-widest uppercase mb-1">{label}</p>
                <div className="flex gap-2 flex-wrap">
                  {divTeams.map(t => (
                    <div key={t.abbreviation} className="flex items-center gap-1">
                      <TeamLogo abbr={t.abbreviation} sport={sport} size={18} />
                      <span className="sports-font text-[9px] text-white/40">{t.abbreviation}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
