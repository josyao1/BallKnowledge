/**
 * FaceRevealSetup.tsx — Setup panel for the Face Reveal game mode.
 * Year cutoff filter and per-zoom-level timer. Solo or Lobby.
 *
 * The Lobby button creates a lobby immediately using the stored player name
 * (same pattern as the waiting room's host settings). Falls back to
 * /lobby/create if no stored name exists.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../../stores/lobbyStore';
import { getStoredPlayerName, updateCareerState } from '../../services/lobby';

interface Props {
  sport: 'nba' | 'nfl';
  onBack: () => void;
}

const COLOR = '#06b6d4';

const MIN_YARDS_OPTIONS: { label: string; value: number }[] = [
  { label: 'Any',   value: 0    },
  { label: '500+',  value: 500  },
  { label: '1000+', value: 1000 },
];

const MIN_MPG_OPTIONS: { label: string; value: number }[] = [
  { label: 'Any',   value: 0  },
  { label: '15+',   value: 15 },
  { label: '20+',   value: 20 },
  { label: '25+',   value: 25 },
];

const ERA_OPTIONS: { label: string; value: number }[] = [
  { label: 'All',   value: 0    },
  { label: '2000+', value: 2000 },
  { label: '2005+', value: 2005 },
  { label: '2010+', value: 2010 },
  { label: '2015+', value: 2015 },
  { label: '2020+', value: 2020 },
];

const TIMER_OPTIONS: { label: string; value: number }[] = [
  { label: '30s', value: 30 },
  { label: '45s', value: 45 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
];

export function FaceRevealSetup({ sport, onBack }: Props) {
  const navigate = useNavigate();
  const { createLobby } = useLobbyStore();
  const [careerTo,     setCareerTo]     = useState(0);
  const [timer,        setTimer]        = useState(60);
  const [minYards,     setMinYards]     = useState(0);
  const [minMpg,       setMinMpg]       = useState(0);
  const [defenseMode,  setDefenseMode]  = useState<'known' | 'all'>('known');
  const [isCreating,   setIsCreating]   = useState(false);

  async function handleLobby() {
    const hostName = getStoredPlayerName();
    if (!hostName) {
      // No stored name — go to create page so user can enter one
      navigate('/lobby/create', { state: { gameType: 'face-reveal' } });
      return;
    }

    setIsCreating(true);
    try {
      const dummyTeamAbbr = sport === 'nba' ? 'LAL' : 'NE';
      const dummySeason   = sport === 'nba' ? '2023-24' : '2023';
      const lobby = await createLobby(hostName, sport, dummyTeamAbbr, dummySeason, 90, 'random', 2000, 2025, 'face-reveal', 'team', null, null);
      if (lobby) {
        await updateCareerState(lobby.id, { win_target: 20, career_to: careerTo, timer, min_yards: minYards, min_mpg: minMpg, defense_mode: defenseMode, round: 0 });
        navigate(`/lobby/${lobby.join_code}`);
      }
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <motion.div
      key="face-reveal-setup"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      className="z-10 w-full max-w-sm"
    >
      <div className="relative bg-[#141414] border-2 rounded-2xl overflow-hidden shadow-2xl" style={{ borderColor: COLOR }}>
        {/* Diagonal stripe texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: `repeating-linear-gradient(45deg, ${COLOR} 0, ${COLOR} 1px, transparent 0, transparent 50%)`, backgroundSize: '14px 14px' }}
        />

        <div className="relative z-10 p-5 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="sports-font text-[10px] tracking-widest uppercase transition"
              style={{ color: `${COLOR}80` }}
              onMouseEnter={e => (e.currentTarget.style.color = COLOR)}
              onMouseLeave={e => (e.currentTarget.style.color = `${COLOR}80`)}
            >
              ← Back
            </button>
            <div className="flex-1 text-center">
              <div className="sports-font text-[9px] tracking-[0.3em] uppercase" style={{ color: `${COLOR}80` }}>FR</div>
              <h2 className="retro-title text-2xl leading-tight" style={{ color: COLOR }}>Face Reveal</h2>
              <p className="sports-font text-[9px] text-[#888] tracking-widest">{sport === 'nba' ? 'NBA' : 'NFL'} Edition</p>
            </div>
            <div className="w-12" />
          </div>

          <div className="border-t border-[#06b6d4]/20" />

          {/* Era filter */}
          <div className="flex flex-col gap-2">
            <div className="sports-font text-[9px] text-[#888] tracking-[0.25em] uppercase text-center">
              Player active into
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ERA_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCareerTo(opt.value)}
                  className={`py-1.5 rounded-lg sports-font text-[10px] tracking-wider uppercase border transition-all ${
                    careerTo === opt.value
                      ? 'text-[#111] border-transparent'
                      : 'border-[#2a2a2a] text-[#666] hover:border-[#06b6d4]/40 hover:text-[#888]'
                  }`}
                  style={careerTo === opt.value ? { backgroundColor: COLOR } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Min yards (NFL only) */}
          {sport === 'nfl' && (
            <div className="flex flex-col gap-2">
              <div className="sports-font text-[9px] text-[#888] tracking-[0.25em] uppercase text-center">
                Min season yards (Offensive)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MIN_YARDS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMinYards(opt.value)}
                    className={`py-1.5 rounded-lg sports-font text-[10px] tracking-wider uppercase border transition-all ${
                      minYards === opt.value
                        ? 'text-[#111] border-transparent'
                        : 'border-[#2a2a2a] text-[#666] hover:border-[#06b6d4]/40 hover:text-[#888]'
                    }`}
                    style={minYards === opt.value ? { backgroundColor: COLOR } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Defense pool (NFL only) */}
          {sport === 'nfl' && (
            <div className="flex flex-col gap-2">
              <div className="sports-font text-[9px] text-[#888] tracking-[0.25em] uppercase text-center">
                Defense pool
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['known', 'all'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setDefenseMode(mode)}
                    className={`py-1.5 rounded-lg sports-font text-[10px] tracking-wider uppercase border transition-all ${
                      defenseMode === mode
                        ? 'text-[#111] border-transparent'
                        : 'border-[#2a2a2a] text-[#666] hover:border-[#06b6d4]/40 hover:text-[#888]'
                    }`}
                    style={defenseMode === mode ? { backgroundColor: COLOR } : {}}
                  >
                    {mode === 'known' ? 'Well Known' : 'All Defense'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Min MPG (NBA only) */}
          {sport === 'nba' && (
            <div className="flex flex-col gap-2">
              <div className="sports-font text-[9px] text-[#888] tracking-[0.25em] uppercase text-center">
                Min season MPG
              </div>
              <div className="grid grid-cols-4 gap-2">
                {MIN_MPG_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMinMpg(opt.value)}
                    className={`py-1.5 rounded-lg sports-font text-[10px] tracking-wider uppercase border transition-all ${
                      minMpg === opt.value
                        ? 'text-[#111] border-transparent'
                        : 'border-[#2a2a2a] text-[#666] hover:border-[#06b6d4]/40 hover:text-[#888]'
                    }`}
                    style={minMpg === opt.value ? { backgroundColor: COLOR } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timer per zoom level */}
          <div className="flex flex-col gap-2">
            <div className="sports-font text-[9px] text-[#888] tracking-[0.25em] uppercase text-center">
              Timer per zoom level
            </div>
            <div className="grid grid-cols-4 gap-2">
              {TIMER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTimer(opt.value)}
                  className={`py-1.5 rounded-lg sports-font text-[10px] tracking-wider uppercase border transition-all ${
                    timer === opt.value
                      ? 'text-[#111] border-transparent'
                      : 'border-[#2a2a2a] text-[#666] hover:border-[#06b6d4]/40 hover:text-[#888]'
                  }`}
                  style={timer === opt.value ? { backgroundColor: COLOR } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#06b6d4]/20" />

          {/* Actions */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => navigate('/face-reveal', { state: { sport, careerTo, timer, minYards, minMpg, defenseMode } })}
              className="px-8 py-2.5 rounded-lg sports-font text-xs tracking-wider uppercase border-2 transition-all hover:text-[#111]"
              style={{ borderColor: COLOR, color: COLOR }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = COLOR; (e.currentTarget as HTMLButtonElement).style.color = '#111'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = ''; (e.currentTarget as HTMLButtonElement).style.color = COLOR; }}
            >
              Start Solo
            </button>
            <button
              onClick={handleLobby}
              disabled={isCreating}
              className="px-4 py-2.5 rounded-lg sports-font border border-[#333] text-[#777] hover:border-[#555] text-xs disabled:opacity-50"
            >
              {isCreating ? '...' : 'Lobby'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
