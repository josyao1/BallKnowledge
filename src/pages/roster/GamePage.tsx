/**
 * GamePage.tsx — Main gameplay screen for solo and multiplayer modes.
 *
 * Renders the timer, score panels, player input, and guessed-players list.
 * In multiplayer, maintains a live scoreboard sidebar and syncs scores to
 * the lobby via debounced updates. Navigates to results when the timer ends.
 */

import { useEffect, useRef, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SpinningNumber } from '../../components/capCrunch/SpinningNumber';
import { useGameStore } from '../../stores/gameStore';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { PlayerInput } from '../../components/game/PlayerInput';
import { GuessedPlayersList } from '../../components/game/GuessedPlayersList';
import { TeamDisplay } from '../../components/game/TeamDisplay';
import { LiveScoreboard } from '../../components/multiplayer/LiveScoreboard';
import { fetchTeamRoster, fetchStaticNFLRoster, fetchStaticSeasonPlayers, fetchStaticNFLSeasonPlayers } from '../../services/roster';
import { findLobbyByCode, getLobbyPlayers } from '../../services/lobby';
import { teams } from '../../data/teams';
import { nflTeams } from '../../data/nfl-teams';
import { EmoteOverlay } from '../../components/multiplayer/EmoteOverlay';
import { getTeammateGuessedPlayers, TEAM_COLORS } from '../../utils/teamUtils';

