import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { TopTenSettings } from '../lobby/settings/TopTenSettings';

const NBA_MIN = 1996, NBA_MAX = 2025;
const NFL_MIN = 1999, NFL_MAX = 2025;

interface Props {
  initialSport: 'nba' | 'nfl';
  onBack: () => void;
  soloOnly?: boolean;
}

export function TopTenSetup({ initialSport, onBack, soloOnly = false }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'settings' | 'rules'>('settings');

  const [sport, setSport]               = useState<'nba' | 'nfl'>(initialSport);
  const [roundType, setRoundType]       = useState<'league' | 'division' | 'team'>('league');
  const [divisionMode, setDivisionMode] = useState<'cumulative' | 'single_season'>('cumulative');
  const [minYear, setMinYear]           = useState(initialSport === 'nba' ? NBA_MIN : NFL_MIN);
  const [maxYear, setMaxYear]           = useState(initialSport === 'nba' ? NBA_MAX : NFL_MAX);
  const [windowYears, setWindowYears]   = useState(10);
  const [pinnedDivision, setPinnedDivision] = useState<string | null>(null);
  const [pinnedTeam, setPinnedTeam]         = useState<string | null>(null);

  useEffect(() => {
    setMinYear(sport === 'nba' ? NBA_MIN : NFL_MIN);
    setMaxYear(sport === 'nba' ? NBA_MAX : NFL_MAX);
  }, [sport]);

  function handleStartSolo() {
    navigate('/top-ten', {
      state: { sport, roundType, divisionMode, minYear, maxYear, windowYears, pinnedDivision, pinnedTeam },
    });
  }

  return (
    <motion.div
      key="top-ten-setup"
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
            style={tab === 'settings' ? { background: '#70BE5B' } : {}}
          >
            Settings
          </button>
          <button
            onClick={() => setTab('rules')}
            className={`px-4 py-2 capcrunch-kicker transition ${tab === 'rules' ? 'bg-[#68BBE5] text-black' : 'text-white/60'}`}
          >
            How to Play
          </button>
        </div>
        <button onClick={onBack} className="px-4 py-2 capcrunch-btn-secondary capcrunch-title text-sm">Back</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        {/* Settings panel */}
        <section className={`${tab !== 'settings' ? 'hidden lg:block' : ''} capcrunch-panel overflow-hidden shadow-2xl`} style={{ borderColor: 'rgba(112,190,91,0.3)' }}>
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
                <div className="capcrunch-kicker text-[9px] text-[#70BE5B]/60 mb-0.5">TT</div>
                <h2 className="capcrunch-title text-2xl text-[#70BE5B] leading-tight">Top Ten</h2>
                <p className="capcrunch-kicker text-[9px] text-white/40">{sport === 'nba' ? 'NBA' : 'NFL'} Edition</p>
              </div>
              <div className="w-12" />
            </div>

            <div className="border-t border-white/10" />

            {/* Settings */}
            <TopTenSettings
              sport={sport}
              onSportChange={s => setSport(s)}
              roundType={roundType}
              onRoundTypeChange={setRoundType}
              divisionMode={divisionMode}
              onDivisionModeChange={setDivisionMode}
              minYear={minYear}
              onMinYearChange={setMinYear}
              maxYear={maxYear}
              onMaxYearChange={setMaxYear}
              windowYears={windowYears}
              onWindowYearsChange={setWindowYears}
              pinnedDivision={pinnedDivision}
              onPinnedDivisionChange={setPinnedDivision}
              pinnedTeam={pinnedTeam}
              onPinnedTeamChange={setPinnedTeam}
            />

            <div className="border-t border-white/10" />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={handleStartSolo}
                className="capcrunch-title px-8 py-2.5 text-base text-black transition-all active:translate-y-px"
                style={{ background: '#70BE5B', boxShadow: '0 3px 0 rgba(60,130,45,0.9)' }}
              >
                Start Solo
              </button>
              {!soloOnly && (
                <>
                  <button
                    onClick={() => navigate('/lobby/create', { state: { gameType: 'top-ten' } })}
                    className="capcrunch-btn-secondary capcrunch-kicker px-4 py-2.5 text-xs"
                  >
                    Create Lobby
                  </button>
                  <button
                    onClick={() => navigate('/lobby/join')}
                    className="capcrunch-btn-secondary capcrunch-kicker px-4 py-2.5 text-xs"
                  >
                    Join Lobby
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* How to Play aside */}
        <aside className={`${tab !== 'rules' ? 'hidden lg:block' : ''} capcrunch-panel p-5 md:p-6`}>
          <h3 className="capcrunch-title text-lg text-[#70BE5B] mb-4">How to Play</h3>
          <ul className="text-sm text-white/80 space-y-3 text-left">
            <li><span className="text-[#70BE5B] font-bold">Goal:</span> Name all 10 players who ranked in the top 10 for a given stat category and season.</li>
            <li>
              <span className="text-[#70BE5B] font-bold">League round:</span> Top 10 across the whole league for one randomly selected season within your year range.
            </li>
            <li>
              <span className="text-[#70BE5B] font-bold">Division round:</span> Top 10 from players on teams within one division, accumulated over your chosen window (5, 10, 15, or 20 years).
            </li>
            <li>
              <span className="text-[#70BE5B] font-bold">Team round:</span> Top 10 from a single franchise's history over the window.
            </li>
            <li>
              <span className="text-white/60 font-bold">Cumulative:</span> Stats are summed across every season in the window — rewards longevity.
            </li>
            <li>
              <span className="text-white/60 font-bold">Single Season:</span> Best individual season within the window counts — rewards peak performance.
            </li>
            <li>
              <span className="text-red-400 font-bold">Strikes:</span> Each wrong guess costs a strike. 3 strikes and the round ends. Remaining players are revealed.
            </li>
            <li>
              <span className="text-white/60 font-bold">Multiplayer:</span> Turn-based. Players alternate guessing — run out of strikes and you're eliminated. Last one standing wins.
            </li>
          </ul>
        </aside>
      </div>
    </motion.div>
  );
}
