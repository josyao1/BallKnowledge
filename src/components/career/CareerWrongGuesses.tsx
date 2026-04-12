/**
 * CareerWrongGuesses.tsx — Red badge list of wrong guesses for Career Arc.
 * Shared by CareerGamePage (solo) and MultiplayerCareerPage.
 */

interface Props {
  guesses: string[];
}

export function CareerWrongGuesses({ guesses }: Props) {
  if (guesses.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {guesses.map((g, i) => (
        <span key={i} className="px-2 py-1 bg-red-900/30 border border-red-800/50 rounded text-xs sports-font text-red-300">
          {g}
        </span>
      ))}
    </div>
  );
}
