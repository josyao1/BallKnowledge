/**
 * StartingLineupSettings.tsx — Host settings for the Starting Lineup game mode.
 * Sport selector and first-to win target.
 */

interface Props {
  startingSport: 'nba' | 'nfl';
  onStartingSportChange: (s: 'nba' | 'nfl') => void;
  winTarget: number;
  onWinTargetChange: (n: number) => void;
}

export function StartingLineupSettings({ startingSport, onStartingSportChange, winTarget, onWinTargetChange }: Props) {
  return (
    <>
      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Sport</div>
        <div className="flex gap-1.5">
          {(['nfl', 'nba'] as const).map(s => (
            <button
              key={s}
              onClick={() => onStartingSportChange(s)}
              className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                startingSport === s
                  ? s === 'nba' ? 'bg-[#f15a29] text-white' : 'bg-[#013369] text-white'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">First To</div>
        <div className="flex gap-1.5">
          {[10, 20, 30].map(n => (
            <button
              key={n}
              onClick={() => onWinTargetChange(n)}
              className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
                winTarget === n
                  ? 'bg-[#16a34a] text-white'
                  : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
