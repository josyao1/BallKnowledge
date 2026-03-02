/**
 * startingLineupData.ts — Static loader for Starting Lineup game mode (NFL + NBA).
 *
 * NFL: fetches /data/nfl/starters_2025.json — offense + defense sides, 11 players each
 * NBA: fetches /data/nba/starters_2025.json — starting 5 per team, no side
 */

export type StarterEncoding = 'college' | 'number' | 'draft';

/** Shared player shape for both NFL and NBA starters. */
export type StarterPlayer = {
  id: string;               // gsis_id for NFL, player_id string for NBA
  name: string;
  pos_abb: string;          // NFL: LT/QB/LDE/etc.  NBA: PG/SG/SF/PF/C
  number: string | null;
  college: string | null;
  college_espn_id: number | null;
  draft_pick: number | null;
  ppg?: number | null;
};

// ── NFL ────────────────────────────────────────────────────────────────────

export type NFLStartersSide = {
  offense: StarterPlayer[];
  defense: StarterPlayer[];
};

export type NFLStartersData = Record<string, NFLStartersSide>;

let nflCache: NFLStartersData | null = null;

export async function loadNFLStarters(): Promise<NFLStartersData> {
  if (nflCache) return nflCache;
  const res = await fetch('/data/nfl/starters_2025.json');
  if (!res.ok) throw new Error(`Failed to fetch NFL starters: ${res.status}`);
  nflCache = await res.json() as NFLStartersData;
  return nflCache;
}

/** Returns all NFL team abbreviations that have at least 8 starters on both sides. */
export function getNFLValidTeams(data: NFLStartersData): string[] {
  return Object.keys(data).filter(
    t => data[t].offense.length >= 8 && data[t].defense.length >= 8
  );
}

/** Pick a random NFL team + side. Offense 70%, defense 30%. */
export function getRandomNFLTeamAndSide(
  data: NFLStartersData,
  excludeTeam?: string
): { team: string; side: 'offense' | 'defense'; players: StarterPlayer[] } {
  const teams = getNFLValidTeams(data).filter(t => t !== excludeTeam);
  if (teams.length === 0) throw new Error('No valid NFL teams in starters data');
  const team = teams[Math.floor(Math.random() * teams.length)];
  const side: 'offense' | 'defense' = Math.random() < 0.7 ? 'offense' : 'defense';
  const players = data[team][side].slice(0, 11);
  return { team, side, players };
}

// ── NBA ────────────────────────────────────────────────────────────────────

export type NBAStartersTeam = {
  starters: StarterPlayer[];
};

export type NBAStartersData = Record<string, NBAStartersTeam>;

let nbaCache: NBAStartersData | null = null;

export async function loadNBAStarters(): Promise<NBAStartersData> {
  if (nbaCache) return nbaCache;
  const res = await fetch('/data/nba/starters_2026.json');
  if (!res.ok) throw new Error(`Failed to fetch NBA starters: ${res.status}`);
  nbaCache = await res.json() as NBAStartersData;
  return nbaCache;
}

/** Returns all NBA team abbreviations that have a full starting 5. */
export function getNBAValidTeams(data: NBAStartersData): string[] {
  return Object.keys(data).filter(t => data[t].starters.length >= 5);
}

/** Pick a random NBA team. */
export function getRandomNBATeam(
  data: NBAStartersData,
  excludeTeam?: string
): { team: string; players: StarterPlayer[] } {
  const teams = getNBAValidTeams(data).filter(t => t !== excludeTeam);
  if (teams.length === 0) throw new Error('No valid NBA teams in starters data');
  const team = teams[Math.floor(Math.random() * teams.length)];
  const players = data[team].starters.slice(0, 5);
  return { team, players };
}

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Pick a random encoding, weighted toward college (most visually interesting). */
export function getRandomEncoding(): StarterEncoding {
  const r = Math.random();
  if (r < 0.5) return 'college';
  if (r < 0.8) return 'number';
  return 'draft';
}

/** Return the best encoding given available player data. */
export function pickBestEncoding(players: StarterPlayer[]): StarterEncoding {
  const collegeCount = players.filter(p => p.college_espn_id != null).length;
  const numberCount  = players.filter(p => p.number != null).length;
  const draftCount   = players.filter(p => p.draft_pick != null).length;

  const weighted: Record<StarterEncoding, number> = {
    college: collegeCount * 1.5,
    number:  numberCount,
    draft:   draftCount * 0.8,
  };

  return (Object.entries(weighted) as [StarterEncoding, number][])
    .sort((a, b) => b[1] - a[1])[0][0];
}
