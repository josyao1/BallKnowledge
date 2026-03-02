/**
 * NFLFieldLayout.tsx — Football field with player blobs positioned by role.
 *
 * Renders an aspect-ratio 16/9 container styled as a green football field
 * with player blobs absolutely positioned at canonical formation coordinates.
 *
 * Offense: spread formation (11 skill players + OL)
 * Defense: 4-3 or 3-4 base look with secondary
 */

import type { StarterPlayer, StarterEncoding } from '../../services/startingLineupData';
import { PlayerBlob } from './PlayerBlob';

type BlobState = 'hidden' | 'revealed' | 'bonus-guess';

type Props = {
  players: StarterPlayer[];
  side: 'offense' | 'defense';
  encoding: StarterEncoding;
  blobState: BlobState;
  bonusCorrect?: Set<string>;
  onBonusGuess?: (id: string, name: string) => void;
  showHint?: boolean;
};

// Canonical formation positions: left%, top% within the 16:9 container
// LOS is at 35%. "Behind" = higher top% (further from top of screen).
// Offense (attacking upward toward y=0)
const OFFENSE_COORDS: Record<string, [number, number]> = {
  LT: [27, 36],
  LG: [36, 36],
  C:  [45, 36],
  RG: [54, 36],
  RT: [63, 36],
  TE: [74, 36],   // at line, outside RT
  QB: [45, 52],
  RB: [52, 62],
};

// Defense (mirrored, defending downward)
const DEFENSE_COORDS: Record<string, [number, number]> = {
  LCB:  [5,  28],
  LDE:  [27, 38],
  LDT:  [37, 38],
  NT:   [45, 38],
  RDT:  [53, 38],
  RDE:  [63, 38],
  RCB:  [88, 28],
  WLB:  [30, 50],
  LILB: [40, 50],
  MLB:  [46, 50],
  RILB: [52, 50],
  SLB:  [62, 50],
  SS:   [35, 63],
  NB:   [65, 40],
  FS:   [57, 63],
  SAF:  [46, 67],
};

// WR positions — all behind or at the LOS (top ≥ 35%)
// Wide receivers on the outside line up AT the line; slot sits ~1 step behind
const WR_SLOTS = [
  [5,  36],   // WR1 wide left  — at LOS
  [88, 36],   // WR2 wide right — at LOS
  [20, 44],   // WR3 slot left  — just behind LOS
];

function getOffenseCoords(player: StarterPlayer, wrIndex: number): [number, number] {
  if (player.pos_abb === 'WR') {
    const slot = WR_SLOTS[wrIndex % WR_SLOTS.length];
    return [slot[0], slot[1]];
  }
  return OFFENSE_COORDS[player.pos_abb] || [50, 50];
}

function getDefenseCoords(player: StarterPlayer, _idx: number): [number, number] {
  return DEFENSE_COORDS[player.pos_abb] || [50 + (_idx - 5) * 8, 55];
}

function getEncodingLabel(encoding: StarterEncoding): string {
  switch (encoding) {
    case 'college': return 'College Logos';
    case 'number': return 'Jersey Numbers';
    case 'draft': return 'Draft Picks';
  }
}

export function NFLFieldLayout({ players, side, encoding, blobState, bonusCorrect, onBonusGuess, showHint }: Props) {
  // Track WR index for multiple WRs
  let wrIndex = 0;

  // Assign coordinates — FB excluded (no fixed formation spot)
  const filtered = players.filter(p => p.pos_abb !== 'FB').slice(0, 11);
  const positioned = filtered.map((player, idx) => {
    let coords: [number, number];
    if (side === 'offense') {
      coords = getOffenseCoords(player, player.pos_abb === 'WR' ? wrIndex++ : 0);
    } else {
      coords = getDefenseCoords(player, idx);
    }
    return { player, left: coords[0], top: coords[1] };
  });

  return (
    <div className="w-full">
      {/* Field label */}
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[10px] sports-font text-white/40 uppercase tracking-wider">
          {side === 'offense' ? 'Offense' : 'Defense'}
        </span>
        <span className="text-[10px] sports-font text-white/30 uppercase tracking-wider">
          {getEncodingLabel(encoding)}
        </span>
      </div>

      {/* Field container — 16:9 aspect ratio */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-[#1a3a1a] shadow-xl"
        style={{ aspectRatio: '16/9', background: 'linear-gradient(180deg, #0d3b0d 0%, #0a2e0a 50%, #0d3b0d 100%)' }}
      >
        {/* Field markings */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
          {/* Yard lines */}
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(y => (
            <line key={y} x1="0" y1={y * 9} x2="1600" y2={y * 9}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          ))}
          {/* Hash marks */}
          {[20, 40, 60, 80].map(y => (
            [200, 400, 600, 800, 1000, 1200, 1400].map(x => (
              <line key={`${x}-${y}`} x1={x} y1={y * 9 - 10} x2={x} y2={y * 9 + 10}
                stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
            ))
          ))}
          {/* Line of scrimmage */}
          <line x1="0" y1="315" x2="1600" y2="315"
            stroke="rgba(255,255,255,0.20)" strokeWidth="2" strokeDasharray="12 8" />
          {/* End zone shading at top */}
          <rect x="0" y="0" width="1600" height="90" fill="rgba(255,255,255,0.03)" />
        </svg>

        {/* Player blobs */}
        {positioned.map(({ player, left, top }) => (
          <div
            key={player.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <PlayerBlob
              player={player}
              encoding={encoding}
              state={blobState}
              bonusCorrect={bonusCorrect?.has(player.id)}
              onBonusGuess={onBonusGuess ? (name) => onBonusGuess(player.id, name) : undefined}
              showHint={showHint}
            />
          </div>
        ))}

        {/* Ball marker */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: '50%', top: '35%' }}
        >
          <div className="w-2 h-1.5 rounded-full bg-amber-600/70 border border-amber-500/50" />
        </div>
      </div>
    </div>
  );
}
