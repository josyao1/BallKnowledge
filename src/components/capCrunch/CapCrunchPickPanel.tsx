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
import { isConferenceRound, formatHeightInches } from '../../services/capCrunch';
import { HEIGHT_THRESHOLD_NBA, HEIGHT_THRESHOLD_NFL, WEIGHT_THRESHOLD } from '../../services/capCrunchData';
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
  onSearch: (query: string) => void;
  onSelectPlayer: (player: SearchResult) => void;
  onSelectYear: (year: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function CapCrunchPickPanel({
  myLineup, canPickThisRound, hardMode, currentPickerId, players, totalRounds,
  selectedPlayerName, isNoYearSelect, isCareerStatRound, currentTeam,
  searchQuery, searchResults, loading, loadingYears, availableYears, selectedYear,
  duplicateError, pickError, addingPlayer, usedPlayerNames, lockedPlayerNames,
  waitingFor, selectedSport, statCategory: _statCategory, hwFilter, onSearch, onSelectPlayer, onSelectYear, onConfirm, onBack,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-black/60 border-2 border-white/10 rounded p-4 flex-1 flex flex-col"
    >
      {myLineup?.isFinished ? (
        // ── All picks made ──────────────────────────────────────────────────
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-2xl text-emerald-400 retro-title">All Picks In!</p>
          <p className="text-white/50 sports-font text-sm">You've made all {totalRounds} picks. Sit tight while others finish.</p>
          {(myLineup.bustCount ?? 0) > 0 && (
            <p className="text-red-400/70 sports-font text-xs">{myLineup.bustCount} bust pick{myLineup.bustCount !== 1 ? 's' : ''} — each counted as 0</p>
          )}
        </div>
      ) : canPickThisRound ? (
        // ── Picking ─────────────────────────────────────────────────────────
        <>
          {!selectedPlayerName ? (
            // Search view
            <div>
              <label className="block sports-font text-[9px] tracking-[0.4em] text-white/60 uppercase mb-3 font-semibold">
                Search for a player
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Enter player name..."
                className="w-full px-4 py-3 bg-[#222] text-white rounded border border-white/10 focus:outline-none focus:border-white/30 mb-3 text-base"
              />
              {loading && <p className="text-white/60 text-sm">Loading...</p>}
              {!loading && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-white/30 text-[9px] sports-font mt-1">No results — player may be too recent, have limited stats, or try a different spelling.</p>
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
                            ? 'bg-[#111] border-white/5 text-white/25 cursor-not-allowed line-through'
                            : 'bg-[#1a1a1a] hover:bg-[#2a2a2a] border-white/10 text-white'
                        }`}
                      >
                        {result.playerName}
                        {alreadyUsed && <span className="ml-2 text-[10px] text-white/20 no-underline not-italic font-normal">(already used)</span>}
                        {taken && <span className="ml-2 text-[10px] text-red-400/40 no-underline not-italic font-normal">(taken)</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : isNoYearSelect ? (
            // ── Total GP / career stat: no year needed, just confirm ──────
            <div className="flex flex-col gap-3 h-full">
              <div className="p-3 bg-[#1a1a1a] rounded border border-white/10">
                <p className="retro-title text-base text-white truncate">{selectedPlayerName}</p>
                <p className="text-xs text-white/60 mt-0.5">
                  {isCareerStatRound
                    ? isConferenceRound(currentTeam)
                      ? `Total career stats — must have attended a ${currentTeam} school`
                      : `Total career stats (all teams) — must have played for ${currentTeam} at some point`
                    : isConferenceRound(currentTeam)
                      ? `Will count all career GP — must have attended a ${currentTeam} school`
                      : `Will count all career GP with ${currentTeam}`}
                  {hwFilter && ` — ${hwFilter === 'height_above' ? `above ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)} tall` : hwFilter === 'height_below' ? `below ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)} tall` : hwFilter === 'weight_above' ? `above ${WEIGHT_THRESHOLD} lbs` : `below ${WEIGHT_THRESHOLD} lbs`}`}
                </p>
              </div>
              <div className="flex-1 flex items-center justify-center text-center">
                <p className="text-white/30 sports-font text-xs leading-relaxed">
                  Games played across every season<br />this player was on the team
                </p>
              </div>
              {pickError && <p className="text-red-400 text-xs mt-1">{pickError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onBack}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] shadow-[0_2px_0_#1a1a1a] active:translate-y-1 active:shadow-none text-white/80 font-semibold rounded-sm transition text-sm retro-title"
                >
                  Back
                </button>
                <button
                  onClick={onConfirm}
                  disabled={addingPlayer}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] shadow-[0_2px_0_#a89860] active:translate-y-1 active:shadow-none disabled:opacity-50 text-black font-semibold rounded-sm transition text-sm retro-title"
                >
                  {addingPlayer ? 'Adding...' : 'Confirm'}
                </button>
              </div>
            </div>
          ) : (
            // ── Normal mode: pick a year ──────────────────────────────────
            <div className="flex flex-col gap-3 h-full">
              <div className="p-3 bg-[#1a1a1a] rounded border border-white/10">
                <p className="retro-title text-base text-white truncate">{selectedPlayerName}</p>
                <p className="text-xs text-white/60 mt-0.5">Select any year this player played</p>
              </div>
              <div className="flex items-baseline justify-between">
                <label className="sports-font text-[9px] tracking-[0.4em] text-white/60 uppercase font-semibold">Select a year</label>
                {selectedSport === 'nfl' && !isCareerStatRound && <span className="text-white/25 text-[8px] sports-font">through 2025</span>}
              </div>
              {loadingYears ? (
                <p className="text-white/60 text-sm">Loading years...</p>
              ) : availableYears.length > 0 ? (
                <div className="max-h-48 md:max-h-64 overflow-y-auto overscroll-contain space-y-1.5">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => onSelectYear(year)}
                      className={`w-full px-4 py-2.5 rounded border transition text-white font-semibold text-sm ${
                        selectedYear === year
                          ? 'bg-[#d4af37] text-black border-[#d4af37]'
                          : 'bg-[#1a1a1a] border-white/10 hover:border-white/20'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-red-400 text-sm">No data found — player may be too recent, have limited stats, or try a different spelling.</p>
              )}
              {pickError && <p className="text-red-400 text-xs mt-1">{pickError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onBack}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] shadow-[0_2px_0_#1a1a1a] active:translate-y-1 active:shadow-none text-white/80 font-semibold rounded-sm transition text-sm retro-title"
                >
                  Back
                </button>
                <button
                  onClick={onConfirm}
                  disabled={!selectedYear || addingPlayer}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-b from-[#f5e6c8] to-[#d4c4a0] shadow-[0_2px_0_#a89860] active:translate-y-1 active:shadow-none disabled:opacity-50 text-black font-semibold rounded-sm transition text-sm retro-title"
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
            <div>
              <p className="text-lg text-yellow-400 retro-title mb-1">Waiting for your turn</p>
              <p className="text-white/50 sports-font text-sm">
                {players.find(p => p.player_id === currentPickerId)?.player_name ?? '...'} is picking
              </p>
            </div>
          ) : (
            <div>
              <p className="text-lg text-emerald-400 retro-title mb-1">Pick submitted!</p>
              <p className="text-white/50 sports-font text-sm">Waiting for other players...</p>
            </div>
          )}
          {!hardMode && waitingFor.length > 0 && (
            <div className="bg-black/40 border border-white/10 rounded p-3 w-full max-w-xs">
              <p className="sports-font text-[10px] text-white/30 tracking-widest uppercase mb-2">Still picking</p>
              {waitingFor.map(p => (
                <div key={p.player_id} className="flex items-center gap-2 py-1">
                  <span className="text-yellow-400 text-xs">⏳</span>
                  <span className="text-white/70 text-sm">{p.player_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
