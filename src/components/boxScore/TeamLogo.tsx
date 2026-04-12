/**
 * TeamLogo.tsx — NFL team logo image with error fallback for Box Score.
 * Shared by BoxScoreGamePage (solo) and MultiplayerBoxScorePage.
 */

import { getLogoUrl } from './boxScoreHelpers';

interface Props {
  abbr: string;
  className?: string;
  imgStyle?: React.CSSProperties;
}

export function TeamLogo({ abbr, className, imgStyle }: Props) {
  return (
    <img
      src={getLogoUrl(abbr)}
      alt={abbr}
      className={className ?? 'w-16 h-16 object-contain'}
      style={imgStyle}
      onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
    />
  );
}
