/**
 * BoxScoreResultsPage.tsx — Box Score solo results.
 *
 * Receives game + guesses via location.state. Renders the full box score
 * with green/red name highlighting and a final score tally.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import { nflTeams } from '../../data/nfl-teams';
import type { BoxScoreGame, BoxScorePassingPlayer, BoxScoreRushingPlayer, BoxScoreReceivingPlayer } from '../../services/boxScoreData';
import type { BoxFilters } from './BoxScoreGamePage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GAME_TYPE_LABELS: Record<string, string> = {
  REG: 'Regular Season',
  WC: 'Wild Card',
  DIV: 'Divisional',
  CON: 'Conf. Championship',
  SB: 'Super Bowl',
};

function getTeamColor(abbr: string): string {
  const team = nflTeams.find(t => t.abbreviation === abbr);
  return team?.colors.primary ?? '#4a4a4a';
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── Row components (display-only) ────────────────────────────────────────────

function ResultName({ name, guessed, correct }: { name: string; guessed: string; correct: boolean }) {
  return (
    <div className={`flex-1 min-w-0 px-2 py-1 rounded border text-xs sports-font truncate ${
      correct
        ? 'bg-green-900/25 border-green-700/50 text-green-400'
        : 'bg-red-900/15 border-red-900/30 text-red-400/80'
    }`}>
      {name}
      {!correct && guessed && (
        <span className="ml-2 text-[#444] line-through text-[10px]">{guessed}</span>
      )}
    </div>
  );
}

function PassingResultRow({ player, guessed }: { player: BoxScorePassingPlayer; guessed: string }) {
  const correct = !!guessed && areSimilarNames(guessed, player.name);
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="sports-font text-[10px] text-[#3a3a3a] w-7 text-right shrink-0 tabular-nums">
        {player.number ? `#${player.number}` : '—'}
      </span>
      <ResultName name={player.name} guessed={guessed} correct={correct} />
      <div className="sports-font text-[10px] text-[#3a3a3a] shrink-0 tabular-nums text-right hidden sm:block" style={{ minWidth: 130 }}>
        {player.completions}/{player.attempts} · {player.yards}yd · {player.tds}TD{player.ints > 0 ? ` · ${player.ints}INT` : ''}
      </div>
      <div className="sports-font text-[10px] text-[#3a3a3a] shrink-0 tabular-nums text-right sm:hidden" style={{ minWidth: 70 }}>
        {player.yards}yd {player.tds}TD
      </div>
    </div>
  );
}

function RushingResultRow({ player, guessed }: { player: BoxScoreRushingPlayer; guessed: string }) {
  const correct = !!guessed && areSimilarNames(guessed, player.name);
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="sports-font text-[10px] text-[#3a3a3a] w-7 text-right shrink-0 tabular-nums">
        {player.number ? `#${player.number}` : '—'}
      </span>
      <ResultName name={player.name} guessed={guessed} correct={correct} />
      <div className="sports-font text-[10px] text-[#3a3a3a] shrink-0 tabular-nums text-right hidden sm:block" style={{ minWidth: 130 }}>
        {player.carries}car · {player.yards}yd · {player.tds}TD
      </div>
      <div className="sports-font text-[10px] text-[#3a3a3a] shrink-0 tabular-nums text-right sm:hidden" style={{ minWidth: 70 }}>
        {player.yards}yd {player.tds}TD
      </div>
    </div>
  );
}

function ReceivingResultRow({ player, guessed }: { player: BoxScoreReceivingPlayer; guessed: string }) {
  const correct = !!guessed && areSimilarNames(guessed, player.name);
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="sports-font text-[10px] text-[#3a3a3a] w-7 text-right shrink-0 tabular-nums">
        {player.number ? `#${player.number}` : '—'}
      </span>
      <ResultName name={player.name} guessed={guessed} correct={correct} />
      <div className="sports-font text-[10px] text-[#3a3a3a] shrink-0 tabular-nums text-right hidden sm:block" style={{ minWidth: 130 }}>
        {player.receptions}/{player.targets} · {player.yards}yd · {player.tds}TD
      </div>
      <div className="sports-font text-[10px] text-[#3a3a3a] shrink-0 tabular-nums text-right sm:hidden" style={{ minWidth: 70 }}>
        {player.yards}yd {player.tds}TD
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface ResultsState {
  game: BoxScoreGame;
  guesses: Record<string, string>;
  spreadGuess: string;
  filters: BoxFilters;
  revealed: boolean;
}

export function BoxScoreResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ResultsState | null;

  useEffect(() => {
    if (!state?.game) navigate('/');
  }, []);

  if (!state?.game) return null;

  const { game, guesses, spreadGuess, filters } = state;

  const homeColor = getTeamColor(game.home_team);
  const awayColor = getTeamColor(game.away_team);
  const gameLabel = GAME_TYPE_LABELS[game.game_type] ?? game.game_type;

  function bk(side: 'home' | 'away', cat: string, idx: number) {
    return `${side}_${cat}_${idx}`;
  }

  // Tally score
  let totalRows = 0;
  let correctRows = 0;
  for (const side of ['home', 'away'] as const) {
    for (const cat of ['passing', 'rushing', 'receiving'] as const) {
      const rows = game.box_score[side][cat] as any[];
      totalRows += rows.length;
      rows.forEach((p, i) => {
        const guess = guesses[bk(side, cat, i)] ?? '';
        if (guess && areSimilarNames(guess, p.name)) correctRows++;
      });
    }
  }

  const spreadCorrect =
    game.spread_line != null &&
    spreadGuess !== '' &&
    Math.abs(parseFloat(spreadGuess) - game.spread_line) <= 0.5;

  const pct = totalRows > 0 ? Math.round((correctRows / totalRows) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#111] text-white">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0e0e0e]/95 backdrop-blur border-b border-[#1e1e1e] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-1.5 text-[#444] hover:text-white transition-colors shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <span className="retro-title text-lg text-[#f59e0b]">Results</span>
        </div>
        <div className="w-8 shrink-0" />
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4 space-y-3">

        {/* ── Score card ── */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 flex flex-col items-center gap-2">
          <div className="sports-font text-[10px] text-[#444] tracking-[0.35em] uppercase">Final Score</div>
          <div className="retro-title text-6xl text-[#f59e0b] tabular-nums leading-none">
            {correctRows}<span className="text-3xl text-[#444]">/{totalRows}</span>
          </div>
          <div className="sports-font text-sm text-[#555]">
            {pct}% · {correctRows === totalRows ? 'Perfect game!' : correctRows >= Math.floor(totalRows * 0.7) ? 'Great job!' : correctRows >= Math.floor(totalRows * 0.4) ? 'Not bad!' : 'Keep practicing!'}
          </div>
          {game.spread_line != null && (
            <div className={`mt-1 px-3 py-1 rounded border sports-font text-xs ${
              spreadCorrect
                ? 'bg-green-900/20 border-green-700/40 text-green-400'
                : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#555]'
            }`}>
              Spread: {game.spread_line > 0 ? '+' : ''}{game.spread_line}
              {spreadCorrect ? ' ✓ correct' : spreadGuess ? ` · you said ${spreadGuess}` : ' · not guessed'}
            </div>
          )}
        </div>

        {/* ── Game header ── */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex flex-col items-center gap-1">
              <div className="retro-title text-2xl sm:text-3xl leading-none" style={{ color: awayColor }}>{game.away_team}</div>
              <div className="retro-title text-4xl sm:text-5xl text-white leading-none tabular-nums">{game.away_score}</div>
              <div className="sports-font text-[9px] text-[#444] tracking-widest mt-0.5">AWAY</div>
            </div>
            <div className="flex flex-col items-center gap-1.5 px-3">
              {game.overtime && (
                <span className="px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 rounded sports-font text-[9px] text-amber-500 tracking-wider">OT</span>
              )}
              <div className="sports-font text-[10px] text-[#333] tracking-[0.3em]">FINAL</div>
              <div className="sports-font text-[10px] text-[#444] text-center leading-snug">
                {gameLabel}<br />Wk {game.week}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="retro-title text-2xl sm:text-3xl leading-none" style={{ color: homeColor }}>{game.home_team}</div>
              <div className="retro-title text-4xl sm:text-5xl text-white leading-none tabular-nums">{game.home_score}</div>
              <div className="sports-font text-[9px] text-[#444] tracking-widest mt-0.5">HOME</div>
            </div>
          </div>
          <div className="border-t border-[#1a1a1a] px-4 py-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
            <span className="sports-font text-[10px] text-[#3a3a3a]">{formatDate(game.gameday)}</span>
            {game.stadium && <span className="sports-font text-[10px] text-[#2e2e2e]">· {game.stadium}</span>}
            {game.roof && <span className="sports-font text-[10px] text-[#2e2e2e] capitalize">· {game.roof}</span>}
            {game.temp != null && <span className="sports-font text-[10px] text-[#2e2e2e]">· {game.temp}°F</span>}
            {game.wind != null && <span className="sports-font text-[10px] text-[#2e2e2e]">· {game.wind} mph wind</span>}
          </div>
        </div>

        {/* ── Box score columns ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(['away', 'home'] as const).map(side => {
            const color = side === 'home' ? homeColor : awayColor;
            const abbr  = side === 'home' ? game.home_team : game.away_team;
            const data  = game.box_score[side];

            return (
              <div key={side} className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-[#1a1a1a] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="retro-title text-base" style={{ color }}>{abbr}</span>
                  <span className="sports-font text-[9px] text-[#333] tracking-widest uppercase ml-1">{side}</span>
                </div>

                <div className="p-3 space-y-3">
                  {data.passing.length > 0 && (
                    <section>
                      <div className="sports-font text-[9px] text-[#333] tracking-[0.35em] uppercase mb-1.5 pb-1 border-b border-[#181818]">Passing</div>
                      {data.passing.map((p, i) => (
                        <PassingResultRow key={`${p.id}-${i}`} player={p} guessed={guesses[bk(side, 'passing', i)] ?? ''} />
                      ))}
                    </section>
                  )}
                  {data.rushing.length > 0 && (
                    <section>
                      <div className="sports-font text-[9px] text-[#333] tracking-[0.35em] uppercase mb-1.5 pb-1 border-b border-[#181818]">Rushing</div>
                      {data.rushing.map((p, i) => (
                        <RushingResultRow key={`${p.id}-${i}`} player={p} guessed={guesses[bk(side, 'rushing', i)] ?? ''} />
                      ))}
                    </section>
                  )}
                  {data.receiving.length > 0 && (
                    <section>
                      <div className="sports-font text-[9px] text-[#333] tracking-[0.35em] uppercase mb-1.5 pb-1 border-b border-[#181818]">Receiving</div>
                      {data.receiving.map((p, i) => (
                        <ReceivingResultRow key={`${p.id}-${i}`} player={p} guessed={guesses[bk(side, 'receiving', i)] ?? ''} />
                      ))}
                    </section>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Action buttons ── */}
        <div className="flex gap-3 pb-10">
          <button
            onClick={() => navigate('/box-score', { state: filters })}
            className="flex-1 py-3 rounded-lg retro-title text-lg text-white transition-all hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${homeColor}dd, ${homeColor}88)`,
              border: `1px solid ${homeColor}55`,
            }}
          >
            Play Again
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-3 rounded-lg sports-font text-sm border border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-[#999] transition-all"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
