import { useState } from 'react';

interface Props {
  playerId: string | number | undefined;
  sport: 'nba' | 'nfl';
  className?: string;
}

/** Generic silhouette shown when no ESPN headshot exists for the player. */
function Silhouette({ className }: { className: string }) {
  return (
    <div className={`${className} bg-white/8 flex items-center justify-center overflow-hidden`}>
      <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
        <circle cx="20" cy="14" r="7" fill="rgba(255,255,255,0.18)" />
        <ellipse cx="20" cy="34" rx="13" ry="10" fill="rgba(255,255,255,0.18)" />
      </svg>
    </div>
  );
}

/**
 * Renders an ESPN player headshot fetched by player_id.
 * Falls back to a generic silhouette if no headshot exists.
 */
export function PlayerHeadshot({ playerId, sport, className = 'w-7 h-7 rounded-full object-cover shrink-0' }: Props) {
  const [error, setError] = useState(false);
  if (!playerId || error) return <Silhouette className={className} />;
  // NBA: player IDs in our data are NBA.com IDs — use the NBA CDN directly.
  // NFL: handled via nfl_headshots.json lookup (see PlayerHeadshot usage); fall back to silhouette.
  const url = sport === 'nba'
    ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`
    : null;
  if (!url) return <Silhouette className={className} />;
  return (
    <img
      src={url}
      alt=""
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
}
