/**
 * ZoomedHeadshot.tsx — Reusable zoomed headshot for Face Reveal.
 *
 * Renders a fixed 320×320 container with overflow hidden. The image is
 * scaled via CSS transform so the player's face fills the frame at higher
 * zoom levels. transform-origin is set to center 28% to keep the face
 * region (not the chest) centered for both NBA and NFL headshots.
 *
 * NBA zoom levels (1040×760 source): [6.0, 3.0, 1.5]
 * NFL zoom levels (~350×280 ESPN source): [4.0, 2.2, 1.3]
 */

import { useState, useEffect } from 'react';

// Module-level cache shared with PlayerHeadshot.
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

// Index 0 = scale 1.0 (full unzoomed view, used for answer reveals).
// Index 1–3 = progressive zoom levels used during gameplay.
const NBA_ZOOM = [1.0, 6.0, 3.0, 1.5] as const;
const NFL_ZOOM = [1.0, 4.0, 2.2, 1.3] as const;

interface Props {
  playerId: string | number;
  sport: 'nba' | 'nfl';
  /** 0 = full unzoomed (answer reveal); 1–3 = gameplay zoom levels (most → least zoomed). */
  zoomLevel: 0 | 1 | 2 | 3;
  /**
   * Focal point for both objectPosition and transformOrigin, as percentages.
   * Defaults to { x: 50, y: 28 } (center horizontally, upper face vertically).
   * Randomised per-player in SoloFaceRevealPage so the zoom-in spot varies.
   */
  originX?: number;
  originY?: number;
  /** Square size in px. Defaults to 320. Use smaller values for thumbnails. */
  size?: number;
  /** Optional extra class on the outer container (e.g. for rounded corners). */
  className?: string;
}

function Silhouette() {
  return (
    <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
      <svg viewBox="0 0 40 40" fill="none" className="w-24 h-24 opacity-20">
        <circle cx="20" cy="14" r="7" fill="white" />
        <ellipse cx="20" cy="34" rx="13" ry="10" fill="white" />
      </svg>
    </div>
  );
}

export function ZoomedHeadshot({ playerId, sport, zoomLevel, originX = 50, originY = 28, size = 320, className = '' }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [error, setError]   = useState(false);

  useEffect(() => {
    setError(false);
    if (!playerId) return;

    if (sport === 'nba') {
      setImgUrl(`https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`);
    } else {
      loadNflHeadshots().then(map => {
        setImgUrl(map[String(playerId)] ?? null);
      });
    }
  }, [playerId, sport]);

  const scale = sport === 'nba' ? NBA_ZOOM[zoomLevel] : NFL_ZOOM[zoomLevel];

  return (
    <div
      className={`relative overflow-hidden bg-[#0e0e0e] ${className}`}
      style={{ width: size, height: size }}
    >
      {(!imgUrl || error) ? (
        <Silhouette />
      ) : (
        <img
          key={playerId}
          src={imgUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: `${originX}% ${originY}%`,
            transform: `scale(${scale})`,
            transformOrigin: `${originX}% ${originY}%`,
            transition: 'transform 1.2s ease-out',
          }}
        />
      )}
    </div>
  );
}
