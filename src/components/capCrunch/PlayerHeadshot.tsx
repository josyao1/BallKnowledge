import { useState, useEffect } from 'react';

interface Props {
  playerId: string | number | undefined;
  sport: 'nba' | 'nfl';
  className?: string;
}

// Module-level cache so the JSON is fetched once and shared across all instances.
let _nflHeadshots: Record<string, string> | null = null;
let _nflHeadshotsPromise: Promise<Record<string, string>> | null = null;

function loadNflHeadshots(): Promise<Record<string, string>> {
  if (_nflHeadshots) return Promise.resolve(_nflHeadshots);
  if (!_nflHeadshotsPromise) {
    _nflHeadshotsPromise = fetch('/data/nfl_headshots.json')
      .then(r => r.json())
      .then(data => { _nflHeadshots = data; return data; });
  }
  return _nflHeadshotsPromise;
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
 * NFL: looks up GSIS ID in nfl_headshots.json (fetched once, cached in memory).
 * Falls back to a generic silhouette if no headshot is found.
 */
export function PlayerHeadshot({ playerId, sport, className = 'w-7 h-7 rounded-full object-cover shrink-0' }: Props) {
  const [error, setError] = useState(false);
  const [nflUrl, setNflUrl] = useState<string | null>(null);

  useEffect(() => {
    if (sport !== 'nfl' || !playerId) return;
    loadNflHeadshots().then(map => {
      setNflUrl(map[String(playerId)] ?? null);
    });
  }, [sport, playerId]);

  if (!playerId || error) return <Silhouette className={className} />;

  const url = sport === 'nba'
    ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`
    : nflUrl;

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
