/**
 * startingLineupData.ts — Static loader for NFL Starting Lineup game mode.
 *
 * Fetches /data/nfl/starters_2025.json once per session and provides
 * helpers for picking a random team + side + encoding for the game.
 */

export type StarterEncoding = 'college' | 'number' | 'draft';

export type StarterPlayer = {
  gsis_id: string;
  name: string;
  pos_abb: string;
  pos_slot: number;
  number: string | null;
  college: string | null;
  college_espn_id: number | null;
  draft_pick: number | null;
};

export type NFLStartersSide = {
  offense: StarterPlayer[];
  defense: StarterPlayer[];
};

export type NFLStartersData = Record<string, NFLStartersSide>;

let cache: NFLStartersData | null = null;

export async function loadNFLStarters(): Promise<NFLStartersData> {
  if (cache) return cache;
  const res = await fetch('/data/nfl/starters_2025.json');
  if (!res.ok) throw new Error(`Failed to fetch starters: ${res.status}`);
  cache = await res.json() as NFLStartersData;
  return cache;
}

/** Returns all team abbreviations that have at least 8 starters on both sides. */
export function getValidTeams(data: NFLStartersData): string[] {
  return Object.keys(data).filter(
    t => data[t].offense.length >= 8 && data[t].defense.length >= 8
  );
}

/** Pick a random team + side. Offense 70%, defense 30%. */
export function getRandomTeamAndSide(
  data: NFLStartersData,
  excludeTeam?: string
): { team: string; side: 'offense' | 'defense'; players: StarterPlayer[] } {
  const teams = getValidTeams(data).filter(t => t !== excludeTeam);
  if (teams.length === 0) throw new Error('No valid teams in starters data');
  const team = teams[Math.floor(Math.random() * teams.length)];
  const side: 'offense' | 'defense' = Math.random() < 0.7 ? 'offense' : 'defense';
  const players = data[team][side].slice(0, 11);
  return { team, side, players };
}

/** Pick a random encoding, weighted toward college (most visually interesting). */
export function getRandomEncoding(): StarterEncoding {
  const r = Math.random();
  if (r < 0.5) return 'college';
  if (r < 0.8) return 'number';
  return 'draft';
}

/** Return the best encoding given available player data.
 *  Falls back: college → number → draft, picking the one with most non-null values. */
export function pickBestEncoding(players: StarterPlayer[]): StarterEncoding {
  const collegeCount = players.filter(p => p.college_espn_id != null).length;
  const numberCount = players.filter(p => p.number != null).length;
  const draftCount = players.filter(p => p.draft_pick != null).length;

  const scores: Record<StarterEncoding, number> = {
    college: collegeCount,
    number: numberCount,
    draft: draftCount,
  };

  // Weight toward college for interesting gameplay
  const weightedScores: Record<StarterEncoding, number> = {
    college: scores.college * 1.5,
    number: scores.number,
    draft: scores.draft * 0.8,
  };

  return (Object.entries(weightedScores) as [StarterEncoding, number][])
    .sort((a, b) => b[1] - a[1])[0][0];
}
