const COLORS = ['#f59e0b','#ec4899','#60a5fa','#34d399','#a78bfa','#fb923c','#f87171','#a3e635'];

function isGradWeek(): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const d = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, +p.value]));
  return d.year === 2026 && d.month === 6 && d.day >= 13 && d.day <= 15;
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
          {'🎓 🎉 🥂 🎊 🏆 📜 ✨ 🎈 👨‍🎓 👩‍🎓 🎓 🎉 🥂 🎊 🏆 📜 ✨ 🎈 '.repeat(6)}
        </div>
      ))}
    </div>
  );
}
