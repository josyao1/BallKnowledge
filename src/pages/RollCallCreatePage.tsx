/**
 * RollCallCreatePage.tsx — Simplified lobby creation for Roll Call mode.
 *
 * Only collects the host's name, then creates a roll_call lobby with
 * dummy roster fields and navigates to the session page.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { getStoredPlayerName } from '../services/lobby';

export function RollCallCreatePage() {
  const navigate = useNavigate();
  const { createLobby, isLoading, error } = useLobbyStore();
  const [hostName, setHostName] = useState(getStoredPlayerName() || '');

  const handleCreate = async () => {
    if (!hostName.trim()) return;

    const lobby = await createLobby(
      hostName.trim(), 'nba', 'ALL', 'all-time',
      0, 'manual', 2000, 2024, 'roll_call'
    );

    if (lobby) {
      navigate(`/roll-call/${lobby.join_code}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d2a0b] text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)` }}
      />

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
            <h1 className="retro-title text-3xl text-[#d4af37]">Roll Call</h1>
            <p className="sports-font text-[9px] text-white/30 tracking-[0.4em] uppercase">Name Every Player You Know</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-md mx-auto w-full p-6 space-y-6">
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
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="w-full p-3 bg-[#111] rounded-sm border-2 border-white/20 text-white focus:outline-none focus:border-[#d4af37] transition-colors sports-font"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-black/50 border border-white/10 rounded-sm p-4 text-center"
        >
          <div className="sports-font text-[10px] text-white/40 mb-2 tracking-[0.3em] uppercase">How It Works</div>
          <p className="text-white/60 text-sm sports-font leading-relaxed">
            Name as many sports players as you can with your friends.
            No roster — just your memory. Fuzzy matching groups similar entries automatically.
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-red-900/30 border border-red-700 rounded-sm text-red-400 text-sm text-center sports-font"
          >
            {error}
          </motion.div>
        )}

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={handleCreate}
          disabled={!hostName.trim() || isLoading}
          className="w-full py-4 rounded-sm retro-title text-xl tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1"
        >
          {isLoading ? 'Creating...' : 'Start Roll Call'}
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-center text-white/30 text-[10px] pb-4 sports-font tracking-widest uppercase"
        >
          <p>You'll get a 6-character code to share</p>
        </motion.div>
      </main>
    </div>
  );
}
