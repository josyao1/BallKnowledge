import { loadNBACareers, loadNFLCareers } from './careerData';
import { NBA_FRANCHISE_ALIASES, NFL_FRANCHISE_ALIASES } from './capCrunchData';
import { teams } from '../data/teams';
import { nflTeams } from '../data/nfl-teams';
import { areSimilarNames } from '../utils/fuzzyDedup';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopTenEntry {
  playerName: string;
  playerId: string | number;
  stat: number;
  team: string;
  year: string;
}

export interface StatCategoryDef {
  key: string;
  label: string;
  shortLabel: string;
  sport: 'nba' | 'nfl';
}

// ─── Category definitions ─────────────────────────────────────────────────────

export const NBA_STAT_CATEGORIES: StatCategoryDef[] = [
  { key: 'pts',       label: 'Points Per Game',      shortLabel: 'PPG',      sport: 'nba' },
  { key: 'reb',       label: 'Rebounds Per Game',     shortLabel: 'RPG',      sport: 'nba' },
  { key: 'ast',       label: 'Assists Per Game',      shortLabel: 'APG',      sport: 'nba' },
  { key: 'stl',       label: 'Steals Per Game',       shortLabel: 'SPG',      sport: 'nba' },
  { key: 'blk',       label: 'Blocks Per Game',       shortLabel: 'BPG',      sport: 'nba' },
  { key: 'total_3pm', label: '3-Pointers Made',       shortLabel: '3PM',      sport: 'nba' },
  { key: 'gp',        label: 'Games Played',          shortLabel: 'GP',       sport: 'nba' },
];

export const NFL_STAT_CATEGORIES: StatCategoryDef[] = [
  { key: 'passing_yards',   label: 'Passing Yards',        shortLabel: 'PASS YDS', sport: 'nfl' },
  { key: 'passing_tds',     label: 'Passing TDs',          shortLabel: 'PASS TDs', sport: 'nfl' },
  { key: 'interceptions',   label: 'Interceptions Thrown', shortLabel: 'INTs',     sport: 'nfl' },
  { key: 'rushing_yards',   label: 'Rushing Yards',        shortLabel: 'RUSH YDS', sport: 'nfl' },
  { key: 'rushing_tds',     label: 'Rushing TDs',          shortLabel: 'RUSH TDs', sport: 'nfl' },
  { key: 'receiving_yards', label: 'Receiving Yards',      shortLabel: 'REC YDS',  sport: 'nfl' },
  { key: 'receiving_tds',   label: 'Receiving TDs',        shortLabel: 'REC TDs',  sport: 'nfl' },
  { key: 'receptions',      label: 'Receptions',           shortLabel: 'REC',      sport: 'nfl' },
];

// Minimum stat value to qualify (avoids 1-game cameos dominating low-traffic categories)
const NFL_MIN_QUALIFY: Record<string, number> = {
  passing_yards: 200, passing_tds: 1, interceptions: 1,
  rushing_yards: 50,  rushing_tds: 1,
  receiving_yards: 50, receiving_tds: 1, receptions: 10,
};

// ─── Franchise alias resolution ───────────────────────────────────────────────

function resolveNBATeam(abbr: string): string {
  const aliases = NBA_FRANCHISE_ALIASES[abbr];
  if (aliases) {
    for (const a of aliases) {
      if (teams.find(t => t.abbreviation === a)) return a;
    }
  }
  return abbr;
}

function resolveNFLTeam(abbr: string): string {
  const aliases = NFL_FRANCHISE_ALIASES[abbr];
  if (aliases) {
    for (const a of aliases) {
      if (nflTeams.find(t => t.abbreviation === a)) return a;
    }
  }
  return abbr;
}

// Check if any team in a slash-separated string belongs to the target division
function nbaTeamInDivision(teamStr: string, conference: string, division: string): boolean {
  for (const part of teamStr.split('/')) {
    const canonical = resolveNBATeam(part.trim());
    const team = teams.find(t => t.abbreviation === canonical) ?? teams.find(t => t.abbreviation === part.trim());
    if (team && team.conference === conference && team.division === division) return true;
  }
  return false;
}

function nflTeamInDivision(teamStr: string, conference: string, division: string): boolean {
  for (const part of teamStr.split('/')) {
    const canonical = resolveNFLTeam(part.trim());
    const team = nflTeams.find(t => t.abbreviation === canonical) ?? nflTeams.find(t => t.abbreviation === part.trim());
    if (team && team.conference === conference && team.division === division) return true;
  }
  return false;
}

// Return the canonical abbreviation of the matching division team in a slash string
function nbaDisplayTeam(teamStr: string, conference?: string, division?: string): string {
  if (!conference || !division) return teamStr.split('/')[0];
  for (const part of teamStr.split('/')) {
    const canonical = resolveNBATeam(part.trim());
    const team = teams.find(t => t.abbreviation === canonical);
    if (team && team.conference === conference && team.division === division) return canonical;
  }
  return resolveNBATeam(teamStr.split('/')[0]);
}

