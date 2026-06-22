/**
 * CapCrunchPickPanel.tsx — Player search, year selection, and confirm flow.
 *
 * Handles three internal views based on parent state:
 *   1. Search — type a player name, see results
 *   2. Year select — pick which season (normal mode) or confirm directly (total_gp / career stat)
 *   3. Submitted — waiting for other players, or "all picks in" when finished
 *
 * All data fetching lives in the parent (MultiplayerCapCrunchPage). This
 * component only fires callbacks and renders what it receives.
 */

import { motion } from 'framer-motion';
import {
  isConferenceRound,
  parseConferenceRound,
  isDivisionRound,
  isDivisionDraftRound,
  parseDivisionDraftRound,
  isTeammateRound,
  parseTeammateRound,
  isNameMatchRound,
  parseNameRound,
  isWildcardRound,
  formatHeightInches,
} from '../../services/capCrunch';
import {
  HEIGHT_THRESHOLD_NBA,
  HEIGHT_THRESHOLD_NFL,
  WEIGHT_THRESHOLD,
} from '../../services/capCrunchData';
import type { HWFilter } from '../../services/capCrunch';
import type { PlayerLineup, StatCategory } from '../../types/capCrunch';

interface Player {
  player_id: string;
  player_name: string;
}

interface SearchResult {
  playerId: string | number;
  playerName: string;
}

