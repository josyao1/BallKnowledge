/**
 * NBACourtLayout.tsx — Half-court basketball layout with 5 player blobs.
 *
 * 16:9 container styled as a dark basketball court. Blobs are positioned
 * at canonical starting-5 spots: PG (top of key), SG (right wing),
 * SF (left wing), PF (right block), C (post).
 */

import type { StarterPlayer, StarterEncoding } from '../../services/startingLineupData';
import { PlayerBlob } from './PlayerBlob';

type BlobState = 'hidden' | 'revealed' | 'bonus-guess';

type Props = {
  players: StarterPlayer[];
  encoding: StarterEncoding;
  blobState: BlobState;
  bonusCorrect?: Set<string>;
  onBonusGuess?: (id: string, name: string) => void;
  showHint?: boolean;
};

function getEncodingLabel(encoding: StarterEncoding): string {
  switch (encoding) {
    case 'college': return 'College Logos';
    case 'number':  return 'Jersey Numbers';
    case 'draft':   return 'Draft Picks';
  }
}

// Canonical court positions (left%, top%) in a 16:9 half-court view.
// Basket is near the bottom center (~85% top).
// Three-point arc apex is ~20% top.
const SLOT_COORDS: Record<string, [number, number]> = {
  PG: [50, 22],   // top of key / point guard spot
  SG: [82, 45],   // right wing
  SF: [16, 45],   // left wing
  PF: [72, 68],   // right block
  C:  [50, 74],   // center post
};

// Fallback for any unrecognised pos_abb — assign by index
const SLOT_ORDER: Array<keyof typeof SLOT_COORDS> = ['PG', 'SG', 'SF', 'PF', 'C'];

function getCoords(player: StarterPlayer, idx: number): [number, number] {
  return SLOT_COORDS[player.pos_abb] ?? SLOT_COORDS[SLOT_ORDER[idx]] ?? [50, 50];
}

export function NBACourtLayout({ players, encoding, blobState, bonusCorrect, onBonusGuess, showHint }: Props) {
  const five = players.slice(0, 5);

  return (
    <div className="w-full">
      {/* Labels */}
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[10px] sports-font text-white/40 uppercase tracking-wider">
          Starting 5
        </span>
        <span className="text-[10px] sports-font text-white/30 uppercase tracking-wider">
          {getEncodingLabel(encoding)}
        </span>
      </div>

      {/* Court container — 16:9 */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-[#2a1800] shadow-xl"
        style={{ aspectRatio: '16/9', background: 'linear-gradient(180deg, #1a0e00 0%, #120a00 50%, #1a0e00 100%)' }}
      >
        {/* Court markings */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
          {/* Three-point arc */}
          <path
            d="M 130 850 A 700 700 0 0 1 1470 850"
            stroke="rgba(255,255,255,0.07)" strokeWidth="3" fill="none"
          />
          {/* Lane / key rectangle */}
          <rect x="580" y="580" width="440" height="280" stroke="rgba(255,255,255,0.07)" strokeWidth="2" fill="none" />
          {/* Free throw circle */}
          <circle cx="800" cy="580" r="180" stroke="rgba(255,255,255,0.06)" strokeWidth="2" fill="none" />
          {/* Restricted area arc */}
          <path d="M 680 850 A 120 120 0 0 1 920 850" stroke="rgba(255,255,255,0.06)" strokeWidth="2" fill="none" />
          {/* Basket */}
          <circle cx="800" cy="830" r="45" stroke="rgba(234,88,12,0.35)" strokeWidth="3" fill="none" />
          {/* Backboard */}
          <line x1="660" y1="870" x2="940" y2="870" stroke="rgba(234,88,12,0.25)" strokeWidth="3" />
          {/* Half-court line at top */}
          <line x1="0" y1="50" x2="1600" y2="50" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
        </svg>

        {/* Player blobs */}
        {five.map((player, idx) => {
          const [left, top] = getCoords(player, idx);
          return (
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
          );
        })}

        {/* Ball marker near basket */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: '50%', top: '90%' }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-amber-700/60 border border-amber-500/40" />
        </div>
      </div>
    </div>
  );
}
