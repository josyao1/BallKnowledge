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
    <div className="min-h-screen flex flex-col home-chalkboard text-white">
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
            <p className="capcrunch-kicker text-[9px] text-white/30">
              {lobby.host_name}'s Game · {players.length}/{lobby.max_players} seated
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-6 space-y-5 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="capcrunch-panel p-6 space-y-4"
        >
          <div className="text-center">
            <div className="capcrunch-kicker text-[10px] text-white/40 mb-2">
              {lobby.sport.toUpperCase()} Roster Challenge
            </div>
            <div className="capcrunch-title text-xl text-white mb-1">Take a Seat</div>
            <div className="capcrunch-kicker text-[10px] text-white/30">Enter your name to join</div>
          </div>

          <input
            type="text"
            value={joinName}
            onChange={e => setJoinName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && onJoin()}
            className="w-full p-3 bg-black/40 border border-white/20 text-white focus:outline-none focus:border-[#FDF100] transition-colors capcrunch-kicker"
          />

          {joinError && (
            <div className="p-2 bg-red-900/30 border border-red-700 text-red-400 text-sm text-center capcrunch-kicker">
              {joinError}
            </div>
          )}

          <button
            onClick={onJoin}
            disabled={!joinName.trim() || isJoining}
            className="w-full py-4 capcrunch-btn-primary capcrunch-title text-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="capcrunch-kicker text-[10px] text-white/30 mb-2">Already Seated</div>
            <div className="flex flex-wrap justify-center gap-2">
              {players.map(p => (
                <span key={p.player_id} className="px-3 py-1 bg-black/40 border border-white/10 capcrunch-kicker text-sm text-white/60">
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
