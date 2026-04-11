/**
 * LobbyGameInfo.tsx — Game info card shown at the top of the waiting room.
 *
 * Displays the current game type, relevant metadata (team/season, win target,
 * hard mode, etc.), and an optional timer. Also renders the session wins
 * scoreboard when any player has wins.
 *
 * The host settings gear button lives here so it's visually attached to the
 * game info rather than floating elsewhere.
 */

import { motion } from 'framer-motion';

interface Player {
  player_id: string;
  player_name: string;
  wins?: number;
}

interface Lobby {
  game_type: string;
  game_mode: string;
  sport: string;
  team_abbreviation: string;
  season: string;
  timer_duration: number;
  min_year?: number;
  max_year?: number;
  selection_scope?: string;
  career_state?: unknown;
}

interface Props {
  lobby: Lobby;
  players: Player[];
  isHost: boolean;
  onToggleSettings: () => void;
}

export function LobbyGameInfo({ lobby, players, isHost, onToggleSettings }: Props) {
  const cs = (lobby.career_state as any) || {};
  const showTimer = lobby.game_type !== 'career'
    && lobby.game_type !== 'scramble'
    && lobby.game_type !== 'lineup-is-right'
    && lobby.game_type !== 'starting-lineup';
  const hasWins = players.some(p => (p.wins || 0) > 0);

  return (
    <>
      {/* ── Current game info card ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/50 border border-white/10 rounded-sm p-4"
      >
        <div className="flex items-center justify-between">
          {/* Left: game type label + relevant details */}
          <div>
            {lobby.game_type === 'scramble' ? (
              <>
                <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                  {lobby.sport.toUpperCase()} Name Scramble
                </div>
                <div className="retro-title text-xl text-[#3b82f6]">Name Scramble</div>
                <div className="sports-font text-[9px] text-white/40 tracking-widest">
                  First to {cs?.win_target ?? '?'} pts
                </div>
              </>
            ) : lobby.game_type === 'career' ? (
              <>
                <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                  {lobby.sport.toUpperCase()} Career Mode
                </div>
                <div className="retro-title text-xl text-[#22c55e]">Guess the Career</div>
                <div className="sports-font text-[9px] text-white/40 tracking-widest">
                  First to {cs?.win_target ?? '?'} wins
                </div>
              </>
            ) : lobby.game_type === 'lineup-is-right' ? (
              <>
                <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                  {lobby.sport.toUpperCase()} Cap Crunch
                </div>
                <div className="retro-title text-xl text-[#ec4899]">Cap Crunch</div>
                <div className={`sports-font text-[9px] tracking-widest ${cs?.hardMode ? 'text-red-400' : 'text-white/40'}`}>
                  {cs?.hardMode ? 'Hard Mode' : 'Normal Mode'}
                </div>
              </>
            ) : lobby.game_type === 'box-score' ? (
              <>
                <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">NFL Box Score</div>
                <div className="retro-title text-xl text-[#f59e0b]">Box Score</div>
                <div className="sports-font text-[9px] text-white/40 tracking-widest">
                  {cs?.min_year || 2015}–{cs?.max_year || 2024}
                  {cs?.team ? ` · ${cs.team}` : ''}
                </div>
              </>
            ) : lobby.game_type === 'starting-lineup' ? (
              <>
                <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                  {(cs?.sport || 'nfl').toUpperCase()} Starting Lineup
                </div>
                <div className="retro-title text-xl text-[#ea580c]">Starters</div>
                <div className="sports-font text-[9px] text-white/40 tracking-widest">
                  First to {cs?.win_target ?? '?'} pts
                </div>
              </>
            ) : (
              /* Roster mode */
              <>
                <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                  {lobby.sport.toUpperCase()} Roster Challenge
                </div>
                {lobby.game_mode === 'random' ? (
                  <div>
                    <div className="retro-title text-xl text-[#d4af37]">Mystery Deck</div>
                    <div className="sports-font text-[9px] text-white/40 tracking-widest">
                      {lobby.selection_scope === 'division' ? 'Division Mode • ' : ''}
                      {lobby.min_year || 2000} - {lobby.max_year || 2025}
                    </div>
                  </div>
                ) : (
                  <div className="retro-title text-xl text-[#d4af37]">
                    {lobby.team_abbreviation} • {lobby.season}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: timer + settings gear */}
          <div className="flex items-center gap-4">
            {showTimer && (
              <div className="text-right">
                <div className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">Timer</div>
                <div className="retro-title text-2xl text-white">
                  {Math.floor(lobby.timer_duration / 60)}:{String(lobby.timer_duration % 60).padStart(2, '0')}
                </div>
              </div>
            )}
            {isHost && (
              <button
                onClick={onToggleSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-white/20 rounded-sm hover:border-[#d4af37] hover:text-[#d4af37] transition-colors"
                title="Game Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="sports-font text-[10px] tracking-widest uppercase">Game Settings</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Session wins scoreboard ── */}
      {hasWins && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/50 border border-[#d4af37]/30 rounded-sm p-4"
        >
          <div className="sports-font text-[10px] text-[#d4af37] mb-3 tracking-[0.3em] uppercase text-center">
            Session Wins
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {[...players]
              .sort((a, b) => (b.wins || 0) - (a.wins || 0))
              .map(player => (
                <div
                  key={player.player_id}
                  className="flex items-center gap-2 px-3 py-2 bg-black/30 rounded-sm border border-white/10"
                >
                  <span className="sports-font text-sm text-white/80">{player.player_name}</span>
                  <span className="retro-title text-lg text-[#d4af37]">{player.wins || 0}</span>
                </div>
              ))}
          </div>
        </motion.div>
      )}
    </>
  );
}
