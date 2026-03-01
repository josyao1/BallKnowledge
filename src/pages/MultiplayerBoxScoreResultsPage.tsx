/**
 * MultiplayerBoxScoreResultsPage.tsx — Multiplayer Box Score results.
 *
 * Shows player leaderboard (score = correct names) and, if location.state
 * is available, the current player's personal box score with green/red
 * highlighting. Host can navigate back to the waiting room for a new game.
 */

import { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus } from '../services/lobby';
import { areSimilarNames } from '../utils/fuzzyDedup';
import { nflTeams } from '../data/nfl-teams';
import type { BoxScoreGame, BoxScorePassingPlayer, BoxScoreRushingPlayer, BoxScoreReceivingPlayer } from '../services/boxScoreData';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GAME_TYPE_LABELS: Record<string, string> = {
  REG: 'Regular Season', WC: 'Wild Card', DIV: 'Divisional',
  CON: 'Conf. Championship', SB: 'Super Bowl',
};

function getTeamColor(abbr: string): string {
  return nflTeams.find(t => t.abbreviation === abbr)?.colors.primary ?? '#4a4a4a';
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function bk(side: 'home' | 'away', cat: string, idx: number) {
  return `${side}_${cat}_${idx}`;
}

// ─── Row components ───────────────────────────────────────────────────────────

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

function PassingRow({ player, guessed }: { player: BoxScorePassingPlayer; guessed: string }) {
  const correct = !!guessed && areSimilarNames(guessed, player.name);
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="sports-font text-[10px] text-[#3a3a3a] w-6 text-right shrink-0 tabular-nums">
        {player.number ? `#${player.number}` : '—'}
      </span>
      <ResultName name={player.name} guessed={guessed} correct={correct} />
      <div className="sports-font text-[10px] text-[#888] shrink-0 tabular-nums text-right hidden sm:block" style={{ minWidth: 110 }}>
        {player.completions}/{player.attempts} · {player.yards}yd · {player.tds}TD{player.ints > 0 ? ` · ${player.ints}INT` : ''}
      </div>
      <div className="sports-font text-[10px] text-[#888] shrink-0 tabular-nums text-right sm:hidden" style={{ minWidth: 60 }}>
        {player.yards}yd {player.tds}TD
      </div>
    </div>
  );
}

function RushingRow({ player, guessed }: { player: BoxScoreRushingPlayer; guessed: string }) {
  const correct = !!guessed && areSimilarNames(guessed, player.name);
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="sports-font text-[10px] text-[#3a3a3a] w-6 text-right shrink-0 tabular-nums">
        {player.number ? `#${player.number}` : '—'}
      </span>
      <ResultName name={player.name} guessed={guessed} correct={correct} />
      <div className="sports-font text-[10px] text-[#888] shrink-0 tabular-nums text-right hidden sm:block" style={{ minWidth: 110 }}>
        {player.carries}car · {player.yards}yd · {player.tds}TD
      </div>
      <div className="sports-font text-[10px] text-[#888] shrink-0 tabular-nums text-right sm:hidden" style={{ minWidth: 60 }}>
        {player.yards}yd {player.tds}TD
      </div>
    </div>
  );
}