export function GamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(location.state?.multiplayer || false);
  const [startedAt, setStartedAt] = useState<string | undefined>(location.state?.startedAt);
  const lobbyCode = useLobbyStore((state) => state.lobby?.join_code);
  const lobbyId = useLobbyStore((state) => state.lobby?.id);

  // Store lobby ID in a ref so we always have it even if the Zustand store's
  // lobby object becomes null during the end-of-game transition. Without this,
  // the final score sync would fail because lobby.id is already gone.
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
    divisionTeams,
    sport,
    timerDuration,
    gameMode,
    startGame,
    endGame,
    processGuesses,
    tick,
    setGameConfig,
    setRoundDeadline,
  } = useGameStore();

  const lobbyDivisionConference = useLobbyStore((state) => state.lobby?.division_conference);
  const lobbyDivisionName = useLobbyStore((state) => state.lobby?.division_name);

  const { lobby, players, currentPlayerId, syncScore, endGame: endLobbyGame } = useLobbyStore();
  useLobbySubscription(isMultiplayer ? lobby?.id || null : null);

  // Team mode: compute teammate guesses for blocking and display
  const currentPlayerData = players.find(p => p.player_id === currentPlayerId);
  const currentPlayerTeamNumber = currentPlayerData?.team_number ?? null;
  const teammateGuessedNames = useMemo(() => {
    if (!isMultiplayer || currentPlayerTeamNumber == null) return [];
    return getTeammateGuessedPlayers(players, currentPlayerId, currentPlayerTeamNumber);
  }, [isMultiplayer, players, currentPlayerId, currentPlayerTeamNumber]);

  // Compute unique guesses: names this player guessed that no other player has guessed
  // Only active in 3+ player multiplayer games with standard (non-hidden) results
  const uniqueGuessNames = useMemo(() => {
    if (!isMultiplayer || players.length < 3 || hideResultsDuringGame) return new Set<string>();
    const myNames = new Set(guessedPlayers.map(p => p.name));
    const otherNames = new Set<string>();
    for (const p of players) {
      if (p.player_id === currentPlayerId) continue;
      for (const name of (p.guessed_players || [])) {
        otherNames.add(name);
      }
    }
    const unique = new Set<string>();
    for (const name of myNames) {
      if (!otherNames.has(name)) unique.add(name);
    }
    return unique;
  }, [isMultiplayer, players, currentPlayerId, guessedPlayers, hideResultsDuringGame]);

  const showSeasonHints = useSettingsStore((state) => state.showSeasonHints);
  const teamRecord = null;

  // Shot clock: activates red pulsing background in the final 5 seconds
  const isShotClockActive = timeRemaining <= 5 && timeRemaining > 0 && status === 'playing';


  const lastSyncRef = useRef({ score: 0, count: 0 });

  useEffect(() => {
    if (!isMultiplayer || !lobby) return;

    const currentScore = score;
    const currentCount = guessedPlayers.length;

    // Debounce score syncs to Supabase (300ms) to avoid flooding during rapid guesses
    if (lastSyncRef.current.score !== currentScore || lastSyncRef.current.count !== currentCount) {
      lastSyncRef.current = { score: currentScore, count: currentCount };
      const timeout = setTimeout(() => {
        syncScore(currentScore, currentCount, guessedPlayers.map(p => p.name), incorrectGuesses, false, lobbyIdRef.current || undefined);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [score, guessedPlayers, incorrectGuesses, isMultiplayer, lobby, syncScore]);

  // On a mid-game reload all Zustand + router state is wiped. Reconstruct from
  // sessionStorage so the player can continue without losing their spot.
  const hasAttemptedRecoveryRef = useRef(false);
  useEffect(() => {
    if (selectedTeam && selectedSeason) return;
    if (hasAttemptedRecoveryRef.current) return;
    hasAttemptedRecoveryRef.current = true;

    const raw = sessionStorage.getItem('bk_roster_mp');
    if (!raw) { navigate('/'); return; }

    const saved = JSON.parse(raw) as {
      code: string; sport: string; team: string; season: string;
      timerDuration: number; startedAt: string;
      scope: string; divConf: string | null; divName: string | null;
    };

    (async () => {
      try {
        const { lobby: freshLobby } = await findLobbyByCode(saved.code);
        if (!freshLobby || freshLobby.status !== 'playing') {
          sessionStorage.removeItem('bk_roster_mp');
          navigate(freshLobby ? `/lobby/${saved.code}` : '/');
          return;
        }

        const { players: freshPlayers } = await getLobbyPlayers(freshLobby.id);
        const teamList = saved.sport === 'nba' ? teams : nflTeams;
        const team = teamList.find(t => t.abbreviation === saved.team);
        if (!team) { navigate('/'); return; }

        let rosterPlayers: any[] = [];
        let leaguePlayers: any[] = [];
        if (saved.sport === 'nba') {
          const result = await fetchTeamRoster(team.abbreviation, saved.season);
          rosterPlayers = result.players;
          leaguePlayers = await fetchStaticSeasonPlayers(saved.season) ?? [];
        } else {
          rosterPlayers = await fetchStaticNFLRoster(team.abbreviation, parseInt(saved.season)) ?? [];
          leaguePlayers = await fetchStaticNFLSeasonPlayers(parseInt(saved.season)) ?? [];
        }

        useLobbyStore.getState().setLobby(freshLobby);
        useLobbyStore.getState().setPlayers(freshPlayers || []);
        setGameConfig(saved.sport as any, team, saved.season, 'manual', saved.timerDuration, rosterPlayers, leaguePlayers, false);
        // Correct the timer immediately so the display shows remaining time, not full duration.
        const deadline = new Date(saved.startedAt).getTime() + saved.timerDuration * 1000;
        const remaining = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
        useGameStore.getState().setRoundDeadline(deadline);
        useGameStore.setState({ timeRemaining: remaining });
        setIsMultiplayer(true);
        setStartedAt(saved.startedAt);
      } catch {
        sessionStorage.removeItem('bk_roster_mp');
        navigate('/');
      }
    })();
  }, [selectedTeam, selectedSeason, navigate]);
  useEffect(() => { if (status === 'idle' && selectedTeam) startGame(); }, [status, selectedTeam, startGame]);

  // Anchor timer to server-issued started_at so all clients share the same deadline.
  // Only applies in multiplayer; solo play uses the local tick countdown.
  useEffect(() => {
    if (!isMultiplayer || !startedAt || status !== 'playing') return;
    const deadline = new Date(startedAt).getTime() + timerDuration * 1000;
    setRoundDeadline(deadline);
  }, [isMultiplayer, startedAt, status, timerDuration, setRoundDeadline]);
  
  useEffect(() => {
    if (status !== 'playing') return;
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval);
  }, [status, tick]);

  useEffect(() => { if (timeRemaining <= 0 && status === 'playing') endGame(); }, [timeRemaining, status, endGame]);

  // ── 0-roster recovery: if the game starts but currentRoster is empty, re-fetch ──
  // Can happen when a network hiccup or race condition causes the roster fetch to
  // return [] before setGameConfig is called. We detect this 1s into gameplay and
  // retry the fetch once. If it succeeds the game continues normally; on failure
  // the game still runs (players just have no targets to match).
  const hasRetriedRosterRef = useRef(false);
  useEffect(() => {
    if (status !== 'playing') return;
    if (currentRoster.length > 0) return;
    if (hasRetriedRosterRef.current) return;
    if (!selectedTeam || !selectedSeason) return;

    const timer = setTimeout(async () => {
      if (currentRoster.length > 0 || hasRetriedRosterRef.current) return;
      hasRetriedRosterRef.current = true;
      try {
        let rosterPlayers: any[] = [];
        let leaguePlayers: any[] = [];
        if (sport === 'nba') {
          const result = await fetchTeamRoster(selectedTeam.abbreviation, selectedSeason);
          rosterPlayers = result.players;
          leaguePlayers = await fetchStaticSeasonPlayers(selectedSeason) ?? [];
        } else {
          const year = parseInt(selectedSeason);
          rosterPlayers = await fetchStaticNFLRoster(selectedTeam.abbreviation, year) ?? [];
          leaguePlayers = await fetchStaticNFLSeasonPlayers(year) ?? [];
        }
        if (rosterPlayers.length > 0) {
          setGameConfig(sport, selectedTeam, selectedSeason, gameMode, timerDuration, rosterPlayers, leaguePlayers, hideResultsDuringGame);
        }
      } catch {
        // Silently swallow — the game remains playable, just with an empty roster
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [status, currentRoster.length, selectedTeam, selectedSeason, sport]);

  useEffect(() => {
    if (status === 'ended') {
      if (hideResultsDuringGame) processGuesses();
      sessionStorage.removeItem('bk_roster_mp');
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
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen home-chalkboard text-white flex flex-col relative overflow-hidden"
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
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={timeRemaining}
                initial={{ scale: 1.3, rotate: timeRemaining % 2 === 0 ? -6 : 6, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.75, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 480, damping: 24 }}
                className="capcrunch-title text-[28rem] md:text-[45rem] text-red-600/10 select-none leading-none"
              >
                {timeRemaining}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <header className={`relative z-10 p-6 capcrunch-panel border-b transition-colors duration-300 ${isShotClockActive ? 'border-red-500/60' : 'border-white/10'}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-8">
            {divisionTeams.length > 0 && lobbyDivisionConference && lobbyDivisionName ? (
              <div className="flex flex-col">
                <div className="capcrunch-title text-xl text-[#FDF100]">
                  {lobbyDivisionConference} {lobbyDivisionName}
                </div>
                <div className="sports-font text-[9px] text-white/40 tracking-widest">
                  {selectedSeason}
                </div>
                <div className="flex gap-1.5 mt-1">
                  {divisionTeams.map(abbr => (
                    <span key={abbr} className="text-[9px] text-white/50 sports-font px-1.5 py-0.5 bg-white/5">
                      {abbr}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <TeamDisplay team={selectedTeam} season={selectedSeason} record={showSeasonHints ? teamRecord : null} sport={sport} />
            )}
            <div className="h-10 w-[1px] bg-white/20 hidden md:block" />

            {/* RESPONSIVE TIMER DESIGN */}
            <div className="flex flex-col items-center">
                <span className="sports-font text-[9px] text-white/40 tracking-[0.4em] uppercase mb-1">Clock</span>
                <div className={`capcrunch-title text-3xl transition-colors duration-300 ${isShotClockActive ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                </div>
            </div>
          </div>

          {/* THREE MECHANICAL SCORE PANELS */}
          <div className="flex gap-4">
            <div className="capcrunch-panel px-6 py-3 text-center min-w-[100px]">
              <div className="sports-font text-[9px] text-white/40 tracking-[0.3em] uppercase mb-1">Correct</div>
              {hideResultsDuringGame ? (
                <div className="capcrunch-title text-3xl text-[#FDF100]">?</div>
              ) : (
                <SpinningNumber value={String(score)} className="capcrunch-title text-3xl" color="#FDF100" />
              )}
            </div>
            <div className="capcrunch-panel px-6 py-3 text-center min-w-[100px]">
              <div className="sports-font text-[9px] text-white/40 tracking-[0.3em] uppercase mb-1">Guessed</div>
              <SpinningNumber
                value={String(hideResultsDuringGame ? pendingGuesses.length : guessedPlayers.length)}
                className="capcrunch-title text-3xl"
                color="#ffffff"
              />
            </div>
            <div className="capcrunch-panel px-6 py-3 text-center min-w-[100px]">
              <div className="sports-font text-[9px] text-white/40 tracking-[0.3em] uppercase mb-1">Roster</div>
              <div className="capcrunch-title text-3xl text-white/40">
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

          <div className="flex-1 capcrunch-panel flex flex-col overflow-hidden">
            <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <span className="sports-font text-[10px] tracking-[0.4em] text-white/60 uppercase">
                Your Picks
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <GuessedPlayersList
                guessedPlayers={guessedPlayers}
                incorrectGuesses={incorrectGuesses}
                pendingGuesses={hideResultsDuringGame ? pendingGuesses : []}
                hideResults={hideResultsDuringGame}
                uniqueGuessNames={uniqueGuessNames}
              />
            </div>
          </div>

          {/* Teammate guesses - visible when on a team */}
          {isMultiplayer && currentPlayerTeamNumber != null && teammateGuessedNames.length > 0 && (
            <div className="mt-4 capcrunch-panel p-4">
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
                    className="px-2.5 py-1 sports-font text-[10px] font-bold uppercase tracking-wider border"
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
                className="capcrunch-kicker text-[9px] text-white/30 hover:text-white transition-all"
              >
                // Terminate Session
              </button>
            </div>
          )}
        </div>

        {isMultiplayer && (
          <EmoteOverlay
            lobbyId={lobbyId}
            currentPlayerId={currentPlayerId}
            currentPlayerName={currentPlayerData?.player_name}
          />
        )}

        {isMultiplayer && players.length > 0 && (
          <aside className="w-full md:w-72 flex-shrink-0">
             <div className="capcrunch-panel p-4 h-full">
                <h3 className="capcrunch-kicker text-[9px] text-white/40 mb-6 text-center">Live Pit</h3>
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