/**
 * MultiplayerCapCrunchResultsPage.tsx — Results and standings for Cap Crunch.
 *
 * Displays final match results showing winner(s) and final standings.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers } from '../../services/lobby';
import type { LobbyPlayer } from '../../types/database';
import { GradBanner } from '../../components/GradWeekOverlay';

export function MultiplayerCapCrunchResultsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, setLobby, setPlayers } = useLobbyStore();
  const [rankings, setRankings] = useState<
    Array<{ player: LobbyPlayer; wins: number; rank: number }>
  >([]);

  useLobbySubscription(lobby?.id || null);

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    if (!lobby) {
      findLobbyByCode(code).then((result) => {
        if (!result.lobby) {
          navigate('/');
          return;
        }
        setLobby(result.lobby);
        getLobbyPlayers(result.lobby.id).then((pr) => {
          if (pr.players) setPlayers(pr.players);
        });
      });
      return;
    }

    const sorted = [...players].sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0));
    const ranked = sorted.map((p, idx) => ({
      player: p,
      wins: p.wins ?? 0,
      rank: idx + 1,
    }));
    setRankings(ranked);
  }, [code, lobby?.id, players]);

  if (!lobby || rankings.length === 0) {
    return (
      <div className="min-h-screen capcrunch-shell flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#FDF100] border-t-transparent animate-spin mx-auto" />
          <p className="capcrunch-kicker text-[10px] text-[#FDF100]/50">Loading results</p>
        </div>
      </div>
    );
  }

  const champion = rankings[0];

  return (
    <div className="min-h-screen capcrunch-shell text-white flex flex-col relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 flex flex-col h-full max-w-3xl mx-auto w-full p-4 md:p-6"
      >
        {/* HEADER */}
        <header className="capcrunch-panel px-5 py-4 mb-4">
          <p className="capcrunch-kicker text-[9px] text-white/30 mb-1">Cap Crunch</p>
          <h1 className="capcrunch-title text-3xl md:text-5xl text-white leading-none">
            Final Rankings
          </h1>
        </header>
        <GradBanner />

        {/* CHAMPION DISPLAY */}
        {champion && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mb-4 p-5 md:p-7 capcrunch-panel border-[#FDF100]/30 text-center"
            style={{ borderColor: 'rgba(253,241,0,0.3)' }}
          >
            <p className="capcrunch-kicker text-[9px] text-[#FDF100]/60 mb-3">Match Champion</p>
            <h2 className="capcrunch-title text-3xl md:text-5xl text-white mb-1">
              {champion.player.player_name}
            </h2>
            <p className="capcrunch-title text-xl md:text-2xl text-[#FDF100]">
              {champion.wins} Win{champion.wins !== 1 ? 's' : ''}
            </p>
          </motion.div>
        )}

        {/* STANDINGS TABLE */}
        <div className="capcrunch-panel flex flex-col overflow-hidden mb-4 flex-1">
          <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
            <span className="capcrunch-kicker text-[9px] text-white/40">Final Standings</span>
            <span className="capcrunch-kicker text-[9px] text-white/20">
              {rankings.length} Players
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-5 max-h-96 lg:max-h-none">
            <div className="flex flex-col gap-2">
              {rankings.map((entry, idx) => (
                <motion.div
                  key={entry.player.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.08 }}
                  className={`flex items-center justify-between px-4 py-3 border transition-all ${
                    idx === 0
                      ? 'border-[#FDF100]/30 bg-[#FDF100]/[0.06]'
                      : 'border-white/8 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="capcrunch-title text-2xl md:text-3xl w-8 text-center text-white/60">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${entry.rank}.`}
                    </span>
                    <div>
                      <p
                        className={`capcrunch-title text-sm md:text-base ${idx === 0 ? 'text-[#FDF100]' : 'text-white'}`}
                      >
                        {entry.player.player_name}
                      </p>
                      <p className="capcrunch-kicker text-[8px] text-white/35">
                        {entry.wins} Win{entry.wins !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 md:py-4 capcrunch-btn-secondary capcrunch-title text-base transition"
          >
            Home
          </button>
          <button
            onClick={() => navigate('/lobby/create')}
            className="flex-1 py-3 md:py-4 capcrunch-btn-primary capcrunch-title text-base transition"
          >
            New Game
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
