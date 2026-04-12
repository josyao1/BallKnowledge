/**
 * CreateGameTypeSelector.tsx — Game type button grid for the lobby creation page.
 * Shows all available modes with popular indicators and a legend.
 */

type LobbyMode = 'roster' | 'career' | 'scramble' | 'lineup-is-right' | 'box-score' | 'starting-lineup';

const MODES: { value: LobbyMode; label: React.ReactNode; activeClass: string }[] = [
  {
    value: 'roster',
    label: <><span style={{ color: '#d4af37' }}>★</span> Roster</>,
    activeClass: 'bg-[#d4af37] text-black',
  },
  { value: 'career',         label: 'Career',    activeClass: 'bg-[#22c55e] text-black' },
  { value: 'scramble',       label: 'Scramble',  activeClass: 'bg-[#3b82f6] text-white' },
  {
    value: 'lineup-is-right',
    label: <><span style={{ color: '#d4af37' }}>★</span> Cap Crunch</>,
    activeClass: 'bg-[#ec4899] text-white',
  },
  { value: 'box-score',      label: 'Box Score', activeClass: 'bg-[#f59e0b] text-black' },
  { value: 'starting-lineup', label: 'Starters', activeClass: 'bg-[#16a34a] text-white' },
];

interface Props {
  lobbyMode: LobbyMode;
  onModeChange: (m: LobbyMode) => void;
}

export function CreateGameTypeSelector({ lobbyMode, onModeChange }: Props) {
  return (
    <div className="bg-black/50 border border-white/10 rounded-sm p-4">
      <div className="sports-font text-[10px] text-white/40 text-center mb-3 tracking-[0.3em] uppercase">
        Game Type
      </div>
      <div className="flex gap-2 justify-center flex-wrap">
        {MODES.map(({ value, label, activeClass }) => (
          <button
            key={value}
            onClick={() => onModeChange(value)}
            className={`px-6 py-2 rounded-sm sports-font tracking-wider transition-all ${
              lobbyMode === value
                ? `${activeClass} shadow-lg font-bold`
                : 'bg-black/40 text-white/50 border border-white/20 hover:border-white/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="text-center mt-2 sports-font text-[10px] text-white/30 tracking-wider">
        <span style={{ color: '#d4af37' }}>★</span> = most popular
      </div>
    </div>
  );
}
