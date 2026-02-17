/**
 * CareerResultsPage.tsx — Results screen after a Career game ends.
 *
 * Shows the full career table (all rows, teams, bio revealed),
 * final score, game stats, and play again / home buttons.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCareerStore } from '../stores/careerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getNextGame } from '../services/careerPrefetch';
import type { Sport } from '../types';

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
  const store = useCareerStore();
  const { sport } = useSettingsStore();
  const [isLoadingNew, setIsLoadingNew] = useState(false);

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
      const game = await getNextGame(sport);
      if (!game) { setIsLoadingNew(false); return; }

      store.initGame(game.data, game.sport);
      navigate('/career');
    } catch {
      setIsLoadingNew(false);
    }
  }

  function handleHome() {
    store.resetGame();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 text-center">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="sports-font text-[10px] tracking-[0.4em] text-white/30 uppercase mb-2">
            Career Mode // {store.sport.toUpperCase()}
          </div>
          <h1 className="retro-title text-4xl md:text-5xl text-[var(--vintage-cream)] mb-2">
            {store.playerName}
          </h1>
          {store.position && (
            <span className="px-3 py-1 rounded text-xs sports-font tracking-wider text-white" style={{ backgroundColor: accentColor }}>
              {store.position}
            </span>
          )}
        </motion.div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-2xl mx-auto w-full">
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-center">
          <div className="sports-font text-[8px] text-[#666] tracking-widest">RESULT</div>
          <div className={`retro-title text-xl ${won ? 'text-green-400' : 'text-red-400'}`}>
            {won ? 'WIN' : 'LOSS'}
          </div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-center">
          <div className="sports-font text-[8px] text-[#666] tracking-widest">SCORE</div>
          <div className="retro-title text-xl text-[var(--vintage-cream)]">{store.score}</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-center">
          <div className="sports-font text-[8px] text-[#666] tracking-widest">SEASONS</div>
          <div className="retro-title text-xl text-[var(--vintage-cream)]">{store.seasons.length}</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-center">
          <div className="sports-font text-[8px] text-[#666] tracking-widest">HINTS / MISSES</div>
          <div className="retro-title text-xl text-[var(--vintage-cream)]">{hintsUsed} / {store.guesses.length}</div>
        </div>
      </div>

      {/* Bio */}
      <div className="mb-6 bg-[#1a1a1a] border border-[#333] rounded-lg p-4 max-w-2xl mx-auto w-full">
        <div className="sports-font text-[10px] text-[#888] tracking-widest mb-2 uppercase">Player Bio</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {store.bio.height && (
            <div>
              <div className="sports-font text-[8px] text-[#666] tracking-wider">HEIGHT</div>
              <div className="sports-font text-sm text-[var(--vintage-cream)]">{store.bio.height}</div>
            </div>
          )}
          {store.bio.weight > 0 && (
            <div>
              <div className="sports-font text-[8px] text-[#666] tracking-wider">WEIGHT</div>
              <div className="sports-font text-sm text-[var(--vintage-cream)]">{store.bio.weight} lbs</div>
            </div>
          )}
          {(store.bio.school || store.bio.college) && (
            <div>
              <div className="sports-font text-[8px] text-[#666] tracking-wider">SCHOOL</div>
              <div className="sports-font text-sm text-[var(--vintage-cream)]">{store.bio.school || store.bio.college}</div>
            </div>
          )}
          {store.bio.draftYear ? (
            <div>
              <div className="sports-font text-[8px] text-[#666] tracking-wider">DRAFT</div>
              <div className="sports-font text-sm text-[var(--vintage-cream)]">{store.bio.draftYear}</div>
            </div>
          ) : store.bio.draftClub ? (
            <div>
              <div className="sports-font text-[8px] text-[#666] tracking-wider">DRAFT</div>
              <div className="sports-font text-sm text-[var(--vintage-cream)]">
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
            <tr className="border-b-2 border-[#333]">
              {columns.map(col => (
                <th key={col.key} className="px-3 py-2 text-left sports-font text-[10px] text-[#888] tracking-wider uppercase whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {store.seasons.map((season, idx) => (
              <tr key={season.season + idx} className="border-b border-[#222] hover:bg-[#1a1a1a]">
                {columns.map(col => (
                  <td key={col.key} className="px-3 py-2 sports-font text-xs text-[var(--vintage-cream)] whitespace-nowrap">
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
          className="group relative bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] py-4 rounded-lg shadow-[0_4px_0_#a89860] active:translate-y-1 active:shadow-none disabled:opacity-50"
        >
          <span className="retro-title text-xl text-black uppercase tracking-widest">
            {isLoadingNew ? 'Loading...' : 'Play Again'}
          </span>
        </button>
        <button
          onClick={handleHome}
          className="group relative bg-[#1a1a1a] border border-white/20 py-3 rounded-lg hover:border-white/40 transition-colors"
        >
          <span className="retro-title text-lg text-white/70 uppercase tracking-widest">Back to Home</span>
        </button>
      </div>
    </div>
  );
}
