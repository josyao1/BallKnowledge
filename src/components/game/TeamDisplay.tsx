// Generic team type to support both NBA and NFL
interface GenericTeam {
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
}

interface TeamDisplayProps {
  team: GenericTeam;
  season: string;
  record?: string | null;  // e.g., "52-30" or "12-5"
}

export function TeamDisplay({ team, season, record }: TeamDisplayProps) {
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
        <div className="text-gray-400 text-sm">
          {season} Season
          {record && (
            <span className="ml-2 text-gray-500">({record})</span>
          )}
        </div>
      </div>
    </div>
  );
}
