import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { getStoredPlayerName } from '../services/lobby';

export function LobbyJoinPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code?: string }>();
  const { joinLobbyByCode, isLoading, error } = useLobbyStore();

  const [playerName, setPlayerName] = useState(getStoredPlayerName() || '');
  const [joinCode, setJoinCode] = useState(code?.toUpperCase() || '');

  // Format code input (uppercase, no spaces)
  const handleCodeChange = (value: string) => {
    const formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setJoinCode(formatted);
  };

  const canJoin = playerName.trim() && joinCode.length === 6;

  const handleJoin = async () => {
    if (!canJoin) return;

    const success = await joinLobbyByCode(joinCode, playerName.trim());
    if (success) {
      navigate(`/lobby/${joinCode}`);
    }
  };

  // Auto-join if code provided in URL
  useEffect(() => {
    if (code && playerName.trim() && code.length === 6) {
      // Don't auto-join, let user confirm name
    }
  }, [code, playerName]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-6 border-b-4 border-[#333]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="retro-title text-3xl text-[var(--nba-orange)]">
            Join Lobby
          </h1>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-md mx-auto w-full p-6 space-y-6">
        {/* Your name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="scoreboard-panel p-4"
        >
          <label className="block sports-font text-sm text-[#888] mb-2 tracking-widest">
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full p-3 bg-[#1a1a1a] rounded-lg border-2 border-[#3d3d3d] text-[var(--vintage-cream)] focus:outline-none focus:border-[var(--nba-orange)]"
          />
        </motion.div>

        {/* Join code */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="scoreboard-panel p-4"
        >
          <label className="block sports-font text-sm text-[#888] mb-2 tracking-widest">
            Lobby Code
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="XXXXXX"
            maxLength={6}
            className="w-full p-4 bg-[#1a1a1a] rounded-lg border-2 border-[#3d3d3d] text-center text-3xl font-mono tracking-[0.5em] text-[var(--vintage-cream)] focus:outline-none focus:border-[var(--nba-orange)] uppercase"
          />
          <p className="text-center text-[#666] text-xs mt-2">
            Enter the 6-character code from your host
          </p>
        </motion.div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm text-center"
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
          className="w-full py-4 rounded-lg sports-font text-lg tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--nba-orange)] text-white"
          style={{ opacity: canJoin ? 1 : 0.5 }}
        >
          {isLoading ? 'Joining...' : 'Join Lobby'}
        </motion.button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-[#333]"></div>
          <span className="text-[#666] text-sm">or</span>
          <div className="flex-1 h-px bg-[#333]"></div>
        </div>

        {/* Create lobby link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={() => navigate('/lobby/create')}
          className="w-full py-3 rounded-lg sports-font tracking-wider border-2 border-[#3d3d3d] text-[#888] hover:border-[#555] hover:text-[var(--vintage-cream)] transition-all"
        >
          Create New Lobby
        </motion.button>
      </main>
    </div>
  );
}
