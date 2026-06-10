interface Props {
  wrongGuesses: string[];
}

export function WrongGuessesList({ wrongGuesses }: Props) {
  if (wrongGuesses.length === 0) return null;
  return (
    <div>
      <p className="capcrunch-kicker text-[9px] text-white/25 tracking-[0.3em] mb-2">Not in Top 10</p>
      <div className="flex flex-wrap gap-1.5">
        {wrongGuesses.map((name, i) => (
          <span
            key={i}
            className="capcrunch-kicker text-[10px] text-white/25 bg-white/5 border border-white/10 px-2 py-0.5 line-through decoration-red-500/40"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
