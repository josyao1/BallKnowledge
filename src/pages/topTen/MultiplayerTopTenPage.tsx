import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyStore } from '../../stores/lobbyStore';
import { useLobbySubscription } from '../../hooks/useLobbySubscription';
import { findLobbyByCode, getLobbyPlayers, updateLobbyStatus, updateCareerState } from '../../services/lobby';
import { isValidGuess, getCategoryDef, formatStat, getTopTen, getTopTenDivision, getTopTenTeam, pickRandomCategory, getAvailableYears } from '../../services/topTen';
import type { TopTenEntry, StatCategoryDef } from '../../services/topTen';
import { getNFLDivisions, nflTeams } from '../../data/nfl-teams';
import { getNBADivisions, teams as nbaTeams } from '../../data/teams';
import { TeamLogo } from '../../components/TeamLogo';
import { PlayerHeadshot } from '../../components/capCrunch/PlayerHeadshot';
import { HomeButton } from '../../components/multiplayer/HomeButton';
import { EmoteOverlay } from '../../components/multiplayer/EmoteOverlay';

// Returns winner IDs: primary = most correct guesses, tiebreaker = most strikes left
function determineWinners(
  allIds: string[],
  attribution: Record<string, number>,
  strikes: Record<string, number>,
  maxStrikes: number,
  lastStanding: boolean,
  lastActiveId: string,
): string[] {
  if (lastStanding) return [lastActiveId];
  const sorted = [...allIds].sort((a, b) => {
    const ga = attribution[a] || 0, gb = attribution[b] || 0;
    if (gb !== ga) return gb - ga;
    return (maxStrikes - (strikes[b] || 0)) - (maxStrikes - (strikes[a] || 0));
  });
  if (!sorted.length) return [];
  const topG  = attribution[sorted[0]] || 0;
  const topSL = maxStrikes - (strikes[sorted[0]] || 0);
  return sorted.filter(id =>
    (attribution[id] || 0) === topG &&
    (maxStrikes - (strikes[id]  || 0)) === topSL
  );
}

// NFL teams grouped for the reference panel
const NFL_BY_DIVISION = (['AFC', 'NFC'] as const).flatMap(conf =>
  (['East', 'North', 'South', 'West'] as const).map(div => ({
    label: `${conf} ${div}`,
    teams: nflTeams.filter(t => t.conference === conf && t.division === div),
  }))
);

