/**
 * TeamLogo.tsx — Renders an ESPN CDN team logo with a text fallback.
 */

import { useState } from 'react';
import { getTeamLogoUrl } from '../utils/teamLogos';

interface TeamLogoProps {
  sport: 'nba' | 'nfl';
  abbr: string;
  size?: number;        // px — applied to both width and height
  className?: string;
}

export function TeamLogo({ sport, abbr, size = 48, className = '' }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);
  const url = getTeamLogoUrl(sport, abbr);

  if (!url || failed) {
    // Fallback: show abbreviation text styled to match surrounding context
    return (
      <span
        className={`retro-title font-bold leading-none ${className}`}
        style={{ fontSize: size * 0.4 }}
      >
        {abbr}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={abbr}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
