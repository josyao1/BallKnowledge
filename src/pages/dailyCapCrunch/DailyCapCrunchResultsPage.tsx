import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  fetchDailyLeaderboard,
  submitDailyEntry,
  getStoredPlayerName,
  setStoredPlayerName,
  getNextResetMs,
  getPerfectLineup,
  generateDailyPuzzle,
  type DailyEntry,
  type PerfectPick,
} from '../../services/dailyCapCrunch';
import { ensureAnonymousSession } from '../../lib/supabase';
import { getCategoryAbbr, fmt } from '../../components/capCrunch/capCrunchUtils';
import { isCareerStat } from '../../services/capCrunch';
import { PlayerHeadshot } from '../../components/capCrunch/PlayerHeadshot';
import type { PlayerLineup, StatCategory, SelectedPlayer } from '../../types/capCrunch';
import type { Sport } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatCountdown(targetMs: number): string {
  const diff = Math.max(0, targetMs - Date.now());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function fmtStat(val: number, cat: StatCategory): string {
  if (isCareerStat(cat) || cat.startsWith('total_')) return Math.round(val).toLocaleString();
  return fmt(val);
}

// ─── types ────────────────────────────────────────────────────────────────────

interface FreshState {
  alreadyPlayed?: false;
  dayNumber: number;
  sport: Sport;
  statCategory: StatCategory;
  targetCap: number;
  lineup: PlayerLineup;
  startedAtMs: number;
  finishedAtMs: number;
}

interface AlreadyPlayedState {
  alreadyPlayed: true;
  existingEntry: DailyEntry;
  dayNumber: number;
  sport: Sport;
  statCategory: StatCategory;
  targetCap: number;
}

type PageState = FreshState | AlreadyPlayedState;

// ─── Pick row ─────────────────────────────────────────────────────────────────

function PickRow({
  pick,
  rank,
  cat,
  sport,
  delay,
}: {
  pick: SelectedPlayer;
  rank: number;
  cat: StatCategory;
  sport: Sport;
  delay: number;
}) {
  const bust = pick.isBust || pick.neverOnTeam;
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 28 }}
      className={`flex items-center gap-3 px-3 py-2.5 border-b border-white/5 ${bust ? 'opacity-60' : ''}`}
    >
      <span className="capcrunch-kicker text-white/30 w-4 text-right shrink-0">{rank}</span>
      <PlayerHeadshot
        playerId={pick.playerId}
        sport={sport}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
      <span
        className={`capcrunch-title text-sm flex-1 min-w-0 truncate ${bust ? 'line-through text-white/40' : 'text-white'}`}
      >
        {pick.playerName}
      </span>
      {pick.position && (
        <span className="capcrunch-kicker text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 shrink-0">
          {pick.position}
        </span>
      )}
      <span className="capcrunch-kicker text-white/40 text-[10px] shrink-0">
        {pick.team} {pick.selectedYear ? `'${String(pick.selectedYear).slice(-2)}` : ''}
      </span>
      {bust && pick.isBust ? (
        <span className="shrink-0 text-right">
          <span className="capcrunch-kicker text-red-400 text-[10px] font-bold block">BUST</span>
          <span className="capcrunch-kicker text-white/30 text-[9px] block">
            +{fmtStat(pick.statValue, cat)}
          </span>
        </span>
      ) : bust ? (
        <span className="capcrunch-kicker text-orange-400 text-[10px] font-bold shrink-0">
          INVALID
        </span>
      ) : (
        <span className="capcrunch-title text-sm text-[#FDF100] shrink-0">
          {fmtStat(pick.statValue, cat)}
        </span>
      )}
    </motion.div>
  );
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  rank,
  isMe,
  cat,
  onClick,
}: {
  entry: DailyEntry;
  rank: number;
  isMe: boolean;
  cat: StatCategory;
  onClick: () => void;
}) {
  const exact = entry.distance === 0;
  return (
    <tr
      onClick={onClick}
      className={`text-sm cursor-pointer transition hover:bg-white/5 ${isMe ? 'bg-[#FDF100]/5 text-[#FDF100]' : 'text-white/80'} ${exact ? 'font-bold' : ''}`}
    >
      <td className="py-2 pl-3 pr-2 capcrunch-kicker text-[11px] text-white/40 w-8">{rank}</td>
      <td className="py-2 pr-2 capcrunch-title text-[11px] truncate max-w-[140px]">
        {entry.player_name}
        {isMe && <span className="ml-1 text-[#FDF100]/60 text-[9px]">(you)</span>}
      </td>
      <td className="py-2 pr-2 capcrunch-kicker text-[11px] text-white/60">
        {fmtStat(entry.total_stat, cat)}
      </td>
      <td className="py-2 pr-2 capcrunch-kicker text-[11px]">
        {exact ? (
          <span className="text-green-400">EXACT</span>
        ) : (
          <span className="text-white/50">{entry.distance}</span>
        )}
      </td>
      <td className="py-2 pr-3 capcrunch-kicker text-[11px] text-white/40">
        {formatMs(entry.time_taken_ms)}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

// Outer shell: handles redirect and null guard before any hooks that need pageState
export default function DailyCapCrunchResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const pageState = location.state as PageState | null;

  useEffect(() => {
    if (!pageState) navigate('/', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pageState) return null;
  return <DailyResultsContent pageState={pageState} />;
}

function DailyResultsContent({ pageState }: { pageState: PageState }) {
  const navigate = useNavigate();
  const { dayNumber, sport, statCategory, targetCap } = pageState;

  // Derive picks and result data
  const picks: SelectedPlayer[] = pageState.alreadyPlayed
    ? (pageState.existingEntry.picks as SelectedPlayer[])
    : pageState.lineup.selectedPlayers;

  const total = picks.reduce((s, p) => s + (p.isBust || p.neverOnTeam ? 0 : p.statValue), 0);
  const distance = Math.max(0, targetCap - Math.floor(total));
  const isExact = distance === 0;
  const timeTakenMs = pageState.alreadyPlayed
    ? pageState.existingEntry.time_taken_ms
    : pageState.finishedAtMs - pageState.startedAtMs;

  // Auth + name prompt state
  const [showNamePrompt, setShowNamePrompt] = useState(!pageState.alreadyPlayed);
  const [authLoading, setAuthLoading] = useState(!pageState.alreadyPlayed);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(pageState.alreadyPlayed ?? false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<DailyEntry[]>([]);
  const [loadingLb, setLoadingLb] = useState(false);
  const [peekedEntry, setPeekedEntry] = useState<DailyEntry | null>(null);

  // Perfect lineup state
  const [perfectLineup, setPerfectLineup] = useState<PerfectPick[] | null | 'loading'>('loading');

  // Countdown
  const [countdown, setCountdown] = useState(formatCountdown(getNextResetMs()));
  const [copied, setCopied] = useState(false);

  const submitDoneRef = useRef(false);

  // Countdown ticker
  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdown(getNextResetMs())), 30000);
    return () => clearInterval(id);
  }, []);

  // Load auth + default name on mount (always load playerId for "(you)" badge on leaderboard)
  useEffect(() => {
    ensureAnonymousSession().then((user) => {
      if (user) {
        setPlayerId(user.id);
        if (!pageState.alreadyPlayed) {
          const stored = getStoredPlayerName();
          const fallback = `Player #${user.id.slice(-6).toUpperCase()}`;
          setPlayerName(stored ?? fallback);
        }
      }
      if (!pageState.alreadyPlayed) setAuthLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute perfect lineup once on mount
  useEffect(() => {
    const puzzle = generateDailyPuzzle(sport, dayNumber);
    void getPerfectLineup(dayNumber, sport, statCategory, targetCap, puzzle.roundFilters).then(
      (result) => setPerfectLineup(result),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLeaderboard = async () => {
    setLoadingLb(true);
    const rows = await fetchDailyLeaderboard(dayNumber, sport);
    setLeaderboard(rows);
    setLoadingLb(false);
  };

  useEffect(() => {
    if (submitted) void loadLeaderboard();
  }, [submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!playerId || submitting || submitDoneRef.current) return;
    submitDoneRef.current = true;
    setSubmitting(true);
    const trimmed = playerName.trim() || `Player #${playerId.slice(-6).toUpperCase()}`;
    setStoredPlayerName(trimmed);
    const { error } = await submitDailyEntry({
      day_number: dayNumber,
      player_id: playerId,
      player_name: trimmed,
      sport,
      total_stat: parseFloat(total.toFixed(1)),
      target_cap: targetCap,
      distance,
      time_taken_ms: timeTakenMs,
      picks,
    });
    if (error) console.error('submitDailyEntry failed:', error);
    setSubmitting(false);
    setShowNamePrompt(false);
    setSubmitted(true);
  };

  const handleSkip = () => {
    setShowNamePrompt(false);
    setSubmitted(true);
  };

  const buildShareText = () => {
    const sportLabel = sport === 'nba' ? 'NBA' : 'NFL';
    const catAbbr = getCategoryAbbr(statCategory);
    const lines = [
      `Daily Cap Crunch #${dayNumber} (${sportLabel})`,
      `Target: ${targetCap} ${catAbbr}`,
      '',
      ...picks.map((p, i) => {
        const bust = p.isBust || p.neverOnTeam;
        const year = p.selectedYear ? `'${String(p.selectedYear).slice(-2)}` : '';
        const val = bust ? 'BUST' : fmtStat(p.statValue, statCategory);
        return `${i + 1}. ${p.playerName} (${p.team}${year ? ' ' + year : ''}) — ${val}`;
      }),
      '',
      `Total: ${fmtStat(total, statCategory)} | ${isExact ? 'EXACT HIT!' : `${distance} away`}`,
      `${window.location.origin}/daily/cap-crunch`,
    ];
    return lines.join('\n');
  };

  const handleShare = () => {
    void navigator.clipboard.writeText(buildShareText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const altSport: Sport = sport === 'nba' ? 'nfl' : 'nba';

  return (
    <div className="min-h-screen home-chalkboard text-white flex flex-col">
      {/* Name prompt modal */}
      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="capcrunch-panel p-6 w-full max-w-sm"
          >
            {authLoading ? (
              <p className="capcrunch-kicker text-white/40 text-[11px] text-center py-4 animate-pulse">
                Connecting…
              </p>
            ) : !playerId ? (
              <>
                <h2 className="capcrunch-title text-lg text-white mb-2">Leaderboard Unavailable</h2>
                <p className="capcrunch-kicker text-white/40 text-[11px] mb-4">
                  Sign-in is disabled on this server. Your score won't be saved to the leaderboard.
                </p>
                <button
                  onClick={handleSkip}
                  className="capcrunch-btn-primary capcrunch-title text-sm px-5 py-2.5 w-full"
                >
                  Continue
                </button>
              </>
            ) : (
              <>
                <h2 className="capcrunch-title text-lg text-white mb-1">Add to leaderboard?</h2>
                <p className="capcrunch-kicker text-white/40 text-[11px] mb-4">
                  Your score: {fmtStat(total, statCategory)} / {targetCap} ({distance} away)
                </p>
                <label className="capcrunch-kicker text-white/60 text-[11px] block mb-1">
                  Display name
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.slice(0, 32))}
                  maxLength={32}
                  className="w-full bg-black/40 border border-white/10 focus:border-[#d4af37] outline-none px-3 py-2 text-white text-sm capcrunch-title mb-4"
                  onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                    className="capcrunch-btn-primary capcrunch-title text-sm px-5 py-2.5 flex-1"
                  >
                    {submitting ? 'Saving…' : 'Submit'}
                  </button>
                  <button
                    onClick={handleSkip}
                    className="capcrunch-btn-secondary capcrunch-title text-sm px-4 py-2.5"
                  >
                    Skip
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="capcrunch-title text-xl text-[#FDF100]">
              Daily Cap Crunch #{dayNumber}
            </h1>
            <p className="capcrunch-kicker text-white/40 text-[10px] mt-0.5">
              {sport.toUpperCase()} · {getCategoryAbbr(statCategory)} · Target: {targetCap} · Next
              puzzle in {countdown}
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="capcrunch-btn-secondary capcrunch-title text-xs px-4 py-2"
          >
            Home
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: your picks + summary */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="capcrunch-title text-sm text-white/60 uppercase tracking-wider">
              Your Lineup
            </h2>
            <button
              onClick={handleShare}
              className="capcrunch-btn-secondary capcrunch-kicker text-[11px] px-3 py-1.5"
            >
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>

          <div className="capcrunch-panel">
            {picks.map((pick, i) => (
              <PickRow
                key={i}
                pick={pick}
                rank={i + 1}
                cat={statCategory}
                sport={sport}
                delay={i * 0.08}
              />
            ))}
          </div>

          {/* Score summary */}
          <div className="mt-3 capcrunch-panel px-4 py-3 flex items-center justify-between">
            <div>
              <div className="capcrunch-kicker text-white/40 text-[10px]">TOTAL</div>
              <div className="capcrunch-title text-2xl text-white">
                {fmtStat(total, statCategory)}
              </div>
            </div>
            <div className="text-right">
              <div className="capcrunch-kicker text-white/40 text-[10px]">TARGET</div>
              <div className="capcrunch-title text-2xl text-white/50">{targetCap}</div>
            </div>
            <div className="text-center">
              {isExact ? (
                <div className="capcrunch-title text-lg text-green-400">EXACT!</div>
              ) : (
                <>
                  <div className="capcrunch-kicker text-white/40 text-[10px]">AWAY</div>
                  <div className="capcrunch-title text-2xl text-[#FDF100]">{distance}</div>
                </>
              )}
            </div>
          </div>

          {/* Play other sport / replay links */}
          <div className="mt-4 flex justify-center gap-6">
            <button
              onClick={() =>
                navigate('/daily/cap-crunch', {
                  state: { sport: altSport },
                })
              }
              className="capcrunch-kicker text-white/40 text-[11px] hover:text-white/70 transition"
            >
              Play today's {altSport.toUpperCase()} puzzle →
            </button>
          </div>
        </div>

        {/* Right: leaderboard + perfect lineup */}
        <div className="flex flex-col gap-6">
          {/* Leaderboard */}
          <div>
            <h2 className="capcrunch-title text-sm text-white/60 uppercase tracking-wider mb-3">
              Today's Leaderboard
            </h2>

            {!submitted ? (
              <div className="capcrunch-panel px-4 py-6 text-center">
                <p className="capcrunch-kicker text-white/30 text-[11px]">
                  Submit to see the leaderboard
                </p>
              </div>
            ) : loadingLb ? (
              <div className="capcrunch-panel px-4 py-6 text-center">
                <p className="capcrunch-kicker text-white/30 text-[11px] animate-pulse">Loading…</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="capcrunch-panel px-4 py-6 text-center">
                <p className="capcrunch-kicker text-white/30 text-[11px]">No entries yet</p>
              </div>
            ) : (
              <div className="capcrunch-panel overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="py-2 pl-3 pr-2 capcrunch-kicker text-[10px] text-white/30 text-left">
                        #
                      </th>
                      <th className="py-2 pr-2 capcrunch-kicker text-[10px] text-white/30 text-left">
                        Name
                      </th>
                      <th className="py-2 pr-2 capcrunch-kicker text-[10px] text-white/30 text-left">
                        {getCategoryAbbr(statCategory)}
                      </th>
                      <th className="py-2 pr-2 capcrunch-kicker text-[10px] text-white/30 text-left">
                        Away
                      </th>
                      <th className="py-2 pr-3 capcrunch-kicker text-[10px] text-white/30 text-left">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, i) => (
                      <LeaderboardRow
                        key={entry.id ?? i}
                        entry={entry}
                        rank={i + 1}
                        isMe={entry.player_id === playerId}
                        cat={statCategory}
                        onClick={() => setPeekedEntry(entry)}
                      />
                    ))}
                  </tbody>
                </table>
                <p className="capcrunch-kicker text-white/20 text-[10px] text-center py-2">
                  Click a row to see their lineup
                </p>
              </div>
            )}

            {submitted && leaderboard.length > 0 && (
              <button
                onClick={() => void loadLeaderboard()}
                className="mt-2 capcrunch-kicker text-white/30 text-[10px] hover:text-white/60 transition w-full text-center py-1"
              >
                Refresh
              </button>
            )}
          </div>

          {/* Perfect lineup */}
          <div>
            <h2 className="capcrunch-title text-sm text-white/60 uppercase tracking-wider mb-3">
              Potential Perfect Lineup
            </h2>
            {perfectLineup === 'loading' ? (
              <div className="capcrunch-panel px-4 py-6 text-center">
                <p className="capcrunch-kicker text-white/30 text-[11px] animate-pulse">
                  Calculating…
                </p>
              </div>
            ) : perfectLineup === null ? (
              <div className="capcrunch-panel px-4 py-6 text-center">
                <p className="capcrunch-kicker text-white/30 text-[11px]">Could not compute</p>
              </div>
            ) : (
              <div className="capcrunch-panel">
                {perfectLineup.map((pick, i) => {
                  const yearShort = pick.year ? `'${String(pick.year).slice(-2)}` : '';
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 border-b border-white/5"
                    >
                      <span className="capcrunch-kicker text-white/30 w-4 text-right shrink-0">
                        {i + 1}
                      </span>
                      <PlayerHeadshot
                        playerId={pick.playerId}
                        sport={sport}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <span className="capcrunch-title text-sm text-white flex-1 min-w-0 truncate">
                        {pick.playerName}
                      </span>
                      {pick.position && (
                        <span className="capcrunch-kicker text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 shrink-0">
                          {pick.position}
                        </span>
                      )}
                      <span className="capcrunch-kicker text-white/40 text-[10px] shrink-0">
                        {pick.team}
                        {yearShort ? ` ${yearShort}` : ''}
                      </span>
                      <span className="capcrunch-title text-sm text-[#d4af37] shrink-0">
                        {fmtStat(pick.stat, statCategory)}
                      </span>
                    </div>
                  );
                })}
                <div className="px-3 py-2 flex justify-between">
                  <span className="capcrunch-kicker text-white/30 text-[10px]">TOTAL</span>
                  <span className="capcrunch-title text-sm text-[#d4af37]">
                    {fmtStat(
                      parseFloat(perfectLineup.reduce((s, p) => s + p.stat, 0).toFixed(1)),
                      statCategory,
                    )}{' '}
                    / {targetCap}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Lineup peek popup */}
      {peekedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPeekedEntry(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="capcrunch-panel p-0 w-full max-w-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="capcrunch-title text-sm text-white">{peekedEntry.player_name}</p>
                <p className="capcrunch-kicker text-white/40 text-[10px]">
                  {fmtStat(peekedEntry.total_stat, statCategory)} ·{' '}
                  {peekedEntry.distance === 0 ? 'EXACT' : `${peekedEntry.distance} away`} ·{' '}
                  {formatMs(peekedEntry.time_taken_ms)}
                </p>
              </div>
              <button
                onClick={() => setPeekedEntry(null)}
                className="capcrunch-kicker text-white/30 hover:text-white text-lg leading-none px-2"
              >
                ×
              </button>
            </div>
            {(peekedEntry.picks as SelectedPlayer[]).map((pick, i) => {
              const bust = pick.isBust || pick.neverOnTeam;
              const year = pick.selectedYear ? `'${String(pick.selectedYear).slice(-2)}` : '';
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 border-b border-white/5 ${bust ? 'opacity-50' : ''}`}
                >
                  <span className="capcrunch-kicker text-white/30 w-4 text-right shrink-0">
                    {i + 1}
                  </span>
                  <PlayerHeadshot
                    playerId={pick.playerId}
                    sport={sport}
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                  <span
                    className={`capcrunch-title text-sm flex-1 min-w-0 truncate ${bust ? 'line-through text-white/40' : 'text-white'}`}
                  >
                    {pick.playerName}
                  </span>
                  {pick.position && (
                    <span className="capcrunch-kicker text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 shrink-0">
                      {pick.position}
                    </span>
                  )}
                  <span className="capcrunch-kicker text-white/40 text-[10px] shrink-0">
                    {pick.team}
                    {year ? ` ${year}` : ''}
                  </span>
                  {bust && pick.isBust ? (
                    <span className="shrink-0 text-right">
                      <span className="capcrunch-kicker text-red-400 text-[10px] font-bold block">
                        BUST
                      </span>
                      <span className="capcrunch-kicker text-white/30 text-[9px] block">
                        +{fmtStat(pick.statValue, statCategory)}
                      </span>
                    </span>
                  ) : bust ? (
                    <span className="capcrunch-kicker text-orange-400 text-[10px] font-bold shrink-0">
                      INVALID
                    </span>
                  ) : (
                    <span className="capcrunch-title text-sm text-[#FDF100] shrink-0">
                      {fmtStat(pick.statValue, statCategory)}
                    </span>
                  )}
                </div>
              );
            })}
          </motion.div>
        </div>
      )}
    </div>
  );
}
