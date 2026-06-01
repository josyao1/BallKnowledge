interface Props {
  wrongGuesses: string[];
}

export function WrongGuessesList({ wrongGuesses }: Props) {
  if (wrongGuesses.length === 0) return null;
  return (
    <div>
      <p className="sports-font text-[9px] text-white/20 tracking-widest uppercase mb-2">Not in top 10</p>
      <div className="flex flex-wrap gap-1.5">
        {wrongGuesses.map((name, i) => (
          <span
            key={i}
            className="sports-font text-[10px] text-red-400/50 bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded-sm"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
