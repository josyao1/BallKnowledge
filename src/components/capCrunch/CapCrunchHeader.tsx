/**
 * CapCrunchHeader.tsx — Sticky header for the Cap Crunch picking screen.
 *
 * Shows the current team (or division), target cap, stat category, the
 * player's running total + remaining budget, and the round counter.
 * In hard mode it also shows whose turn it is.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SpinningNumber, getTotalColor, getRemainingColor } from './SpinningNumber';
import { TeamSlotMachine } from './TeamSlotMachine';
import { isDivisionRound, isConferenceRound, parseConferenceRound, NFL_DIVISIONS, P4_CONFERENCES, CONFERENCE_LOGOS } from '../../services/capCrunch';
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
  /** When true, hides the player's running total and remaining cap (blind mode) */
  blindMode?: boolean;
}

export function CapCrunchHeader({
  hardMode, currentPickerId, currentPlayerId, players,
  currentRound, totalRounds, currentTeam, selectedSport,
  targetCap, statCategory, myLineup, badFlashKey, isCareerStatRound, blindMode = false,
}: Props) {
  const [showSchools, setShowSchools] = useState(false);
  const pressureColor = getTotalColor(myLineup?.totalStat ?? 0, targetCap);
  return (
    <motion.header
      className="relative z-10 flex-shrink-0 bg-black/60 border-b-2 border-white/10 backdrop-blur-sm"
      animate={{ boxShadow: `0 4px 24px -4px ${pressureColor}44` }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="px-4 py-2 flex items-center justify-between border-b border-white/5">
        <h1 className="retro-title text-xl text-[#d4af37]">Cap Crunch</h1>
        <div className="flex items-center gap-2">
          {hardMode && (
            <div className={`px-3 py-1 rounded-sm border ${
              currentPickerId === currentPlayerId
                ? 'bg-yellow-400/20 border-yellow-400/60'
                : 'bg-black/40 border-white/20'
            }`}>
              <span className={`retro-title text-xs ${
                currentPickerId === currentPlayerId ? 'text-yellow-400' : 'text-white/50'
              }`}>
                {currentPickerId === currentPlayerId
                  ? 'Your Turn'
                  : `${players.find(p => p.player_id === currentPickerId)?.player_name ?? '...'}'s Turn`}
              </span>
            </div>
          )}
          <div className="px-3 py-1 bg-[#ec4899]/20 border border-[#ec4899]/50 rounded-sm">
            <span className="retro-title text-sm text-[#ec4899]">Round {currentRound} / {totalRounds}</span>
          </div>
        </div>
      </div>

      {/* Team + compact stats row */}
      <div className="flex items-center gap-3 px-4 py-2">
        {isConferenceRound(currentTeam) ? (() => {
          const { college: confName, nflConf } = parseConferenceRound(currentTeam);
          return (
          <motion.div
            key={currentTeam + currentRound}
            initial={{ opacity: 0, rotateY: -90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: 90 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            style={{ perspective: 600 }}
            className="px-4 py-2 rounded border-2 bg-black border-[#3b82f6]/80 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
          >
            <p className="sports-font text-[8px] text-white/50 tracking-widest uppercase leading-none mb-1">Conference</p>

            {/* College conference */}
            {CONFERENCE_LOGOS[confName] ? (
              <div className={`rounded px-1 py-0.5 ${confName === 'Big Ten' ? 'bg-white/15' : ''}`}>
                <img
                  src={CONFERENCE_LOGOS[confName]}
                  alt={confName}
                  className="h-8 md:h-10 object-contain"
                />
              </div>
            ) : (
              <p className="retro-title text-2xl md:text-3xl font-bold text-[#3b82f6] leading-tight">
                {confName}
              </p>
            )}

            {/* Pro conference — large and prominent */}
            {nflConf && (
              <div className="flex items-center gap-2 mt-2">
                <span className="sports-font text-[9px] text-white/30 tracking-widest">+</span>
                <div className={`px-3 py-1 rounded-sm ${
                  nflConf === 'AFC' ? 'bg-[#1d4ed8]/80 border border-[#3b82f6]' :
                  nflConf === 'NFC' ? 'bg-[#b91c1c]/80 border border-[#ef4444]' :
                  nflConf === 'East' ? 'bg-[#065f46]/80 border border-[#34d399]' :
                  nflConf === 'West' ? 'bg-[#7c2d12]/80 border border-[#fb923c]' :
                  'bg-white/10 border border-white/20'
                }`}>
                  <span className="retro-title text-lg md:text-xl leading-none text-white tracking-wider">{nflConf}</span>
                </div>
              </div>
            )}

            {confName === 'Non-P4' ? (
              <p className="sports-font text-[7px] text-white/35 leading-none mt-1.5">
                any year — just need to have attended a non-P4 school
              </p>
            ) : (
              <button
                onClick={() => setShowSchools(v => !v)}
                className="sports-font text-[8px] text-[#3b82f6]/60 hover:text-[#3b82f6] leading-none mt-1.5 transition-colors"
              >
                {showSchools ? 'hide schools ▲' : 'see schools ▼'}
              </button>
            )}
            {showSchools && confName in P4_CONFERENCES && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-1.5 pt-1.5 border-t border-[#3b82f6]/20"
              >
                <p className="sports-font text-[7px] text-white/35 leading-relaxed">
                  {(P4_CONFERENCES[confName] ?? [])
                    .filter((s, i, a) => a.indexOf(s) === i)
                    .filter(s => !s.includes('&amp;') && !s.includes('amp;'))
                    .join(' · ')}
                </p>
              </motion.div>
            )}
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
            className="px-5 py-2 rounded border-2 bg-black border-[#d4af37]/80 shadow-[0_0_12px_rgba(212,175,55,0.25)]"
          >
            <p className="sports-font text-[8px] text-white/50 tracking-widest uppercase leading-none mb-0.5">Division</p>
            <p className="retro-title text-2xl md:text-3xl font-bold text-[#d4af37] leading-tight">
              {currentTeam}
            </p>
            <p className="sports-font text-[8px] text-white/40 leading-none mt-0.5">
              {(NFL_DIVISIONS[currentTeam] ?? []).join(' · ')}
            </p>
          </motion.div>
        ) : (
          <TeamSlotMachine sport={selectedSport as 'nba' | 'nfl'} team={currentTeam} size="sm" />
        )}

        <div className="flex gap-1.5 md:gap-2 ml-auto">
          <div className="bg-[#111] border border-white/10 px-2 md:px-3 py-1 md:py-1.5 rounded-sm text-center">
            <div className="sports-font text-[7px] text-white/30 tracking-widest uppercase">Target</div>
            <p className="retro-title text-sm md:text-lg text-white leading-none">{targetCap}</p>
          </div>
          <div className="bg-[#111] border border-white/10 px-2 md:px-3 py-1 md:py-1.5 rounded-sm text-center">
            <div className="sports-font text-[7px] text-white/30 tracking-widest uppercase">{isCareerStatRound ? 'Career' : 'Stat'}</div>
            <p className="retro-title text-xs md:text-sm text-white leading-none">{getCategoryAbbr(statCategory)}</p>
          </div>
          {/* My running total — hidden in blind mode */}
          {!blindMode && (
            <>
              <div className="bg-[#d4af37]/10 border border-[#d4af37]/40 px-2 md:px-3 py-1 md:py-1.5 rounded-sm text-center">
                <div className="sports-font text-[7px] text-white/30 tracking-widest uppercase">You</div>
                <SpinningNumber
                  value={fmt(myLineup?.totalStat ?? 0)}
                  className="retro-title text-sm md:text-lg leading-none"
                  color={getTotalColor(myLineup?.totalStat ?? 0, targetCap)}
                  flashKey={badFlashKey}
                />
              </div>
              {/* Remaining to cap */}
              <div className="bg-[#111] border border-white/10 px-2 md:px-3 py-1 md:py-1.5 rounded-sm text-center">
                <div className="sports-font text-[7px] text-white/30 tracking-widest uppercase">Left</div>
                <SpinningNumber
                  value={fmt(targetCap - (myLineup?.totalStat ?? 0))}
                  className="retro-title text-sm md:text-lg leading-none"
                  color={getRemainingColor(myLineup?.totalStat ?? 0, targetCap)}
                  flashKey={badFlashKey}
                />
              </div>
            </>
          )}
          {blindMode && (
            <div className="bg-[#7c3aed]/10 border border-[#7c3aed]/40 px-2 md:px-3 py-1 md:py-1.5 rounded-sm text-center">
              <div className="sports-font text-[7px] text-[#7c3aed]/70 tracking-widest uppercase">Blind</div>
              <p className="retro-title text-sm md:text-lg leading-none text-[#7c3aed]/70">?</p>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
