/**
 * CapCrunchResultCard.tsx — A single player's result card on the results screen.
 *
 * Shows their pick list, total score, bust annotations, tiebreaker info,
 * and an "optimal last pick" hint fetched after the game ends.
 */

import { motion } from 'framer-motion';
import { RevealingScore } from './RevealingScore';
import { fmt, getCategoryAbbr } from './capCrunchUtils';
import type { PlayerLineup, StatCategory } from '../../types/capCrunch';
import type { OptimalPick } from '../../services/capCrunch';

interface PlayerWithLineup {
  id: string;
  player_id: string;
  player_name: string;
  lineup: PlayerLineup;
}

interface Props {
  item: PlayerWithLineup;
  idx: number;
  isWinner: boolean;
  tiebreakerUsed: boolean;
  tiedOnBusts: boolean;
  targetCap: number;
  optimalPicks: Map<string, OptimalPick | null>;
  statCategory: StatCategory;
  isCareerStatRound: boolean;
  avgPickYear: (lineup: PlayerLineup) => number;
}

export function CapCrunchResultCard({
  item, idx, isWinner, tiebreakerUsed, tiedOnBusts, targetCap,
  optimalPicks, statCategory, isCareerStatRound, avgPickYear,
}: Props) {
  const reverseDelay = idx * 0.65; // passed in already reversed by caller
  const scoreDelay = idx * 650 + 450;

  const opt = optimalPicks.get(item.player_id);
  const hasOptimal = opt && item.lineup.selectedPlayers.length > 0;

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reverseDelay, type: 'spring', stiffness: 300, damping: 26 }}
      className={`bg-black/60 rounded p-4 border-2 ${isWinner ? 'border-[#d4af37]/70 shadow-[0_0_24px_rgba(212,175,55,0.2)]' : 'border-white/10'}`}
    >
      {/* Header row */}
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isWinner && (
              <span className="sports-font text-[8px] bg-[#d4af37] text-black px-1.5 py-0.5 rounded-sm font-bold tracking-widest uppercase shrink-0">Winner</span>
            )}
            <p className="font-semibold text-white text-lg truncate">
              {idx + 1}. {item.player_name}
            </p>
          </div>
          {(item.lineup.bustCount ?? 0) > 0 && (
            <span className="text-[9px] sports-font text-red-400/70">{item.lineup.bustCount} bust{item.lineup.bustCount !== 1 ? 's' : ''} (each counted as 0)</span>
          )}
          {tiebreakerUsed && tiedOnBusts && idx <= 1 && (
            <span className="block text-[9px] sports-font text-[#d4af37]/60">avg yr {avgPickYear(item.lineup).toFixed(1)}</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <RevealingScore
            value={fmt(item.lineup.totalStat)}
            delay={scoreDelay}
            className="retro-title text-3xl"
            color={isWinner ? '#d4af37' : '#ffffff'}
          />
          <p className="text-xs text-white/40">
            {fmt(Math.abs(item.lineup.totalStat - targetCap))} away
          </p>
        </div>
      </div>

      {/* Pick list */}
      <div className="space-y-2 text-xs mb-3 border-t border-white/10 pt-3">
        {item.lineup.selectedPlayers.map((selected, pidx) => {
          const isBust = selected.isBust;
          const isNotOnTeam = !isBust && selected.neverOnTeam;
          const isMiss = !isBust && !isNotOnTeam && selected.statValue === 0;
          const isBad = isBust || isMiss || isNotOnTeam;
          const badLabel = isBust ? 'BUST' : isNotOnTeam ? 'NOT ON TEAM' : '0 STAT';
          return (
            <div key={pidx} className={`flex justify-between ${isBad ? 'text-red-300' : 'text-white/70'}`}>
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className={`truncate ${isBad ? 'text-red-400' : ''}`}>{pidx + 1}. {selected.playerName}</span>
                  {isBad && <span className="text-[7px] bg-red-600 text-white px-0.5 rounded shrink-0">{badLabel}</span>}
                </div>
                <span className={`block text-[11px] ${isBad ? 'text-red-400/70' : 'text-white/40'}`}>({selected.selectedYear}, {selected.team})</span>
                {isBust && <span className="block text-[10px] text-red-400/60">Exceeded cap — scored 0, total reverted</span>}
                {isNotOnTeam && <span className="block text-[10px] text-orange-400/60">Never played for this team — scored 0</span>}
              </div>
              <span className={`font-semibold ml-2 ${isBad ? 'text-red-400' : 'text-[#d4af37]'}`}>
                {isBust ? `${fmt(selected.statValue)}→0` : fmt(selected.statValue)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Optimal last pick hint */}
      {hasOptimal && (() => {
        const lastPick = item.lineup.selectedPlayers[item.lineup.selectedPlayers.length - 1];
        const totalBeforeLast = lastPick.isBust
          ? item.lineup.totalStat
          : parseFloat((item.lineup.totalStat - lastPick.statValue).toFixed(1));
        const wouldFinishAt = parseFloat((totalBeforeLast + opt!.statValue).toFixed(1));
        return (
          <div className="mt-2 bg-black/40 border border-[#d4af37]/25 rounded px-3 py-2">
            <div className="sports-font text-[8px] text-[#d4af37]/50 tracking-widest uppercase mb-1">Optimal Last Pick</div>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-white/80 font-medium">{opt!.playerName}</span>
                <span className="text-[10px] text-white/35 ml-2">
                  {opt!.year === 'career' ? (isCareerStatRound ? getCategoryAbbr(statCategory) : 'Career GP') : opt!.year} · {opt!.team}
                </span>
                {lastPick.isBust && (
                  <span className="block text-[10px] text-emerald-400/70 mt-0.5">
                    Would finish: {fmt(wouldFinishAt)} / {targetCap}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-sm text-[#d4af37] font-semibold">{fmt(opt!.statValue)}</span>
                {opt!.statValue > lastPick.statValue && (
                  <span className="text-[10px] text-emerald-400/70 ml-1">+{fmt(opt!.statValue - lastPick.statValue)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </motion.div>
  );
}
