import { useState } from 'react';
import nflHeadshots from '../../../public/data/nfl_headshots.json';

interface Props {
  playerId: string | number | undefined;
  sport: 'nba' | 'nfl';
  className?: string;
}

/** Generic silhouette shown when no headshot exists for the player. */
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
 * Renders a player headshot.
 * NBA: uses NBA.com CDN directly (player IDs in our data are NBA.com IDs).
 * NFL: looks up GSIS ID in nfl_headshots.json (pre-generated from nflverse).
 * Falls back to a generic silhouette if no headshot is found.
 */
export function PlayerHeadshot({ playerId, sport, className = 'w-7 h-7 rounded-full object-cover shrink-0' }: Props) {
  const [error, setError] = useState(false);
  if (!playerId || error) return <Silhouette className={className} />;

  let url: string | null = null;
  if (sport === 'nba') {
    url = `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
  } else {
    url = (nflHeadshots as Record<string, string>)[String(playerId)] ?? null;
  }

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
