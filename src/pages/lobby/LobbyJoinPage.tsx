/**
 * LobbyJoinPage.tsx — Multiplayer lobby join page.
 *
 * Lets a player enter their name and a 6-character join code to
 * join an existing lobby. Supports pre-filled codes via URL params.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { getStoredPlayerName, findLobbyByCode } from '../../services/lobby';

export function LobbyJoinPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code?: string }>();
  const { joinLobbyByCode, isLoading, error } = useLobbyStore();

  const [playerName, setPlayerName] = useState(getStoredPlayerName() || '');
  const [joinCode, setJoinCode] = useState(code?.toUpperCase() || '');

  const handleCodeChange = (value: string) => {
    const formatted = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
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
    <div className="min-h-screen flex flex-col home-chalkboard text-white">
      {/* Header */}
      <header className="capcrunch-panel border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="capcrunch-kicker text-[10px] text-white/40 hover:text-white/70 transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="capcrunch-title text-3xl text-white">Join Table</h1>
            <p className="capcrunch-kicker text-[9px] text-white/30">Enter a Private Game</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-md mx-auto w-full p-6 space-y-6">
        {/* Player name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="capcrunch-panel p-4"
        >
          <label className="block capcrunch-kicker text-[10px] text-white/40 mb-2">Your Name</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full p-3 bg-black/40 border border-white/20 text-white focus:outline-none focus:border-[#FDF100] transition-colors capcrunch-kicker"
          />
        </motion.div>

        {/* Join code */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="capcrunch-panel p-4"
        >
          <label className="block capcrunch-kicker text-[10px] text-white/40 mb-2">
            Table Code
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="XXXXXX"
            maxLength={6}
            className="w-full p-4 bg-black/40 border border-white/20 text-center text-3xl font-mono tracking-[0.5em] text-[#FDF100] focus:outline-none focus:border-[#FDF100] uppercase"
          />
          <p className="text-center text-white/30 text-[10px] mt-2 capcrunch-kicker">
            Enter the 6-character code from your host
          </p>
        </motion.div>

        {/* Rejoin hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-center text-white/30 text-[11px] capcrunch-kicker tracking-wide"
        >
          Glitched out of a game? Re-enter the same code with your name as it shows in the lobby to
          pick up where you left off.
        </motion.p>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-red-900/30 border border-red-700 text-red-400 text-sm text-center capcrunch-kicker"
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
          className="w-full py-4 capcrunch-btn-primary capcrunch-title text-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Joining...' : 'Take a Seat'}
        </motion.button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-white/30 text-sm capcrunch-kicker">or</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        {/* Create lobby link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={() => navigate('/lobby/create')}
          className="w-full py-3 capcrunch-btn-secondary capcrunch-kicker"
        >
          Open New Table
        </motion.button>
      </main>
    </div>
  );
}
