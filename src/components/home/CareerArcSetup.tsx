/**
 * CareerArcSetup.tsx — Setup panel for the Career Arc game mode.
 * Lets the player filter by era before starting solo or creating a lobby.
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface Props {
  sport: 'nba' | 'nfl';
  careerActiveYear: number | null;
  setCareerActiveYear: (y: number | null) => void;
  onBack: () => void;
}

const ERA_OPTIONS: (number | null)[] = [null, 2010, 2015, 2018, 2020, 2022];

export function CareerArcSetup({ sport, careerActiveYear, setCareerActiveYear, onBack }: Props) {
  const navigate = useNavigate();

  return (
    <motion.div
      key="career-setup"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      className="z-10 w-full max-w-sm"
    >
      <div className="relative bg-[#141414] border-2 border-[#22c55e] rounded-2xl overflow-hidden shadow-2xl">
        {/* Diagonal stripe texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #22c55e 0, #22c55e 1px, transparent 0, transparent 50%)', backgroundSize: '14px 14px' }}
        />

        <div className="relative z-10 p-5 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="sports-font text-[10px] text-[#22c55e]/50 hover:text-[#22c55e]/90 tracking-widest uppercase transition"
            >
              ← Back
            </button>
            <div className="flex-1 text-center">
              <div className="sports-font text-[9px] text-[#22c55e]/50 tracking-[0.3em] uppercase">CA</div>
              <h2 className="retro-title text-2xl text-[#22c55e] leading-tight">Career Arc</h2>
              <p className="sports-font text-[9px] text-[#888] tracking-widest">{sport === 'nba' ? 'NBA' : 'NFL'} Edition</p>
            </div>
            <div className="w-12" />
          </div>
          <div className="border-t border-[#22c55e]/20" />

          {/* Era filter */}
          <div className="flex flex-col gap-2">
            <div className="sports-font text-[9px] text-[#888] tracking-[0.25em] uppercase text-center">
              Player must be active into
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ERA_OPTIONS.map(yr => (
                <button
                  key={yr ?? 'any'}
                  onClick={() => setCareerActiveYear(yr)}
                  className={`py-1.5 rounded-lg sports-font text-[10px] tracking-wider uppercase border transition-all ${
                    careerActiveYear === yr
                      ? 'bg-[#22c55e] text-[#111] border-[#22c55e]'
                      : 'border-[#2a2a2a] text-[#666] hover:border-[#22c55e]/40 hover:text-[#888]'
                  }`}
                >
                  {yr == null ? 'Any era' : `${yr}+`}
                </button>
              ))}
            </div>
            {careerActiveYear && (
              <p className="sports-font text-[9px] text-[#555] text-center">
                Players who played in {careerActiveYear} or later
              </p>
            )}
          </div>

          <div className="border-t border-[#22c55e]/20" />

          {/* Actions */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => navigate('/career', { state: careerActiveYear ? { careerTo: careerActiveYear } : null })}
              className="px-8 py-2.5 rounded-lg sports-font text-xs tracking-wider uppercase border-2 border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-[#111] transition-all"
            >
              Start Solo
            </button>
            <button
              onClick={() => navigate('/lobby/create', { state: { gameType: 'career' } })}
              className="px-4 py-2.5 rounded-lg sports-font border border-[#333] text-[#777] hover:border-[#555] text-xs"
            >
              Lobby
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
