/**
 * CareerResultsPage.tsx — Results screen after a Career game ends.
 *
 * Shows the full career table (all rows, teams, bio revealed),
 * final score, game stats, and play again / home buttons.
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCareerStore } from '../../stores/careerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getNextGame } from '../../services/careerPrefetch';
import type { Sport } from '../../types';

const NBA_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'min', label: 'MIN' },
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'fg_pct', label: 'FG%' },
  { key: 'fg3_pct', label: '3P%' },
];

const NFL_QB_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'completions', label: 'Comp' },
  { key: 'attempts', label: 'Att' },
  { key: 'passing_yards', label: 'Pass Yds' },
  { key: 'passing_tds', label: 'Pass TD' },
  { key: 'interceptions', label: 'INT' },
  { key: 'rushing_yards', label: 'Rush Yds' },
];

const NFL_RB_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'carries', label: 'Rush Att' },
  { key: 'rushing_yards', label: 'Rush Yds' },
  { key: 'rushing_tds', label: 'Rush TD' },
  { key: 'receptions', label: 'Rec' },
  { key: 'receiving_yards', label: 'Rec Yds' },
];

const NFL_WR_TE_COLUMNS = [
  { key: 'season', label: 'Season' },
  { key: 'team', label: 'Team' },
  { key: 'gp', label: 'GP' },
  { key: 'targets', label: 'Targets' },
  { key: 'receptions', label: 'Rec' },
  { key: 'receiving_yards', label: 'Rec Yds' },
  { key: 'receiving_tds', label: 'Rec TD' },
];

function getColumns(sport: Sport, position: string) {
  if (sport === 'nba') return NBA_COLUMNS;
  switch (position) {
    case 'QB': return NFL_QB_COLUMNS;
    case 'RB': return NFL_RB_COLUMNS;
    default: return NFL_WR_TE_COLUMNS;
  }
}

function formatStat(key: string, value: any): string {
  if (key === 'fg_pct' || key === 'fg3_pct') {
    return (value * 100).toFixed(1);
  }
  return String(value ?? 0);
}

export function CareerResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const store = useCareerStore();
  const { sport } = useSettingsStore();
  const [isLoadingNew, setIsLoadingNew] = useState(false);

  const careerFilters = useMemo(() => {
    const state = location.state as { careerTo?: number } | null;
    return state?.careerTo ? { careerTo: state.careerTo } : undefined;
  }, []);

  const accentColor = sport === 'nba' ? 'var(--nba-orange)' : '#013369';

  useEffect(() => {
    if (!store.playerName) navigate('/');
  }, [store.playerName, navigate]);

  if (!store.playerName) return null;

  const columns = getColumns(store.sport, store.position);
  const won = store.status === 'won';
  const hintsUsed = (store.yearsRevealed ? 1 : 0) + (store.bioRevealed ? 1 : 0);

  async function handlePlayAgain() {
    setIsLoadingNew(true);

    try {
      const game = await getNextGame(sport, careerFilters);
      if (!game) { setIsLoadingNew(false); return; }

      store.initGame(game.data, game.sport);
      navigate('/career', { state: location.state });
    } catch {
      setIsLoadingNew(false);
    }
  }

  function handleHome() {
    store.resetGame();
    navigate('/');
  }

  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 text-center">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="capcrunch-kicker text-[10px] tracking-[0.4em] text-white/30 uppercase mb-2">
            Career Mode // {store.sport.toUpperCase()}
          </div>
          <h1 className="capcrunch-title text-4xl md:text-5xl text-white mb-2">
            {store.playerName}
          </h1>
          {store.position && (
            <span className="px-3 py-1 rounded text-xs capcrunch-kicker tracking-wider text-white" style={{ backgroundColor: accentColor }}>
              {store.position}
            </span>
          )}
        </motion.div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-2xl mx-auto w-full">
        <div className="capcrunch-panel p-3 text-center">
          <div className="capcrunch-kicker text-[8px] text-[#666] tracking-widest">RESULT</div>
          <div className={`capcrunch-title text-xl ${won ? 'text-green-400' : 'text-red-400'}`}>
            {won ? 'WIN' : 'LOSS'}
          </div>
        </div>
        <div className="capcrunch-panel p-3 text-center">
          <div className="capcrunch-kicker text-[8px] text-[#666] tracking-widest">SCORE</div>
          <div className="capcrunch-title text-xl text-white/90">{store.score}</div>
        </div>
        <div className="capcrunch-panel p-3 text-center">
          <div className="capcrunch-kicker text-[8px] text-[#666] tracking-widest">SEASONS</div>
          <div className="capcrunch-title text-xl text-white/90">{store.seasons.length}</div>
        </div>
        <div className="capcrunch-panel p-3 text-center">
          <div className="capcrunch-kicker text-[8px] text-[#666] tracking-widest">HINTS / MISSES</div>
          <div className="capcrunch-title text-xl text-white/90">{hintsUsed} / {store.guesses.length}</div>
        </div>
      </div>

      {/* Bio */}
      <div className="mb-6 capcrunch-panel p-4 max-w-2xl mx-auto w-full">
        <div className="capcrunch-kicker text-[10px] text-[#888] tracking-widest mb-2 uppercase">Player Bio</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {store.bio.height && (
            <div>
              <div className="capcrunch-kicker text-[8px] text-[#666] tracking-wider">HEIGHT</div>
              <div className="capcrunch-kicker text-sm text-white/80">{store.bio.height}</div>
            </div>
          )}
          {store.bio.weight > 0 && (
            <div>
              <div className="capcrunch-kicker text-[8px] text-[#666] tracking-wider">WEIGHT</div>
              <div className="capcrunch-kicker text-sm text-white/80">{store.bio.weight} lbs</div>
            </div>
          )}
          {(store.bio.school || store.bio.college) && (
            <div>
              <div className="capcrunch-kicker text-[8px] text-[#666] tracking-wider">SCHOOL</div>
              <div className="capcrunch-kicker text-sm text-white/80">{store.bio.school || store.bio.college}</div>
            </div>
          )}
          {store.bio.draftYear ? (
            <div>
              <div className="capcrunch-kicker text-[8px] text-[#666] tracking-wider">DRAFT</div>
              <div className="capcrunch-kicker text-sm text-white/80">{store.bio.draftYear}</div>
            </div>
          ) : store.bio.draftClub ? (
            <div>
              <div className="capcrunch-kicker text-[8px] text-[#666] tracking-wider">DRAFT</div>
              <div className="capcrunch-kicker text-sm text-white/80">
                {store.bio.draftClub} #{store.bio.draftNumber}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Full Career Table */}
      <div className="flex-1 overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map(col => (
                <th key={col.key} className="px-3 py-2 text-left capcrunch-kicker text-[10px] text-[#888] tracking-wider uppercase whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {store.seasons.map((season, idx) => (
              <tr key={season.season + idx} className="border-b border-white/5 hover:bg-white/5">
                {columns.map(col => (
                  <td key={col.key} className="px-3 py-2 capcrunch-kicker text-xs text-white/80 whitespace-nowrap">
                    {formatStat(col.key, season[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 max-w-md mx-auto w-full">
        <button
          onClick={handlePlayAgain}
          disabled={isLoadingNew}
          className="group relative bg-[#f5f5dc] hover:bg-[#e8e8c4] py-4 disabled:opacity-50 transition-colors"
        >
          <span className="capcrunch-title text-xl text-black uppercase tracking-widest">
            {isLoadingNew ? 'Loading...' : 'Play Again'}
          </span>
        </button>
        <button
          onClick={handleHome}
          className="group relative bg-black/40 border border-white/10 py-3 hover:border-white/20 transition-colors"
        >
          <span className="capcrunch-title text-lg text-white/70 uppercase tracking-widest">Back to Home</span>
        </button>
      </div>
    </div>
  );
}
