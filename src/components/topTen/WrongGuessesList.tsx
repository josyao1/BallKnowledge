interface Props {
  wrongGuesses: string[];
}

export function WrongGuessesList({ wrongGuesses }: Props) {
  if (wrongGuesses.length === 0) return null;
  return (
    <div>
      <p className="capcrunch-kicker text-[9px] text-white/20 tracking-widest uppercase mb-2">Not in top 10</p>
      <div className="flex flex-wrap gap-1.5">
        {wrongGuesses.map((name, i) => (
          <span
            key={i}
            className="capcrunch-kicker text-[10px] text-[#E2008A]/65 bg-[#E2008A]/10 border border-[#E2008A]/20 px-2 py-0.5"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
