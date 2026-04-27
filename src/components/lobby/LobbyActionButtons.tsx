/**
 * LobbyActionButtons.tsx — Ready toggle, start/force-start buttons, and
 * the "How to Play" explainer for the current game mode.
 *
 * Start button visibility and copy depend on the current game_type. The
 * parent provides one handler per game type; this component just wires the
 * correct one based on lobby.game_type.
 */

import { motion } from 'framer-motion';

interface Player {
  player_id: string;
  is_ready: boolean;
}

interface CurrentPlayer extends Player {
  player_name: string;
}

interface Lobby {
  game_type: string;
  status: string;
}

interface Props {
  lobby: Lobby;
  players: Player[];
  currentPlayer: CurrentPlayer | undefined;
  isHost: boolean;
  isLoadingRoster: boolean;
  allReady: boolean;
  onReadyToggle: () => void;
  onManualStart: () => void;
  onCareerStart: () => void;
  onScrambleStart: () => void;
  onLineupStart: () => void;
  onBoxScoreStart: () => void;
  onStartingLineupStart: () => void;
}

export function LobbyActionButtons({
  lobby, players, currentPlayer, isHost, isLoadingRoster, allReady,
  onReadyToggle, onManualStart, onCareerStart, onScrambleStart,
  onLineupStart, onBoxScoreStart, onStartingLineupStart,
}: Props) {
  const readyCount = players.filter(p => p.is_ready).length;
  const allPlayersReady = players.every(p => p.is_ready);
  const canForceStart = isHost && players.length >= 2 && !allPlayersReady && lobby.status === 'waiting';

  // Map game type to start handler, button label, and color classes
  const gameStartConfig: Record<string, { onStart: () => void; label: string; loadingLabel: string; btnClass: string; forceHoverClass: string }> = {
    scramble: {
      onStart: onScrambleStart,
      label: 'Start Name Scramble',
      loadingLabel: 'Loading Player...',
      btnClass: 'bg-gradient-to-b from-[#3b82f6] to-[#2563eb] text-white shadow-[0_4px_0_#1d4ed8]',
      forceHoverClass: 'hover:border-orange-500 hover:text-orange-400',
    },
    career: {
      onStart: onCareerStart,
      label: 'Start Career Mode',
      loadingLabel: 'Loading Player...',
      btnClass: 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_4px_0_#166534]',
      forceHoverClass: 'hover:border-orange-500 hover:text-orange-400',
    },
    'lineup-is-right': {
      onStart: onLineupStart,
      label: 'Start Cap Crunch',
      loadingLabel: 'Loading Game...',
      btnClass: 'bg-gradient-to-b from-[#ec4899] to-[#be185d] text-white shadow-[0_4px_0_#831843]',
      forceHoverClass: 'hover:border-orange-500 hover:text-orange-400',
    },
    'box-score': {
      onStart: onBoxScoreStart,
      label: 'Start Box Score',
      loadingLabel: 'Loading Game...',
      btnClass: 'bg-gradient-to-b from-[#f59e0b] to-[#d97706] text-black shadow-[0_4px_0_#92400e]',
      forceHoverClass: 'hover:border-orange-500 hover:text-orange-400',
    },
    'starting-lineup': {
      onStart: onStartingLineupStart,
      label: 'Start Starting Lineup',
      loadingLabel: 'Loading...',
      btnClass: 'bg-gradient-to-b from-[#ea580c] to-[#c2410c] text-white shadow-[0_4px_0_#9a3412]',
      forceHoverClass: 'hover:border-[#ea580c] hover:text-orange-400',
    },
  };

  const config = gameStartConfig[lobby.game_type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-3"
    >
      {/* Ready toggle */}
      {currentPlayer && (
        <button
          onClick={onReadyToggle}
          disabled={isLoadingRoster || lobby.status === 'countdown'}
          className={`w-full py-4 rounded-sm retro-title text-lg tracking-wider transition-all disabled:opacity-50 ${
            currentPlayer.is_ready
              ? 'bg-emerald-900/50 text-emerald-300 border-2 border-emerald-700/60'
              : 'bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] text-black shadow-[0_4px_0_#a89860] active:shadow-none active:translate-y-1 hover:from-[#fdf0d5] hover:to-[#e0ceaa]'
          }`}
        >
          {isLoadingRoster ? 'Starting...' : currentPlayer.is_ready ? '✓ Ready' : 'Ready Up'}
        </button>
      )}

      {/* Roster mode: deal cards / force start */}
      {!config && (
        <>
          {isHost && allReady && lobby.status === 'waiting' && (
            <button
              onClick={onManualStart}
              disabled={isLoadingRoster}
              className="w-full py-4 rounded-sm retro-title text-lg tracking-wider transition-all bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_4px_0_#166534] active:shadow-none active:translate-y-1"
            >
              Deal Cards
            </button>
          )}
          {canForceStart && (
            <button
              onClick={onManualStart}
              disabled={isLoadingRoster}
              className="w-full py-3 rounded-sm sports-font text-sm tracking-wider transition-all bg-black/50 text-white/50 border border-white/20 hover:border-orange-500 hover:text-orange-400"
            >
              Force Start ({readyCount}/{players.length} ready)
            </button>
          )}
        </>
      )}

      {/* Other game modes: start / force start */}
      {config && (
        <>
          {isHost && allPlayersReady && lobby.status === 'waiting' && (
            <button
              onClick={config.onStart}
              disabled={isLoadingRoster}
              className={`w-full py-4 rounded-sm retro-title text-lg tracking-wider transition-all active:shadow-none active:translate-y-1 disabled:opacity-50 ${config.btnClass}`}
            >
              {isLoadingRoster ? config.loadingLabel : config.label}
            </button>
          )}
          {canForceStart && (
            <button
              onClick={config.onStart}
              disabled={isLoadingRoster}
              className={`w-full py-3 rounded-sm sports-font text-sm tracking-wider transition-all bg-black/50 text-white/50 border border-white/20 ${config.forceHoverClass}`}
            >
              Force Start ({readyCount}/{players.length} ready)
            </button>
          )}
        </>
      )}

      {/* Waiting for more players */}
      {players.length < 2 && (
        <p className="text-center text-white/30 text-sm sports-font tracking-widest">
          Share the code above to invite players
        </p>
      )}

      {/* How to Play */}
      <div className="mt-4 bg-black/40 border border-white/10 rounded-sm p-4">
        <p className="sports-font text-[9px] text-[#d4af37] tracking-[0.3em] uppercase mb-3">How to Play</p>
        <HowToPlay gameType={lobby.game_type} />
      </div>

      <p className="text-center text-white/20 text-[10px] sports-font tracking-wider mt-4">
        Tip: If stuck on empty screen, refresh page to rejoin
      </p>
    </motion.div>
  );
}

