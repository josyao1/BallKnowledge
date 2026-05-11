import { getNBALogoUrl } from './boxScoreHelpers';

interface Props {
  abbr: string;
  className?: string;
  imgStyle?: React.CSSProperties;
}

export function NBATeamLogo({ abbr, className, imgStyle }: Props) {
  return (
    <img
      src={getNBALogoUrl(abbr)}
      alt={abbr}
      className={className ?? 'w-14 h-14 object-contain'}
      style={imgStyle}
      onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
    />
  );
}
