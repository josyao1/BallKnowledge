// Generic team type to support both NBA and NFL
interface GenericTeam {
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
}

interface TeamDisplayProps {
  team: GenericTeam;
  season: string;
}

export function TeamDisplay({ team, season }: TeamDisplayProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg"
        style={{ backgroundColor: team.colors.primary, color: team.colors.secondary }}
      >
        {team.abbreviation}
      </div>
      <div>
        <div className="font-semibold text-lg">{team.name}</div>
        <div className="text-gray-400 text-sm">{season} Season</div>
      </div>
    </div>
  );
}
