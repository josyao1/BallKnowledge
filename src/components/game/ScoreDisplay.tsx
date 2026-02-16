/**
 * ScoreDisplay.tsx — Score summary with points, roster progress, and bonus.
 *
 * Shows total points (base + bonus), player count vs. roster size with
 * percentage, and an optional bonus badge when bonus points are earned.
 */

interface ScoreDisplayProps {
  score: number;
  bonusPoints: number;
  guessedCount: number;
  totalPlayers: number;
}

export function ScoreDisplay({ score, bonusPoints, guessedCount, totalPlayers }: ScoreDisplayProps) {
  const totalScore = score + bonusPoints;
  const percentage = Math.round((guessedCount / totalPlayers) * 100);

  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="text-center">
        <div className="text-3xl font-bold text-green-400">{totalScore}</div>
        <div className="text-gray-500 text-xs">Points</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-semibold text-white">
          {guessedCount}/{totalPlayers}
        </div>
        <div className="text-gray-500 text-xs">{percentage}%</div>
      </div>
      {bonusPoints > 0 && (
        <div className="text-center">
          <div className="text-lg font-semibold text-yellow-400">+{bonusPoints}</div>
          <div className="text-gray-500 text-xs">Bonus</div>
        </div>
      )}
    </div>
  );
}
