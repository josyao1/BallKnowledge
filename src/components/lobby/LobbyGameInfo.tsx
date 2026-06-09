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
  onToggleSettings?: () => void;
}

export function LobbyGameInfo({ lobby, players, isHost, onToggleSettings }: Props) {
  const cs = (lobby.career_state as any) || {};
  const showTimer = lobby.game_type !== 'career'
    && lobby.game_type !== 'scramble'
    && lobby.game_type !== 'lineup-is-right'
    && lobby.game_type !== 'starting-lineup'
    && lobby.game_type !== 'face-reveal'
    && lobby.game_type !== 'top-ten';
  const hasWins = players.some(p => (p.wins ?? 0) > 0);

  return (
    <>
      {/* ── Current game info card ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="capcrunch-panel p-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: game type label + relevant details */}
          <div className="min-w-0">
            {lobby.game_type === 'scramble' ? (
              <>
                <div className="capcrunch-kicker text-[9px] text-white/40 mb-0.5">
                  {lobby.sport.toUpperCase()} Name Scramble
                </div>
                <div className="capcrunch-title text-xl text-[#3b82f6]">Name Scramble</div>
                <div className="capcrunch-kicker text-[9px] text-white/40">
                  First to {cs?.win_target ?? '?'} pts
                </div>
              </>
            ) : lobby.game_type === 'career' ? (
              <>
                <div className="capcrunch-kicker text-[9px] text-white/40 mb-0.5">
                  {lobby.sport.toUpperCase()} Career Mode
                </div>
                <div className="capcrunch-title text-xl text-[#70BE5B]">Guess the Career</div>
                <div className="capcrunch-kicker text-[9px] text-white/40">
                  First to {cs?.win_target ?? '?'} wins
                </div>
              </>
            ) : lobby.game_type === 'lineup-is-right' ? (
              <>
                <div className="capcrunch-kicker text-[9px] text-white/40 mb-0.5">
                  {lobby.sport.toUpperCase()} Cap Crunch
                </div>
                <div className="capcrunch-title text-xl text-[#E2008A]">Cap Crunch</div>
                <div className={`capcrunch-kicker text-[9px] ${cs?.hardMode ? 'text-red-400' : 'text-white/40'}`}>
                  {cs?.hardMode ? 'Hard Mode' : 'Normal Mode'}
                </div>
              </>
            ) : lobby.game_type === 'box-score' ? (
              <>
                <div className="capcrunch-kicker text-[9px] text-white/40 mb-0.5">NFL Box Score</div>
                <div className="capcrunch-title text-xl text-[#f59e0b]">Box Score</div>
                <div className="capcrunch-kicker text-[9px] text-white/40">
                  {cs?.min_year || 2015}–{cs?.max_year || 2025}
                  {cs?.team ? ` · ${cs.team}` : ''}
                </div>
              </>
            ) : lobby.game_type === 'starting-lineup' ? (
              <>
                <div className="capcrunch-kicker text-[9px] text-white/40 mb-0.5">
                  {(cs?.sport || 'nfl').toUpperCase()} Starting Lineup
                </div>
                <div className="capcrunch-title text-xl text-[#ea580c]">Starters</div>
                <div className="capcrunch-kicker text-[9px] text-white/40">
                  First to {cs?.win_target ?? '?'} pts
                </div>
              </>
            ) : lobby.game_type === 'face-reveal' ? (
              <>
                <div className="capcrunch-kicker text-[9px] text-white/40 mb-0.5">
                  {(cs?.sport || lobby.sport || 'nba').toUpperCase()} Face Reveal
                </div>
                <div className="capcrunch-title text-xl text-[#06b6d4]">Face Reveal</div>
                <div className="capcrunch-kicker text-[9px] text-white/40">
                  First to {cs?.win_target ?? '?'} pts
                </div>
              </>
            ) : lobby.game_type === 'top-ten' ? (
              <>
                <div className="capcrunch-kicker text-[9px] text-white/40 mb-0.5">
                  {(cs?.top_ten_sport || 'nba').toUpperCase()} Top Ten
                </div>
                <div className="capcrunch-title text-xl text-[#70BE5B]">Top Ten</div>
                <div className="capcrunch-kicker text-[9px] text-white/40">
                  {cs?.top_ten_round_type === 'division' ? 'Division Mode' : 'League Mode'}
                  {cs?.top_ten_sport === 'nba' || cs?.top_ten_sport === 'nfl'
                    ? ` · ${cs?.top_ten_min_year ?? ''}–${cs?.top_ten_max_year ?? ''}`
                    : ''}
                  {cs?.max_strikes ? ` · ${cs.max_strikes} strike${cs.max_strikes > 1 ? 's' : ''}` : ''}
                </div>
              </>
            ) : (
              /* Roster mode */
              <>
                <div className="capcrunch-kicker text-[9px] text-white/40 mb-0.5">
                  {lobby.sport.toUpperCase()} Roster Challenge
                </div>
                {lobby.game_mode === 'random' ? (
                  <div>
                    <div className="capcrunch-title text-xl text-[#FDF100]">Mystery Deck</div>
                    <div className="capcrunch-kicker text-[9px] text-white/40">
                      {lobby.selection_scope === 'division' ? 'Division Mode · ' : ''}
                      {lobby.min_year || 2000}–{lobby.max_year || 2025}
                    </div>
                  </div>
                ) : (
                  <div className="capcrunch-title text-xl text-[#FDF100]">
                    {lobby.team_abbreviation} · {lobby.season}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: timer + settings gear */}
          <div className="flex flex-col items-start gap-3 sm:items-end sm:text-right">
            {showTimer && (
              <div className="text-left sm:text-right">
                <div className="capcrunch-kicker text-[9px] text-white/40 mb-0.5">Timer</div>
                <div className="capcrunch-title text-2xl text-white">
                  {Math.floor(lobby.timer_duration / 60)}:{String(lobby.timer_duration % 60).padStart(2, '0')}
                </div>
              </div>
            )}
            {isHost && onToggleSettings && (
              <button
                onClick={onToggleSettings}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2 border border-white/20 hover:border-[#FDF100] hover:text-[#FDF100] transition-colors"
                title="Game Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="capcrunch-kicker text-[10px]">Game Settings</span>
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
          className="capcrunch-panel border-[#FDF100]/20 p-4"
        >
          <div className="capcrunch-kicker text-[9px] text-[#FDF100]/60 mb-3 text-center">
            Session Wins
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
            {[...players]
              .sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0))
              .map(player => (
                <div
                  key={player.player_id}
                  className="flex items-center gap-2 px-3 py-2 bg-black/30 border border-white/10 min-w-0"
                >
                  <span className="sports-font text-sm text-white/80 truncate">{player.player_name}</span>
                  <span className="capcrunch-title text-lg text-[#FDF100]">{player.wins ?? 0}</span>
                </div>
              ))}
          </div>
        </motion.div>
      )}
    </>
  );
}
