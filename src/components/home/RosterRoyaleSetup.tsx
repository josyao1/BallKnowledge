/**
 * RosterRoyaleSetup.tsx — Setup panel for the Roster Royale game mode.
 *
 * NFL-only: offers a sub-mode toggle between Roster Royale and Box Score.
 * Roster Royale supports Random (year range) or Manual (pick team + year).
 * Box Score supports year range filter and optional team filter.
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { TeamSelector } from './TeamSelector';
import { YearSelector } from './YearSelector';
import { nflTeams } from '../../data/nfl-teams';
import type { GenericTeam, LoadingStatus } from '../../data/homeGames';
import type { GameMode } from '../../types';

interface Props {
  sport: 'nba' | 'nfl';
  deckArt: string;
  // NFL sub-mode toggle
  rosterSubMode: 'roster' | 'box-score';
  setRosterSubMode: (m: 'roster' | 'box-score') => void;
  // Box Score filters
  boxScoreMinYear: number;
  boxScoreMaxYear: number;
  boxScoreTeam: string | null;
  setBoxScoreMinYear: (y: number) => void;
  setBoxScoreMaxYear: (y: number) => void;
  setBoxScoreTeam: (t: string | null) => void;
  // Roster Royale state
  gameMode: GameMode;
  setGameMode: (m: GameMode) => void;
  selectedTeam: GenericTeam | null;
  setSelectedTeam: (t: GenericTeam | null) => void;
  selectedYear: number | null;
  setSelectedYear: (y: number | null) => void;
  randomMinYear: number;
  randomMaxYear: number;
  setRandomMinYear: (y: number) => void;
  setRandomMaxYear: (y: number) => void;
  timerDuration: number;
  loadingStatus: LoadingStatus;
  statusMessage: string;
  setLoadingStatus: (s: LoadingStatus) => void;
  // Callbacks
  onBack: () => void;
  onStartGame: () => void;
  onOpenSettings: () => void;
}

const BOX_SCORE_YEAR_PRESETS = [
  { label: 'Any',   min: 2015, max: 2024 },
  { label: '2018+', min: 2018, max: 2024 },
  { label: '2021+', min: 2021, max: 2024 },
] as const;

export function RosterRoyaleSetup({
  sport, deckArt,
  rosterSubMode, setRosterSubMode,
  boxScoreMinYear, boxScoreMaxYear, boxScoreTeam,
  setBoxScoreMinYear, setBoxScoreMaxYear, setBoxScoreTeam,
  gameMode, setGameMode,
  selectedTeam, setSelectedTeam,
  selectedYear, setSelectedYear,
  randomMinYear, randomMaxYear, setRandomMinYear, setRandomMaxYear,
  timerDuration, loadingStatus, statusMessage, setLoadingStatus,
  onBack, onStartGame, onOpenSettings,
}: Props) {
  const navigate = useNavigate();

  return (
    <motion.div
      key="roster-setup"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      className="z-10 w-full max-w-md overflow-y-auto max-h-[calc(100vh-120px)]"
    >
      <div className="relative bg-[#141414] border-2 border-[#d4af37] rounded-2xl overflow-hidden shadow-2xl">
        {/* Diagonal stripe texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #d4af37 0, #d4af37 1px, transparent 0, transparent 50%)', backgroundSize: '14px 14px' }}
        />
        {/* Faint deck art watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
          <img src={deckArt} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
        </div>

        <div className="relative z-10 p-5 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="sports-font text-[10px] text-[#d4af37]/50 hover:text-[#d4af37]/90 tracking-widest uppercase transition"
            >
              ← Back
            </button>
            <div className="flex-1 text-center">
              <div className="sports-font text-[9px] text-[#d4af37]/50 tracking-[0.3em] uppercase">RR</div>
              <h2 className="retro-title text-2xl text-[#d4af37] leading-tight">Roster Royale</h2>
              <p className="sports-font text-[9px] text-[#888] tracking-widest">{sport === 'nba' ? 'NBA' : 'NFL'} Edition</p>
            </div>
            <div className="w-12" />
          </div>
          <div className="border-t border-[#d4af37]/20" />

          {loadingStatus === 'idle' ? (
            <>
              {/* NFL-only: sub-mode toggle between Roster Royale and Box Score */}
              {sport === 'nfl' && (
                <div className="flex gap-2 justify-center">
                  {(['roster', 'box-score'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setRosterSubMode(m)}
                      className={`px-4 py-1.5 rounded-lg sports-font text-xs transition-all ${
                        rosterSubMode === m
                          ? 'bg-[#d4af37] text-[#111]'
                          : 'bg-[#1a1a1a] text-[#888] border border-[#3d3d3d]'
                      }`}
                    >
                      {m === 'roster' ? 'Roster Royale' : 'Box Score'}
                    </button>
                  ))}
                </div>
              )}

              {rosterSubMode === 'box-score' && sport === 'nfl' ? (
                // ── Box Score sub-mode ──
                <>
                  <div className="flex flex-col gap-2">
                    <div className="sports-font text-[9px] text-[#888] tracking-[0.25em] uppercase text-center">Year Range</div>
                    <div className="grid grid-cols-3 gap-2">
                      {BOX_SCORE_YEAR_PRESETS.map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => { setBoxScoreMinYear(opt.min); setBoxScoreMaxYear(opt.max); }}
                          className={`py-1.5 rounded-lg sports-font text-[10px] tracking-wider uppercase border transition-all ${
                            boxScoreMinYear === opt.min && boxScoreMaxYear === opt.max
                              ? 'bg-[#f59e0b] text-[#111] border-[#f59e0b]'
                              : 'border-[#2a2a2a] text-[#666] hover:border-[#f59e0b]/40 hover:text-[#888]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="sports-font text-[9px] text-[#888] tracking-[0.25em] uppercase text-center">Team Filter</div>
                    <select
                      value={boxScoreTeam ?? ''}
                      onChange={e => setBoxScoreTeam(e.target.value || null)}
                      className="bg-[#111] text-[var(--vintage-cream)] px-3 py-2 rounded-lg border border-[#3d3d3d] sports-font text-xs focus:outline-none focus:border-[#f59e0b]/50"
                    >
                      <option value="">Any Team</option>
                      {nflTeams.map(t => (
                        <option key={t.abbreviation} value={t.abbreviation}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="border-t border-[#d4af37]/20" />
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => navigate('/box-score', { state: { minYear: boxScoreMinYear, maxYear: boxScoreMaxYear, team: boxScoreTeam } })}
                      className="retro-btn retro-btn-gold px-8 py-2.5 text-base"
                    >
                      Start Solo
                    </button>
                    <button
                      onClick={() => navigate('/lobby/create', { state: { gameType: 'box-score' } })}
                      className="px-4 py-2.5 rounded-lg sports-font border border-[#333] text-[#777] hover:border-[#555] text-xs"
                    >
                      Lobby
                    </button>
                  </div>
                </>
              ) : (
                // ── Roster Royale sub-mode ──
                <>
                  {/* Random vs Manual toggle */}
                  <div className="flex gap-2 justify-center">
                    {(['random', 'manual'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setGameMode(m)}
                        className={`px-5 py-1.5 rounded-lg sports-font text-xs transition-all ${
                          gameMode === m
                            ? 'bg-[#d4af37] text-[#111]'
                            : 'bg-[#1a1a1a] text-[#888] border border-[#3d3d3d]'
                        }`}
                      >
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>

                  {gameMode === 'manual' ? (
                    <div className="flex flex-col gap-3">
                      <TeamSelector selectedTeam={selectedTeam} onSelect={setSelectedTeam} sport={sport} />
                      <YearSelector selectedYear={selectedYear} onSelect={setSelectedYear} minYear={2000} maxYear={2025} sport={sport} />
                    </div>
                  ) : (
                    <div className="bg-[#1a1a1a]/60 rounded-lg p-3 text-center border border-[#2a2a2a]">
                      <div className="sports-font text-[9px] text-[#888] mb-2 tracking-widest">Year Range</div>
                      <div className="flex items-center justify-center gap-2">
                        <select
                          value={randomMinYear}
                          onChange={e => setRandomMinYear(+e.target.value)}
                          className="bg-[#111] text-[var(--vintage-cream)] px-2 py-1 rounded border border-[#3d3d3d] sports-font text-xs"
                        >
                          {Array.from({ length: 26 }, (_, i) => 2000 + i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <span className="text-[#666] sports-font text-xs">to</span>
                        <select
                          value={randomMaxYear}
                          onChange={e => setRandomMaxYear(+e.target.value)}
                          className="bg-[#111] text-[var(--vintage-cream)] px-2 py-1 rounded border border-[#3d3d3d] sports-font text-xs"
                        >
                          {Array.from({ length: 26 }, (_, i) => 2000 + i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Timer display — click to open settings */}
                  <button
                    onClick={onOpenSettings}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1a1a1a]/60 border border-[#2a2a2a] rounded-lg hover:border-[#444] transition-colors group w-full"
                  >
                    <svg className="w-3.5 h-3.5 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="sports-font text-sm text-[var(--vintage-cream)]">
                      {Math.floor(timerDuration / 60)}:{String(timerDuration % 60).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] text-[#555] sports-font tracking-wider">TIMER</span>
                    <svg className="w-3 h-3 text-[#555]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>

                  <div className="border-t border-[#d4af37]/20" />
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={onStartGame}
                      disabled={gameMode === 'manual' && (!selectedTeam || !selectedYear)}
                      className="retro-btn retro-btn-gold px-8 py-2.5 text-base disabled:opacity-50"
                    >
                      Start Solo
                    </button>
                    <button
                      onClick={() => navigate('/lobby/create', { state: { gameType: 'roster' } })}
                      className={`px-4 py-2.5 rounded-lg sports-font border text-xs transition-all ${
                        sport === 'nba'
                          ? 'border-[var(--nba-orange)] text-[var(--nba-orange)] hover:bg-[var(--nba-orange)] hover:text-white'
                          : 'border-[#4a7fb5] text-[#4a7fb5] hover:bg-[#013369] hover:text-white'
                      }`}
                    >
                      Create Lobby
                    </button>
                    <button
                      onClick={() => navigate('/lobby/join')}
                      className="px-4 py-2.5 rounded-lg sports-font border border-[#333] text-[#777] hover:border-[#555] text-xs"
                    >
                      Join Lobby
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            // Loading / error state
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-8 h-8 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
              <span className="sports-font text-sm text-[var(--vintage-cream)]">{statusMessage}</span>
              {loadingStatus === 'error' && (
                <button onClick={() => setLoadingStatus('idle')} className="text-xs underline text-red-500">Back</button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
