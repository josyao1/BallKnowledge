/**
 * CreateSportSelector.tsx — NBA / NFL toggle for the lobby creation page.
 * NBA is disabled and auto-locked to NFL when Box Score mode is active.
 */

import type { Sport } from '../../../types';

interface Props {
  sport: Sport;
  lobbyMode: string;
  onSportChange: (s: Sport) => void;
}

export function CreateSportSelector({ sport, onSportChange }: Props) {
  return (
    <div className="bg-black/50 border border-white/10 rounded-sm p-4">
      <div className="capcrunch-kicker text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
        Select League
      </div>
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => onSportChange('nba')}
          className={`px-6 py-2 rounded-sm capcrunch-kicker tracking-wider transition-all ${
            sport === 'nba'
              ? 'bg-[#d4af37] text-black shadow-lg font-bold'
              : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
          }`}
        >
          NBA
        </button>
        <button
          onClick={() => onSportChange('nfl')}
          className={`px-6 py-2 rounded-sm capcrunch-kicker tracking-wider transition-all ${
            sport === 'nfl'
              ? 'bg-[#d4af37] text-black shadow-lg font-bold'
              : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
          }`}
        >
          NFL
        </button>
      </div>
    </div>
  );
}
