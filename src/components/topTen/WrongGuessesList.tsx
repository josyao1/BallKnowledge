import { useState, useEffect } from 'react';

const COLLAPSE_THRESHOLD = 5;

interface Props {
  wrongGuesses: string[];
}

export function WrongGuessesList({ wrongGuesses }: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (wrongGuesses.length === 0) setExpanded(false);
  }, [wrongGuesses.length]);

  if (wrongGuesses.length === 0) return null;

  const shouldCollapse = wrongGuesses.length > COLLAPSE_THRESHOLD;
  const visible =
    shouldCollapse && !expanded ? wrongGuesses.slice(0, COLLAPSE_THRESHOLD) : wrongGuesses;
  const hiddenCount = wrongGuesses.length - COLLAPSE_THRESHOLD;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="capcrunch-kicker text-[9px] text-white/30 tracking-[0.25em] shrink-0">
        Wrong ({wrongGuesses.length}):
      </span>
      {visible.map((name, i) => (
        <span
          key={i}
          className="capcrunch-kicker text-[10px] text-red-400/60 bg-red-950/30 border border-red-700/25 px-2 py-0.5 line-through decoration-red-500/50"
        >
          {name}
        </span>
      ))}
      {shouldCollapse && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="capcrunch-kicker text-[9px] text-white/30 hover:text-white/60 border border-white/10 px-2 py-0.5 transition-colors shrink-0"
        >
          +{hiddenCount} more
        </button>
      )}
      {shouldCollapse && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="capcrunch-kicker text-[9px] text-white/30 hover:text-white/60 border border-white/10 px-2 py-0.5 transition-colors shrink-0"
        >
          show less
        </button>
      )}
    </div>
  );
}
