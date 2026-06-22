/**
 * RosterRoyaleSetup.tsx — Setup panel for the Roster Royale game mode.
 *
 * NFL-only: offers a sub-mode toggle between Roster Royale and Box Score.
 * Roster Royale supports Random (year range) or Manual (pick team + year).
 * Box Score supports year range filter and optional team filter.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { TeamSelector } from './TeamSelector';
import { YearSelector } from './YearSelector';
import { nflTeams } from '../../data/nfl-teams';
import { teams as nbaTeams } from '../../data/teams';
import type { GenericTeam, LoadingStatus } from '../../data/homeGames';
import type { GameMode } from '../../types';

const NFL_BOX_SCORE_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const NBA_BOX_SCORE_YEARS = [
  2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
];

const selectCls =
  'bg-black/40 text-white/70 px-3 py-2 border border-white/15 capcrunch-kicker text-xs focus:outline-none focus:border-white/30 hover:border-white/25 appearance-none cursor-pointer transition-colors';

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
  setTimerDuration: (d: number) => void;
  loadingStatus: LoadingStatus;
  statusMessage: string;
  setLoadingStatus: (s: LoadingStatus) => void;
  // Callbacks
  onBack: () => void;
  onStartGame: () => void;
  soloOnly?: boolean;
}

export function RosterRoyaleSetup({
  sport,
  deckArt: _deckArt,
  rosterSubMode,
  setRosterSubMode,
  boxScoreMinYear,
  boxScoreMaxYear,
  boxScoreTeam,
  setBoxScoreMinYear,
  setBoxScoreMaxYear,
  setBoxScoreTeam,
  gameMode,
  setGameMode,
  selectedTeam,
  setSelectedTeam,
  selectedYear,
  setSelectedYear,
  randomMinYear,
  randomMaxYear,
  setRandomMinYear,
  setRandomMaxYear,
  timerDuration,
  setTimerDuration,
  loadingStatus,
  statusMessage,
  setLoadingStatus,
  onBack,
  onStartGame,
  soloOnly = false,
}: Props) {
  const navigate = useNavigate();
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [timerMins, setTimerMins] = useState(Math.floor(timerDuration / 60));
  const [timerSecs, setTimerSecs] = useState(timerDuration % 60);

  return (
    <motion.div
      key="roster-setup"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      className="z-10 w-full max-w-md overflow-y-auto max-h-[calc(100vh-120px)]"
    >
      <div className="capcrunch-panel overflow-hidden shadow-2xl">
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
              <div className="capcrunch-kicker text-[9px] text-white/30 mb-0.5">RR</div>
              <h2 className="capcrunch-title text-2xl text-white leading-tight">Roster Royale</h2>
              <p className="capcrunch-kicker text-[9px] text-white/40">
                {sport === 'nba' ? 'NBA' : 'NFL'} Edition
              </p>
            </div>
            <div className="w-12" />
          </div>
          <div className="border-t border-white/10" />

          {loadingStatus === 'idle' ? (
            <>
              {/* Sub-mode toggle: Roster Royale vs Box Score */}
              <div className="flex gap-2 justify-center">
                {(['roster', 'box-score'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setRosterSubMode(m)}
                    className={`px-4 py-1.5 capcrunch-kicker text-xs transition-all ${
                      rosterSubMode === m
                        ? 'bg-[#FDF100] text-black font-bold'
                        : 'bg-black/40 text-white/50 border border-white/15 hover:border-white/30'
                    }`}
                  >
                    {m === 'roster' ? 'Roster Royale' : 'Box Score'}
                  </button>
                ))}
              </div>

              {rosterSubMode === 'box-score' ? (
                // ── Box Score sub-mode ──
                (() => {
                  const bsYears = sport === 'nba' ? NBA_BOX_SCORE_YEARS : NFL_BOX_SCORE_YEARS;
                  const teamList = sport === 'nba' ? nbaTeams : nflTeams;
                  const soloPath = sport === 'nba' ? '/nba-box-score' : '/box-score';
                  return (
                    <>
                      <div className="flex flex-col gap-2">
                        <div className="capcrunch-kicker text-[9px] text-white/40 text-center">
                          Year Range
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={boxScoreMinYear}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              setBoxScoreMinYear(v);
                              if (v > boxScoreMaxYear) setBoxScoreMaxYear(v);
                            }}
                            className={`flex-1 ${selectCls}`}
                          >
                            {bsYears.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                          <span className="text-white/30 capcrunch-kicker text-xs">to</span>
                          <select
                            value={boxScoreMaxYear}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              setBoxScoreMaxYear(v);
                              if (v < boxScoreMinYear) setBoxScoreMinYear(v);
                            }}
                            className={`flex-1 ${selectCls}`}
                          >
                            {bsYears.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="capcrunch-kicker text-[9px] text-white/40 text-center">
                          Team Filter
                        </div>
                        <select
                          value={boxScoreTeam ?? ''}
                          onChange={(e) => setBoxScoreTeam(e.target.value || null)}
                          className={`w-full ${selectCls}`}
                        >
                          <option value="">Any Team</option>
                          {teamList.map((t) => (
                            <option key={t.abbreviation} value={t.abbreviation}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="border-t border-white/10" />
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() =>
                            navigate(soloPath, {
                              state: {
                                minYear: boxScoreMinYear,
                                maxYear: boxScoreMaxYear,
                                team: boxScoreTeam,
                              },
                            })
                          }
                          className="capcrunch-btn-primary capcrunch-title px-8 py-2.5 text-base"
                        >
                          Start Solo
                        </button>
                        {!soloOnly && (
                          <button
                            onClick={() =>
                              navigate('/lobby/create', {
                                state: {
                                  gameType: sport === 'nba' ? 'nba-box-score' : 'box-score',
                                },
                              })
                            }
                            className="capcrunch-btn-secondary capcrunch-kicker px-4 py-2.5 text-xs"
                          >
                            Lobby
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()
              ) : (
                // ── Roster Royale sub-mode ──
                <>
                  {/* Random vs Manual toggle */}
                  <div className="flex gap-2 justify-center">
                    {(['random', 'manual'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setGameMode(m)}
                        className={`px-5 py-1.5 capcrunch-kicker text-xs transition-all ${
                          gameMode === m
                            ? 'bg-[#FDF100] text-black font-bold'
                            : 'bg-black/40 text-white/50 border border-white/15 hover:border-white/30'
                        }`}
                      >
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>

                  {gameMode === 'manual' ? (
                    <div className="flex flex-col gap-3">
                      <TeamSelector
                        selectedTeam={selectedTeam}
                        onSelect={setSelectedTeam}
                        sport={sport}
                      />
                      <YearSelector
                        selectedYear={selectedYear}
                        onSelect={setSelectedYear}
                        minYear={2000}
                        maxYear={2025}
                        sport={sport}
                      />
                    </div>
                  ) : (
                    <div className="capcrunch-panel p-3 text-center">
                      <div className="capcrunch-kicker text-[9px] text-white/40 mb-2">
                        Year Range
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <select
                          value={randomMinYear}
                          onChange={(e) => setRandomMinYear(+e.target.value)}
                          className={selectCls}
                        >
                          {Array.from({ length: 26 }, (_, i) => 2000 + i).map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                        <span className="text-white/30 capcrunch-kicker text-xs">to</span>
                        <select
                          value={randomMaxYear}
                          onChange={(e) => setRandomMaxYear(+e.target.value)}
                          className={selectCls}
                        >
                          {Array.from({ length: 26 }, (_, i) => 2000 + i).map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Timer */}
                  <div className="capcrunch-panel border-white/10 px-4 py-2.5">
                    <button
                      onClick={() => setShowTimerPicker((p) => !p)}
                      className="flex items-center justify-center gap-2 w-full"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-white/40"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="capcrunch-title text-sm text-white">
                        {Math.floor(timerDuration / 60)}:
                        {String(timerDuration % 60).padStart(2, '0')}
                      </span>
                      <span className="capcrunch-kicker text-[9px] text-white/40">Timer</span>
                      <svg
                        className="w-3 h-3 text-white/30"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    {showTimerPicker && (
                      <div className="flex items-center justify-center gap-2 mt-2.5">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="capcrunch-kicker text-[8px] text-white/30">MIN</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={timerMins}
                            onChange={(e) => {
                              const m = Math.max(0, Math.min(99, parseInt(e.target.value) || 0));
                              setTimerMins(m);
                              const total = m * 60 + timerSecs;
                              if (total > 0) setTimerDuration(total);
                            }}
                            className="w-14 text-center bg-black/40 border border-white/15 text-white capcrunch-title text-lg py-1 focus:outline-none focus:border-[#FDF100]/50"
                          />
                        </div>
                        <span className="capcrunch-title text-lg text-white/40 mt-4">:</span>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="capcrunch-kicker text-[8px] text-white/30">SEC</span>
                          <input
                            type="number"
                            min={0}
                            max={59}
                            value={timerSecs}
                            onChange={(e) => {
                              const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                              setTimerSecs(s);
                              const total = timerMins * 60 + s;
                              if (total > 0) setTimerDuration(total);
                            }}
                            className="w-14 text-center bg-black/40 border border-white/15 text-white capcrunch-title text-lg py-1 focus:outline-none focus:border-[#FDF100]/50"
                          />
                        </div>
                        <button
                          onClick={() => setShowTimerPicker(false)}
                          className="mt-4 capcrunch-kicker text-[9px] text-white/40 hover:text-white/70 transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/10" />
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={onStartGame}
                      disabled={gameMode === 'manual' && (!selectedTeam || !selectedYear)}
                      className="capcrunch-btn-primary capcrunch-title px-8 py-2.5 text-base disabled:opacity-50"
                    >
                      Start Solo
                    </button>
                    {!soloOnly && (
                      <>
                        <button
                          onClick={() =>
                            navigate('/lobby/create', { state: { gameType: 'roster' } })
                          }
                          className={`capcrunch-btn-secondary capcrunch-kicker px-4 py-2.5 text-xs ${
                            sport === 'nba'
                              ? 'border-[var(--nba-orange)] text-[var(--nba-orange)] hover:bg-[var(--nba-orange)] hover:text-white'
                              : 'border-[#4a7fb5] text-[#4a7fb5] hover:bg-[#013369] hover:text-white'
                          }`}
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
                </>
              )}
            </>
          ) : (
            // Loading / error state
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-8 h-8 border-4 border-[#FDF100] border-t-transparent rounded-full animate-spin" />
              <span className="capcrunch-kicker text-sm text-white/70">{statusMessage}</span>
              {loadingStatus === 'error' && (
                <button
                  onClick={() => setLoadingStatus('idle')}
                  className="capcrunch-kicker text-xs text-red-400 underline"
                >
                  Back
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
