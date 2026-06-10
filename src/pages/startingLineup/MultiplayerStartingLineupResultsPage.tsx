/**
 * MultiplayerStartingLineupResultsPage.tsx — Final results for
 * Multiplayer Starting Lineup mode.
 *
 * Shows winner, final standings (wins column), and Play Again / Leave buttons.
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers, resetMatchForPlayAgain } from '../../services/lobby';

export function MultiplayerStartingLineupResultsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, isHost, setLobby, setPlayers } = useLobbyStore();

  useLobbySubscription(lobby?.id || null);

  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby?.id) return;

    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => {
        if (pr.players) setPlayers(pr.players);
      });
    });
  }, []);

  // Navigate back to lobby on play-again (status reverts to 'waiting')
  useEffect(() => {
    if (lobby?.status === 'waiting') {
      navigate(`/lobby/${code}`);
    }
  }, [lobby?.status]);

  const sorted = [...players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const winner = sorted[0];
  const careerState = (lobby?.career_state as any) || {};
  const winTarget = careerState.win_target || 10;

  async function handlePlayAgain() {
    if (!isHost || !lobby) return;
    await resetMatchForPlayAgain(lobby.id, winTarget);
  }

  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col">
      <header className="flex items-center px-4 py-3 border-b border-white/10">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 transition-colors">
          <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="capcrunch-title text-xl text-[#ea580c] ml-3">Starting Lineup</h1>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-8 max-w-md mx-auto w-full gap-6">
        {/* Winner */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="capcrunch-kicker text-[10px] text-white/30 tracking-[0.4em] uppercase mb-2">Winner</div>
            <div className="capcrunch-title text-4xl text-[#ea580c] mb-1">{winner.player_name}</div>
            <div className="capcrunch-title text-2xl text-[#fdb927]">{winner.points ?? 0} pts</div>
          </motion.div>
        )}

        {/* Final standings */}
        <div className="w-full">
          <div className="capcrunch-kicker text-[9px] text-white/30 tracking-widest uppercase mb-3">Final Standings</div>
          <div className="flex flex-col gap-2">
            {sorted.map((p, i) => (
              <motion.div
                key={p.player_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 px-4 py-3 bg-black/40 border border-white/10"
              >
                <span className="capcrunch-title text-lg text-white/40 w-6">{i + 1}</span>
                {i === 0 && <span className="text-base">🏆</span>}
                <span className="flex-1 capcrunch-kicker text-sm text-white">{p.player_name}</span>
                <span className="capcrunch-title text-xl text-[#fdb927]">{p.points ?? 0}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          {isHost && (
            <button
              onClick={handlePlayAgain}
              className="flex-1 py-4 capcrunch-title text-lg tracking-wider bg-[#ea580c] hover:bg-[#c2410c] text-white transition-all"
            >
              Play Again
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-4 capcrunch-kicker text-sm bg-black/40 border border-white/10 text-white/60 hover:border-white/25 transition-all"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
