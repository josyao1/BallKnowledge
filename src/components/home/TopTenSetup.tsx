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
      className="z-10 w-full max-w-md overflow-y-auto max-h-[calc(100vh-120px)]"
    >
      <div className="capcrunch-panel overflow-hidden shadow-2xl" style={{ borderColor: 'rgba(112,190,91,0.3)' }}>
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
      </div>
    </motion.div>
  );
}
