import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const COLOR = '#06b6d4';

const ERA_OPTIONS    = [{ label: 'All', value: 0 }, { label: '2000+', value: 2000 }, { label: '2005+', value: 2005 }, { label: '2010+', value: 2010 }, { label: '2015+', value: 2015 }, { label: '2020+', value: 2020 }];
const TIMER_OPTIONS  = [{ label: '30s', value: 30 }, { label: '45s', value: 45 }, { label: '60s', value: 60 }, { label: '90s', value: 90 }];
const YARDS_OPTIONS  = [{ label: 'Any', value: 0 }, { label: '500+', value: 500 }, { label: '1000+', value: 1000 }];
const MPG_OPTIONS    = [{ label: 'Any', value: 0 }, { label: '15+', value: 15 }, { label: '20+', value: 20 }, { label: '25+', value: 25 }];

interface Props {
  sport: 'nba' | 'nfl';
  onBack: () => void;
}

function ChipRow<T extends number | string>({ label, options, value, onChange }: { label: string; options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="capcrunch-kicker text-[9px] text-white/40 text-center">{label}</p>
      <div className={`grid gap-2 ${options.length === 4 ? 'grid-cols-4' : options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {options.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`py-2 capcrunch-kicker text-[10px] border transition-all ${
              value === opt.value
                ? 'text-black border-transparent'
                : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/60'
            }`}
            style={value === opt.value ? { backgroundColor: COLOR } : {}}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FaceRevealSetup({ sport, onBack }: Props) {
  const navigate = useNavigate();
  const [careerTo,    setCareerTo]    = useState(0);
  const [timer,       setTimer]       = useState(60);
  const [minYards,    setMinYards]    = useState(0);
  const [minMpg,      setMinMpg]      = useState(0);
  const [defenseMode, setDefenseMode] = useState<'known' | 'all'>('known');
  const [tab,         setTab]         = useState<'settings' | 'rules'>('settings');

  return (
    <motion.div
      key="face-reveal-setup"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      className="z-10 w-full max-w-4xl overflow-y-auto max-h-[calc(100vh-120px)]"
    >
      {/* Narrow tab toggle */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <div className="inline-flex border border-white/10 bg-black/20">
          <button
            onClick={() => setTab('settings')}
            className={`px-4 py-2 capcrunch-kicker transition ${tab === 'settings' ? 'text-black' : 'text-white/60'}`}
            style={tab === 'settings' ? { background: COLOR } : {}}
          >
            Settings
          </button>
          <button
            onClick={() => setTab('rules')}
            className={`px-4 py-2 capcrunch-kicker transition ${tab === 'rules' ? 'text-black' : 'text-white/60'}`}
            style={tab === 'rules' ? { background: '#68BBE5' } : {}}
          >
            How to Play
          </button>
        </div>
        <button onClick={onBack} className="px-4 py-2 capcrunch-btn-secondary capcrunch-title text-sm">Back</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        {/* Settings panel */}
        <section
          className={`${tab !== 'settings' ? 'hidden lg:block' : ''} capcrunch-panel overflow-hidden shadow-2xl`}
          style={{ borderColor: `${COLOR}4d` }}
        >
          <div className="p-5 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center">
              <button onClick={onBack} className="capcrunch-kicker text-[10px] text-white/40 hover:text-white/70 transition-colors">
                ← Back
              </button>
              <div className="flex-1 text-center">
                <div className="capcrunch-kicker text-[9px] mb-0.5" style={{ color: `${COLOR}99` }}>FR</div>
                <h2 className="capcrunch-title text-2xl leading-tight" style={{ color: COLOR }}>Face Reveal</h2>
                <p className="capcrunch-kicker text-[9px] text-white/40">{sport === 'nba' ? 'NBA' : 'NFL'} Edition</p>
              </div>
              <div className="w-12" />
            </div>

            <div className="border-t border-white/10" />

            <ChipRow label="Player active into" options={ERA_OPTIONS} value={careerTo} onChange={setCareerTo} />
            <ChipRow label="Timer per zoom level" options={TIMER_OPTIONS} value={timer} onChange={setTimer} />

            {sport === 'nfl' && (
              <>
                <ChipRow label="Min season yards (offensive)" options={YARDS_OPTIONS} value={minYards} onChange={setMinYards} />
                <ChipRow
                  label="Defense pool"
                  options={[{ label: 'Well Known', value: 'known' as const }, { label: 'All Defense', value: 'all' as const }]}
                  value={defenseMode}
                  onChange={setDefenseMode}
                />
              </>
            )}

            {sport === 'nba' && (
              <ChipRow label="Min season MPG" options={MPG_OPTIONS} value={minMpg} onChange={setMinMpg} />
            )}

            <div className="border-t border-white/10" />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => navigate('/face-reveal', { state: { sport, careerTo, timer, minYards, minMpg, defenseMode } })}
                className="capcrunch-title px-8 py-2.5 text-base text-black transition-all active:translate-y-px"
                style={{ background: COLOR, boxShadow: '0 3px 0 rgba(5,85,100,0.9)' }}
              >
                Start Solo
              </button>
            </div>
          </div>
        </section>

        {/* How to Play aside */}
        <aside className={`${tab !== 'rules' ? 'hidden lg:block' : ''} capcrunch-panel p-5 md:p-6`}>
          <h3 className="capcrunch-title text-lg mb-4" style={{ color: COLOR }}>How to Play</h3>
          <ul className="text-sm text-white/80 space-y-3 text-left">
            <li><span className="font-bold" style={{ color: COLOR }}>Goal:</span> Identify a mystery player from a progressively zoomed-out headshot.</li>
            <li><span className="font-bold" style={{ color: COLOR }}>Zoom levels:</span> Three increasingly wider crop views, then a final hint with initials and team logo. Fewer levels seen = more points.</li>
            <li><span className="text-white/60 font-bold">Scoring:</span> First correct guess each round = 3 pts. All other correct guesses = 1 pt.</li>
            <li><span className="text-white/60 font-bold">Timer:</span> Each zoom level has a countdown. Runs out and the next level reveals automatically.</li>
            <li><span className="text-white/60 font-bold">Skip vote:</span> In multiplayer, players can vote to skip ahead to the next zoom level.</li>
            <li><span className="text-red-400 font-bold">Give Up:</span> Reveals the answer and moves to the next round.</li>
            <li><span className="text-white/60 font-bold">Era / yards / MPG:</span> Filters narrow the player pool — higher thresholds mean more well-known players.</li>
            <li><span className="text-white/60 font-bold">Defense pool:</span> NFL only — "Well Known" limits defensive players to a curated allowlist of recognizable names.</li>
          </ul>
        </aside>
      </div>
    </motion.div>
  );
}
