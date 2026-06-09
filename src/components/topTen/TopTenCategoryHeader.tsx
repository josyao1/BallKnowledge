import { TeamLogo } from '../TeamLogo';

interface Props {
  categoryLabel: string;
  roundInfo: string;
  isTeamRound: boolean;
  teamAbbr: string;
  isCumulativeRound: boolean;
  isSingleSeason: boolean;
  sport: 'nba' | 'nfl';
}

export function TopTenCategoryHeader({ categoryLabel, roundInfo, isTeamRound, teamAbbr, isCumulativeRound, isSingleSeason, sport }: Props) {
  return (
    <div className="text-center pt-5 pb-1">
      <h2
        className="capcrunch-title text-3xl md:text-4xl"
        style={{ color: '#FDF100', textShadow: '0 0 28px rgba(253,241,0,0.2)' }}
      >
        {categoryLabel}
      </h2>
      <div className="flex items-center justify-center gap-1.5 mt-1.5">
        {isTeamRound && teamAbbr && (
          <TeamLogo abbr={teamAbbr} sport={sport} size={16} />
        )}
        <p className="capcrunch-kicker text-[11px] text-white/60 tracking-[0.35em] uppercase">{roundInfo}</p>
      </div>
      {isCumulativeRound && (
        <p className="capcrunch-kicker text-[9px] tracking-[0.2em] uppercase mt-1 inline-block px-2 py-0.5 border border-[#68BBE5]/30 bg-[#68BBE5]/08 text-[#68BBE5]">
          {isSingleSeason ? 'Single Season (No Repeats)' : 'Cumulative'}
        </p>
      )}
    </div>
  );
}
