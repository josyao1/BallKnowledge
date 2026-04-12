/**
 * SettingsHelpers.tsx — Shared UI primitives used across game-type settings blocks.
 *
 *   SportToggle — NBA / NFL two-button toggle
 *   TimerPicker — preset buttons + freeform seconds input
 */

// ── SportToggle ────────────────────────────────────────────────────────────────

export function SportToggle({ sport, onChange }: { sport: string; onChange: (s: string) => void }) {
  return (
    <div>
      <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Sport</div>
      <div className="flex gap-1.5">
        {(['nba', 'nfl'] as const).map(s => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`flex-1 py-2 rounded-sm retro-title text-base transition-all ${
              sport === s
                ? s === 'nba' ? 'bg-[#f15a29] text-white' : 'bg-[#013369] text-white'
                : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── TimerPicker ────────────────────────────────────────────────────────────────

interface TimerPickerProps {
  timer: number;
  customTimer: string;
  presets: number[];
  activeColor: string;
  onSelect: (seconds: number) => void;
  onCustomChange: (raw: string, clamped: number) => void;
}

export function TimerPicker({ timer, customTimer, presets, activeColor, onSelect, onCustomChange }: TimerPickerProps) {
  return (
    <div>
      <div className="sports-font text-[9px] text-[#555] tracking-[0.25em] uppercase mb-2">Timer</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presets.map(s => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className={`flex-1 py-2 rounded-sm sports-font text-xs transition-all ${
              timer === s && !customTimer
                ? activeColor
                : 'bg-[#111] text-[#444] border border-[#222] hover:border-[#3a3a3a] hover:text-[#888]'
            }`}
          >
            {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#444] text-[10px] sports-font tracking-wider">Custom:</span>
        <input
          type="number"
          value={customTimer}
          onChange={e => {
            const raw = e.target.value;
            const clamped = Math.max(10, Math.min(600, parseInt(raw) || 90));
            onCustomChange(raw, clamped);
          }}
          placeholder="sec" min={10} max={600}
          className="w-20 px-2 py-1.5 bg-[#111] rounded-sm border border-[#2a2a2a] text-[#ccc] text-center sports-font text-sm focus:outline-none focus:border-[#444]"
        />
        {customTimer && (
          <span className="text-[#666] sports-font text-sm">
            = {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
          </span>
        )}
      </div>
    </div>
  );
}
