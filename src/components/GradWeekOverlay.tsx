const COLORS = [
  '#f59e0b',
  '#ec4899',
  '#60a5fa',
  '#34d399',
  '#a78bfa',
  '#fb923c',
  '#f87171',
  '#a3e635',
];

export function isGradWeek(): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const d = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, +p.value]),
  );
  return d.year === 2026 && d.month === 6 && d.day >= 13 && d.day <= 15;
}

const GRAD_EMOJIS = '🎓 🎉 🥂 🎊 🏆 📜 ✨ 🎈 👨‍🎓 👩‍🎓 🎓 🎊 🥂 🎉 ✨ 🎈 🏆 📜 ';

export function GradBanner() {
  if (!isGradWeek()) return null;
  return (
    <div className="w-full overflow-hidden border-y border-white/10 bg-white/[0.02] py-2">
      <p className="whitespace-nowrap text-lg tracking-widest select-none animate-[gradscroll_18s_linear_infinite]">
        {GRAD_EMOJIS.repeat(4)}
      </p>
      <style>{`@keyframes gradscroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

export function GradWeekOverlay() {
  if (!isGradWeek()) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
      {COLORS.map((color, i) => (
        <div
          key={i}
          className="absolute whitespace-nowrap retro-title text-[13px] tracking-[0.2em] select-none"
          style={{
            color,
            opacity: 0.22,
            top: `${i * 14}%`,
            left: '50%',
            transform: 'translateX(-50%) rotate(-22deg)',
          }}
        >
          {'🎓 HAPPY GRADUATION 🎓 '.repeat(12)}
        </div>
      ))}
    </div>
  );
}