function nflDisplayTeam(teamStr: string, conference?: string, division?: string): string {
  if (!conference || !division) return teamStr.split('/')[0];
  for (const part of teamStr.split('/')) {
    const canonical = resolveNFLTeam(part.trim());
    const team = nflTeams.find(t => t.abbreviation === canonical);
    if (team && team.conference === conference && team.division === division) return canonical;
  }
  return resolveNFLTeam(teamStr.split('/')[0]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** League-wide top 10 for a given stat category and season start year. */
export async function getTopTen(
  sport: 'nba' | 'nfl',
  category: string,
  year: number,
): Promise<TopTenEntry[]> {
  if (sport === 'nba') {
    const players = await loadNBACareers();
    const entries: TopTenEntry[] = [];

    for (const player of players) {
      for (const season of player.seasons) {
        if (parseInt(season.season.split('-')[0]) !== year) continue;
        const stat = (season as any)[category] as number | undefined;
        if (!stat || stat <= 0) continue;
        entries.push({
          playerName: player.player_name,
          playerId: player.player_id,
          stat,
          team: resolveNBATeam(season.team.split('/')[0]),
          year: season.season,
        });
        break;
      }
    }

    return entries.sort((a, b) => b.stat - a.stat).slice(0, 10);
  } else {
    const players = await loadNFLCareers();
    const entries: TopTenEntry[] = [];
    const minQual = NFL_MIN_QUALIFY[category] ?? 1;

    for (const player of players) {
      for (const season of player.seasons) {
        if (parseInt(season.season) !== year) continue;
        const stat = (season as any)[category] as number | undefined;
        if (!stat || stat < minQual) continue;
        entries.push({
          playerName: player.player_name,
          playerId: player.player_id,
          stat,
          team: resolveNFLTeam(season.team.split('/')[0]),
          year: season.season,
        });
        break;
      }
    }

    return entries.sort((a, b) => b.stat - a.stat).slice(0, 10);
  }
}

/** Division-window top 10: best qualifying season per player within the window. */
export async function getTopTenDivision(
  sport: 'nba' | 'nfl',
  category: string,
  conference: string,
  division: string,
  yearFrom: number,
  yearTo: number,
): Promise<TopTenEntry[]> {
  if (sport === 'nba') {
    const players = await loadNBACareers();
    const best = new Map<number, TopTenEntry>();

    for (const player of players) {
      for (const season of player.seasons) {
        const yr = parseInt(season.season.split('-')[0]);
        if (yr < yearFrom || yr > yearTo) continue;
        if (!nbaTeamInDivision(season.team, conference, division)) continue;
        const stat = (season as any)[category] as number | undefined;
        if (!stat || stat <= 0) continue;
        const existing = best.get(player.player_id);
        if (!existing || stat > existing.stat) {
          best.set(player.player_id, {
            playerName: player.player_name,
            playerId: player.player_id,
            stat,
            team: nbaDisplayTeam(season.team, conference, division),
            year: season.season,
          });
        }
      }
    }

    return Array.from(best.values()).sort((a, b) => b.stat - a.stat).slice(0, 10);
  } else {
    const players = await loadNFLCareers();
    const best = new Map<string, TopTenEntry>();
    const minQual = NFL_MIN_QUALIFY[category] ?? 1;

    for (const player of players) {
      for (const season of player.seasons) {
        const yr = parseInt(season.season);
        if (yr < yearFrom || yr > yearTo) continue;
        if (!nflTeamInDivision(season.team, conference, division)) continue;
        const stat = (season as any)[category] as number | undefined;
        if (!stat || stat < minQual) continue;
        const existing = best.get(player.player_id);
        if (!existing || stat > existing.stat) {
          best.set(player.player_id, {
            playerName: player.player_name,
            playerId: player.player_id,
            stat,
            team: nflDisplayTeam(season.team, conference, division),
            year: season.season,
          });
        }
      }
    }

    return Array.from(best.values()).sort((a, b) => b.stat - a.stat).slice(0, 10);
  }
}

export function pickRandomCategory(sport: 'nba' | 'nfl'): StatCategoryDef {
  const cats = sport === 'nba' ? NBA_STAT_CATEGORIES : NFL_STAT_CATEGORIES;
  return cats[Math.floor(Math.random() * cats.length)];
}

export function getAvailableYears(sport: 'nba' | 'nfl'): number[] {
  if (sport === 'nba') return Array.from({ length: 2025 - 1996 + 1 }, (_, i) => 1996 + i);
  return Array.from({ length: 2024 - 1999 + 1 }, (_, i) => 1999 + i);
}

export function getCategoryDef(sport: 'nba' | 'nfl', key: string): StatCategoryDef | undefined {
  const cats = sport === 'nba' ? NBA_STAT_CATEGORIES : NFL_STAT_CATEGORIES;
  return cats.find(c => c.key === key);
}

export function formatStat(stat: number, categoryKey: string): string {
  const perGame = ['pts', 'reb', 'ast', 'stl', 'blk', 'fg3m'];
  return perGame.includes(categoryKey) ? stat.toFixed(1) : stat.toString();
}

/**
 * Returns the indices of top10 entries matched by this guess.
 * Fills all entries belonging to the same player (handles multi-slot in division rounds).
 */
export function isValidGuess(
  guess: string,
  entries: TopTenEntry[],
  alreadyGuessedIndices: number[],
): number[] {
  const guessed = new Set(alreadyGuessedIndices);
  for (let i = 0; i < entries.length; i++) {
    if (guessed.has(i)) continue;
    if (areSimilarNames(guess, entries[i].playerName)) {
      const matched: number[] = [];
      for (let j = 0; j < entries.length; j++) {
        if (!guessed.has(j) && entries[j].playerId === entries[i].playerId) {
          matched.push(j);
        }
      }
      return matched;
    }
  }
  return [];
}
