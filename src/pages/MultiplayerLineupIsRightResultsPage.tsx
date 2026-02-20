/**
 * MultiplayerLineupIsRightResultsPage.tsx — Results and standings for "Lineup Is Right".
 *
 * Displays final match results showing winner(s) and final standings.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import {
  findLobbyByCode,
  getLobbyPlayers,
} from '../services/lobby';
import type { LobbyPlayer } from '../types/database';

export function MultiplayerLineupIsRightResultsPage() {
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
      findLobbyByCode(code).then(result => {
        if (!result.lobby) {
          navigate('/');
          return;
        }
        setLobby(result.lobby);
        getLobbyPlayers(result.lobby.id).then(pr => {
          if (pr.players) setPlayers(pr.players);
        });
      });
      return;
    }

    // Calculate rankings from player scores/wins
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
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4" />
          <p className="text-white">Loading results...</p>
        </div>
      </div>
    );
  }

  const champion = rankings[0];

  return (
    <div className="min-h-screen bg-[#0d2a0b] text-white flex flex-col relative overflow-hidden p-4 md:p-6">
      {/* BACKGROUND FELT */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
          background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)`
        }}
      />

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 flex flex-col h-full max-w-7xl mx-auto w-full"
      >
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-2 border-white/10 pb-4 gap-4">
          <div>
            <div className="sports-font text-[8px] md:text-[10px] tracking-[0.4em] md:tracking-[0.6em] text-white/30 uppercase">Match Result // Settlement</div>
            <h1 className="retro-title text-4xl md:text-6xl text-white uppercase leading-none">Final Rankings</h1>
          </div>
        </header>

        {/* CHAMPION DISPLAY */}
        {champion && (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6 p-6 md:p-8 bg-gradient-to-br from-yellow-900/40 to-yellow-900/20 rounded-sm border-2 border-yellow-600/40 text-center"
          >
            <p className="sports-font text-[8px] md:text-[10px] text-yellow-400/60 tracking-widest uppercase mb-2">🏆 Match Champion 🏆</p>
            <h2 className="retro-title text-3xl md:text-5xl font-bold text-white mb-1">{champion.player.player_name}</h2>
            <p className="retro-title text-2xl md:text-3xl text-yellow-300">
              {champion.wins} Win{champion.wins !== 1 ? 's' : ''}
            </p>
          </motion.div>
        )}

        {/* STANDINGS TABLE */}
        <div className="bg-black/70 border border-white/10 rounded-sm flex flex-col shadow-2xl overflow-hidden mb-6 flex-1">
          <div className="p-3 md:p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
            <span className="sports-font text-[9px] tracking-widest text-white/40 uppercase">Final Standings</span>
            <span className="retro-title text-[9px] text-white/20 uppercase">{rankings.length} Players</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6 max-h-96 lg:max-h-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {rankings.map((entry, idx) => (
                <motion.div
                  key={entry.player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  className={`relative p-3 md:p-4 border transition-all ${
                    idx === 0 ? 'border-yellow-500/40' : 'border-white/10'
                  }`}
                  style={{
                    background: idx === 0 
                      ? 'linear-gradient(135deg, #FFD70033 0%, #FFA50033 100%)'
                      : 'transparent'
                  }}
                >
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <span className="retro-title text-2xl md:text-3xl text-white">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${entry.rank}.`}
                      </span>
                      <div>
                        <p className={`retro-title text-sm md:text-base ${
                          idx === 0 ? 'text-yellow-300' : 'text-white'
                        }`}>{entry.player.player_name}</p>
                        <p className="sports-font text-[8px] md:text-[9px] text-white/40 uppercase tracking-widest">
                          {entry.wins} Win{entry.wins !== 1 ? 's' : ''}
                        </p>
                      </div>
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
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 md:gap-4"
        >
          <button
            onClick={() => navigate('/')}
            className="group relative bg-[#1a1a1a] border border-white/20 py-3 md:py-4 rounded-sm hover:border-white/40 transition-colors flex-1"
          >
            <span className="relative z-10 retro-title text-lg md:text-xl text-white/70 uppercase tracking-widest">Home</span>
          </button>
          <button
            onClick={() => navigate('/lobby/create')}
            className="group relative bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] py-3 md:py-4 rounded-sm shadow-[0_4px_0_#a89860] active:translate-y-1 active:shadow-none flex-1"
          >
            <span className="relative z-10 retro-title text-lg md:text-xl text-black uppercase tracking-widest">New Game</span>
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