// ── How to Play copy per game mode ────────────────────────────────────────────

function HowToPlay({ gameType }: { gameType: string }) {
  const prose = 'space-y-2 text-white/50 sports-font text-xs leading-relaxed';

  if (gameType === 'roster') return (
    <div className={prose}>
      <p>A team and season are randomly selected. Players on that roster are shuffled into a deck of cards.</p>
      <p>Each round a card is revealed — guess the player before the timer runs out to score a point.</p>
      <p>Cards show hints like position, jersey number, and stats. The faster you buzz in, the better.</p>
      <p className="text-[#d4af37]/60">🏆 Most correct guesses wins.</p>
    </div>
  );

  if (gameType === 'career') return (
    <div className={prose}>
      <p>A mystery player is chosen. Their career stats are revealed year by year — team, stats, season.</p>
      <p>Players race to identify the mystery player. Buzz in early for more points, but a wrong guess costs you.</p>
      <p>The fewer clues revealed when you guess correctly, the higher your score.</p>
      <p className="text-[#d4af37]/60">🏆 Most points across all rounds wins.</p>
    </div>
  );

  if (gameType === 'scramble') return (
    <div className={prose}>
      <p>A player's name is scrambled on screen. Type the correct name to score a point.</p>
      <p>Multiple rounds — first to unscramble each name scores. Speed matters.</p>
      <p>You can pass on a name if you're stuck, but the point goes to whoever gets it first.</p>
      <p className="text-[#d4af37]/60">🏆 Most unscrambled names wins.</p>
    </div>
  );

  if (gameType === 'box-score') return (
    <div className={prose}>
      <p>A real NFL game's box score is shown with all player names blacked out.</p>
      <p>Fill in the names from memory — QBs, rushers, and receivers for both teams — within the time limit.</p>
      <p>Use the search bar to find players and confirm matches. Correct guesses light up green.</p>
      <p>You can also guess the Vegas spread for a bonus point.</p>
      <p className="text-[#f59e0b]/60">🏆 Most correct player names wins.</p>
    </div>
  );

  if (gameType === 'lineup-is-right') return (
    <div className={prose}>
      <p>Each round everyone sees the same random team and a stat category. Teams can be a single franchise, a division, or a college + pro conference combo (e.g. SEC players who played in the AFC).</p>
      <p>Search for any player and pick a season — their stat for that year adds to your running total.</p>
      <p>If the stat is <span className="text-white/70">Total GP</span>, pick any player and their entire career GP with that team counts — no year needed.</p>
      <p>A pick that pushes you over the cap <span className="text-red-400">busts</span> — it scores 0 and your total reverts. You still play all 5 rounds.</p>
      <p>You <span className="text-white/70">cannot repeat a player</span> across rounds.</p>
      <p className="text-[#d4af37]/60">🏆 Closest to the target without busting wins. Tiebreaker: fewest busts, then oldest average pick year.</p>
    </div>
  );

  if (gameType === 'starting-lineup') return (
    <div className={prose}>
      <p>A team's starting lineup is shown on a field or court — players hidden as college logos, jersey numbers, or draft picks.</p>
      <p>Race to type the correct team name. Wrong guesses lock you out until everyone else is also wrong, then everyone unlocks.</p>
      <p>Fewest wrong answers wins each round. Ties broken by who guessed first.</p>
      <p className="text-[#16a34a]/70">🏆 First to the win target takes the match.</p>
    </div>
  );

  return null;
}