interface Props {
  myLineup: (PlayerLineup & { hasPickedThisRound?: boolean }) | undefined;
  /** False when it's not your turn (hard mode) or you've already submitted this round */
  canPickThisRound: boolean;
  /** Hard mode = turn-based (one picker at a time); false = simultaneous picks */
  hardMode: boolean;
  /** Player whose turn it currently is (hard mode only) */
  currentPickerId: string | null;
  players: Player[];
  totalRounds: number;
  /** Name of the player selected so far this pick (null = still on search view) */
  selectedPlayerName: string | null;
  /** Skip year selection — used for total_gp and career stat rounds */
  isNoYearSelect: boolean;
  /** Career stat rounds count all-team totals rather than a single team-season */
  isCareerStatRound: boolean;
  currentTeam: string;
  searchQuery: string;
  searchResults: SearchResult[];
  loading: boolean;
  loadingYears: boolean;
  availableYears: string[];
  selectedYear: string;
  duplicateError: string | null;
  /** Server-side error from the confirm step (e.g. player not on team) */
  pickError: string | null;
  addingPlayer: boolean;
  /** Players already picked by *this* user across all rounds — shown as "already used" */
  usedPlayerNames: Set<string>;
  /** Players currently locked in by *other* users this round — shown as "taken" */
  lockedPlayerNames: Set<string>;
  /** Players who haven't submitted their pick yet this round */
  waitingFor: Player[];
  selectedSport: 'nba' | 'nfl' | null;
  statCategory: StatCategory | null;
  hwFilter?: HWFilter | null;
  /** Whether the current user is the host (enables force-skip controls) */
  isHost?: boolean;
  onSearch: (query: string) => void;
  onSelectPlayer: (player: SearchResult) => void;
  onSelectYear: (year: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  /** Host-only: forcibly skip a stuck player's turn */
  onHostSkipPlayer?: (playerId: string) => void;
}

export function CapCrunchPickPanel({
  myLineup,
  canPickThisRound,
  hardMode,
  currentPickerId,
  players,
  totalRounds,
  selectedPlayerName,
  isNoYearSelect,
  isCareerStatRound,
  currentTeam,
  searchQuery,
  searchResults,
  loading,
  loadingYears,
  availableYears,
  selectedYear,
  duplicateError,
  pickError,
  addingPlayer,
  usedPlayerNames,
  lockedPlayerNames,
  waitingFor,
  selectedSport,
  statCategory: _statCategory,
  hwFilter,
  isHost,
  onSearch,
  onSelectPlayer,
  onSelectYear,
  onConfirm,
  onBack,
  onHostSkipPlayer,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="capcrunch-panel p-4 flex-1 min-h-0 flex flex-col"
    >
      {myLineup?.isFinished ? (
        // ── All picks made ──────────────────────────────────────────────────
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-2xl text-[#70BE5B] capcrunch-title">All Picks In!</p>
          <p className="text-white/50 capcrunch-body text-sm">
            You've made all {totalRounds} picks. Sit tight while others finish.
          </p>
          {(myLineup.bustCount ?? 0) > 0 && (
            <p className="text-red-400/70 capcrunch-kicker text-xs">
              {myLineup.bustCount} bust pick{myLineup.bustCount !== 1 ? 's' : ''} — each counted as
              0
            </p>
          )}
          {waitingFor.length > 0 && isHost && onHostSkipPlayer && (
            <div className="bg-black/40 border border-white/10 rounded p-3 w-full max-w-xs mt-2">
              <p className="capcrunch-kicker text-[10px] text-white/30 mb-2">Still picking</p>
              {waitingFor.map((p) => (
                <div key={p.player_id} className="flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-xs">⏳</span>
                    <span className="text-white/70 text-sm">{p.player_name}</span>
                  </div>
                  <button
                    onClick={() => onHostSkipPlayer(p.player_id)}
                    className="text-[10px] capcrunch-kicker tracking-wider text-orange-400/60 hover:text-orange-400 transition-colors shrink-0"
                  >
                    skip
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : canPickThisRound ? (
        // ── Picking ─────────────────────────────────────────────────────────
        <>
          {!selectedPlayerName ? (
            // Search view
            <div>
              <label className="block capcrunch-kicker text-[9px] text-white/60 mb-2">
                Search for a player
              </label>
              {(() => {
                if (isNameMatchRound(currentTeam)) {
                  const { type, pickIndex, proConf } = parseNameRound(currentTeam);
                  const refName = myLineup?.selectedPlayers?.[pickIndex - 1]?.playerName;
                  const parts = refName ? refName.split(' ') : [];
                  const SUFFIXES = new Set(['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'Jr.', 'Sr.']);
                  const filtered = parts.filter((p) => !SUFFIXES.has(p));
                  const required =
                    type === 'first'
                      ? parts[0]
                      : (filtered[filtered.length - 1] ?? parts[parts.length - 1]);
                  const initial = (required?.[0] ?? '?').toUpperCase();
                  const CONF_COLORS: Record<string, string> = {
                    AFC: '#ef4444',
                    NFC: '#3b82f6',
                    East: '#34d399',
                    West: '#fb923c',
                  };
                  const color = proConf ? (CONF_COLORS[proConf] ?? '#06b6d4') : '#06b6d4';
                  return (
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span
                        className="px-2 py-0.5 border text-[10px] capcrunch-kicker"
                        style={{ borderColor: color, color }}
                      >
                        {type === 'first' ? 'First' : 'Last'} initial: {initial}
                      </span>
                      {proConf && (
                        <span
                          className="px-2 py-0.5 border text-[10px] capcrunch-kicker"
                          style={{ borderColor: color, color }}
                        >
                          {proConf}
                        </span>
                      )}
                    </div>
                  );
                }
                if (isTeammateRound(currentTeam)) {
                  const { pickIndex } = parseTeammateRound(currentTeam);
                  const refName =
                    myLineup?.selectedPlayers?.[pickIndex - 1]?.playerName ?? `Pick ${pickIndex}`;
                  return (
                    <p className="text-[10px] text-[#68BBE5] capcrunch-kicker mb-2">
                      Played with {refName}
                    </p>
                  );
                }
                if (isConferenceRound(currentTeam)) {
                  const { college, nflConf } = parseConferenceRound(currentTeam);
                  return (
                    <p className="text-[10px] text-[#FDF100] capcrunch-kicker mb-2">
                      {college}
                      {nflConf ? ` + ${nflConf}` : ''}
                    </p>
                  );
                }
                if (isDivisionRound(currentTeam)) {
                  return (
                    <p className="text-[10px] text-[#FDF100] capcrunch-kicker mb-2">
                      Division: {currentTeam}
                    </p>
                  );
                }
                if (isDivisionDraftRound(currentTeam)) {
                  const { division, draftRound } = parseDivisionDraftRound(currentTeam);
                  return (
                    <p className="text-[10px] text-[#FDF100] capcrunch-kicker mb-2">
                      {division} · {draftRound}
                    </p>
                  );
                }
                return null;
              })()}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Enter player name..."
                className="w-full px-4 py-3 bg-black/35 text-white border border-[#68BBE5]/25 focus:outline-none focus:border-[#68BBE5]/60 mb-3 text-base capcrunch-body"
              />
              {loading && <p className="text-white/60 text-sm">Loading...</p>}
              {!loading && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-white/30 text-[9px] capcrunch-kicker mt-1">
                  No results — player may be too recent, have limited stats, or try a different
                  spelling.
                </p>
              )}
              {duplicateError && (
                <p className="text-red-400 text-sm font-semibold mb-2">{duplicateError}</p>
              )}
              {searchResults.length > 0 && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto overscroll-contain">
                  {searchResults.map((result, idx) => {
                    const alreadyUsed = usedPlayerNames.has(result.playerName);
                    const taken = lockedPlayerNames.has(result.playerName);
                    const disabled = alreadyUsed || taken;
                    return (
                      <button
                        key={String(result.playerId) + idx}
                        onClick={() => onSelectPlayer(result)}
                        className={`w-full text-left px-4 py-3 rounded border transition text-sm font-semibold ${
                          disabled
                            ? 'bg-black/40 border-white/5 text-white/25 cursor-not-allowed line-through'
                            : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 text-white'
                        }`}
                      >
                        {result.playerName}
                        {alreadyUsed && (
                          <span className="ml-2 text-[10px] text-white/20 no-underline not-italic font-normal">
                            (already used)
                          </span>
                        )}
                        {taken && (
                          <span className="ml-2 text-[10px] text-red-400/40 no-underline not-italic font-normal">
                            (taken)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : isNoYearSelect ? (
            // ── Total GP / career stat: no year needed, just confirm ──────
            <div className="flex flex-col gap-3 h-full">
              <div className="p-3 capcrunch-panel-soft">
                <p className="capcrunch-title text-base text-white truncate">
                  {selectedPlayerName}
                </p>
                <p className="text-xs text-white/60 mt-0.5">
                  {isWildcardRound(currentTeam)
                    ? isCareerStatRound
                      ? 'Total career stats — no restrictions'
                      : 'All career GP — no restrictions'
                    : isNameMatchRound(currentTeam)
                      ? (() => {
                          const { type, pickIndex, proConf } = parseNameRound(currentTeam);
                          const refName =
                            myLineup?.selectedPlayers?.[pickIndex - 1]?.playerName ??
                            `Pick ${pickIndex}`;
                          const parts = refName.split(' ');
                          const SUFFIXES = new Set([
                            'Jr',
                            'Sr',
                            'II',
                            'III',
                            'IV',
                            'V',
                            'Jr.',
                            'Sr.',
                          ]);
                          const filtered = parts.filter((p) => !SUFFIXES.has(p));
                          const required =
                            type === 'first'
                              ? parts[0]
                              : (filtered[filtered.length - 1] ?? parts[parts.length - 1]);
                          return `${isCareerStatRound ? 'Total career stats' : 'All career GP'} — ${type} initial must be "${(required[0] ?? '').toUpperCase()}"${proConf ? ` + played for ${proConf}` : ''}`;
                        })()
                      : isCareerStatRound
                        ? isConferenceRound(currentTeam)
                          ? `Total career stats — must have attended a ${currentTeam} school`
                          : isTeammateRound(currentTeam)
                            ? `Total career stats — must have played with Pick ${parseTeammateRound(currentTeam).pickIndex} at some point`
                            : `Total career stats (all teams) — must have played for ${currentTeam} at some point`
                        : isConferenceRound(currentTeam)
                          ? `Will count all career GP — must have attended a ${currentTeam} school`
                          : isTeammateRound(currentTeam)
                            ? `Will count all career GP — must have played with Pick ${parseTeammateRound(currentTeam).pickIndex} at some point`
                            : `Will count all career GP with ${currentTeam}`}
                  {hwFilter &&
                    ` — ${hwFilter === 'height_above' ? `above ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)} tall` : hwFilter === 'height_below' ? `below ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)} tall` : hwFilter === 'weight_above' ? `above ${WEIGHT_THRESHOLD} lbs` : `below ${WEIGHT_THRESHOLD} lbs`}`}
                </p>
              </div>
              <div className="flex-1 flex items-center justify-center text-center">
                <p className="text-white/30 capcrunch-body text-xs leading-relaxed">
                  {isWildcardRound(currentTeam) ? (
                    <>No constraints — pick any player freely</>
                  ) : isNameMatchRound(currentTeam) ? (
                    <>
                      Career stats — no team constraint
                      <br />
                      initial match is the only requirement
                    </>
                  ) : (
                    <>
                      Games played across every season
                      <br />
                      this player was on the team
                    </>
                  )}
                </p>
              </div>
              {pickError && <p className="text-red-400 text-xs mt-1">{pickError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onBack}
                  className="flex-1 px-4 py-2.5 capcrunch-btn-secondary text-sm capcrunch-title"
                >
                  Back
                </button>
                <button
                  onClick={onConfirm}
                  disabled={addingPlayer}
                  className="flex-1 px-4 py-2.5 capcrunch-btn-primary disabled:opacity-50 text-sm capcrunch-title"
                >
                  {addingPlayer ? 'Adding...' : 'Confirm'}
                </button>
              </div>
            </div>
          ) : (
            // ── Normal mode: pick a year ──────────────────────────────────
            <div className="space-y-2 flex flex-col flex-1 overflow-hidden">
              <div className="p-3 capcrunch-panel-soft">
                <p className="capcrunch-title text-base text-white truncate">
                  {selectedPlayerName}
                </p>
                <p className="text-xs text-white/60 mt-0.5">Select any year this player played</p>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="flex items-baseline justify-between mb-2 flex-shrink-0">
                  <label className="capcrunch-kicker text-[9px] text-white/60">Select a year</label>
                  {selectedSport === 'nfl' && !isCareerStatRound && (
                    <span className="text-white/25 text-[8px] capcrunch-kicker">through 2025</span>
                  )}
                </div>
                {loadingYears ? (
                  <p className="text-white/60 text-sm">Loading years...</p>
                ) : availableYears.length > 0 ? (
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                    {availableYears.map((year) => (
                      <button
                        key={year}
                        onClick={() => onSelectYear(year)}
                        className={`w-full px-4 py-2.5 rounded border transition text-white font-semibold text-sm ${
                          selectedYear === year
                            ? 'bg-[#FDF100] text-black border-[#FDF100]'
                            : 'bg-white/[0.03] border-white/10 hover:border-[#68BBE5]/40'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-red-400 text-sm">
                    No data found — player may be too recent, have limited stats, or try a different
                    spelling.
                  </p>
                )}
              </div>
              {pickError && <p className="text-red-400 text-xs mt-1">{pickError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onBack}
                  className="flex-1 px-4 py-2.5 capcrunch-btn-secondary text-sm capcrunch-title"
                >
                  Back
                </button>
                <button
                  onClick={onConfirm}
                  disabled={!selectedYear || addingPlayer}
                  className="flex-1 px-4 py-2.5 capcrunch-btn-primary disabled:opacity-50 text-sm capcrunch-title"
                >
                  {addingPlayer ? 'Adding...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        // ── Submitted / waiting ──────────────────────────────────────────────
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          {hardMode && !myLineup?.hasPickedThisRound ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg text-[#FDF100] capcrunch-title mb-1">Waiting for your turn</p>
              <p className="text-white/50 capcrunch-body text-sm">
                {players.find((p) => p.player_id === currentPickerId)?.player_name ?? '...'} is
                picking
              </p>
              {isHost && currentPickerId && onHostSkipPlayer && (
                <button
                  onClick={() => onHostSkipPlayer(currentPickerId)}
                  className="mt-1 px-3 py-1 text-[11px] capcrunch-kicker tracking-wider uppercase text-orange-400/70 border border-orange-400/30 rounded hover:text-orange-400 hover:border-orange-400/60 transition-colors"
                >
                  Skip{' '}
                  {players.find((p) => p.player_id === currentPickerId)?.player_name ?? 'Player'}'s
                  turn
                </button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-lg text-[#70BE5B] capcrunch-title mb-1">Pick submitted!</p>
              <p className="text-white/50 capcrunch-body text-sm">Waiting for other players...</p>
            </div>
          )}
          {waitingFor.length > 0 && (hardMode ? myLineup?.hasPickedThisRound : true) && (
            <div className="bg-black/20 border border-white/10 p-3 w-full max-w-xs">
              <p className="capcrunch-kicker text-[10px] text-white/30 mb-2">Still picking</p>
              {waitingFor.map((p) => (
                <div key={p.player_id} className="flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-xs">⏳</span>
                    <span className="text-white/70 text-sm">{p.player_name}</span>
                  </div>
                  {isHost && onHostSkipPlayer && (
                    <button
                      onClick={() => onHostSkipPlayer(p.player_id)}
                      className="text-[10px] capcrunch-kicker tracking-wider text-orange-400/60 hover:text-orange-400 transition-colors shrink-0"
                    >
                      skip
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
