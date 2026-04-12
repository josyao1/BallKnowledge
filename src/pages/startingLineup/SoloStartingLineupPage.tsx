/**
 * SoloStartingLineupPage.tsx — Solo "Starting Lineup" game mode (NFL + NBA).
 *
 * Phase machine: loading → guessing → bonus → results
 *
 * Guessing phase: see the field/court of encoded blobs, type the team name.
 *   - 1st correct guess: 10 pts
 *   - 2nd+ correct guess: 5 pts
 *   - Give Up: skip to results with 0 pts
 *
 * Bonus phase (optional): blobs become "?" — tap to name each player.
 *   - 60-second timer, +1 pt per correct player (max 11 NFL / 5 NBA)
 *
 * Results: score breakdown + Play Again / Home buttons.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  loadNFLStarters,
  loadNBAStarters,
  getRandomNFLTeamAndSide,
  getRandomNBATeam,
  getRandomEncoding,
  pickBestEncoding,
  type NFLStartersData,
  type NBAStartersData,
  type StarterPlayer,
  type StarterEncoding,
} from '../../services/startingLineupData';
import { NFLFieldLayout } from '../../components/startingLineup/NFLFieldLayout';
import { NBACourtLayout } from '../../components/startingLineup/NBACourtLayout';
import { nflTeams } from '../../data/nfl-teams';
import { teams as nbaTeams } from '../../data/teams';
import { useSettingsStore } from '../../stores/settingsStore';
import { areSimilarNames } from '../../utils/fuzzyDedup';

type Phase = 'loading' | 'guessing' | 'bonus' | 'results';

type AnyTeam = { name: string; city?: string; abbreviation: string; colors: { primary: string } };

function normalizeTeamInput(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function teamMatchesInput(input: string, team: AnyTeam): boolean {
  const norm = normalizeTeamInput(input);
  if (!norm) return false;
  const name = normalizeTeamInput(team.name);
  const city = team.city ? normalizeTeamInput(team.city) : '';
  const abbr = team.abbreviation.toLowerCase();
  return (
    name.includes(norm) ||
    (city && city.includes(norm)) ||
    abbr === norm ||
    norm.includes(abbr) ||
    name.split(' ').some(w => w.startsWith(norm) && norm.length >= 3)
  );
}

export function SoloStartingLineupPage() {
  const navigate = useNavigate();
  const { sport } = useSettingsStore();
  const isNBA = sport === 'nba';

  const [phase, setPhase] = useState<Phase>('loading');
  const [nflData, setNflData] = useState<NFLStartersData | null>(null);
  const [nbaData, setNbaData] = useState<NBAStartersData | null>(null);

  // Current round state
  const [team, setTeam] = useState('');
  const [side, setSide] = useState<'offense' | 'defense' | null>(null);
  const [players, setPlayers] = useState<StarterPlayer[]>([]);
  const [encoding, setEncoding] = useState<StarterEncoding>('college');
  const [gaveUp, setGaveUp] = useState(false);

  // Guessing phase
  const [guessInput, setGuessInput] = useState('');
  const [suggestions, setSuggestions] = useState<AnyTeam[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [score, setScore] = useState(0);
  const [teamGuessScore, setTeamGuessScore] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hint mode (NBA only)
  const [hintEnabled, setHintEnabled] = useState(false);

  // Bonus phase
  const [bonusTimeLeft, setBonusTimeLeft] = useState(60);
  const [bonusCorrect, setBonusCorrect] = useState<Set<string>>(new Set());
  const bonusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teamList: AnyTeam[] = isNBA
    ? nbaTeams.map(t => ({ name: t.name, city: t.city, abbreviation: t.abbreviation, colors: t.colors }))
    : nflTeams.map(t => ({ name: t.name, city: t.city, abbreviation: t.abbreviation, colors: t.colors }));

  // Load starters on mount
  useEffect(() => {
    if (isNBA) {
      loadNBAStarters().then(data => {
        setNbaData(data);
        startRound(null, data);
      }).catch(err => console.error('Failed to load starters:', err));
    } else {
      loadNFLStarters().then(data => {
        setNflData(data);
        startRound(data, null);
      }).catch(err => console.error('Failed to load starters:', err));
    }
  }, [isNBA]);

  function startRound(nfl: NFLStartersData | null, nba: NBAStartersData | null, excludeTeam?: string) {
    let pickedPlayers: StarterPlayer[];
    let pickedTeam: string;
    let pickedSide: 'offense' | 'defense' | null = null;

    if (isNBA && nba) {
      const pick = getRandomNBATeam(nba, excludeTeam);
      pickedTeam = pick.team;
      pickedPlayers = pick.players;
    } else if (!isNBA && nfl) {
      const pick = getRandomNFLTeamAndSide(nfl, excludeTeam);
      pickedTeam = pick.team;
      pickedSide = pick.side;
      pickedPlayers = pick.players;
    } else {
      return;
    }

    let enc = getRandomEncoding();
    const dataScore = {
      college: pickedPlayers.filter(p => p.college_espn_id != null).length,
      number:  pickedPlayers.filter(p => p.number != null).length,
      draft:   pickedPlayers.filter(p => p.draft_pick != null).length,
    };
    if (dataScore[enc] < (isNBA ? 3 : 5)) enc = pickBestEncoding(pickedPlayers);

    setTeam(pickedTeam);
    setSide(pickedSide);
    setPlayers(pickedPlayers);
    setEncoding(enc);
    setGuessInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    setWrongGuesses([]);
    setShake(false);
    setGaveUp(false);
    setHintEnabled(false);
    setTeamGuessScore(0);
    setBonusCorrect(new Set());
    setBonusTimeLeft(60);
    setPhase('guessing');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleGuessInput(value: string) {
    setGuessInput(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const matches = teamList.filter(t => teamMatchesInput(value, t)).slice(0, 5);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }

  function submitGuess(guessedAbbr?: string) {
    const inputVal = guessedAbbr
      ? teamList.find(t => t.abbreviation === guessedAbbr)?.name || guessInput
      : guessInput;

    setShowSuggestions(false);
    setGuessInput('');

    const correctTeam = teamList.find(t => t.abbreviation === team);
    if (!correctTeam) return;

    const isCorrect = guessedAbbr === team ||
      (!guessedAbbr && teamMatchesInput(inputVal, correctTeam) &&
        teamList.filter(t => teamMatchesInput(inputVal, t)).length === 1 &&
        teamList.filter(t => teamMatchesInput(inputVal, t))[0].abbreviation === team);

    if (isCorrect) {
      const pts = wrongGuesses.length === 0 ? 10 : 5;
      setTeamGuessScore(pts);
      setScore(s => s + pts);
      setTimeout(() => {
        setPhase('bonus');
        startBonusTimer();
      }, 800);
    } else {
      setWrongGuesses(prev => [...prev, inputVal]);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleGiveUp() {
    setGaveUp(true);
    setTeamGuessScore(0);
    setPhase('results');
  }

  function startBonusTimer() {
    setBonusTimeLeft(60);
    if (bonusTimerRef.current) clearInterval(bonusTimerRef.current);
    bonusTimerRef.current = setInterval(() => {
      setBonusTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(bonusTimerRef.current!);
          bonusTimerRef.current = null;
          endBonus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleBonusGuess(playerId: string, name: string) {
    const player = players.find(p => p.id === playerId);
    if (!player || bonusCorrect.has(playerId)) return;
    if (areSimilarNames(name, player.name)) {
      setBonusCorrect(prev => {
        const next = new Set(prev);
        next.add(playerId);
        return next;
      });
      setScore(s => s + 1);
    }
  }

  function skipBonus() {
    if (bonusTimerRef.current) {
      clearInterval(bonusTimerRef.current);
      bonusTimerRef.current = null;
    }
    endBonus();
  }

  const endBonus = useCallback(() => {
    if (bonusTimerRef.current) {
      clearInterval(bonusTimerRef.current);
      bonusTimerRef.current = null;
    }
    setPhase('results');
  }, []);

  useEffect(() => () => {
    if (bonusTimerRef.current) clearInterval(bonusTimerRef.current);
  }, []);

  function playAgain() {
    startRound(nflData, nbaData, team);
  }

  const correctTeamObj = teamList.find(t => t.abbreviation === team);
  const encodingLabel = { college: 'college logos', number: 'jersey numbers', draft: 'draft picks' }[encoding];
  const maxBonus = isNBA ? 5 : 11;
  const sportLabel = isNBA ? 'NBA' : 'NFL';
  const contextLine = isNBA
    ? `${correctTeamObj?.name || team} · ${encodingLabel}`
    : `${correctTeamObj?.name || team} · ${side} · ${encodingLabel}`;

  function renderLayout(blobState: 'hidden' | 'revealed' | 'bonus-guess') {
    if (isNBA) {
      return (
        <NBACourtLayout
          players={players}
          encoding={encoding}
          blobState={blobState}
          bonusCorrect={bonusCorrect}
          onBonusGuess={blobState === 'bonus-guess' ? handleBonusGuess : undefined}
          showHint={blobState === 'hidden' && hintEnabled}
        />
      );
    }
    return (
      <NFLFieldLayout
        players={players}
        side={side ?? 'offense'}
        encoding={encoding}
        blobState={blobState}
        bonusCorrect={bonusCorrect}
        onBonusGuess={blobState === 'bonus-guess' ? handleBonusGuess : undefined}
        showHint={blobState === 'hidden' && hintEnabled}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#222]">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="retro-title text-2xl text-[#ea580c]">Starting Lineup</h1>
          {phase !== 'loading' && phase !== 'results' && (
            <div className="sports-font text-[10px] text-[#ea580c]/50 tracking-widest">{sportLabel}</div>
          )}
        </div>

        <div className="min-w-[40px] text-right">
          {phase !== 'loading' && phase !== 'results' && (
            <div>
              <div className="retro-title text-xl text-[#fdb927]">{score}</div>
              <div className="text-[9px] text-white/30 sports-font">PTS</div>
            </div>
          )}
        </div>
      </header>

      {/* Loading */}
      {phase === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/30 sports-font tracking-widest text-sm">Loading lineup...</div>
        </div>
      )}

      {/* Guessing phase */}
      {phase === 'guessing' && (
        <div className="flex-1 flex flex-col px-3 py-3 gap-3 max-w-2xl mx-auto w-full">
          {renderLayout('hidden')}

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-white/40 sports-font tracking-wider">
              {isNBA
                ? `Which ${sportLabel} team's starting 5 is this? · ${encodingLabel}`
                : `Which ${sportLabel} team's ${side} is this? · ${encodingLabel}`}
            </p>
            <button
              onClick={() => setHintEnabled(h => !h)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sports-font border transition-all ${
                hintEnabled
                  ? 'border-[#fdb927]/50 text-[#fdb927] bg-[#fdb927]/10'
                  : 'border-white/10 text-white/30 hover:border-white/20 hover:text-white/50'
              }`}
            >
              {isNBA ? 'PPG' : 'INITIALS'} {hintEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {wrongGuesses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {wrongGuesses.map((g, i) => (
                <span key={i} className="px-2 py-0.5 bg-red-900/20 border border-red-800/40 rounded text-xs sports-font text-red-400">
                  ✗ {g}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <motion.div
              animate={shake ? { x: [-8, 8, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.3 }}
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
                  className="flex-1 bg-[#1a1a1a] border-2 border-[#3d3d3d] rounded-lg px-4 py-3 sports-font text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#ea580c]"
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
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#3d3d3d] rounded-lg overflow-hidden z-20 shadow-xl"
                  >
                    {suggestions.map(t => (
                      <button
                        key={t.abbreviation}
                        onMouseDown={e => { e.preventDefault(); submitGuess(t.abbreviation); }}
                        className="w-full text-left px-4 py-2.5 sports-font text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-3"
                      >
                        <span
                          className="w-8 h-5 rounded text-[9px] font-bold flex items-center justify-center text-white"
                          style={{ background: t.colors.primary }}
                        >
                          {t.abbreviation}
                        </span>
                        {t.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <button
              onClick={handleGiveUp}
              className="w-full py-2 rounded-lg sports-font text-xs bg-[#1a1a1a] border-2 border-red-900/50 text-red-400 hover:border-red-700 transition-all"
            >
              Give Up
            </button>
          </div>
        </div>
      )}

      {/* Bonus phase */}
      {phase === 'bonus' && (
        <div className="flex-1 flex flex-col px-3 py-3 gap-3 max-w-2xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-between px-4 py-2 bg-[#ea580c]/10 border border-[#ea580c]/40 rounded-lg"
          >
            <div>
              <div className="text-[9px] text-[#ea580c]/60 sports-font tracking-widest uppercase">Correct!</div>
              <div className="retro-title text-lg text-[#fdb927]">{correctTeamObj?.name || team}</div>
            </div>
            <div className="text-right">
              <div className="retro-title text-xl text-[#ea580c]">+{teamGuessScore}</div>
              <div className="text-[9px] text-[#ea580c]/50 sports-font">pts</div>
            </div>
          </motion.div>

          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] text-white/40 sports-font tracking-wider">
              Tap blobs to name players — +1 pt each
            </p>
            <div className={`retro-title text-lg ${bonusTimeLeft <= 10 ? 'text-red-400' : 'text-white/60'}`}>
              {bonusTimeLeft}s
            </div>
          </div>

          {renderLayout('bonus-guess')}

          <div className="flex items-center justify-between px-1">
            <div className="text-[11px] text-white/40 sports-font">
              {bonusCorrect.size}/{Math.min(players.length, maxBonus)} players named
            </div>
            <button
              onClick={skipBonus}
              className="text-[11px] text-white/30 sports-font hover:text-white/60 transition-colors underline"
            >
              Skip →
            </button>
          </div>
        </div>
      )}

      {/* Results phase */}
      {phase === 'results' && (
        <div className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="text-center">
              <div className="sports-font text-[10px] text-white/30 tracking-[0.4em] uppercase mb-2">
                {gaveUp ? 'Better luck next time' : 'Round Complete'}
              </div>
              <div className={`retro-title text-5xl ${gaveUp ? 'text-white/40' : 'text-[#ea580c]'}`}>
                +{teamGuessScore + bonusCorrect.size}
              </div>
              <div className="sports-font text-sm text-white/40 mt-1">points this round</div>
            </div>

            {gaveUp && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-4 py-3 bg-[#1a1a1a] border-2 border-[#555] rounded-lg text-center"
              >
                <div className="sports-font text-[10px] text-[#888] tracking-widest uppercase mb-1">The Answer Was</div>
                <div className="retro-title text-2xl text-[#fdb927]">{correctTeamObj?.name || team}</div>
              </motion.div>
            )}

            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2a2a] flex justify-between items-center">
                <span className="sports-font text-sm text-white/60">Team guess</span>
                <span className="retro-title text-lg text-[#fdb927]">
                  {teamGuessScore > 0 ? `+${teamGuessScore}` : gaveUp ? 'Gave up' : '0'}
                  {!gaveUp && wrongGuesses.length > 0 && (
                    <span className="text-xs text-white/30 ml-1">({wrongGuesses.length} wrong)</span>
                  )}
                </span>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="sports-font text-sm text-white/60">Bonus players</span>
                <span className="retro-title text-lg text-[#ea580c]">+{bonusCorrect.size}</span>
              </div>
            </div>

            <p className="text-center text-[11px] text-white/30 sports-font">{contextLine}</p>

            {renderLayout('revealed')}

            <div className="text-center">
              <div className="text-[10px] text-white/30 sports-font tracking-widest uppercase">Total Score</div>
              <div className="retro-title text-3xl text-[#fdb927]">{score}</div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={playAgain}
                className="flex-1 py-4 rounded-lg retro-title text-xl tracking-wider transition-all bg-gradient-to-b from-[#ea580c] to-[#c2410c] text-white shadow-[0_4px_0_#9a3412] active:shadow-none active:translate-y-1"
              >
                Play Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-4 rounded-lg sports-font text-sm bg-[#1a1a1a] border-2 border-[#333] text-white/60 hover:border-[#555] transition-all"
              >
                Home
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
