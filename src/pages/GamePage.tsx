import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useLobbyStore } from '../stores/lobbyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import { PlayerInput } from '../components/game/PlayerInput';
import { GuessedPlayersList } from '../components/game/GuessedPlayersList';
import { TeamDisplay } from '../components/game/TeamDisplay';
import { LiveScoreboard } from '../components/multiplayer/LiveScoreboard';
import { fetchTeamRecord } from '../services/api';
import { fetchNFLTeamRecord } from '../services/nfl-api';
import { getTeammateGuessedPlayers, TEAM_COLORS } from '../utils/teamUtils';

export function GamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMultiplayer = location.state?.multiplayer || false;
  const lobbyCode = useLobbyStore((state) => state.lobby?.join_code);
  const lobbyId = useLobbyStore((state) => state.lobby?.id);

  // Store lobby ID in a ref so we always have it even if store's lobby becomes null
  const lobbyIdRef = useRef<string | null>(null);
  if (lobbyId) {
    lobbyIdRef.current = lobbyId;
  }

  const {
    selectedTeam,
    selectedSeason,
    status,
    timeRemaining,
    currentRoster,
    pendingGuesses,
    guessedPlayers,
    incorrectGuesses,
    score,
    hideResultsDuringGame,
    startGame,
    endGame,
    processGuesses,
    tick,
  } = useGameStore();

  const { lobby, players, currentPlayerId, syncScore, endGame: endLobbyGame } = useLobbyStore();
  useLobbySubscription(isMultiplayer ? lobby?.id || null : null);

  // Team mode: compute teammate guesses for blocking and display
  const currentPlayerData = players.find(p => p.player_id === currentPlayerId);
  const currentPlayerTeamNumber = currentPlayerData?.team_number ?? null;
  const teammateGuessedNames = useMemo(() => {
    if (!isMultiplayer || currentPlayerTeamNumber == null) return [];
    return getTeammateGuessedPlayers(players, currentPlayerId, currentPlayerTeamNumber);
  }, [isMultiplayer, players, currentPlayerId, currentPlayerTeamNumber]);

  const showSeasonHints = useSettingsStore((state) => state.showSeasonHints);
  const [teamRecord, setTeamRecord] = useState<string | null>(null);

  // SHOT CLOCK LOGIC
  const isShotClockActive = timeRemaining <= 5 && timeRemaining > 0 && status === 'playing';

  useEffect(() => {
    if (!showSeasonHints || !selectedTeam || !selectedSeason) return;
    const fetchRecord = async () => {
      const isNFL = !selectedSeason.includes('-');
      try {
        if (isNFL) {
          const record = await fetchNFLTeamRecord(selectedTeam.abbreviation, parseInt(selectedSeason));
          setTeamRecord(record?.record || null);
        } else {
          const record = await fetchTeamRecord(selectedTeam.abbreviation, selectedSeason);
          setTeamRecord(record?.record || null);
        }
      } catch (error) { console.error(error); }
    };
    fetchRecord();
  }, [showSeasonHints, selectedTeam, selectedSeason]);

  const lastSyncRef = useRef({ score: 0, count: 0 });

  useEffect(() => {
    if (!isMultiplayer || !lobby) return;

    const currentScore = score;
    const currentCount = guessedPlayers.length;

    if (lastSyncRef.current.score !== currentScore || lastSyncRef.current.count !== currentCount) {
      lastSyncRef.current = { score: currentScore, count: currentCount };
      const timeout = setTimeout(() => {
        syncScore(currentScore, currentCount, guessedPlayers.map(p => p.name), incorrectGuesses, false, lobbyIdRef.current || undefined);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [score, guessedPlayers, incorrectGuesses, isMultiplayer, lobby, syncScore]);

  useEffect(() => { if (!selectedTeam || !selectedSeason) navigate('/'); }, [selectedTeam, selectedSeason, navigate]);
  useEffect(() => { if (status === 'idle' && selectedTeam) startGame(); }, [status, selectedTeam, startGame]);
  
  useEffect(() => {
    if (status !== 'playing') return;
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval);
  }, [status, tick]);

  useEffect(() => { if (timeRemaining <= 0 && status === 'playing') endGame(); }, [timeRemaining, status, endGame]);

  useEffect(() => {
    if (status === 'ended') {
      if (hideResultsDuringGame) processGuesses();
      if (isMultiplayer && lobbyCode) {
        const finishGame = async () => {
          const guessedNames = guessedPlayers.map(p => p.name);
          // Mark this player as finished and sync final score with incorrect guesses
          // Pass lobbyIdRef.current as fallback in case store's lobby becomes null
          await syncScore(score, guessedPlayers.length, guessedNames, incorrectGuesses, true, lobbyIdRef.current || undefined);
          // This will only set lobby to finished if all players are done
          await endLobbyGame();
          navigate(`/lobby/${lobbyCode}/results`);
        };
        finishGame();
      } else {
        navigate('/results');
      }
    }
  }, [status, navigate, hideResultsDuringGame, processGuesses, isMultiplayer, lobbyCode, score, guessedPlayers, incorrectGuesses, syncScore, endLobbyGame]);

  if (!selectedTeam || !selectedSeason) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} 
      animate={{ 
        opacity: 1,
        backgroundColor: isShotClockActive ? ['#0d2a0b', '#3b0a0a', '#0d2a0b'] : '#0d2a0b',
      }}
      transition={isShotClockActive ? { duration: 0.5, repeat: Infinity, ease: "linear" } : { duration: 0.5 }}
      className="min-h-screen text-white flex flex-col relative overflow-hidden"
    >
      {/* GHOST SHOT CLOCK (Center of Pit) */}
      <AnimatePresence>
        {isShotClockActive && (
          <motion.div
            key="shot-clock"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
          >
            <span className="retro-title text-[28rem] md:text-[45rem] text-red-600/10 select-none leading-none">
              {timeRemaining}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GREEN FELT BACKGROUND */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `url("https://www.transparenttextures.com/patterns/felt.png")`,
          background: `radial-gradient(circle, #2d5a27 0%, #0d2a0b 100%)`
        }}
      />

      <header className="relative z-10 p-6 border-b-2 border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-8">
            <TeamDisplay team={selectedTeam} season={selectedSeason} record={showSeasonHints ? teamRecord : null} />
            <div className="h-10 w-[1px] bg-white/20 hidden md:block" />

            {/* RESPONSIVE TIMER DESIGN */}
            <div className="flex flex-col items-center">
                <span className="sports-font text-[9px] text-white/40 tracking-[0.4em] uppercase mb-1">Clock</span>
                <div className={`retro-title text-3xl transition-colors duration-300 ${isShotClockActive ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                </div>
            </div>
          </div>

          {/* THREE MECHANICAL SCORE PANELS */}
          <div className="flex gap-4">
            <div className="bg-[#111] border-2 border-[#333] px-6 py-3 rounded-sm text-center min-w-[100px]">
              <div className="sports-font text-[9px] text-white/40 tracking-[0.3em] uppercase mb-1">Banked</div>
              <div className="retro-title text-3xl text-white">
                {hideResultsDuringGame ? '?' : score}
              </div>
            </div>
            <div className="bg-[#111] border-2 border-[#333] px-6 py-3 rounded-sm text-center min-w-[100px]">
              <div className="sports-font text-[9px] text-white/40 tracking-[0.3em] uppercase mb-1">Found</div>
              <div className="retro-title text-3xl text-white">
                {hideResultsDuringGame ? pendingGuesses.length : guessedPlayers.length}
              </div>
            </div>
            <div className="bg-[#111] border-2 border-[#333] px-6 py-3 rounded-sm text-center min-w-[100px]">
              <div className="sports-font text-[9px] text-white/40 tracking-[0.3em] uppercase mb-1">Roster</div>
              <div className="retro-title text-3xl text-white/40">
                {currentRoster.length}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col md:flex-row gap-8 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="mb-8">
            <PlayerInput teammateGuessedNames={teammateGuessedNames} />
          </div>

          <div className="flex-1 bg-black/60 border-2 border-white/10 rounded-sm flex flex-col overflow-hidden">
            <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <span className="sports-font text-[10px] tracking-[0.4em] text-white/60 uppercase">
                Active Ledger
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <GuessedPlayersList
                guessedPlayers={guessedPlayers}
                incorrectGuesses={incorrectGuesses}
                pendingGuesses={hideResultsDuringGame ? pendingGuesses : []}
                hideResults={hideResultsDuringGame}
              />
            </div>
          </div>

          {/* Teammate guesses - visible when on a team */}
          {isMultiplayer && currentPlayerTeamNumber != null && teammateGuessedNames.length > 0 && (
            <div className="mt-4 bg-black/60 border-2 border-white/10 rounded-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: TEAM_COLORS[currentPlayerTeamNumber - 1].bg }}
                />
                <span className="sports-font text-[10px] text-white/40 tracking-[0.3em] uppercase">
                  Teammate Guesses ({teammateGuessedNames.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {teammateGuessedNames.map((name, idx) => (
                  <span
                    key={`tm-${idx}`}
                    className="px-2.5 py-1 rounded-sm sports-font text-[10px] font-bold uppercase tracking-wider border"
                    style={{
                      backgroundColor: TEAM_COLORS[currentPlayerTeamNumber - 1].bg + '20',
                      borderColor: TEAM_COLORS[currentPlayerTeamNumber - 1].bg + '40',
                      color: TEAM_COLORS[currentPlayerTeamNumber - 1].bg,
                    }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!isMultiplayer && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => endGame()}
                className="retro-title text-xs tracking-widest text-white/30 hover:text-white transition-all uppercase"
              >
                // Terminate Session
              </button>
            </div>
          )}
        </div>

        {isMultiplayer && players.length > 0 && (
          <aside className="w-full md:w-72 flex-shrink-0">
             <div className="bg-black/60 border-2 border-white/10 rounded-sm p-4 h-full">
                <h3 className="retro-title text-xs text-white/40 tracking-[0.3em] uppercase mb-6 text-center">Live Pit</h3>
                <LiveScoreboard
                  players={players}
                  currentPlayerId={currentPlayerId}
                  rosterSize={currentRoster.length}
                />
             </div>
          </aside>
        )}
      </main>
    </motion.div>
  );
}