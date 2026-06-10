import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus, incrementPlayerWins } from '../../services/lobby';
import { areSimilarNames } from '../../utils/fuzzyDedup';
import { getNBATeamColor, nbk } from '../../components/boxScore/boxScoreHelpers';
import { type NBABoxScoreGame } from '../../services/nbaBoxScoreData';
import { NBAScoreboard } from '../../components/boxScore/NBAScoreboard';
import { NBATeamLogo } from '../../components/boxScore/NBATeamLogo';
import { NBAPlayerResultRow } from '../../components/boxScore/NBAPlayerResultRow';
import { computeLeaders } from '../../components/boxScore/NBAStatLine';

interface ResultsState {
  game: NBABoxScoreGame | null;
  myGuesses: Record<string, string>;
}

export function NBAMultiplayerBoxScoreResultsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const state = location.state as ResultsState | null;

  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers, leaveLobby } = useLobbyStore();
  const hasIncrementedWins = useRef(false);

  useLobbySubscription(lobby?.id || null);

  useEffect(() => {
    if (!isHost || !lobby || players.length === 0 || hasIncrementedWins.current) return;
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    const topScore = sorted[0].score || 0;
    if (topScore === 0) return;
    hasIncrementedWins.current = true;
    sorted.filter(p => (p.score || 0) === topScore).forEach(p => incrementPlayerWins(lobby.id, p.player_id));
  }, [isHost, lobby?.id, players]);

  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby) return;
    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => { if (pr.players) setPlayers(pr.players); });
    });
  }, []);

  useEffect(() => {
    if (!lobby || isHost) return;
    if (lobby.status === 'waiting') navigate(`/lobby/${code}`);
  }, [lobby?.status]);

  const handleNewGame = async () => {
    if (!lobby || !isHost) return;
    await updateLobbyStatus(lobby.id, 'waiting');
    setLobby({ ...lobby, status: 'waiting' });
    navigate(`/lobby/${code}`);
  };

  const handleLeave = async () => { await leaveLobby(); navigate('/'); };

  if (!lobby) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="text-white/50 capcrunch-kicker">Loading results...</div>
      </div>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const winner = sortedPlayers[0];

  const game = state?.game ?? null;
  const myGuesses = state?.myGuesses ?? {};

  const homeColor = game ? getNBATeamColor(game.home_team) : '#FDF100';
  const awayColor = game ? getNBATeamColor(game.away_team) : '#555';

  let myCorrect = 0, myTotal = 0;
  if (game) {
    for (const side of ['home', 'away'] as const) {
      game.box_score[side].forEach((p, i) => {
        myTotal++;
        if (areSimilarNames(myGuesses[nbk(side, i)] ?? '', p.name)) myCorrect++;
      });
    }
  }

  const whoGot: Record<string, string[]> = {};
  if (game) {
    players.forEach(p => {
      (p.guessed_players || []).forEach((entry: string) => {
        if (!entry.startsWith('BOX:')) return;
        const parts = entry.split(':');
        if (parts.length < 2) return;
        const key = parts[1];
        if (!whoGot[key]) whoGot[key] = [];
        whoGot[key].push(p.player_name);
      });
    });
  }

  return (
    <div className="min-h-screen home-chalkboard text-white">
      <header className="sticky top-0 z-20 capcrunch-panel border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-1.5 text-[#555] hover:text-white transition-colors shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <span className="capcrunch-title text-xl text-[#FDF100]">RESULTS</span>
        </div>
        <div className="w-8 shrink-0" />
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4 space-y-4">

        {/* Winner banner */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden capcrunch-panel border-[#FDF100]/30 p-5 text-center"
          >
            <div className="capcrunch-kicker text-[10px] text-[#555] tracking-[0.4em] uppercase mb-2">Match Winner</div>
            <div className="capcrunch-title text-4xl text-[#FDF100]">{winner.player_name}</div>
            <div className="capcrunch-kicker text-sm text-[#888] mt-1">{winner.score || 0} correct</div>
          </motion.div>
        )}

        {/* Standings */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="capcrunch-panel p-4"
        >
          <div className="capcrunch-kicker text-[9px] text-white/40 tracking-[0.35em] uppercase mb-3 text-center">Standings</div>
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
                  className={`flex items-center justify-between px-4 py-3 ${
                    rank === 0
                      ? 'bg-[#FDF100]/10 border border-[#FDF100]/30'
                      : isMe
                        ? 'bg-white/5 border border-white/10'
                        : 'bg-black/20 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`capcrunch-title text-lg w-7 text-center ${rank === 0 ? 'text-[#FDF100]' : 'text-[#444]'}`}>#{rank + 1}</span>
                    <span className="capcrunch-kicker text-sm text-white/90">
                      {player.player_name}
                      {isMe && <span className="text-white/40 ml-1 text-[10px]">(you)</span>}
                    </span>
                  </div>
                  <span className={`capcrunch-title text-xl tabular-nums ${rank === 0 ? 'text-[#FDF100]' : 'text-[#666]'}`}>{score}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Your score */}
        {game && (
          <div
            className="capcrunch-panel p-5 flex flex-col items-center gap-1"
          >
            <div className="capcrunch-kicker text-[9px] text-white/40 tracking-[0.35em] uppercase">Your Score</div>
            <div className="capcrunch-title text-5xl text-[#FDF100] tabular-nums leading-none">
              {myCorrect}<span className="text-2xl text-[#444]">/{myTotal}</span>
            </div>
          </div>
        )}

        {game && <NBAScoreboard game={game} compact />}

        {/* Box score columns */}
        {game && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['away', 'home'] as const).map(side => {
              const color      = side === 'home' ? homeColor : awayColor;
              const abbr       = side === 'home' ? game.home_team : game.away_team;
              const playerList = game.box_score[side];
              const leaders    = computeLeaders(playerList);

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
                      <div className="capcrunch-kicker text-[9px] text-[#555] tracking-widest uppercase mt-0.5">{side}</div>
                    </div>
                  </div>
                  <div className="p-4">
                    {playerList.map((p, i) => (
                      <NBAPlayerResultRow
                        key={`${p.id}-${i}`}
                        player={p}
                        guessed={myGuesses[nbk(side, i)] ?? ''}
                        teamColor={color}
                        leaders={leaders}
                        getters={players.length > 1 ? whoGot[nbk(side, i)] : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-3 pb-10">
          {isHost && (
            <button
              onClick={handleNewGame}
              className="flex-1 py-4 capcrunch-btn-primary capcrunch-title text-lg transition-all"
            >
              New Game
            </button>
          )}
          {!isHost && (
            <div className="flex-1 py-4 text-center capcrunch-kicker text-sm text-[#555] border border-white/6">
              Waiting for host...
            </div>
          )}
          <button
            onClick={handleLeave}
            className="px-6 py-4 capcrunch-btn-secondary capcrunch-kicker"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
