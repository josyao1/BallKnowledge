/**
 * LobbyJoinPrompt.tsx — Full-screen join form for players who arrive via
 * direct link before they've been added to the lobby.
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface Props {
  lobby: {
    host_name: string;
    max_players: number;
    sport: string;
  };
  players: { player_id: string; player_name: string; is_host: boolean }[];
  joinName: string;
  setJoinName: (n: string) => void;
  isJoining: boolean;
  joinError: string | null;
  onJoin: () => void;
}

export function LobbyJoinPrompt({ lobby, players, joinName, setJoinName, isJoining, joinError, onJoin }: Props) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-[#0d2a0b] text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)' }}
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
            <h1 className="retro-title text-3xl text-[#d4af37]">Join Table</h1>
            <p className="sports-font text-[9px] text-white/30 tracking-[0.4em] uppercase">
              {lobby.host_name}'s Game • {players.length}/{lobby.max_players} seated
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-md mx-auto w-full p-6 space-y-5 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/50 border border-white/10 rounded-sm p-6 space-y-4"
        >
          <div className="text-center">
            <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase mb-2">
              {lobby.sport.toUpperCase()} Roster Challenge
            </div>
            <div className="retro-title text-xl text-[#d4af37] mb-1">Take a Seat</div>
            <div className="sports-font text-[10px] text-white/30 tracking-wider">Enter your name to join</div>
          </div>

          <input
            type="text"
            value={joinName}
            onChange={e => setJoinName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && onJoin()}
            className="w-full p-3 bg-[#111] rounded-sm border-2 border-white/20 text-white focus:outline-none focus:border-[#d4af37] transition-colors sports-font"
          />

          {joinError && (
            <div className="p-2 bg-red-900/30 border border-red-700 rounded-sm text-red-400 text-sm text-center sports-font">
              {joinError}
            </div>
          )}

          <button
            onClick={onJoin}
            disabled={!joinName.trim() || isJoining}
            className="w-full py-4 rounded-sm retro-title text-xl tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1"
          >
            {isJoining ? 'Joining...' : 'Take a Seat'}
          </button>
        </motion.div>

        {players.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center space-y-2"
          >
            <div className="sports-font text-[10px] text-white/30 tracking-[0.3em] uppercase">Already Seated</div>
            <div className="flex flex-wrap justify-center gap-2">
              {players.map(p => (
                <span key={p.player_id} className="px-3 py-1 bg-black/40 border border-white/10 rounded-sm sports-font text-sm text-white/60">
                  {p.is_host && '★ '}{p.player_name}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
