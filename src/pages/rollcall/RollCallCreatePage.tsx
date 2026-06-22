/**
 * RollCallCreatePage.tsx — Simplified lobby creation for Roll Call mode.
 *
 * Only collects the host's name, then creates a roll_call lobby with
 * dummy roster fields and navigates to the session page.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { getStoredPlayerName } from '../../services/lobby';

export function RollCallCreatePage() {
  const navigate = useNavigate();
  const { createLobby, isLoading, error } = useLobbyStore();
  const [hostName, setHostName] = useState(getStoredPlayerName() || '');

  const handleCreate = async () => {
    if (!hostName.trim()) return;

    const lobby = await createLobby(
      hostName.trim(),
      'nba',
      'ALL',
      'all-time',
      0,
      'manual',
      2000,
      2024,
      'roll_call',
    );

    if (lobby) {
      navigate(`/roll-call/${lobby.join_code}`);
    }
  };

  return (
    <div className="min-h-screen home-chalkboard flex flex-col text-white">
      <header className="p-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 transition-colors">
            <svg
              className="w-6 h-6 text-white/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div>
            <h1 className="capcrunch-title text-3xl text-[#d4af37]">Roll Call</h1>
            <p className="capcrunch-kicker text-[9px] text-white/30 tracking-[0.4em] uppercase">
              Name Every Player You Know
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="capcrunch-panel p-4"
        >
          <label className="block capcrunch-kicker text-[10px] text-white/40 mb-2 tracking-[0.3em] uppercase">
            Your Name
          </label>
          <input
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="w-full p-3 bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#d4af37] transition-colors capcrunch-kicker"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="capcrunch-panel p-4 text-center"
        >
          <div className="capcrunch-kicker text-[10px] text-white/40 mb-2 tracking-[0.3em] uppercase">
            How It Works
          </div>
          <p className="text-white/60 text-sm capcrunch-kicker leading-relaxed">
            Name as many sports players as you can with your friends. No roster — just your memory.
            Fuzzy matching groups similar entries automatically.
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-red-900/30 border border-red-700 text-red-400 text-sm text-center capcrunch-kicker"
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
          className="w-full py-4 capcrunch-title text-xl tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#d4af37] hover:bg-[#c4a030] text-black"
        >
          {isLoading ? 'Creating...' : 'Start Roll Call'}
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-center text-white/30 text-[10px] pb-4 capcrunch-kicker tracking-widest uppercase"
        >
          <p>You'll get a 6-character code to share</p>
        </motion.div>
      </main>
    </div>
  );
}
