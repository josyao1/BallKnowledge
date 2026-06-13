/**
 * CapCrunchHeader.tsx — Sticky header for the Cap Crunch picking screen.
 *
 * Shows the current team (or division), target cap, stat category, the
 * player's running total + remaining budget, and the round counter.
 * In hard mode it also shows whose turn it is.
 */

import { motion } from 'framer-motion';
import { SpinningNumber, getTotalColor, getRemainingColor } from './SpinningNumber';
import { TeamSlotMachine } from './TeamSlotMachine';
import { ConferenceRoundCard } from './ConferenceRoundCard';
import { HomeButton } from '../multiplayer/HomeButton';
import { isDivisionRound, isConferenceRound, parseConferenceRound, isDivisionDraftRound, parseDivisionDraftRound, isTeammateRound, parseTeammateRound, isNameMatchRound, parseNameRound, isWildcardRound, NFL_DIVISIONS, formatHeightInches } from '../../services/capCrunch';
import { HEIGHT_THRESHOLD_NBA, HEIGHT_THRESHOLD_NFL, WEIGHT_THRESHOLD } from '../../services/capCrunchData';
import type { HWFilter } from '../../services/capCrunch';
import { DivisionDraftRoundCard } from './DivisionDraftRoundCard';
import { TeammateRoundCard } from './TeammateRoundCard';
import { NameMatchRoundCard } from './NameMatchRoundCard';
import { WildcardRoundCard } from './WildcardRoundCard';
import { getCategoryAbbr, fmt } from './capCrunchUtils';
import type { StatCategory, PlayerLineup } from '../../types/capCrunch';

interface Player {
  player_id: string;
  player_name: string;
}

interface Props {
  /** Hard mode = turn-based; false = simultaneous picks */
  hardMode: boolean;
  /** Player whose turn it is in hard mode — used to render the "X's Turn" badge */
  currentPickerId: string | null;
  currentPlayerId: string | null;
  players: Player[];
  currentRound: number;
  totalRounds: number;
  currentTeam: string;
  selectedSport: 'nba' | 'nfl' | null;
  targetCap: number;
  statCategory: StatCategory;
  myLineup: (PlayerLineup & { hasPickedThisRound?: boolean }) | undefined;
  /** Increment this value to trigger a red flash on the score display (bust or zero pick) */
  badFlashKey: number;
  /** Career stat rounds count all-team totals rather than a single team-season */
  isCareerStatRound: boolean;
  /** Optional height/weight eligibility filter applied this game */
  hwFilter?: HWFilter | null;
  /** When true, hides the player's running total and remaining cap (blind mode) */
  blindMode?: boolean;
  /** Whether the local player is the lobby host (shows End Game option in HomeButton) */
  isHost?: boolean;
  /** Called when host chooses to end the game for all players */
  onEndGame?: () => void;
}

