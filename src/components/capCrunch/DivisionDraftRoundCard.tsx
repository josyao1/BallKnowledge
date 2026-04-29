/**
 * DivisionDraftRoundCard.tsx — Displays a division + draft round category in Cap Crunch.
 *
 * e.g. "AFC North | R47" → "AFC North" in gold, "4th–7th Round" in purple,
 * with a click-to-expand list of the division's teams.
 *
 * Used in both the multiplayer header and the solo picking screen.
 */

import { NFL_DIVISIONS, NBA_DIVISIONS } from '../../services/capCrunch';

function draftLabel(code: string): string {
  if (code === 'R1')  return '1st Round';
  if (code === 'R2')  return '2nd Round';
  if (code === 'R23') return '2nd–3rd Round';
  if (code === 'R47') return '4th–7th Round';
  return code;
}

interface Props {
  division: string;
  draftRound: string;
  sport: 'nba' | 'nfl';
  /** 'sm' used in the multiplayer sticky header; 'lg' used on the solo full-screen card */
  size?: 'sm' | 'lg';
}

export function DivisionDraftRoundCard({ division, draftRound, sport, size = 'sm' }: Props) {
  const divTeams = sport === 'nfl'
    ? (NFL_DIVISIONS[division] ?? [])
    : (NBA_DIVISIONS[division] ?? []);

  const divisionSize = size === 'lg' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl';
  const roundSize   = size === 'lg' ? 'text-base md:text-lg' : 'text-sm md:text-base';

  return (
    <div className="px-5 py-2 rounded border-2 bg-black border-[#a855f7]/80 shadow-[0_0_12px_rgba(168,85,247,0.25)]">
      {/* Division name + draft round side by side */}
      <div className="flex items-center gap-3 flex-wrap">
        <p className={`retro-title font-bold text-[#d4af37] leading-tight ${divisionSize}`}>
          {division}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="sports-font text-[9px] text-white/30">+</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#a855f7]/20 border border-[#a855f7]/50">
            <img src="/draftlogo.png" alt="Draft" className={size === 'lg' ? 'h-5 object-contain' : 'h-4 object-contain'} />
            <span className={`retro-title text-[#a855f7] leading-none tracking-wide ${roundSize}`}>
              {draftLabel(draftRound)}
            </span>
          </div>
        </div>
      </div>

      {/* Teams always visible */}
      <p className="sports-font text-[7px] text-white/35 leading-relaxed mt-1.5">
        {divTeams.join(' · ')}
      </p>
    </div>
  );
}
