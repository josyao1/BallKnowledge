/**
 * MultiplayerStartingLineupPage.tsx — Multiplayer "Starting Lineup" game mode.
 *
 * Players see an NFL field with encoded player blobs (college logos / jersey
 * numbers / draft picks) and race to guess the team.
 *
 * Lock-out mechanic: wrong guess → player is locked until host increments
 * unlock_epoch (happens when ALL players are locked simultaneously).
 *
 * Scoring: 1st correct: 3 pts, all others correct within 30s: 1 pt
 *
 * career_state shape:
 *   { team, side, encoding, round, win_target, unlock_epoch }
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import {
  findLobbyByCode,
  getLobbyPlayers,
  updateLobbyStatus,
  updatePlayerScore,
  addCareerPoints,
  incrementPlayerWins,
  startCareerRound,
  updateCareerState,
} from '../../services/lobby';
import {
  loadNFLStarters,
  getRandomNFLTeamAndSide,
  getRandomEncoding,
  pickBestEncoding,
  loadNBAStarters,
  getRandomNBATeam,
  type NFLStartersData,
  type NBAStartersData,
  type StarterPlayer,
  type StarterEncoding,
} from '../../services/startingLineupData';
import { NFLFieldLayout } from '../../components/startingLineup/NFLFieldLayout';
import { NBACourtLayout } from '../../components/startingLineup/NBACourtLayout';
import { nflTeams } from '../../data/nfl-teams';
import { teams as nbaTeams } from '../../data/teams';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StartingLineupState {
  sport?: 'nba' | 'nfl';
  team: string;
  side?: 'offense' | 'defense';
  encoding: StarterEncoding;
  round: number;
  win_target: number;
  unlock_epoch: number;
  giveUps?: string[];
  allGaveUp?: boolean;
  firstCorrectAt?: string;
  hintRequests?: string[];
  phase?: 'playing' | 'results';
}

function normalizeInput(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function teamMatchesInput(input: string, team: { name: string; city: string; abbreviation: string }): boolean {
  const norm = normalizeInput(input);
  if (!norm) return false;
  const name = normalizeInput(team.name);
  const city = normalizeInput(team.city);
  const abbr = team.abbreviation.toLowerCase();
  return (
    name.includes(norm) ||
    city.includes(norm) ||
    abbr === norm ||
    name.split(' ').some(w => w.startsWith(norm) && norm.length >= 3)
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MultiplayerStartingLineupPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { lobby, players, isHost, currentPlayerId, setLobby, setPlayers } = useLobbyStore();

  useLobbySubscription(lobby?.id || null);

  const careerState = lobby?.career_state as StartingLineupState | null;

  // ── Data ──
  const [startersData, setStartersData] = useState<NFLStartersData | NBAStartersData | null>(null);
  const [currentPlayers, setCurrentPlayers] = useState<StarterPlayer[]>([]);

  // ── Local state ──
  const [guessInput, setGuessInput] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ abbreviation: string; name: string; colors: { primary: string } }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localIncorrect, setLocalIncorrect] = useState<string[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasGivenUp, setHasGivenUp] = useState(false);
  const [shake, setShake] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const [pressureTimeLeft, setPressureTimeLeft] = useState<number | null>(null);
  const [wasFirstCorrect, setWasFirstCorrect] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const hasSubmittedRef = useRef(false);
  const hasAdvancedRef = useRef(false);
  const prevRoundRef = useRef(-1);
  const roundStartTimeRef = useRef<string | null>(null);
  const pressureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load lobby on mount ──
  useEffect(() => {
    if (!code) { navigate('/'); return; }

    function loadStarters(cs: StartingLineupState | null) {
      const sport = cs?.sport || 'nfl';
      const loader = sport === 'nba' ? loadNBAStarters() : loadNFLStarters();
      loader
        .then(setStartersData)
        .catch(err => console.error('[StartingLineup] Failed to load starters data:', err));
    }

    if (lobby?.career_state) {
      loadStarters(lobby.career_state as StartingLineupState);
      return;
    }

    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => {
        if (pr.players) setPlayers(pr.players);
      });
      loadStarters(result.lobby.career_state as StartingLineupState | null);
    });
  }, []);

  // ── Update current players when career_state changes ──
  useEffect(() => {
    if (!careerState || !startersData) return;
    const sport = careerState.sport || 'nfl';
    const teamData = (startersData as any)[careerState.team];
    if (!teamData) return;
    if (sport === 'nba') {
      setCurrentPlayers((teamData.starters as StarterPlayer[]).slice(0, 5));
    } else {
      const side = careerState.side || 'offense';
      setCurrentPlayers((teamData[side] as StarterPlayer[]).slice(0, 11));
    }
  }, [careerState?.team, careerState?.side, careerState?.sport, startersData]);

  // ── Reset local state on new round ──
  useEffect(() => {
    if (!careerState) return;
    if (careerState.round !== prevRoundRef.current) {
      prevRoundRef.current = careerState.round;
      roundStartTimeRef.current = new Date().toISOString();
      setLocalIncorrect([]);
      setGuessInput('');
      setSuggestions([]);
      setShowSuggestions(false);
      setIsCorrect(false);
      setHasGivenUp(false);
      setFeedbackMsg('');
      setWasFirstCorrect(false);
      setPressureTimeLeft(null);
      hasSubmittedRef.current = false;
      hasAdvancedRef.current = false;
      if (pressureTimerRef.current) { clearTimeout(pressureTimerRef.current); pressureTimerRef.current = null; }
      if (pressureIntervalRef.current) { clearInterval(pressureIntervalRef.current); pressureIntervalRef.current = null; }
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [careerState?.round]);

  // ── Navigate away when lobby finishes ──
  useEffect(() => {
    if (lobby?.status === 'finished') {
      navigate(`/lobby/${code}/starting-lineup/results`);
    }
  }, [lobby?.status]);

  // ── Check if current player is locked ──
  const currentPlayer = players.find(p => p.player_id === currentPlayerId);
  const myIncorrectCount = currentPlayer?.incorrect_guesses?.length ?? 0;
  const unlockEpoch = careerState?.unlock_epoch ?? 0;
  const isLocked = myIncorrectCount > unlockEpoch;

  // ── Host: auto-increment unlock_epoch when all active players are locked ──
  useEffect(() => {
    if (!isHost || !lobby || !careerState) return;
    const connectedPlayers = players.filter(p => p.is_connected !== false);
    if (connectedPlayers.length === 0) return;

    const gaveUpIds = new Set(careerState.giveUps || []);
    // Only check players who haven't finished (correct or gave up)
    const activePlayers = connectedPlayers.filter(p => !p.finished_at && !gaveUpIds.has(p.player_id));

    const allLocked = activePlayers.length > 0 && activePlayers.every(
      p => (p.incorrect_guesses?.length ?? 0) > careerState.unlock_epoch
    );

    if (allLocked && !hasAdvancedRef.current) {
      if (careerState.firstCorrectAt) {
        // Someone already answered correctly and all remaining players guessed wrong —
        // advance immediately instead of giving them another attempt.
        hasAdvancedRef.current = true;
        advanceRound();
      } else {
        // Nobody correct yet: unlock everyone for another guess attempt
        const newState = { ...careerState, unlock_epoch: careerState.unlock_epoch + 1 };
        updateCareerState(lobby.id, newState);
        setLobby({ ...lobby, career_state: newState });
      }
    }
  }, [players, careerState?.unlock_epoch, careerState?.giveUps?.join(',')]);

  // ── Host: detect first correct answer or all-gave-up ──
  useEffect(() => {
    if (!isHost || !lobby || !careerState || hasAdvancedRef.current || careerState.firstCorrectAt) return;
    const gaveUpIds = new Set(careerState.giveUps || []);
    const connected = players.filter(p => p.is_connected !== false);
    if (connected.length === 0) return;

    // Guard against transitional state: new career_state (giveUps=[]) arrived before
    // lobby_players were reset — stale finished_at from the previous round would
    // cause us to incorrectly score players. Skip until all finished_at are cleared.
    const roundStart = roundStartTimeRef.current;
    if (roundStart && connected.some(p => p.finished_at && p.finished_at < roundStart)) {
      return;
    }

    const allGaveUp = connected.every(p => gaveUpIds.has(p.player_id));
    if (allGaveUp) {
      hasAdvancedRef.current = true;
      advanceRound();
      return;
    }

    const firstCorrect = players.find(p => p.finished_at && !gaveUpIds.has(p.player_id));
    if (firstCorrect) {
      const newState = { ...careerState, firstCorrectAt: new Date().toISOString() };
      updateCareerState(lobby.id, newState);
      setLobby({ ...lobby, career_state: newState });
    }
  }, [players.map(p => p.finished_at).join(','), careerState?.giveUps?.join(',')]);

  // ── Host: 30-second pressure timer after first correct answer ──
  useEffect(() => {
    if (!isHost || !lobby || !careerState?.firstCorrectAt || hasAdvancedRef.current) return;

    const gaveUpIds = new Set(careerState.giveUps || []);
    const connected = players.filter(p => p.is_connected !== false);
    const allDone = connected.every(p => p.finished_at || gaveUpIds.has(p.player_id));

    if (allDone) {
      if (!hasAdvancedRef.current) {
        if (pressureTimerRef.current) { clearTimeout(pressureTimerRef.current); pressureTimerRef.current = null; }
        hasAdvancedRef.current = true;
        advanceRound();
      }
      return;
    }

    if (pressureTimerRef.current) return;
    pressureTimerRef.current = setTimeout(() => {
      if (!hasAdvancedRef.current) {
        hasAdvancedRef.current = true;
        advanceRound();
      }
    }, 30000);
  }, [careerState?.firstCorrectAt, players.map(p => p.finished_at).join(',')]);

  // ── All clients: countdown display from firstCorrectAt ──
  useEffect(() => {
    if (!careerState?.firstCorrectAt) {
      setPressureTimeLeft(null);
      return;
    }
    const start = new Date(careerState.firstCorrectAt).getTime();
    const tick = () => setPressureTimeLeft(Math.max(0, Math.ceil((30000 - (Date.now() - start)) / 1000)));
    tick();
    pressureIntervalRef.current = setInterval(tick, 500);
    return () => { if (pressureIntervalRef.current) clearInterval(pressureIntervalRef.current); };
  }, [careerState?.firstCorrectAt]);

  async function advanceRound() {
    if (!lobby || !careerState || !startersData) return;
    setIsAdvancing(true);
    try {
      const gaveUpIds = new Set(careerState.giveUps || []);
      const connectedPlayers = players.filter(p => p.is_connected !== false);
      const everyoneGaveUp = connectedPlayers.length > 0 && connectedPlayers.every(p => gaveUpIds.has(p.player_id));

      // Rank players who answered correctly: fewest wrong first, then earliest finished_at
      const finished = players
        .filter(p => p.finished_at && !gaveUpIds.has(p.player_id))
        .sort((a, b) => {
          const wrongA = a.incorrect_guesses?.length ?? 0;
          const wrongB = b.incorrect_guesses?.length ?? 0;
          if (wrongA !== wrongB) return wrongA - wrongB;
          return (a.finished_at || '').localeCompare(b.finished_at || '');
        });

      // First correct: 3 pts. Everyone else who answered within the window: 1 pt.
      for (let i = 0; i < finished.length; i++) {
        await addCareerPoints(lobby.id, finished[i].player_id, i === 0 ? 3 : 1);
      }

      // Check if anyone won
      const updatedPlayers = await getLobbyPlayers(lobby.id);
      const winTarget = careerState.win_target;
      const winner = (updatedPlayers.players || []).find(p => (p.points ?? 0) >= winTarget);

      if (winner) {
        // Award session win to the match winner
        await incrementPlayerWins(lobby.id, winner.player_id);
        await updateLobbyStatus(lobby.id, 'finished');
        return;
      }

      // Show results to all players — host advances to next round manually
      const resultsState = {
        ...careerState,
        phase: 'results' as const,
        allGaveUp: everyoneGaveUp,
      };
      await updateCareerState(lobby.id, resultsState);
      setLobby({ ...lobby, career_state: resultsState });
      setIsAdvancing(false);
    } catch (err) {
      console.error('[StartingLineup] advanceRound failed:', err);
      setIsAdvancing(false);
      hasAdvancedRef.current = false;
    }
  }

  async function handleNextRound() {
    if (!lobby || !careerState || !startersData) return;
    setIsAdvancing(true);
    try {
      const nextRound = careerState.round + 1;
      const sport = careerState.sport || 'nfl';

      let pick: { team: string; players: StarterPlayer[] };
      let side: 'offense' | 'defense' | undefined;

      if (sport === 'nba') {
        pick = getRandomNBATeam(startersData as NBAStartersData, careerState.team);
      } else {
        const nflPick = getRandomNFLTeamAndSide(startersData as NFLStartersData, careerState.team);
        pick = nflPick;
        side = nflPick.side;
      }

      let enc = getRandomEncoding();
      const hasEncodingData = (p: StarterPlayer): boolean => {
        if (enc === 'college') return p.college_espn_id != null;
        if (enc === 'number') return p.number != null;
        return p.draft_pick != null;
      };
      if (pick.players.filter(hasEncodingData).length < 5) {
        enc = pickBestEncoding(pick.players);
      }
      const newState: StartingLineupState = {
        sport,
        team: pick.team,
        side,
        encoding: enc,
        round: nextRound,
        win_target: careerState.win_target,
        unlock_epoch: 0,
        giveUps: [],
        firstCorrectAt: undefined,
        hintRequests: [],
        phase: 'playing',
      };
      await startCareerRound(lobby.id, newState as unknown as Record<string, unknown>);
      setLobby({ ...lobby, career_state: newState, status: 'playing' });
      setIsAdvancing(false);
    } catch (err) {
      console.error('[StartingLineup] handleNextRound failed:', err);
      setIsAdvancing(false);
    }
  }

  // ── Guess handling ──
  function handleGuessInput(value: string) {
    if (!careerState) return;
    setGuessInput(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const teamList = (careerState.sport || 'nfl') === 'nba' ? nbaTeams : nflTeams;
    const matches = teamList.filter(t => teamMatchesInput(value, t as any)).slice(0, 5);
    setSuggestions(matches as any[]);
    setShowSuggestions(matches.length > 0);
  }

  async function submitGuess(guessedAbbr?: string) {
    if (!careerState || !lobby || isLocked || isCorrect || hasSubmittedRef.current) return;

    setShowSuggestions(false);
    setGuessInput('');

    const sport = careerState.sport || 'nfl';
    const teamList = sport === 'nba' ? nbaTeams : nflTeams;
    const correctTeam = teamList.find(t => t.abbreviation === careerState.team);
    if (!correctTeam) return;

    const inputVal = guessedAbbr
      ? teamList.find(t => t.abbreviation === guessedAbbr)?.name || guessInput
      : guessInput;

    const correct = guessedAbbr === careerState.team ||
      (!guessedAbbr &&
        teamList.filter(t => teamMatchesInput(inputVal, t as any)).length === 1 &&
        teamList.filter(t => teamMatchesInput(inputVal, t as any))[0].abbreviation === careerState.team);

    if (correct) {
      hasSubmittedRef.current = true;
      setIsCorrect(true);
      setFeedbackMsg('');
      // Points awarded at round end by host via addCareerPoints (3 for first, 1 for others)
      setWasFirstCorrect(!careerState.firstCorrectAt);
      await updatePlayerScore(lobby.id, 0, 1, [], localIncorrect, true);
    } else {
      const newIncorrect = [...localIncorrect, inputVal];
      setLocalIncorrect(newIncorrect);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setFeedbackMsg(`Wrong — ${newIncorrect.length} incorrect`);
      setTimeout(() => setFeedbackMsg(''), 2000);
      await updatePlayerScore(lobby.id, 0, 0, [], newIncorrect, false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleGiveUp() {
    if (!careerState || !lobby || !currentPlayerId || isCorrect || hasGivenUp || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setHasGivenUp(true);
    setShowSuggestions(false);
    setGuessInput('');

    // Append this player to giveUps in career_state
    const newGiveUps = [...(careerState.giveUps || []), currentPlayerId];
    const newState = { ...careerState, giveUps: newGiveUps };
    await updateCareerState(lobby.id, newState);
    setLobby({ ...lobby, career_state: newState });

    // Mark as finished so host can detect everyone is done
    await updatePlayerScore(lobby.id, 0, 0, [], localIncorrect, true);
  }

  // ── Render ──
  if (!careerState || !startersData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white/30 sports-font tracking-widest">Loading...</div>
      </div>
    );
  }

  const sport = careerState.sport || 'nfl';
  const isNBA = sport === 'nba';
  const allGaveUp = !!careerState.allGaveUp;
  const isResultsPhase = careerState.phase === 'results';
  const correctTeamObj = isNBA
    ? nbaTeams.find(t => t.abbreviation === careerState.team)
    : nflTeams.find(t => t.abbreviation === careerState.team);
  const encodingLabel = { college: 'college logos', number: 'jersey #s', draft: 'draft picks' }[careerState.encoding];
  const connectedCount = players.filter(p => p.is_connected !== false).length;
  const finishedCount = players.filter(p => p.finished_at !== null).length;

  // Consensus initials hint
  const hintRequests = careerState.hintRequests || [];
  const myHintRequested = !!currentPlayerId && hintRequests.includes(currentPlayerId);
  const hintVotes = players.filter(p => hintRequests.includes(p.player_id)).length;
  const hintGranted = connectedCount > 0 && hintVotes >= connectedCount;

  async function requestHint() {
    if (!lobby || !careerState || !currentPlayerId || myHintRequested) return;
    const newRequests = [...hintRequests, currentPlayerId];
    const newState = { ...careerState, hintRequests: newRequests };
    await updateCareerState(lobby.id, newState);
    setLobby({ ...lobby, career_state: newState });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1a2a1a]">
        <div>
          <h1 className="retro-title text-lg text-[#ea580c]">Starting Lineup</h1>
          <div className="text-[9px] text-white/30 sports-font">Round {careerState.round} · Race to {careerState.win_target} pts</div>
        </div>
        <div className="text-center">
          {pressureTimeLeft !== null ? (
            <div className={`retro-title text-xl ${pressureTimeLeft <= 10 ? 'text-red-400' : 'text-[#fdb927]'}`}>
              {pressureTimeLeft}s
            </div>
          ) : (
            <div className="text-[9px] text-white/30 sports-font">{finishedCount}/{connectedCount} done</div>
          )}
        </div>
        {/* Scores */}
        <div className="flex gap-2">
          {players.slice(0, 4).map(p => (
            <div key={p.player_id} className="text-center min-w-[36px]">
              <div className="text-[9px] text-white/40 sports-font truncate max-w-[40px]">{p.player_name.split(' ')[0]}</div>
              <div className={`retro-title text-sm ${p.player_id === currentPlayerId ? 'text-[#fdb927]' : 'text-white/60'}`}>{p.points ?? 0}</div>
            </div>
          ))}
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col px-3 py-3 gap-3 max-w-2xl mx-auto w-full">
        {isNBA ? (
          <NBACourtLayout
            players={currentPlayers}
            encoding={careerState.encoding}
            blobState={isCorrect || allGaveUp || isResultsPhase ? 'revealed' : 'hidden'}
            showHint={!isCorrect && !allGaveUp && !isResultsPhase && hintGranted}
          />
        ) : (
          <NFLFieldLayout
            players={currentPlayers}
            side={careerState.side || 'offense'}
            encoding={careerState.encoding}
            blobState={isCorrect || allGaveUp || isResultsPhase ? 'revealed' : 'hidden'}
            showHint={!isCorrect && !allGaveUp && !isResultsPhase && hintGranted}
          />
        )}

        {/* ── Results phase ─────────────────────────────────────────── */}
        {isResultsPhase ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Personal result */}
            {isCorrect ? (
              <div className="px-4 py-2.5 bg-green-900/25 border border-green-700/40 rounded-lg flex items-center justify-between">
                <span className="sports-font text-sm text-green-400">You got it!</span>
                <span className="retro-title text-base text-[#fdb927]">{wasFirstCorrect ? '+3' : '+1'}</span>
              </div>
            ) : (
              <div className="px-4 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-lg">
                <span className="sports-font text-sm text-white/30">
                  {hasGivenUp ? 'You gave up' : 'Out of guesses'}
                </span>
              </div>
            )}

            {/* Team reveal */}
            {correctTeamObj && (
              <div className="px-4 py-4 bg-[#0f1a0f] border border-[#1a3a1a] rounded-lg text-center">
                <div className="text-[9px] text-white/30 sports-font uppercase tracking-widest mb-1.5">
                  {allGaveUp ? 'Nobody got it — the answer was' : 'The team'}
                </div>
                <div className="retro-title text-2xl text-white">{correctTeamObj.name}</div>
                <div className="text-[10px] text-white/30 sports-font mt-1">
                  {!isNBA && careerState.side ? `${careerState.side} · ` : ''}{encodingLabel}
                </div>
              </div>
            )}

            {/* Round scoring breakdown */}
            {!allGaveUp && (() => {
              const gaveUpIds = new Set(careerState.giveUps || []);
              const correctPlayers = [...players]
                .filter(p => p.finished_at && !gaveUpIds.has(p.player_id))
                .sort((a, b) => {
                  const wrongA = a.incorrect_guesses?.length ?? 0;
                  const wrongB = b.incorrect_guesses?.length ?? 0;
                  if (wrongA !== wrongB) return wrongA - wrongB;
                  return (a.finished_at || '').localeCompare(b.finished_at || '');
                });
              return (
                <div className="px-3 py-2.5 bg-[#0f1f0f] border border-green-900/30 rounded-lg space-y-1.5">
                  {correctPlayers.map((p, i) => (
                    <div key={p.player_id} className="flex items-center justify-between">
                      <span className="sports-font text-sm text-green-400">{p.player_name}</span>
                      <span className="retro-title text-base text-[#fdb927]">{i === 0 ? '+3' : '+1'}</span>
                    </div>
                  ))}
                  {correctPlayers.length === 0 && (
                    <div className="sports-font text-sm text-white/30 text-center">No correct answers</div>
                  )}
                </div>
              );
            })()}

            {/* Host: next round button / Non-host: waiting */}
            {isHost ? (
              <button
                onClick={handleNextRound}
                disabled={isAdvancing}
                className="w-full py-3 rounded-lg retro-title text-xl text-white bg-[#ea580c] hover:bg-[#c2410c] disabled:opacity-50 transition-all"
              >
                {isAdvancing ? 'Loading...' : 'Next Round →'}
              </button>
            ) : (
              <div className="text-center sports-font text-sm text-white/30 py-2">
                Waiting for host to start next round...
              </div>
            )}
          </motion.div>

        ) : (
          /* ── Playing phase ────────────────────────────────────────── */
          <>
            {/* Correct answer reveal */}
            <AnimatePresence>
              {isCorrect && correctTeamObj && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-4 py-3 bg-green-900/30 border border-green-700/50 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <div className="text-[9px] text-green-400/60 sports-font uppercase tracking-widest">Correct!</div>
                    <div className="retro-title text-xl text-[#fdb927]">{correctTeamObj.name}</div>
                  </div>
                  <div className="text-xs text-green-400/60 sports-font">{wasFirstCorrect ? '+3 pts' : '+1 pt'}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lock-out indicator */}
            {isLocked && !isCorrect && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-3 bg-red-900/20 border border-red-800/40 rounded-lg text-center"
              >
                <div className="sports-font text-sm text-red-400">Locked out — waiting for others...</div>
                <div className="text-[10px] text-red-400/50 mt-1 sports-font">Will unlock when all players make wrong guess</div>
              </motion.div>
            )}

            {/* Gave up indicator */}
            {hasGivenUp && !isCorrect && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-center"
              >
                <div className="sports-font text-sm text-white/40">You gave up — waiting for others...</div>
              </motion.div>
            )}

            {/* Instructions + hint toggle */}
            {!isCorrect && !isLocked && !hasGivenUp && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/40 sports-font tracking-wider">
                  Guess the {isNBA ? 'NBA' : 'NFL'} team{!isNBA && careerState.side ? ` · ${careerState.side}` : ''} · {encodingLabel}
                </p>
                {hintGranted ? (
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] sports-font border border-[#fdb927]/50 text-[#fdb927] bg-[#fdb927]/10">
                    {isNBA ? 'PPG ON' : 'INITIALS ON'}
                  </span>
                ) : myHintRequested ? (
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] sports-font border border-white/10 text-white/30">
                    {isNBA ? 'PPG' : 'INITIALS'} {hintVotes}/{connectedCount}
                  </span>
                ) : (
                  <button
                    onClick={requestHint}
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] sports-font border transition-all ${
                      hintVotes > 0
                        ? 'border-[#fdb927]/30 text-[#fdb927]/60 hover:border-[#fdb927]/60 hover:text-[#fdb927]'
                        : 'border-white/10 text-white/30 hover:border-white/20 hover:text-white/50'
                    }`}
                  >
                    {isNBA ? 'PPG?' : 'INITIALS?'}{hintVotes > 0 ? ` (${hintVotes}/${connectedCount})` : ''}
                  </button>
                )}
              </div>
            )}

            {/* Wrong guesses */}
            {localIncorrect.length > 0 && !isCorrect && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {localIncorrect.map((g, i) => (
                  <span key={i} className="px-2 py-0.5 bg-red-900/20 border border-red-800/40 rounded text-xs sports-font text-red-400">✗ {g}</span>
                ))}
              </div>
            )}

            {/* Input */}
            {!isCorrect && !isLocked && !hasGivenUp && (
              <motion.div
                animate={shake ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.25 }}
                className="relative"
              >
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={guessInput}
                    onChange={e => handleGuessInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && guessInput.trim()) submitGuess();
                      if (e.key === 'Escape') { setShowSuggestions(false); setGuessInput(''); }
                    }}
                    onFocus={() => guessInput.trim().length >= 2 && setShowSuggestions(true)}
                    placeholder="Type team name..."
                    className="flex-1 bg-[#0f1f0f] border-2 border-[#1a3a1a] rounded-lg px-4 py-3 sports-font text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#ea580c]"
                    autoComplete="off"
                  />
                  <button
                    onClick={() => guessInput.trim() && submitGuess()}
                    disabled={!guessInput.trim()}
                    className="px-5 py-3 rounded-lg sports-font text-sm font-semibold bg-[#ea580c] hover:bg-[#c2410c] disabled:opacity-40 transition-all text-white"
                  >
                    Guess
                  </button>
                </div>

                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-[#0f1f0f] border border-[#1a3a1a] rounded-lg overflow-hidden z-20 shadow-xl"
                    >
                      {suggestions.map(t => (
                        <button
                          key={t.abbreviation}
                          onMouseDown={e => { e.preventDefault(); submitGuess(t.abbreviation); }}
                          className="w-full text-left px-4 py-2.5 sports-font text-sm text-white hover:bg-[#1a3a1a] transition-colors flex items-center gap-3"
                        >
                          <span className="w-8 h-5 rounded text-[9px] font-bold flex items-center justify-center text-white" style={{ background: t.colors.primary }}>
                            {t.abbreviation}
                          </span>
                          {t.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Give Up button */}
            {!isCorrect && !hasGivenUp && (
              <button
                onClick={handleGiveUp}
                className="w-full py-2 rounded-lg sports-font text-xs bg-transparent border border-white/10 text-white/25 hover:border-red-900/50 hover:text-red-400/60 transition-all"
              >
                Give Up
              </button>
            )}

            {/* Feedback */}
            <AnimatePresence>
              {feedbackMsg && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center sports-font text-sm text-red-400"
                >
                  {feedbackMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Waiting for others */}
            {isCorrect && (
              <div className="text-center sports-font text-sm text-white/30">
                Waiting for other players... ({finishedCount}/{connectedCount})
              </div>
            )}

            {/* Host advancing indicator */}
            {isAdvancing && (
              <div className="text-center sports-font text-sm text-green-400/60">
                Calculating scores...
              </div>
            )}
          </>
        )}

        {/* Live scoreboard */}
        <div className="mt-auto">
          <div className="text-[9px] text-white/30 sports-font tracking-widest uppercase mb-2">Leaderboard</div>
          <div className="flex flex-col gap-1.5">
            {[...players]
              .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
              .map((p, i) => (
                <div key={p.player_id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${p.player_id === currentPlayerId ? 'bg-[#1a2a1a]' : 'bg-[#111]'}`}>
                  <span className="retro-title text-sm text-white/30 w-4">{i + 1}</span>
                  <span className="flex-1 sports-font text-sm text-white/80 truncate">{p.player_name}</span>
                  {p.finished_at && !(careerState?.giveUps || []).includes(p.player_id) && <span className="text-green-400 text-xs">✓</span>}
                  {(careerState?.giveUps || []).includes(p.player_id) && <span className="text-white/30 text-xs sports-font">gave up</span>}
                  {(p.incorrect_guesses?.length ?? 0) > (careerState?.unlock_epoch ?? 0) && !p.finished_at && (
                    <span className="text-red-400 text-xs">🔒</span>
                  )}
                  <span className="retro-title text-sm text-[#fdb927] w-8 text-right">{p.points ?? 0}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
