interface Props {
  wrongGuesses: string[];
}

export function WrongGuessesList({ wrongGuesses }: Props) {
  if (wrongGuesses.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="capcrunch-kicker text-[9px] text-white/30 tracking-[0.25em] shrink-0">Wrong:</span>
      {wrongGuesses.map((name, i) => (
        <span
          key={i}
          className="capcrunch-kicker text-[10px] text-red-400/60 bg-red-950/30 border border-red-700/25 px-2 py-0.5 line-through decoration-red-500/50"
        >
          {name}
        </span>
      ))}
    </div>
  );
}
