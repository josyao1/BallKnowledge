/**
 * LobbyJoinPage.tsx — Multiplayer lobby join page.
 *
 * Lets a player enter their name and a 6-character join code to
 * join an existing lobby. Supports pre-filled codes via URL params.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { getStoredPlayerName, findLobbyByCode } from '../services/lobby';

export function LobbyJoinPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code?: string }>();
  const { joinLobbyByCode, isLoading, error } = useLobbyStore();

  const [playerName, setPlayerName] = useState(getStoredPlayerName() || '');
  const [joinCode, setJoinCode] = useState(code?.toUpperCase() || '');

  const handleCodeChange = (value: string) => {
    const formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setJoinCode(formatted);
  };

  const canJoin = playerName.trim() && joinCode.length === 6;

  const handleJoin = async () => {
    if (!canJoin) return;

    const success = await joinLobbyByCode(joinCode, playerName.trim());
    if (success) {
      // Check game type to route to the right page
      const lobbyResult = await findLobbyByCode(joinCode);
      if (lobbyResult.lobby?.game_type === 'roll_call') {
        navigate(`/roll-call/${joinCode}`);
      } else {
        navigate(`/lobby/${joinCode}`);
      }
    }
  };

  useEffect(() => {
    if (code && playerName.trim() && code.length === 6) {
      // Don't auto-join, let user confirm name
    }
  }, [code, playerName]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0d2a0b] text-white relative overflow-hidden">
      {/* Green felt background */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
      />

      {/* Header */}
      <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="retro-title text-3xl text-[#d4af37]">Join Table</h1>
            <p className="sports-font text-[9px] text-white/30 tracking-[0.4em] uppercase">Enter a Private Game</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 max-w-md mx-auto w-full p-6 space-y-6">
        {/* Player name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/50 border border-white/10 rounded-sm p-4"
        >
          <label className="block sports-font text-[10px] text-white/40 mb-2 tracking-[0.3em] uppercase">
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full p-3 bg-[#111] rounded-sm border-2 border-white/20 text-white focus:outline-none focus:border-[#d4af37] transition-colors sports-font"
          />
        </motion.div>

        {/* Join code */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-black/50 border border-white/10 rounded-sm p-4"
        >
          <label className="block sports-font text-[10px] text-white/40 mb-2 tracking-[0.3em] uppercase">
            Table Code
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="XXXXXX"
            maxLength={6}
            className="w-full p-4 bg-[#111] rounded-sm border-2 border-white/20 text-center text-3xl font-mono tracking-[0.5em] text-[#d4af37] focus:outline-none focus:border-[#d4af37] uppercase"
          />
          <p className="text-center text-white/30 text-[10px] mt-2 sports-font tracking-widest uppercase">
            Enter the 6-character code from your host
          </p>
        </motion.div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-red-900/30 border border-red-700 rounded-sm text-red-400 text-sm text-center sports-font"
          >
            {error}
          </motion.div>
        )}

        {/* Join button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={handleJoin}
          disabled={!canJoin || isLoading}
          className="w-full py-4 rounded-sm retro-title text-xl tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1"
        >
          {isLoading ? 'Joining...' : 'Take a Seat'}
        </motion.button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-white/30 text-sm sports-font">or</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        {/* Create lobby link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={() => navigate('/lobby/create')}
          className="w-full py-3 rounded-sm sports-font tracking-wider border border-white/20 text-white/50 hover:border-[#d4af37] hover:text-[#d4af37] transition-all"
        >
          Open New Table
        </motion.button>
      </main>
    </div>
  );
}
