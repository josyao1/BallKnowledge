/**
 * SectionHeader.tsx — Divider with centered label for Box Score sections.
 * Shared by BoxScoreGamePage (solo) and MultiplayerBoxScorePage.
 */

export function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${color}60, transparent)` }} />
      <span className="sports-font text-[10px] tracking-[0.4em] uppercase font-bold" style={{ color }}>{label}</span>
      <div className="h-px flex-1" style={{ background: `linear-gradient(270deg, ${color}60, transparent)` }} />
    </div>
  );
}
