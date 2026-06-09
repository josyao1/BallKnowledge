import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import { getNBATeamColor, nbk } from '../../components/boxScore/boxScoreHelpers';
import { type NBABoxScoreGame } from '../../services/nbaBoxScoreData';
import { NBAScoreboard } from '../../components/boxScore/NBAScoreboard';
import { NBATeamLogo } from '../../components/boxScore/NBATeamLogo';
import { NBAPlayerResultRow } from '../../components/boxScore/NBAPlayerResultRow';
import { computeLeaders } from '../../components/boxScore/NBAStatLine';
import type { NBABoxFilters } from './NBABoxScoreGamePage';

interface ResultsState {
  game: NBABoxScoreGame;
  guesses: Record<string, string>;
  filters: NBABoxFilters;
  revealed: boolean;
}

export function NBABoxScoreResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ResultsState | null;

  useEffect(() => {
    if (!state?.game) navigate('/');
  }, []);

  if (!state?.game) return null;

  const { game, guesses, filters } = state;
  const homeColor = getNBATeamColor(game.home_team);
  const awayColor = getNBATeamColor(game.away_team);

  let totalRows = 0, correctRows = 0;
  for (const side of ['home', 'away'] as const) {
    game.box_score[side].forEach((p, i) => {
      totalRows++;
      if (areSimilarNames(guesses[nbk(side, i)] ?? '', p.name)) correctRows++;
    });
  }

  const pct = totalRows > 0 ? Math.round(correctRows / totalRows * 100) : 0;
  const message = correctRows === totalRows ? 'Perfect game!'
    : correctRows >= Math.floor(totalRows * 0.7) ? 'Great job!'
    : correctRows >= Math.floor(totalRows * 0.4) ? 'Not bad!'
    : 'Keep practicing!';

  return (
    <div className="min-h-screen home-chalkboard text-white">
      <header className="sticky top-0 z-20 capcrunch-panel border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-1.5 text-[#555] hover:text-white transition-colors shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <span className="capcrunch-title text-xl" style={{ color: '#FDF100' }}>RESULTS</span>
        </div>
        <div className="w-8 shrink-0" />
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4 space-y-4">

        {/* Score card */}
        <div
          className="relative overflow-hidden p-6 flex flex-col items-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${awayColor}18 0%, #0a0a0a 40%, #0a0a0a 60%, ${homeColor}18 100%)`,
            border: '1px solid rgba(253,241,0,0.2)',
          }}
        >
          <div className="sports-font text-[10px] text-white/40 tracking-[0.4em] uppercase">Final Score</div>
          <div className="capcrunch-title text-7xl text-[#FDF100] tabular-nums leading-none">
            {correctRows}<span className="text-4xl text-[#444]">/{totalRows}</span>
          </div>
          <div className="sports-font text-sm" style={{ color: pct === 100 ? '#4ade80' : '#666' }}>
            {pct}% · {message}
          </div>
        </div>

        <NBAScoreboard game={game} compact />

        {/* Box score columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['away', 'home'] as const).map(side => {
            const color   = side === 'home' ? homeColor : awayColor;
            const abbr    = side === 'home' ? game.home_team : game.away_team;
            const players = game.box_score[side];
            const leaders = computeLeaders(players);
            const correct = players.filter((p, i) => areSimilarNames(guesses[nbk(side, i)] ?? '', p.name)).length;

            return (
              <div
                key={side}
                className="overflow-hidden"
                style={{
                  background: `linear-gradient(160deg, ${color}12 0%, #111 30%)`,
                  border: `1px solid ${color}30`,
                }}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b"
                  style={{ background: `linear-gradient(90deg, ${color}25 0%, transparent 80%)`, borderColor: `${color}20` }}
                >
                  <NBATeamLogo abbr={abbr} className="w-9 h-9 object-contain shrink-0" />
                  <div>
                    <div className="capcrunch-title text-xl leading-none" style={{ color }}>{abbr}</div>
                    <div className="sports-font text-[9px] text-[#555] tracking-widest uppercase mt-0.5">{side}</div>
                  </div>
                  <div className="ml-auto sports-font text-[10px] tracking-wider" style={{ color: correct === players.length ? '#4ade80' : '#555' }}>
                    {correct}/{players.length}
                  </div>
                </div>
                <div className="p-4">
                  {players.map((p, i) => (
                    <NBAPlayerResultRow
                      key={`${p.id}-${i}`}
                      player={p}
                      guessed={guesses[nbk(side, i)] ?? ''}
                      teamColor={color}
                      leaders={leaders}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pb-10">
          <button
            onClick={() => navigate('/nba-box-score', { state: filters })}
            className="flex-1 py-4 capcrunch-title text-2xl text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${homeColor}, ${homeColor}88)`,
              boxShadow: `0 4px 24px ${homeColor}50, 0 0 0 1px ${homeColor}30`,
            }}
          >
            Play Again
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-4 capcrunch-btn-secondary capcrunch-kicker"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
