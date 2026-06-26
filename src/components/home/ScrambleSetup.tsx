import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const COLOR = '#3b82f6';
const SCRAMBLE_TO_YEARS = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i);
const MPG_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '15+', value: 15 },
  { label: '20+', value: 20 },
  { label: '25+', value: 25 },
];
const YARD_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '500+', value: 500 },
  { label: '1000+', value: 1000 },
];

interface Props {
  sport: 'nba' | 'nfl';
  onBack: () => void;
}

export function ScrambleSetup({ sport, onBack }: Props) {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<number>(0);
  const [minMpg, setMinMpg] = useState(0);
  const [minYards, setMinYards] = useState(0);
  const [includeDefense, setIncludeDefense] = useState(true);
  const [tab, setTab] = useState<'settings' | 'rules'>('settings');

  return (
    <motion.div
      key="scramble-setup"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      className="z-10 w-full max-w-3xl overflow-y-auto max-h-[calc(100vh-120px)]"
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
        <button
          onClick={onBack}
          className="px-4 py-2 capcrunch-btn-secondary capcrunch-title text-sm"
        >
          Back
        </button>
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
              <button
                onClick={onBack}
                className="capcrunch-kicker text-[10px] text-white/40 hover:text-white/70 transition-colors"
              >
                ← Back
              </button>
              <div className="flex-1 text-center">
                <div className="capcrunch-kicker text-[9px] mb-0.5" style={{ color: `${COLOR}99` }}>
                  NS
                </div>
                <h2 className="capcrunch-title text-2xl leading-tight" style={{ color: COLOR }}>
                  Name Scramble
                </h2>
                <p className="capcrunch-kicker text-[9px] text-white/40">
                  {sport === 'nba' ? 'NBA' : 'NFL'} Edition
                </p>
              </div>
              <div className="w-12" />
            </div>

            <div className="border-t border-white/10" />

            {/* Era filter */}
            <div className="flex flex-col gap-2">
              <p className="capcrunch-kicker text-[9px] text-white/40 text-center">
                Player active into
              </p>
              <select
                value={activeYear}
                onChange={(e) => setActiveYear(+e.target.value)}
                className="w-full bg-black/40 border border-white/10 px-3 py-2 capcrunch-kicker text-[10px] text-white focus:outline-none focus:border-[#d4af37]"
              >
                <option value={0}>Any era</option>
                {SCRAMBLE_TO_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}+
                  </option>
                ))}
              </select>
            </div>

            {/* MPG filter (NBA only) */}
            {sport === 'nba' && (
              <div className="flex flex-col gap-2">
                <p className="capcrunch-kicker text-[9px] text-white/40 text-center">
                  Min MPG (any season)
                </p>
                <div className="flex gap-2">
                  {MPG_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setMinMpg(opt.value)}
                      className={`flex-1 py-2 capcrunch-kicker text-[10px] border transition-all ${
                        minMpg === opt.value
                          ? 'text-white border-transparent'
                          : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/60'
                      }`}
                      style={minMpg === opt.value ? { backgroundColor: COLOR } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Yards filter (NFL only) */}
            {sport === 'nfl' && (
              <div className="flex flex-col gap-2">
                <p className="capcrunch-kicker text-[9px] text-white/40 text-center">
                  Min off. yards (any season)
                </p>
                <div className="flex gap-2">
                  {YARD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setMinYards(opt.value)}
                      className={`flex-1 py-2 capcrunch-kicker text-[10px] border transition-all ${
                        minYards === opt.value
                          ? 'text-white border-transparent'
                          : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/60'
                      }`}
                      style={minYards === opt.value ? { backgroundColor: COLOR } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Defense toggle (NFL only) */}
            {sport === 'nfl' && (
              <div className="flex items-center justify-between">
                <p className="capcrunch-kicker text-[9px] text-white/40">Defensive players</p>
                <div className="inline-flex border border-white/10">
                  <button
                    onClick={() => setIncludeDefense(true)}
                    className={`px-4 py-1.5 capcrunch-kicker text-[10px] transition ${includeDefense ? 'text-black' : 'text-white/40 hover:text-white/60'}`}
                    style={includeDefense ? { backgroundColor: COLOR } : {}}
                  >
                    On
                  </button>
                  <button
                    onClick={() => setIncludeDefense(false)}
                    className={`px-4 py-1.5 capcrunch-kicker text-[10px] transition ${!includeDefense ? 'text-black' : 'text-white/40 hover:text-white/60'}`}
                    style={!includeDefense ? { backgroundColor: COLOR } : {}}
                  >
                    Off
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-white/10" />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() =>
                  navigate('/scramble', {
                    state: {
                      sport,
                      careerTo: activeYear || undefined,
                      minMpg: minMpg || undefined,
                      minYards: minYards || undefined,
                      includeDefense: sport === 'nfl' ? includeDefense : undefined,
                    },
                  })
                }
                className="capcrunch-title px-8 py-2.5 text-base text-white transition-all active:translate-y-px"
                style={{ background: COLOR, boxShadow: '0 3px 0 rgba(30,60,140,0.9)' }}
              >
                Start Solo
              </button>
            </div>
          </div>
        </section>

        {/* How to Play aside */}
        <aside className={`${tab !== 'rules' ? 'hidden lg:block' : ''} capcrunch-panel p-5 md:p-6`}>
          <h3 className="capcrunch-title text-lg mb-4" style={{ color: COLOR }}>
            How to Play
          </h3>
          <ul className="text-sm text-white/80 space-y-3 text-left">
            <li>
              <span className="font-bold" style={{ color: COLOR }}>
                Goal:
              </span>{' '}
              Unscramble a shuffled athlete name before time runs out.
            </li>
            <li>
              <span className="font-bold" style={{ color: COLOR }}>
                Each round:
              </span>{' '}
              A player's name is scrambled — letters are shuffled within first and last name
              segments.
            </li>
            <li>
              <span className="text-white/60 font-bold">Guessing:</span> Type the correct name and
              submit. Wrong guesses show a red indicator but don't penalize points.
            </li>
            <li>
              <span className="text-red-400 font-bold">Give Up:</span> Reveals the answer and moves
              on — no points for that round.
            </li>
            <li>
              <span className="text-white/60 font-bold">Era filter:</span> Limits the player pool to
              those who were active in the selected year or later.
            </li>
            <li>
              <span className="text-white/60 font-bold">Multiplayer:</span> All players race
              simultaneously — first correct guess scores the most points. First to the win target
              wins the match.
            </li>
          </ul>
        </aside>
      </div>
    </motion.div>
  );
}
