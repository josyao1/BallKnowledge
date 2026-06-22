/**
 * SettingsHelpers.tsx — Shared UI primitives used across game-type settings blocks.
 *
 *   Row         — label-left / content-right single line
 *   Chips       — inline flex group (small fixed sets)
 *   ScrollStrip — horizontally scrollable chip container (~4 visible)
 *   Chip        — single selectable option
 *   Stepper     — − N + numeric control
 *   SportToggle — NBA / NFL row using shared primitives
 *   TimerPicker — kept for BoxScoreSettings backward compat
 */

import type { ReactNode } from 'react';

// ─── Shared select style ──────────────────────────────────────────────────────

export const selectCls =
  'bg-black/40 text-white/60 px-2 py-1 border border-white/12 capcrunch-kicker text-[10px] focus:outline-none focus:border-white/25 hover:border-white/20 appearance-none cursor-pointer transition-colors';

// ─── Layout primitives ────────────────────────────────────────────────────────

/** Label-left / content-right single settings row. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 min-h-[26px]">
      <span className="capcrunch-kicker text-[9px] text-white/35 tracking-[0.2em] uppercase shrink-0 w-14">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/** Inline flex group — for small fixed option sets (2–6 options, all visible). */
export function Chips({ children }: { children: ReactNode }) {
  return <div className="flex gap-1">{children}</div>;
}

/** Horizontally scrollable strip — shows ~4 chips at a time, hides scrollbar. */
export function ScrollStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {children}
    </div>
  );
}

/** Single selectable chip. */
export function Chip({
  active,
  activeBg = '#FDF100',
  activeText = '#000',
  onClick,
  children,
  dim = false,
  title,
}: {
  active: boolean;
  activeBg?: string;
  activeText?: string;
  onClick: () => void;
  children: ReactNode;
  /** dim = struck-through disabled state (round filter off) */
  dim?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`shrink-0 px-2.5 py-1 capcrunch-kicker text-[10px] tracking-wider transition-all ${
        active
          ? ''
          : dim
            ? 'bg-black/20 text-white/15 border border-white/6 line-through'
            : 'bg-black/40 text-white/40 border border-white/10 hover:border-white/22 hover:text-white/60'
      }`}
      style={
        active
          ? {
              background: activeBg,
              color: activeText,
              boxShadow: '0 1px 0 rgba(0,0,0,0.35)',
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}

/** − N + numeric stepper. */
export function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const btn =
    'w-6 h-6 flex items-center justify-center capcrunch-kicker text-sm text-white/40 hover:text-white border border-white/10 hover:border-white/25 transition-colors';
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
        −
      </button>
      <span className="capcrunch-title text-sm text-white tabular-nums w-5 text-center">
        {value}
      </span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
        +
      </button>
    </div>
  );
}

// ─── SportToggle ──────────────────────────────────────────────────────────────

export function SportToggle({ sport, onChange }: { sport: string; onChange: (s: string) => void }) {
  return (
    <Row label="Sport">
      <Chips>
        {(['nba', 'nfl'] as const).map((s) => (
          <Chip
            key={s}
            active={sport === s}
            activeBg={s === 'nba' ? '#f15a29' : '#013369'}
            activeText="#fff"
            onClick={() => onChange(s)}
          >
            {s.toUpperCase()}
          </Chip>
        ))}
      </Chips>
    </Row>
  );
}

// ─── TimerPicker ──────────────────────────────────────────────────────────────

interface TimerPickerProps {
  timer: number;
  customTimer: string;
  presets: number[];
  activeColor: string;
  onSelect: (seconds: number) => void;
  onCustomChange: (raw: string, clamped: number) => void;
}

export function TimerPicker({
  timer,
  customTimer,
  presets,
  activeColor,
  onSelect,
  onCustomChange,
}: TimerPickerProps) {
  const activeBg = activeColor.includes('f59e0b') ? '#f59e0b' : '#FDF100';
  return (
    <div className="space-y-2">
      <Row label="Timer">
        <ScrollStrip>
          {presets.map((s) => (
            <Chip
              key={s}
              active={timer === s && !customTimer}
              activeBg={activeBg}
              onClick={() => onSelect(s)}
            >
              {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
            </Chip>
          ))}
        </ScrollStrip>
      </Row>
      <Row label="Custom">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={customTimer}
            onChange={(e) => {
              const raw = e.target.value;
              const clamped = Math.max(10, Math.min(600, parseInt(raw) || 90));
              onCustomChange(raw, clamped);
            }}
            placeholder="sec"
            min={10}
            max={600}
            className="w-16 px-2 py-1 bg-black/40 border border-white/10 text-white/60 text-center capcrunch-kicker text-[10px] focus:outline-none focus:border-white/25"
          />
          {customTimer && (
            <span className="text-[#555] capcrunch-kicker text-[10px]">
              = {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      </Row>
    </div>
  );
}