export function CapCrunchHeader({
  hardMode, currentPickerId, currentPlayerId, players,
  currentRound, totalRounds, currentTeam, selectedSport,
  targetCap, statCategory, myLineup, badFlashKey, isCareerStatRound, blindMode = false,
  isHost = false, onEndGame, hwFilter,
}: Props) {
  const pressureColor = getTotalColor(myLineup?.totalStat ?? 0, targetCap);
  const _p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const _d = Object.fromEntries(_p.filter(x => x.type !== 'literal').map(x => [x.type, +x.value]));
  const isGradWeek = _d.year === 2026 && _d.month === 6 && _d.day >= 13 && _d.day <= 15;
  return (
    <motion.header
      className="relative z-10 flex-shrink-0 capcrunch-panel border-b border-white/12"
      animate={{ boxShadow: `0 4px 24px -4px ${pressureColor}44` }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="px-3 sm:px-4 py-2 flex flex-col gap-2 border-b border-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3 min-w-0 sm:justify-start">
          <h1 className="capcrunch-title text-lg sm:text-xl text-[#FDF100] truncate">Cap Crunch{isGradWeek ? ' 🎓' : ''}</h1>
          <HomeButton isHost={isHost} onEndGame={onEndGame} />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {hardMode && (
            <div className={`px-2.5 py-1 border max-w-full ${
              currentPickerId === currentPlayerId
                ? 'bg-[#FDF100]/14 border-[#FDF100]/60'
                : 'bg-black/40 border-white/20'
            }`}>
              <span className={`capcrunch-kicker text-[10px] sm:text-xs ${
                currentPickerId === currentPlayerId ? 'text-[#FDF100]' : 'text-white/50'
              }`}>
                {currentPickerId === currentPlayerId
                  ? 'Your Turn'
                  : `${players.find(p => p.player_id === currentPickerId)?.player_name ?? '...'}'s Turn`}
              </span>
            </div>
          )}
          <div className="px-2.5 py-1 bg-[#E2008A]/18 border border-[#E2008A]/50">
            <span className="capcrunch-kicker text-[10px] sm:text-sm text-[#E2008A]">Round {currentRound} / {totalRounds}</span>
          </div>
        </div>
      </div>


      {/* Team + compact stats row */}
      <div className="flex flex-col gap-3 px-3 sm:px-4 py-2 lg:flex-row lg:items-center">
        {isDivisionDraftRound(currentTeam) ? (() => {
          const { division, draftRound } = parseDivisionDraftRound(currentTeam);
          return (
            <motion.div
              key={currentTeam + currentRound}
              initial={{ opacity: 0, rotateY: -90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ perspective: 600 }}
            >
              <DivisionDraftRoundCard division={division} draftRound={draftRound} sport={selectedSport ?? 'nfl'} size="sm" />
            </motion.div>
          );
        })() : isConferenceRound(currentTeam) ? (() => {
          const { college: confName, nflConf } = parseConferenceRound(currentTeam);
          return (
            <motion.div
              key={currentTeam + currentRound}
              initial={{ opacity: 0, rotateY: -90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ perspective: 600 }}
            >
              <ConferenceRoundCard confName={confName} nflConf={nflConf} size="sm" />
            </motion.div>
          );
        })() : isDivisionRound(currentTeam) ? (
          <motion.div
            key={currentTeam + currentRound}
            initial={{ opacity: 0, rotateY: -90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: 90 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            style={{ perspective: 600 }}
            className="px-5 py-2 border bg-black/40 border-[#FDF100]/70 shadow-[0_0_16px_rgba(253,241,0,0.18)]"
          >
            <p className="capcrunch-kicker text-[8px] text-white/50 tracking-widest uppercase leading-none mb-0.5">Division</p>
            <p className="capcrunch-title text-2xl md:text-3xl text-[#FDF100] leading-tight">
              {currentTeam}
            </p>
            <p className="capcrunch-kicker text-[8px] text-white/40 leading-none mt-0.5">
              {(NFL_DIVISIONS[currentTeam] ?? []).join(' · ')}
            </p>
          </motion.div>
        ) : isNameMatchRound(currentTeam) ? (() => {
          const { type, pickIndex, proConf } = parseNameRound(currentTeam);
          return <NameMatchRoundCard key={currentTeam + currentRound} nameType={type} pickIndex={pickIndex} proConf={proConf} size="sm" />;
        })() : isTeammateRound(currentTeam) ? (() => {
          const { pickIndex } = parseTeammateRound(currentTeam);
          return <TeammateRoundCard key={currentTeam + currentRound} pickIndex={pickIndex} size="sm" />;
        })() : isWildcardRound(currentTeam) ? (
          <WildcardRoundCard key={currentTeam + currentRound} size="sm" />
        ) : (
          <div className="flex flex-col items-center gap-1 self-center lg:self-auto">
            <TeamSlotMachine sport={selectedSport as 'nba' | 'nfl'} team={currentTeam} size="sm" />
            {hwFilter && (
              <div className="px-2 py-0.5 border border-[#68BBE5]/40 bg-[#68BBE5]/10 text-[#68BBE5] capcrunch-kicker text-[8px] text-center">
                {hwFilter === 'height_above' ? `Above ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)}`
                : hwFilter === 'height_below' ? `Below ${formatHeightInches(selectedSport === 'nba' ? HEIGHT_THRESHOLD_NBA : HEIGHT_THRESHOLD_NFL)}`
                : hwFilter === 'weight_above' ? `Above ${WEIGHT_THRESHOLD} lbs`
                : `Below ${WEIGHT_THRESHOLD} lbs`}
              </div>
            )}
          </div>
        )}

        {/* Desktop stat grid — hidden on mobile, shown md+ */}
        <div className="hidden md:grid md:grid-cols-4 gap-1.5 md:gap-2 w-full lg:w-auto lg:ml-auto">
          <div className="capcrunch-panel-soft px-2 md:px-3 py-1 md:py-1.5 text-center">
            <div className="capcrunch-kicker text-[7px] text-white/35">Target</div>
            <p className="capcrunch-title text-sm md:text-lg text-white leading-none">{targetCap}</p>
          </div>
          <div className="capcrunch-panel-soft px-2 md:px-3 py-1 md:py-1.5 text-center">
            <div className="capcrunch-kicker text-[7px] text-white/35">{isCareerStatRound ? 'Career' : 'Stat'}</div>
            <p className="capcrunch-title text-xs md:text-sm text-white leading-none">{getCategoryAbbr(statCategory)}</p>
          </div>
          {!blindMode && (
            <>
              <div className="px-2 md:px-3 py-1 md:py-1.5 text-center bg-[#70BE5B]/10 border border-[#70BE5B]/35">
                <div className="capcrunch-kicker text-[7px] text-white/35">You</div>
                <SpinningNumber
                  value={fmt(myLineup?.totalStat ?? 0)}
                  className="capcrunch-title text-sm md:text-lg leading-none"
                  color={getTotalColor(myLineup?.totalStat ?? 0, targetCap)}
                  flashKey={badFlashKey}
                />
              </div>
              <div className="capcrunch-panel-soft px-2 md:px-3 py-1 md:py-1.5 text-center">
                <div className="capcrunch-kicker text-[7px] text-white/35">Left</div>
                <SpinningNumber
                  value={fmt(targetCap - (myLineup?.totalStat ?? 0))}
                  className="capcrunch-title text-sm md:text-lg leading-none"
                  color={getRemainingColor(myLineup?.totalStat ?? 0, targetCap)}
                  flashKey={badFlashKey}
                />
              </div>
            </>
          )}
          {blindMode && (
            <div className="bg-[#4E53A5]/10 border border-[#4E53A5]/40 px-2 md:px-3 py-1 md:py-1.5 text-center col-span-2 md:col-span-1">
              <div className="capcrunch-kicker text-[7px] text-[#68BBE5]">Blind</div>
              <p className="capcrunch-title text-sm md:text-lg leading-none text-[#68BBE5]">?</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile stat strip — matches solo's compact 4-column accent-border layout */}
      <div className="md:hidden grid grid-cols-4 border-t border-white/10">
        <div className="px-2 py-2 text-center border-r border-white/10" style={{ borderLeftWidth: 3, borderLeftColor: '#FDF100' }}>
          <div className="capcrunch-kicker text-[7px] text-white/30 mb-0.5">Target</div>
          <p className="capcrunch-title text-sm text-white leading-none">{targetCap}</p>
        </div>
        <div className="px-2 py-2 text-center border-r border-white/10" style={{ borderLeftWidth: 3, borderLeftColor: '#68BBE5' }}>
          {isCareerStatRound
            ? <div className="capcrunch-kicker text-[6px] text-[#68BBE5] mb-0.5">Career</div>
            : <div className="capcrunch-kicker text-[7px] text-white/30 mb-0.5">Stat</div>
          }
          <p className="capcrunch-title text-sm text-white leading-none">
            {isCareerStatRound ? getCategoryAbbr(statCategory).replace('CAREER ', '') : getCategoryAbbr(statCategory)}
          </p>
        </div>
        {!blindMode && (
          <>
            <div className="px-2 py-2 text-center border-r border-white/10" style={{ borderLeftWidth: 3, borderLeftColor: '#E2008A' }}>
              <div className="capcrunch-kicker text-[7px] text-white/30 mb-0.5">You</div>
              <SpinningNumber
                value={fmt(myLineup?.totalStat ?? 0)}
                className="capcrunch-title text-sm leading-none"
                color={getTotalColor(myLineup?.totalStat ?? 0, targetCap)}
                flashKey={badFlashKey}
              />
            </div>
            <div className="px-2 py-2 text-center" style={{ borderLeftWidth: 3, borderLeftColor: '#70BE5B' }}>
              <div className="capcrunch-kicker text-[7px] text-white/30 mb-0.5">Left</div>
              <SpinningNumber
                value={fmt(targetCap - (myLineup?.totalStat ?? 0))}
                className="capcrunch-title text-sm leading-none"
                color={getRemainingColor(myLineup?.totalStat ?? 0, targetCap)}
                flashKey={badFlashKey}
              />
            </div>
          </>
        )}
        {blindMode && (
          <>
            <div className="px-2 py-2 text-center border-r border-white/10" style={{ borderLeftWidth: 3, borderLeftColor: '#E2008A' }}>
              <div className="capcrunch-kicker text-[7px] text-white/30 mb-0.5">You</div>
              <p className="capcrunch-title text-sm leading-none text-[#4E53A5]">?</p>
            </div>
            <div className="px-2 py-2 text-center" style={{ borderLeftWidth: 3, borderLeftColor: '#70BE5B' }}>
              <div className="capcrunch-kicker text-[7px] text-white/30 mb-0.5">Left</div>
              <p className="capcrunch-title text-sm leading-none text-[#4E53A5]">?</p>
            </div>
          </>
        )}
      </div>
    </motion.header>
  );
}