function ReceivingRow({ player, guessed }: { player: BoxScoreReceivingPlayer; guessed: string }) {
  const correct = !!guessed && areSimilarNames(guessed, player.name);
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="sports-font text-[10px] text-[#3a3a3a] w-6 text-right shrink-0 tabular-nums">
        {player.number ? `#${player.number}` : '—'}
      </span>
      <ResultName name={player.name} guessed={guessed} correct={correct} />
      <div className="sports-font text-[10px] text-[#888] shrink-0 tabular-nums text-right hidden sm:block" style={{ minWidth: 110 }}>
        {player.receptions}/{player.targets} · {player.yards}yd · {player.tds}TD
      </div>
      <div className="sports-font text-[10px] text-[#888] shrink-0 tabular-nums text-right sm:hidden" style={{ minWidth: 60 }}>
        {player.yards}yd {player.tds}TD
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface ResultsState {
  game: BoxScoreGame | null;
  myGuesses: Record<string, string>;
  mySpreadGuess: string;
}

export function MultiplayerBoxScoreResultsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const state = (location.state as ResultsState | null);

  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers, leaveLobby } = useLobbyStore();

  useLobbySubscription(lobby?.id || null);

  // Load lobby on refresh
  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby) return;
    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => {
        if (pr.players) setPlayers(pr.players);
      });
    });
  }, []);

  // Non-host: follow when host resets to waiting
  useEffect(() => {
    if (!lobby || isHost) return;
    if (lobby.status === 'waiting') {
      navigate(`/lobby/${code}`);
    }
  }, [lobby?.status]);

  const handleNewGame = async () => {
    if (!lobby || !isHost) return;
    await updateLobbyStatus(lobby.id, 'waiting');
    setLobby({ ...lobby, status: 'waiting' });
    navigate(`/lobby/${code}`);
  };

  const handleLeave = async () => {
    await leaveLobby();
    navigate('/');
  };

  if (!lobby) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="text-white/50 sports-font">Loading results...</div>
      </div>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const winner = sortedPlayers[0];

  const game = state?.game ?? null;
  const myGuesses = state?.myGuesses ?? {};
  const mySpreadGuess = state?.mySpreadGuess ?? '';

  const homeColor = game ? getTeamColor(game.home_team) : '#f59e0b';
  const awayColor = game ? getTeamColor(game.away_team) : '#555';

  // Count my correct answers
  let myCorrect = 0;
  let myTotal = 0;
  if (game) {
    for (const side of ['home', 'away'] as const) {
      for (const cat of ['passing', 'rushing', 'receiving'] as const) {
        const rows = game.box_score[side][cat] as any[];
        myTotal += rows.length;
        rows.forEach((p, i) => {
          const guess = myGuesses[bk(side, cat, i)] ?? '';
          if (guess && areSimilarNames(guess, p.name)) myCorrect++;
        });
      }
    }
    const spreadCorrect =
      game.spread_line != null &&
      mySpreadGuess !== '' &&
      Math.abs(parseFloat(mySpreadGuess) - game.spread_line) <= 0.5;
    if (spreadCorrect) myCorrect++;
    if (game.spread_line != null) myTotal++;
  }

  const gameLabel = game ? (GAME_TYPE_LABELS[game.game_type] ?? game.game_type) : '';

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
          <span className="retro-title text-lg text-[#f59e0b]">Box Score Results</span>
        </div>
        <div className="w-8 shrink-0" />
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4 space-y-3">

        {/* ── Winner banner ── */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-[#f59e0b]/30 rounded-xl p-5 text-center"
          >
            <div className="sports-font text-[10px] text-[#555] tracking-[0.4em] uppercase mb-2">Match Winner</div>
            <div className="retro-title text-3xl text-[#f59e0b]">{winner.player_name}</div>
            <div className="sports-font text-sm text-[#888] mt-1">{winner.score || 0} correct</div>
          </motion.div>
        )}

        {/* ── Leaderboard ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4"
        >
          <div className="sports-font text-[10px] text-[#555] tracking-[0.35em] uppercase mb-3 text-center">Standings</div>
          <div className="space-y-2">
            {sortedPlayers.map((player, rank) => {
              const isMe = player.player_id === currentPlayerId;
              const score = player.score || 0;
              return (
                <motion.div
                  key={player.player_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + rank * 0.04 }}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                    rank === 0
                      ? 'bg-[#f59e0b]/10 border border-[#f59e0b]/30'
                      : isMe
                        ? 'bg-white/5 border border-white/15'
                        : 'bg-black/20 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`retro-title text-lg w-7 text-center ${
                      rank === 0 ? 'text-[#f59e0b]' : 'text-[#444]'
                    }`}>#{rank + 1}</span>
                    <span className="sports-font text-sm text-white/90">
                      {player.player_name}
                      {isMe && <span className="text-white/40 ml-1 text-[10px]">(you)</span>}
                    </span>
                  </div>
                  <span className={`retro-title text-xl tabular-nums ${
                    rank === 0 ? 'text-[#f59e0b]' : 'text-[#888]'
                  }`}>{score}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── My score summary ── */}
        {game && (
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 text-center">
            <div className="sports-font text-[10px] text-[#555] tracking-[0.35em] uppercase mb-1">Your Score</div>
            <div className="retro-title text-4xl text-[#f59e0b] tabular-nums">
              {myCorrect}<span className="text-xl text-[#444]">/{myTotal}</span>
            </div>
          </div>
        )}

        {/* ── Game header ── */}
        {game && (
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex flex-col items-center gap-1">
                <div className="retro-title text-2xl sm:text-3xl leading-none" style={{ color: awayColor }}>{game.away_team}</div>
                <div className="retro-title text-4xl sm:text-5xl text-white leading-none tabular-nums">{game.away_score}</div>
                <div className="sports-font text-[9px] text-[#444] tracking-widest mt-0.5">AWAY</div>
              </div>
              <div className="flex flex-col items-center gap-1 px-2">
                {game.overtime && (
                  <span className="px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 rounded sports-font text-[9px] text-amber-500">OT</span>
                )}
                <div className="sports-font text-[10px] text-[#333] tracking-[0.3em]">FINAL</div>
                <div className="sports-font text-[9px] text-[#444] text-center leading-snug">
                  {gameLabel}<br />Wk {game.week}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="retro-title text-2xl sm:text-3xl leading-none" style={{ color: homeColor }}>{game.home_team}</div>
                <div className="retro-title text-4xl sm:text-5xl text-white leading-none tabular-nums">{game.home_score}</div>
                <div className="sports-font text-[9px] text-[#444] tracking-widest mt-0.5">HOME</div>
              </div>
            </div>
            <div className="border-t border-[#1a1a1a] px-4 py-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
              <span className="sports-font text-[10px] text-[#3a3a3a]">{formatDate(game.gameday)}</span>
              {game.stadium && <span className="sports-font text-[10px] text-[#2e2e2e]">· {game.stadium}</span>}
              {game.temp != null && <span className="sports-font text-[10px] text-[#2e2e2e]">· {game.temp}°F</span>}
              {game.wind != null && <span className="sports-font text-[10px] text-[#2e2e2e]">· {game.wind} mph wind</span>}
            </div>
          </div>
        )}

        {/* ── My box score (personal) ── */}
        {game && (
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
                        <div className="sports-font text-[9px] text-[#333] tracking-[0.35em] uppercase mb-1 pb-0.5 border-b border-[#181818]">Passing</div>
                        {data.passing.map((p, i) => (
                          <PassingRow key={p.id} player={p} guessed={myGuesses[bk(side, 'passing', i)] ?? ''} />
                        ))}
                      </section>
                    )}
                    {data.rushing.length > 0 && (
                      <section>
                        <div className="sports-font text-[9px] text-[#333] tracking-[0.35em] uppercase mb-1 pb-0.5 border-b border-[#181818]">Rushing</div>
                        {data.rushing.map((p, i) => (
                          <RushingRow key={p.id} player={p} guessed={myGuesses[bk(side, 'rushing', i)] ?? ''} />
                        ))}
                      </section>
                    )}
                    {data.receiving.length > 0 && (
                      <section>
                        <div className="sports-font text-[9px] text-[#333] tracking-[0.35em] uppercase mb-1 pb-0.5 border-b border-[#181818]">Receiving</div>
                        {data.receiving.map((p, i) => (
                          <ReceivingRow key={p.id} player={p} guessed={myGuesses[bk(side, 'receiving', i)] ?? ''} />
                        ))}
                      </section>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-3 pb-10">
          {isHost && (
            <button
              onClick={handleNewGame}
              className="flex-1 py-3 rounded-lg retro-title text-lg text-black transition-all hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #f59e0bdd, #d97706aa)',
                border: '1px solid #f59e0b55',
              }}
            >
              New Game
            </button>
          )}
          {!isHost && (
            <div className="flex-1 py-3 rounded-lg text-center sports-font text-sm text-[#555]">
              Waiting for host...
            </div>
          )}
          <button
            onClick={handleLeave}
            className="px-5 py-3 rounded-lg sports-font text-sm border border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-[#999] transition-all"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
