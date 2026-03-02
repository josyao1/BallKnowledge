/**
 * MultiplayerStartingLineupPage.tsx — Multiplayer "Starting Lineup" game mode.
 *
 * Players see an NFL field with encoded player blobs (college logos / jersey
 * numbers / draft picks) and race to guess the team.
 *
 * Lock-out mechanic: wrong guess → player is locked until host increments
 * unlock_epoch (happens when ALL players are locked simultaneously).
 *
 * Scoring: rank by (incorrect_guesses.length ASC, finished_at ASC)
 *   1st correct: 3 pts, 2nd correct: 1 pt
 *
 * career_state shape:
 *   { team, side, encoding, round, win_target, unlock_epoch }
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../stores/lobbyStore';
import { useLobbySubscription } from '../hooks/useLobbySubscription';
import {
  findLobbyByCode,
  getLobbyPlayers,
  updateLobbyStatus,
  updatePlayerScore,
  addCareerPoints,
  startCareerRound,
  updateCareerState,
} from '../services/lobby';
import {
  loadNFLStarters,
  getRandomNFLTeamAndSide,
  getRandomEncoding,
  pickBestEncoding,
  type NFLStartersData,
  type StarterPlayer,
  type StarterEncoding,
} from '../services/startingLineupData';
import { NFLFieldLayout } from '../components/startingLineup/NFLFieldLayout';
import { nflTeams } from '../data/nfl-teams';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StartingLineupState {
  team: string;
  side: 'offense' | 'defense';
  encoding: StarterEncoding;
  round: number;
  win_target: number;
  unlock_epoch: number;
  giveUps?: string[];
  allGaveUp?: boolean;
  firstCorrectAt?: string;
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
  const [startersData, setStartersData] = useState<NFLStartersData | null>(null);
  const [currentPlayers, setCurrentPlayers] = useState<StarterPlayer[]>([]);

  // ── Local state ──
  const [guessInput, setGuessInput] = useState('');
  const [suggestions, setSuggestions] = useState<typeof nflTeams>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localIncorrect, setLocalIncorrect] = useState<string[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasGivenUp, setHasGivenUp] = useState(false);
  const [shake, setShake] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const [pressureTimeLeft, setPressureTimeLeft] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const hasSubmittedRef = useRef(false);
  const hasAdvancedRef = useRef(false);
  const prevRoundRef = useRef(-1);
  const pressureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load lobby on mount ──
  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby?.career_state) {
      loadNFLStarters().then(setStartersData);
      return;
    }

    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => {
        if (pr.players) setPlayers(pr.players);
      });
      loadNFLStarters().then(setStartersData);
    });
  }, []);

  // ── Update current players when career_state changes ──
  useEffect(() => {
    if (!careerState || !startersData) return;
    const teamData = startersData[careerState.team];
    if (!teamData) return;
    const sidePlayers = teamData[careerState.side].slice(0, 11);
    setCurrentPlayers(sidePlayers);
  }, [careerState?.team, careerState?.side, startersData]);

  // ── Reset local state on new round ──
  useEffect(() => {
    if (!careerState) return;
    if (careerState.round !== prevRoundRef.current) {
      prevRoundRef.current = careerState.round;
      setLocalIncorrect([]);
      setGuessInput('');
      setSuggestions([]);
      setShowSuggestions(false);
      setIsCorrect(false);
      setHasGivenUp(false);
      setFeedbackMsg('');
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

  // ── Host: auto-increment unlock_epoch when all players are locked ──
  useEffect(() => {
    if (!isHost || !lobby || !careerState) return;
    const connectedPlayers = players.filter(p => p.is_connected !== false);
    if (connectedPlayers.length === 0) return;

    const allLocked = connectedPlayers.every(
      p => (p.incorrect_guesses?.length ?? 0) > careerState.unlock_epoch && !p.finished_at
    );

    if (allLocked && !hasAdvancedRef.current) {
      // Increment unlock_epoch to release everyone
      const newState = { ...careerState, unlock_epoch: careerState.unlock_epoch + 1 };
      updateCareerState(lobby.id, newState);
      setLobby({ ...lobby, career_state: newState });
    }
  }, [players, careerState?.unlock_epoch]);

  // ── Host: detect first correct answer or all-gave-up ──
  useEffect(() => {
    if (!isHost || !lobby || !careerState || hasAdvancedRef.current || careerState.firstCorrectAt) return;
    const gaveUpIds = new Set(careerState.giveUps || []);
    const connected = players.filter(p => p.is_connected !== false);
    if (connected.length === 0) return;

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
  }, [players.map(p => p.finished_at).join(','), JSON.stringify(careerState?.giveUps)]);

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

    // Exclude players who gave up from scoring
    const gaveUpIds = new Set(careerState.giveUps || []);
    const connectedPlayers = players.filter(p => p.is_connected !== false);
    const everyoneGaveUp = connectedPlayers.length > 0 && connectedPlayers.every(p => gaveUpIds.has(p.player_id));

    if (everyoneGaveUp) {
      // Reveal the answer to all clients before advancing
      const revealState = { ...careerState, allGaveUp: true };
      await updateCareerState(lobby.id, revealState);
      setLobby({ ...lobby, career_state: revealState });
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    // Rank players who answered correctly: fewest wrong first, then earliest finished_at
    const finished = players
      .filter(p => p.finished_at && !gaveUpIds.has(p.player_id))
      .sort((a, b) => {
        const wrongA = a.incorrect_guesses?.length ?? 0;
        const wrongB = b.incorrect_guesses?.length ?? 0;
        if (wrongA !== wrongB) return wrongA - wrongB;
        return (a.finished_at || '').localeCompare(b.finished_at || '');
      });

    // Award 1 pt to every player who answered correctly
    for (const player of finished) {
      await addCareerPoints(lobby.id, player.player_id, 1);
    }

    // Check if anyone won
    const updatedPlayers = await getLobbyPlayers(lobby.id);
    const winTarget = careerState.win_target;
    const winner = (updatedPlayers.players || []).find(p => (p.wins || 0) >= winTarget);

    if (winner) {
      await updateLobbyStatus(lobby.id, 'finished');
      return;
    }

    // Start next round
    const nextRound = careerState.round + 1;
    const pick = getRandomNFLTeamAndSide(startersData, careerState.team);
    let enc = getRandomEncoding();
    if (pick.players.filter((p: StarterPlayer) => enc === 'college' ? p.college_espn_id != null : enc === 'number' ? p.number != null : p.draft_pick != null).length < 5) {
      enc = pickBestEncoding(pick.players);
    }

    const newState: StartingLineupState = {
      team: pick.team,
      side: pick.side,
      encoding: enc,
      round: nextRound,
      win_target: winTarget,
      unlock_epoch: 0,
      giveUps: [],
      firstCorrectAt: undefined,
    };

    await startCareerRound(lobby.id, newState as unknown as Record<string, unknown>);
    setLobby({ ...lobby, career_state: newState, status: 'playing' });
    setIsAdvancing(false);
  }

  // ── Guess handling ──
  function handleGuessInput(value: string) {
    setGuessInput(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const matches = nflTeams.filter(t => teamMatchesInput(value, t)).slice(0, 5);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }

  async function submitGuess(guessedAbbr?: string) {
    if (!careerState || !lobby || isLocked || isCorrect || hasSubmittedRef.current) return;

    setShowSuggestions(false);
    setGuessInput('');

    const correctTeam = nflTeams.find(t => t.abbreviation === careerState.team);
    if (!correctTeam) return;

    const inputVal = guessedAbbr
      ? nflTeams.find(t => t.abbreviation === guessedAbbr)?.name || guessInput
      : guessInput;

    const correct = guessedAbbr === careerState.team ||
      (!guessedAbbr &&
        nflTeams.filter(t => teamMatchesInput(inputVal, t)).length === 1 &&
        nflTeams.filter(t => teamMatchesInput(inputVal, t))[0].abbreviation === careerState.team);

    if (correct) {
      hasSubmittedRef.current = true;
      setIsCorrect(true);
      setFeedbackMsg('');
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

  const allGaveUp = !!careerState.allGaveUp;
  const correctTeamObj = nflTeams.find(t => t.abbreviation === careerState.team);
  const encodingLabel = { college: 'college logos', number: 'jersey #s', draft: 'draft picks' }[careerState.encoding];
  const connectedCount = players.filter(p => p.is_connected !== false).length;
  const finishedCount = players.filter(p => p.finished_at !== null).length;

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
              <div className={`retro-title text-sm ${p.player_id === currentPlayerId ? 'text-[#fdb927]' : 'text-white/60'}`}>{p.wins || 0}</div>
            </div>
          ))}
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col px-3 py-3 gap-3 max-w-2xl mx-auto w-full">
        <NFLFieldLayout
          players={currentPlayers}
          side={careerState.side}
          encoding={careerState.encoding}
          blobState={isCorrect || allGaveUp ? 'revealed' : 'hidden'}
        />

        {/* All gave up — answer reveal */}
        <AnimatePresence>
          {allGaveUp && correctTeamObj && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-4 py-3 bg-[#1a1a1a] border border-white/20 rounded-lg flex items-center justify-between"
            >
              <div>
                <div className="text-[9px] text-white/30 sports-font uppercase tracking-widest">Nobody got it — the answer was</div>
                <div className="retro-title text-xl text-white/80">{correctTeamObj.name}</div>
              </div>
              <div className="text-xs text-white/20 sports-font">Next round soon...</div>
            </motion.div>
          )}
        </AnimatePresence>

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
              <div className="text-xs text-green-400/60 sports-font">+1 pt</div>
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
            <div className="text-[10px] text-red-400/50 mt-1 sports-font">Host will unlock when all players are locked</div>
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

        {/* Instructions */}
        {!isCorrect && !isLocked && !hasGivenUp && (
          <p className="text-center text-[11px] text-white/40 sports-font tracking-wider">
            Guess the NFL team · {careerState.side} · {encodingLabel}
          </p>
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

        {/* Live scoreboard */}
        <div className="mt-auto">
          <div className="text-[9px] text-white/30 sports-font tracking-widest uppercase mb-2">Leaderboard</div>
          <div className="flex flex-col gap-1.5">
            {[...players]
              .sort((a, b) => (b.wins || 0) - (a.wins || 0))
              .map((p, i) => (
                <div key={p.player_id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${p.player_id === currentPlayerId ? 'bg-[#1a2a1a]' : 'bg-[#111]'}`}>
                  <span className="retro-title text-sm text-white/30 w-4">{i + 1}</span>
                  <span className="flex-1 sports-font text-sm text-white/80 truncate">{p.player_name}</span>
                  {p.finished_at && <span className="text-green-400 text-xs">✓</span>}
                  {(p.incorrect_guesses?.length ?? 0) > (careerState?.unlock_epoch ?? 0) && !p.finished_at && (
                    <span className="text-red-400 text-xs">🔒</span>
                  )}
                  <span className="retro-title text-sm text-[#fdb927] w-8 text-right">{p.wins || 0}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