export function MultiplayerTopTenPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const {
    lobby, players, isHost, currentPlayerId,
    setLobby, setPlayers,
  } = useLobbyStore();

  const [guess, setGuess]             = useState('');
  const [feedback, setFeedback]       = useState<{ msg: string; type: 'correct' | 'wrong' | '' }>({ msg: '', type: '' });
  const [timeLeft, setTimeLeft]       = useState(45);
  const [showTeamsPanel, setShowTeamsPanel] = useState(false);
  const inputRef          = useRef<HTMLInputElement>(null);
  const feedbackTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAdvancedRef    = useRef(false);
  const isWritingRef      = useRef(false);
  const zeroSinceRef      = useRef<number | null>(null);
  // Always-current reference so the timer effect never captures a stale advanceTurn
  const advanceTurnRef    = useRef<typeof advanceTurn>(() => Promise.resolve());

  useLobbySubscription(lobby?.id || null);

  useEffect(() => {
    if (!code) { navigate('/'); return; }
    if (lobby) return;
    findLobbyByCode(code).then(result => {
      if (!result.lobby) { navigate('/'); return; }
      setLobby(result.lobby);
      getLobbyPlayers(result.lobby.id).then(pr => {
        if (pr.players) setPlayers(pr.players);
      }).catch(err => console.error('[TopTen] getLobbyPlayers failed:', err));
    }).catch(err => {
      console.error('[TopTen] findLobbyByCode failed:', err);
      navigate('/');
    });
  }, []);

  const cs = (lobby?.career_state as any) || {};
  const entries: TopTenEntry[]                    = cs.top10_entries || [];
  const guessedIndices: number[]                  = cs.guessed_indices || [];
  const turnOrder: string[]                       = cs.turn_order || [];
  const eliminated: string[]                      = cs.eliminated || [];
  const playerStrikes: Record<string, number>     = cs.player_strikes || {};
  const maxStrikes: number                        = cs.max_strikes || 2;
  const turnTimerSecs: number                     = cs.turn_timer || 45;
  const isDivisionRound: boolean                  = cs.is_division_round || false;
  const isTeamRound: boolean                      = cs.is_team_round || cs.top_ten_round_type === 'team' || false;
  const hintMode: boolean                         = cs.hint_mode || false;
  // Division round shows team logos as hints; team round doesn't (team is already known)
  const showTeamHint: boolean                     = isDivisionRound || (hintMode && !isTeamRound);
  const currentTurnIndex: number                  = cs.current_turn_index ?? 0;
  const turnDeadline: string | null               = cs.turn_deadline || null;
  const categoryKey: string                       = cs.category || '';
  const categoryLabel: string                     = cs.category_label || '';
  const roundInfo: string                         = cs.round_info || '';
  const wrongGuesses: string[]                    = cs.wrong_guesses || [];
  const sport: string                             = cs.sport || 'nba';

  const activePlayers   = turnOrder.filter(id => !eliminated.includes(id));
  const currentTurnId   = activePlayers[currentTurnIndex % Math.max(activePlayers.length, 1)] || '';
  const isMyTurn        = currentTurnId === currentPlayerId;
  const catDef: StatCategoryDef | undefined = getCategoryDef(cs.sport || 'nba', categoryKey);
  const isCumulativeRound = isDivisionRound || isTeamRound;
  const statShortLabel = (isCumulativeRound && sport === 'nba' && catDef?.divisionShortLabel) ? catDef.divisionShortLabel : catDef?.shortLabel;

  // Timer — active player fires immediately; host fallback after 500ms grace
  useEffect(() => {
    if (!turnDeadline) return;

    function tryAdvance() {
      if (hasAdvancedRef.current || isWritingRef.current) return;
      if (isMyTurn || isHost) {
        hasAdvancedRef.current = true;
        zeroSinceRef.current = null;
        advanceTurnRef.current(false);
      }
    }

    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(turnDeadline).getTime() - Date.now()) / 1000));
      setTimeLeft(secs);
      if (secs === 0) {
        if (zeroSinceRef.current === null) zeroSinceRef.current = Date.now();
        if (!hasAdvancedRef.current && !isWritingRef.current) {
          if (isMyTurn) {
            hasAdvancedRef.current = true;
            zeroSinceRef.current = null;
            advanceTurnRef.current(false);
          } else if (isHost && Date.now() - (zeroSinceRef.current ?? Date.now()) >= 500) {
            hasAdvancedRef.current = true;
            zeroSinceRef.current = null;
            advanceTurnRef.current(false);
          }
        }
      } else {
        zeroSinceRef.current = null;
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const secs = Math.round((new Date(turnDeadline).getTime() - Date.now()) / 1000);
      if (secs <= 0) tryAdvance();
    };

    tick();
    const id = setInterval(tick, 500);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [turnDeadline, isMyTurn, isHost]);

  useEffect(() => {
    hasAdvancedRef.current = false;
    if (isMyTurn) setTimeout(() => inputRef.current?.focus(), 100);
  }, [currentTurnId]);

  useEffect(() => {
    if (lobby?.status === 'finished') navigate(`/lobby/${code}/top-ten/results`);
    if (lobby?.status === 'waiting')  window.location.href = `/lobby/${code}`;
  }, [lobby?.status]);

  useEffect(() => {
    if (isHost) return;
    if (cs.abandoned) window.location.href = `/lobby/${code}`;
  }, [cs.abandoned]);

  const advanceTurn = useCallback(async (
    correct: boolean,
    newGuessedIndices?: number[],
    extras: Record<string, unknown> = {},
  ) => {
    if (!lobby || isWritingRef.current) return;
    isWritingRef.current = true;

    try {
      const currentStrikes    = { ...playerStrikes };
      const currentEliminated = [...eliminated];

      if (!correct) {
        const n = (currentStrikes[currentTurnId] || 0) + 1;
        currentStrikes[currentTurnId] = n;
        if (n >= maxStrikes && !currentEliminated.includes(currentTurnId)) {
          currentEliminated.push(currentTurnId);
        }
      }

      const newActivePlayers  = turnOrder.filter(id => !currentEliminated.includes(id));
      const finalGuessed      = newGuessedIndices ?? guessedIndices;
      const allSlotsFilled    = finalGuessed.length >= entries.length;
      const allOut            = newActivePlayers.length === 0;
      // Only "last standing" if the survivor has strikes to spare. If they're also on their
      // last strike, give them their final turn — allOut will end it if they miss.
      const allRemainingOnLastStrike = newActivePlayers.length > 0
        && newActivePlayers.every(id => (currentStrikes[id] || 0) >= maxStrikes - 1);
      const lastStanding      = newActivePlayers.length === 1 && !allRemainingOnLastStrike;

      const roundOver = allSlotsFilled || lastStanding || allOut;

      const newDeadline = new Date(Date.now() + turnTimerSecs * 1000).toISOString();
      const currentWasEliminated = !eliminated.includes(currentTurnId) && currentEliminated.includes(currentTurnId);
      const nextIndex = newActivePlayers.length > 0
        ? (currentWasEliminated ? currentTurnIndex : currentTurnIndex + 1) % newActivePlayers.length
        : 0;

      if (roundOver) {
        const mergedAttribution: Record<string, number> =
          (extras.guess_attribution as Record<string, number>) ?? (cs.guess_attribution || {});
        const winnerIds = determineWinners(
          turnOrder, mergedAttribution, currentStrikes, maxStrikes,
          lastStanding && !allOut, newActivePlayers[0] || '',
        );
        const newState = {
          ...cs, ...extras,
          guessed_indices:    finalGuessed,
          player_strikes:     currentStrikes,
          eliminated:         currentEliminated,
          missed_in_rotation: [],
          winner_ids:         winnerIds,
          winner_id:          winnerIds[0] || '',
          guess_attribution:  mergedAttribution,
        };
        await updateCareerState(lobby.id, newState);
        await updateLobbyStatus(lobby.id, 'finished');
        setLobby({ ...lobby, career_state: newState, status: 'finished' });
      } else {
        const newState = {
          ...cs, ...extras,
          guessed_indices:    finalGuessed,
          player_strikes:     currentStrikes,
          eliminated:         currentEliminated,
          current_turn_index: nextIndex,
          turn_deadline:      newDeadline,
        };
        await updateCareerState(lobby.id, newState);
        setLobby({ ...lobby, career_state: newState });
      }
    } catch (err) {
      console.error('[TopTen] advanceTurn failed:', err);
      setFeedback({ msg: 'Connection error — try again', type: 'wrong' });
      hasAdvancedRef.current = false;
    } finally {
      isWritingRef.current = false;
    }
  }, [lobby, cs, currentTurnId, currentTurnIndex, guessedIndices, entries.length,
      playerStrikes, eliminated, maxStrikes, turnOrder, turnTimerSecs]);

  useEffect(() => { advanceTurnRef.current = advanceTurn; }, [advanceTurn]);

  function clearFeedback() {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback({ msg: '', type: '' }), 1800);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = guess.trim();
    if (!trimmed || !isMyTurn || isWritingRef.current) return;

    const matched = isValidGuess(trimmed, entries, guessedIndices);
    setGuess('');

    if (matched.length > 0) {
      const newGuessedIndices = [...guessedIndices, ...matched];
      setFeedback({ msg: `✓ ${entries[matched[0]].playerName}`, type: 'correct' });
      clearFeedback();
      const newAttribution = {
        ...(cs.guess_attribution || {}),
        [currentTurnId]: ((cs.guess_attribution || {})[currentTurnId] || 0) + matched.length,
      };
      hasAdvancedRef.current = true;
      await advanceTurn(true, newGuessedIndices, { guess_attribution: newAttribution });
    } else {
      setFeedback({ msg: '✗ Not in the top 10', type: 'wrong' });
      clearFeedback();
      hasAdvancedRef.current = true;
      await advanceTurn(false, undefined, { wrong_guesses: [...wrongGuesses, trimmed] });
    }
    inputRef.current?.focus();
  }

  async function handleForceEnd() {
    if (!lobby || !isHost) return;
    try {
      const attribution: Record<string, number> = cs.guess_attribution || {};
      const winnerIds = determineWinners(
        turnOrder, attribution, playerStrikes, maxStrikes,
        activePlayers.length === 1, activePlayers[0] || '',
      );
      const newState = { ...cs, winner_ids: winnerIds, winner_id: winnerIds[0] || '' };
      await updateCareerState(lobby.id, newState);
      await updateLobbyStatus(lobby.id, 'finished');
    } catch (err) {
      console.error('[TopTen] handleForceEnd failed:', err);
    }
  }

  async function handleToggleHint() {
    if (!lobby || !isHost) return;
    try {
      const newState = { ...cs, hint_mode: !hintMode };
      await updateCareerState(lobby.id, newState);
      setLobby({ ...lobby, career_state: newState });
    } catch (err) {
      console.error('[TopTen] handleToggleHint failed:', err);
    }
  }

  async function handleSkipTurn() {
    if (!lobby || !isHost || hasAdvancedRef.current || isWritingRef.current) return;
    hasAdvancedRef.current = true;
    await advanceTurn(false);
  }

  // Generate a fresh round using the same settings currently in career_state
  async function generateRound() {
    const roundSport = (cs.top_ten_sport || cs.sport || 'nba') as 'nba' | 'nfl';
    const roundType: 'league' | 'division' | 'team' = cs.top_ten_round_type || 'league';
    const cat = pickRandomCategory(roundSport, roundType);

    let newEntries: TopTenEntry[] = [];
    let newRoundInfo = '';
    let usedDivision = false;
    let newTeamAbbr = '';

    if (roundType === 'team') {
      const windowYears: number = cs.top_ten_window_years || 10;
      const currentYear = roundSport === 'nba' ? 2025 : 2025;
      const fromYear = roundSport === 'nba' ? currentYear - windowYears : currentYear - windowYears + 1;
      const allTeams = roundSport === 'nba' ? nbaTeams : nflTeams;
      const picked = allTeams[Math.floor(Math.random() * allTeams.length)];
      newTeamAbbr = picked.abbreviation;
      const limit = cat.key === 'fantasy_pts' ? 10 : 5 + windowYears / 5;
      newEntries = await getTopTenTeam(roundSport, cat.key, newTeamAbbr, fromYear, currentYear, limit);
      newRoundInfo = `${picked.name} · last ${windowYears} years`;
      usedDivision = roundSport === 'nba';
    } else if (roundType === 'division') {
      const windowYears: number = cs.top_ten_window_years || 10;
      const currentYear = roundSport === 'nba' ? 2025 : 2025;
      const fromYear = roundSport === 'nba' ? currentYear - windowYears : currentYear - windowYears + 1;
      const divs = roundSport === 'nba' ? getNBADivisions() : getNFLDivisions();
      const div = divs[Math.floor(Math.random() * divs.length)];
      newEntries = await getTopTenDivision(roundSport, cat.key, div.conference, div.division, fromYear, currentYear);
      newRoundInfo = `${div.conference} ${div.division} · last ${windowYears} years`;
      if (newEntries.length >= 5) {
        usedDivision = true;
      } else {
        const years = getAvailableYears(roundSport, cat.key);
        const year = years[Math.floor(Math.random() * years.length)];
        newEntries = await getTopTen(roundSport, cat.key, year);
        newRoundInfo = roundSport === 'nba'
          ? `${year}-${String(year + 1).slice(-2)} season`
          : `${year} season`;
      }
    } else {
      const minYear: number = cs.top_ten_min_year || (roundSport === 'nba' ? 1996 : 1999);
      const maxYear: number = cs.top_ten_max_year || (roundSport === 'nba' ? 2025 : 2025);
      const years = getAvailableYears(roundSport, cat.key).filter(y => y >= minYear && y <= maxYear);
      const year = years[Math.floor(Math.random() * Math.max(years.length, 1))];
      newEntries = await getTopTen(roundSport, cat.key, year);
      newRoundInfo = roundSport === 'nba'
        ? `${year}-${String(year + 1).slice(-2)} season`
        : `${year} season`;
    }

    const catLabel = usedDivision && roundSport === 'nba'
      ? (cat.divisionLabel ?? cat.label)
      : cat.label;

    return { entries: newEntries, cat, catLabel, roundInfo: newRoundInfo, teamAbbr: newTeamAbbr };
  }

  async function handleSkipCategory() {
    if (!lobby || !isHost || isWritingRef.current) return;
    isWritingRef.current = true;
    try {
      const { entries: newEntries, cat, catLabel, roundInfo: newRoundInfo, teamAbbr: newTeamAbbr } = await generateRound();
      if (newEntries.length === 0) return;
      const deadline = new Date(Date.now() + turnTimerSecs * 1000).toISOString();
      const newState = {
        ...cs,
        category:           cat.key,
        category_label:     catLabel,
        round_info:         newRoundInfo,
        top10_entries:      newEntries,
        is_division_round:  cs.top_ten_round_type === 'division',
        is_team_round:      cs.top_ten_round_type === 'team',
        top_ten_team:       newTeamAbbr,
        guessed_indices:    [],
        wrong_guesses:      [],
        hint_mode:          false,
        guess_attribution:  {},
        current_turn_index: 0,
        turn_deadline:      deadline,
      };
      await updateCareerState(lobby.id, newState);
      setLobby({ ...lobby, career_state: newState });
      hasAdvancedRef.current = false;
    } catch (err) {
      console.error('[TopTen] handleSkipCategory failed:', err);
    } finally {
      isWritingRef.current = false;
    }
  }

  async function handleSendToLobby() {
    if (!lobby || !isHost) return;
    try {
      const newState = { ...cs, abandoned: true };
      await updateCareerState(lobby.id, newState);
      await updateLobbyStatus(lobby.id, 'waiting');
      window.location.href = `/lobby/${code}`;
    } catch (err) {
      console.error('[TopTen] handleSendToLobby failed:', err);
      window.location.href = `/lobby/${code}`;
    }
  }

  if (!lobby || entries.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-white/30 sports-font tracking-widest">Loading...</p>
      </div>
    );
  }

  const currentTurnPlayer = players.find(p => p.player_id === currentTurnId);
  const timerFraction     = timeLeft / turnTimerSecs;
  const timerColor        = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-white/8 flex items-center gap-3 bg-black/60 relative z-20">
        <HomeButton isHost={isHost} onEndGame={handleSendToLobby} />
        <h1 className="retro-title text-base text-[#22c55e]">Top Ten</h1>
        <span className="sports-font text-[9px] text-white/25 tracking-[0.25em] uppercase">{sport.toUpperCase()}</span>
        <div className="ml-auto flex items-center gap-2">
          {/* Teams reference panel — NFL only, visible to all */}
          {sport === 'nfl' && (
            <button
              onClick={() => setShowTeamsPanel(v => !v)}
              className={`px-2.5 py-1 rounded-sm sports-font text-[9px] tracking-widest uppercase border transition-colors ${
                showTeamsPanel
                  ? 'border-[#22c55e]/60 text-[#22c55e] bg-[#22c55e]/8'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              Teams
            </button>
          )}
          {isHost && !isDivisionRound && !isTeamRound && (
            <button
              onClick={handleToggleHint}
              className={`px-2.5 py-1 rounded-sm sports-font text-[9px] tracking-widest uppercase border transition-colors ${
                hintMode
                  ? 'border-[#d4af37]/60 text-[#d4af37] bg-[#d4af37]/8'
                  : 'border-white/12 text-white/25 hover:border-white/25 hover:text-white/50'
              }`}
            >
              Hint {hintMode ? 'On' : 'Off'}
            </button>
          )}
          {isHost && !isMyTurn && (
            <button
              onClick={handleSkipTurn}
              className="sports-font text-[9px] text-white/30 border border-white/15 hover:border-yellow-500/50 hover:text-yellow-400 px-2.5 py-1 rounded-sm tracking-widest uppercase transition-colors"
            >
              Skip
            </button>
          )}
          {isHost && (
            <button
              onClick={handleSkipCategory}
              className="sports-font text-[9px] text-white/30 border border-white/15 hover:border-blue-500/50 hover:text-blue-400 px-2.5 py-1 rounded-sm tracking-widest uppercase transition-colors"
            >
              Skip Cat
            </button>
          )}
          {isHost && (
            <button
              onClick={handleForceEnd}
              className="sports-font text-[9px] text-white/30 border border-white/15 hover:border-red-500/50 hover:text-red-400 px-2.5 py-1 rounded-sm tracking-widest uppercase transition-colors"
            >
              End
            </button>
          )}
        </div>
      </header>

      {/* NFL Teams reference panel */}
      <AnimatePresence>
        {showTeamsPanel && sport === 'nfl' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="border-b border-white/8 bg-[#0a0a0a]/98 z-10 px-4 py-3"
            onClick={() => setShowTeamsPanel(false)}
          >
            <div className="max-w-lg mx-auto grid grid-cols-2 gap-x-6 gap-y-2">
              {NFL_BY_DIVISION.map(({ label, teams }) => (
                <div key={label}>
                  <p className="sports-font text-[8px] text-white/20 tracking-widest uppercase mb-1">{label}</p>
                  <div className="flex gap-2">
                    {teams.map(t => (
                      <div key={t.abbreviation} className="flex items-center gap-1">
                        <TeamLogo abbr={t.abbreviation} sport="nfl" size={18} />
                        <span className="sports-font text-[9px] text-white/40">{t.abbreviation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-8 flex flex-col gap-4">
        {/* Category + round info */}
        <div className="text-center pt-5 pb-1">
          <h2
            className="retro-title text-3xl md:text-4xl"
            style={{ color: '#22c55e', textShadow: '0 0 28px rgba(34,197,94,0.3)' }}
          >
            {categoryLabel}
          </h2>
          <p className="sports-font text-[10px] text-white/30 tracking-[0.35em] uppercase mt-1.5">{roundInfo}</p>
        </div>

        {/* Turn indicator + timer */}
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border transition-colors ${
          isMyTurn ? 'border-[#22c55e]/50 bg-[#22c55e]/8' : 'border-white/8 bg-[#0d0d0d]'
        }`}>
          <div className="flex-1">
            <p className="sports-font text-[10px] text-white/35 tracking-widest uppercase mb-1">
              {isMyTurn ? 'Your turn' : `${currentTurnPlayer?.player_name ?? '...'}'s turn`}
            </p>
            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: timerColor }}
                animate={{ width: `${timerFraction * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
          <span className="retro-title text-2xl tabular-nums" style={{ color: timerColor }}>{timeLeft}</span>
        </div>

        {/* Feedback */}
        <div className="h-5 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {feedback.type && (
              <motion.p
                key={feedback.msg}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`sports-font text-xs tracking-wider ${feedback.type === 'correct' ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {feedback.msg}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Guess input */}
        {isMyTurn && (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={guess}
              onChange={e => setGuess(e.target.value)}
              placeholder="Type a player name..."
              autoComplete="off"
              className="flex-1 bg-[#0d0d0d] border border-[#22c55e]/40 rounded-sm px-4 py-2.5 text-white sports-font text-sm focus:outline-none focus:border-[#22c55e] placeholder-white/15 transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-black shadow-[0_3px_0_#166534] active:shadow-none active:translate-y-px rounded-sm retro-title text-sm transition-all"
            >
              Guess
            </button>
          </form>
        )}

        {/* Board */}
        <div className="space-y-1.5">
          {entries.map((entry, i) => {
            const isRevealed = guessedIndices.includes(i);
            return (
              <motion.div
                key={i}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border transition-colors ${
                  isRevealed
                    ? 'bg-emerald-950/40 border-emerald-700/35'
                    : 'bg-[#0b0b0b] border-white/4'
                }`}
              >
                <span className="sports-font text-[10px] text-white/20 w-4 text-right shrink-0 tabular-nums">#{i + 1}</span>
                <div
                  className={`w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 transition-all duration-500 ${
                    isRevealed ? 'ring-emerald-500/40' : 'ring-white/5'
                  }`}
                  style={{
                    filter: isRevealed ? 'none' : 'blur(14px) saturate(0) brightness(0.45)',
                    opacity: isRevealed ? 1 : 0.6,
                  }}
                >
                  <PlayerHeadshot playerId={entry.playerId} sport={sport as 'nba' | 'nfl'} className="w-9 h-9 object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  {isRevealed ? (
                    <>
                      <p className="retro-title text-sm text-emerald-300 leading-tight truncate">{entry.playerName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <TeamLogo abbr={entry.team} sport={sport as 'nba' | 'nfl'} size={18} />
                        <p className="sports-font text-[9px] text-white/40">{entry.year}</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      {showTeamHint && <TeamLogo abbr={entry.team} sport={sport as 'nba' | 'nfl'} size={20} />}
                      <p className="sports-font text-[10px] text-white/20 tracking-[0.2em]">???</p>
                    </div>
                  )}
                </div>
                {isRevealed && catDef && (
                  <span className="sports-font text-xs text-[#22c55e] shrink-0 tabular-nums">
                    {formatStat(entry.stat, categoryKey)}{' '}
                    <span className="text-[9px] opacity-60">{statShortLabel}</span>
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Wrong guesses */}
        {wrongGuesses.length > 0 && (
          <div>
            <p className="sports-font text-[9px] text-white/20 tracking-widest uppercase mb-2">Not in top 10</p>
            <div className="flex flex-wrap gap-1.5">
              {wrongGuesses.map((name, i) => (
                <span key={i} className="sports-font text-[10px] text-red-400/50 bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded-sm">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Player scoreboard */}
        <div className="bg-[#0d0d0d] border border-white/8 rounded-sm p-3">
          <p className="sports-font text-[9px] text-white/25 tracking-widest uppercase mb-2">Players</p>
          <div className="space-y-1.5">
            {players.map(p => {
              const strikes   = playerStrikes[p.player_id] || 0;
              const isElim    = eliminated.includes(p.player_id);
              const guesses   = (cs.guess_attribution || {})[p.player_id] || 0;
              const isCurrent = p.player_id === currentTurnId;
              return (
                <div key={p.player_id} className={`flex items-center gap-2 ${isElim ? 'opacity-30' : ''}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isCurrent && !isElim ? 'bg-[#22c55e]' : 'bg-white/10'}`} />
                  <span className={`sports-font text-sm flex-1 truncate ${p.player_id === currentPlayerId ? 'text-white' : 'text-white/55'}`}>
                    {p.player_name}{isElim ? ' ✕' : ''}
                  </span>
                  <span className="sports-font text-[10px] text-white/25">
                    {Array.from({ length: maxStrikes }).map((_, i) => (
                      <span key={i} className={i < strikes ? 'text-red-400' : 'opacity-20'}>✕</span>
                    ))}
                  </span>
                  <span className="sports-font text-[10px] text-emerald-400 w-8 text-right tabular-nums">{guesses} pts</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <EmoteOverlay
        lobbyId={lobby?.id}
        currentPlayerId={currentPlayerId}
        currentPlayerName={players.find(p => p.player_id === currentPlayerId)?.player_name ?? ''}
      />
    </div>
  );
}
