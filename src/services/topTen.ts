import { loadNBALineupPool, loadNFLLineupPool } from './careerData';
import { NBA_FRANCHISE_ALIASES, NFL_FRANCHISE_ALIASES } from './capCrunchData';
import { teams, getNBADivisions } from '../data/teams';
import { nflTeams, getNFLDivisions } from '../data/nfl-teams';
import { areSimilarNames, normalize } from '../utils/fuzzyDedup';
import { getAwardEntries, getAwardYears, AWARD_CATEGORY_KEYS } from '../data/nflAwards';

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
  /** Overrides label/shortLabel when used in division cumulative mode (totals, not per-game). */
  divisionLabel?: string;
  divisionShortLabel?: string;
}

// ─── Category definitions ─────────────────────────────────────────────────────

export const NBA_STAT_CATEGORIES: StatCategoryDef[] = [
  { key: 'pts',       label: 'Points Per Game',      shortLabel: 'PPG', sport: 'nba', divisionLabel: 'Total Points',    divisionShortLabel: 'PTS' },
  { key: 'reb',       label: 'Rebounds Per Game',     shortLabel: 'RPG', sport: 'nba', divisionLabel: 'Total Rebounds',  divisionShortLabel: 'REB' },
  { key: 'ast',       label: 'Assists Per Game',      shortLabel: 'APG', sport: 'nba', divisionLabel: 'Total Assists',   divisionShortLabel: 'AST' },
  { key: 'stl',       label: 'Steals Per Game',       shortLabel: 'SPG', sport: 'nba', divisionLabel: 'Total Steals',    divisionShortLabel: 'STL' },
  { key: 'blk',       label: 'Blocks Per Game',       shortLabel: 'BPG', sport: 'nba', divisionLabel: 'Total Blocks',    divisionShortLabel: 'BLK' },
  { key: 'total_3pm', label: '3-Pointers Made',       shortLabel: '3PM', sport: 'nba' },
  { key: 'gp',        label: 'Games Played',          shortLabel: 'GP',  sport: 'nba' },
];

/** NFL categories for team-cumulative mode: combined fantasy_pts instead of per-position. */
export const NFL_TEAM_STAT_CATEGORIES: StatCategoryDef[] = [
  { key: 'passing_yards',   label: 'Passing Yards',        shortLabel: 'PASS YDS', sport: 'nfl' },
  { key: 'passing_tds',     label: 'Passing TDs',          shortLabel: 'PASS TDs', sport: 'nfl' },
  { key: 'interceptions',   label: 'Interceptions Thrown', shortLabel: 'INTs',     sport: 'nfl' },
  { key: 'rushing_yards',   label: 'Rushing Yards',        shortLabel: 'RUSH YDS', sport: 'nfl' },
  { key: 'rushing_tds',     label: 'Rushing TDs',          shortLabel: 'RUSH TDs', sport: 'nfl' },
  { key: 'receiving_yards', label: 'Receiving Yards',      shortLabel: 'REC YDS',  sport: 'nfl' },
  { key: 'receiving_tds',   label: 'Receiving TDs',        shortLabel: 'REC TDs',  sport: 'nfl' },
  { key: 'receptions',      label: 'Receptions',           shortLabel: 'REC',      sport: 'nfl' },
  { key: 'fantasy_pts',     label: 'Fantasy Points (PPR)', shortLabel: 'FPTS',     sport: 'nfl' },
];

export const NFL_STAT_CATEGORIES: StatCategoryDef[] = [
  { key: 'passing_yards',    label: 'Passing Yards',        shortLabel: 'PASS YDS', sport: 'nfl' },
  { key: 'passing_tds',      label: 'Passing TDs',          shortLabel: 'PASS TDs', sport: 'nfl' },
  { key: 'interceptions',    label: 'Interceptions Thrown', shortLabel: 'INTs',     sport: 'nfl' },
  { key: 'rushing_yards',    label: 'Rushing Yards',        shortLabel: 'RUSH YDS', sport: 'nfl' },
  { key: 'rushing_tds',      label: 'Rushing TDs',          shortLabel: 'RUSH TDs', sport: 'nfl' },
  { key: 'receiving_yards',  label: 'Receiving Yards',      shortLabel: 'REC YDS',  sport: 'nfl' },
  { key: 'receiving_tds',    label: 'Receiving TDs',        shortLabel: 'REC TDs',  sport: 'nfl' },
  { key: 'receptions',       label: 'Receptions',           shortLabel: 'REC',      sport: 'nfl' },
  { key: 'fantasy_pts_qb',   label: 'Fantasy Points (QB)',  shortLabel: 'FPTS QB',  sport: 'nfl' },
  { key: 'fantasy_pts_rb',   label: 'Fantasy Points (RB)',  shortLabel: 'FPTS RB',  sport: 'nfl' },
  { key: 'fantasy_pts_wr',   label: 'Fantasy Points (WR)',  shortLabel: 'FPTS WR',  sport: 'nfl' },
  { key: 'fantasy_pts_te',   label: 'Fantasy Points (TE)',  shortLabel: 'FPTS TE',  sport: 'nfl' },
  { key: 'award_mvp',        label: 'AP MVP Voting',        shortLabel: 'AP MVP',   sport: 'nfl' },
  { key: 'award_opoy',       label: 'AP Off. Player of Year', shortLabel: 'OPOY',   sport: 'nfl' },
  { key: 'award_oroy',       label: 'AP Off. Rookie of Year', shortLabel: 'OROY',   sport: 'nfl' },
];

// Minimum stat value to qualify (avoids 1-game cameos dominating low-traffic categories)
const NFL_MIN_QUALIFY: Record<string, number> = {
  passing_yards: 200, passing_tds: 1, interceptions: 1,
  rushing_yards: 50,  rushing_tds: 1,
  receiving_yards: 50, receiving_tds: 1, receptions: 10,
};

// PPR fantasy points scoring
function calcFantasyPts(season: any): number {
  return Math.round((
    (Number(season.passing_yards)  || 0) * 0.04 +
    (Number(season.passing_tds)    || 0) * 4 +
    (Number(season.interceptions)  || 0) * -2 +
    (Number(season.rushing_yards)  || 0) * 0.1 +
    (Number(season.rushing_tds)    || 0) * 6 +
    (Number(season.receptions)     || 0) * 1 +
    (Number(season.receiving_yards)|| 0) * 0.1 +
    (Number(season.receiving_tds)  || 0) * 6
  ) * 10) / 10;
}

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

function nbaTeamMatches(teamStr: string, targetAbbr: string): boolean {
  for (const part of teamStr.split('/')) {
    const canonical = resolveNBATeam(part.trim());
    if (canonical === targetAbbr || part.trim() === targetAbbr) return true;
  }
  return false;
}

function nflTeamMatches(teamStr: string, targetAbbr: string): boolean {
  for (const part of teamStr.split('/')) {
    const canonical = resolveNFLTeam(part.trim());
    if (canonical === targetAbbr || part.trim() === targetAbbr) return true;
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

// ─── Award player-id lookup ───────────────────────────────────────────────────
// Award entries only carry player name; resolve to GSIS ID via the lineup pool
// so PlayerHeadshot can render the real headshot.
let _nflAwardIdCache: Map<string, string> | null = null;
async function nflIdByName(name: string): Promise<string> {
  if (!_nflAwardIdCache) {
    const pool = await loadNFLLineupPool();
    _nflAwardIdCache = new Map();
    for (const p of pool) {
      if (p.player_name && p.player_id)
        _nflAwardIdCache.set(normalize(p.player_name).toLowerCase(), String(p.player_id));
    }
  }
  return _nflAwardIdCache.get(normalize(name).toLowerCase()) ?? name;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** League-wide top 10 for a given stat category and season start year. */
export async function getTopTen(
  sport: 'nba' | 'nfl',
  category: string,
  year: number,
): Promise<TopTenEntry[]> {
  // Award voting — hardcoded, not derived from career stats
  if (category in AWARD_CATEGORY_KEYS) {
    const raw = getAwardEntries(category, year);
    return Promise.all(raw.map(async e => ({
      playerName: e.name,
      playerId:   await nflIdByName(e.name),
      stat:       e.rank,
      team:       e.team,
      year:       String(year),
    })));
  }

  if (sport === 'nba') {
    const players = await loadNBALineupPool();
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
    const players = await loadNFLLineupPool();
    const entries: TopTenEntry[] = [];

    if (category.startsWith('fantasy_pts_')) {
      const posFilter = category.split('_')[2].toUpperCase();
      for (const player of players) {
        if (player.position?.toUpperCase() !== posFilter) continue;
        for (const season of player.seasons) {
          if (parseInt(season.season) !== year) continue;
          const stat = calcFantasyPts(season);
          if (stat <= 0) continue;
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
    } else {
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
    }

    return entries.sort((a, b) => b.stat - a.stat).slice(0, 10);
  }
}

// NBA per-game fields → season-total equivalents for cumulative division mode
const NBA_PER_GAME_TO_TOTAL: Record<string, string> = {
  pts: 'total_pts',
  reb: 'total_reb',
  ast: 'total_ast',
  stl: 'total_stl',
  blk: 'total_blk',
};

type DivSumEntry = { playerName: string; playerId: number | string; total: number; team: string; latestYr: number; earliestYr: number; teamTotals?: Record<string, number> };

function bestTeam(teamTotals: Record<string, number>): string {
  return Object.entries(teamTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/** Division-window top 10: cumulative or best-single-season stats within the window. */
export async function getTopTenDivision(
  sport: 'nba' | 'nfl',
  category: string,
  conference: string,
  division: string,
  yearFrom: number,
  yearTo: number,
  singleSeason = false,
): Promise<TopTenEntry[]> {
  // Award categories are league-wide — pick the most recent year in the window that has data
  if (category in AWARD_CATEGORY_KEYS) {
    const awardYears = getAwardYears().filter(y => y >= yearFrom && y <= yearTo);
    const targetYear = awardYears.length ? Math.max(...awardYears) : yearTo;
    const raw = getAwardEntries(category, targetYear);
    return Promise.all(raw.map(async e => ({
      playerName: e.name,
      playerId:   await nflIdByName(e.name),
      stat:       e.rank,
      team:       e.team,
      year:       String(targetYear),
    })));
  }

  if (sport === 'nba') {
    // Use total-season field for per-game categories so we're summing actual totals
    const statField = NBA_PER_GAME_TO_TOTAL[category] || category;
    const players = await loadNBALineupPool();
    const sums = new Map<number, DivSumEntry>();

    for (const player of players) {
      for (const season of player.seasons) {
        const yr = parseInt(season.season.split('-')[0]);
        // yearTo for NBA is one past the last season start year (e.g., 2025 for 2024-25)
        if (yr < yearFrom || yr >= yearTo) continue;
        if (!nbaTeamInDivision(season.team, conference, division)) continue;
        const stat = (season as any)[statField] as number | undefined;
        if (!stat || stat <= 0) continue;
        const team = nbaDisplayTeam(season.team, conference, division);
        const existing = sums.get(player.player_id);
        if (singleSeason) {
          if (!existing || stat > existing.total) {
            sums.set(player.player_id, { playerName: player.player_name, playerId: player.player_id, total: stat, team, latestYr: yr, earliestYr: yr });
          }
        } else if (existing) {
          const teamTotals = { ...(existing.teamTotals ?? {}), [team]: ((existing.teamTotals ?? {})[team] ?? 0) + stat };
          sums.set(player.player_id, { ...existing, total: existing.total + stat, teamTotals,
            ...(yr > existing.latestYr ? { latestYr: yr } : {}),
            ...(yr < existing.earliestYr ? { earliestYr: yr } : {}),
          });
        } else {
          sums.set(player.player_id, { playerName: player.player_name, playerId: player.player_id, total: stat, team, latestYr: yr, earliestYr: yr, teamTotals: { [team]: stat } });
        }
      }
    }

    return Array.from(sums.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(({ playerName, playerId, total, team: entryTeam, teamTotals, earliestYr, latestYr }) => ({
        playerName, playerId, stat: total,
        team: singleSeason ? entryTeam : bestTeam(teamTotals ?? {}),
        year: singleSeason
          ? `${earliestYr}-${String(earliestYr + 1).slice(-2)}`
          : (earliestYr === latestYr ? String(earliestYr) : `${earliestYr}–${latestYr}`),
      }));
  } else {
    const players = await loadNFLLineupPool();
    const sums = new Map<string, DivSumEntry>();

    function accumulate(id: string, name: string, stat: number, team: string, yr: number, round = false) {
      const existing = sums.get(id);
      if (singleSeason) {
        if (!existing || stat > existing.total) {
          sums.set(id, { playerName: name, playerId: id, total: round ? Math.round(stat * 10) / 10 : stat, team, latestYr: yr, earliestYr: yr });
        }
      } else if (existing) {
        const newTotal = round ? Math.round((existing.total + stat) * 10) / 10 : existing.total + stat;
        const teamTotals = { ...(existing.teamTotals ?? {}), [team]: ((existing.teamTotals ?? {})[team] ?? 0) + stat };
        sums.set(id, { ...existing, total: newTotal, teamTotals,
          ...(yr > existing.latestYr ? { latestYr: yr } : {}),
          ...(yr < existing.earliestYr ? { earliestYr: yr } : {}),
        });
      } else {
        sums.set(id, { playerName: name, playerId: id, total: stat, team, latestYr: yr, earliestYr: yr, teamTotals: { [team]: stat } });
      }
    }

    if (category.startsWith('fantasy_pts_')) {
      const posFilter = category.split('_')[2].toUpperCase();
      for (const player of players) {
        if (player.position?.toUpperCase() !== posFilter) continue;
        for (const season of player.seasons) {
          const yr = parseInt(season.season);
          if (yr < yearFrom || yr > yearTo) continue;
          if (!nflTeamInDivision(season.team, conference, division)) continue;
          const stat = calcFantasyPts(season);
          if (stat <= 0) continue;
          accumulate(player.player_id, player.player_name, stat, nflDisplayTeam(season.team, conference, division), yr, true);
        }
      }
    } else {
      const minQual = NFL_MIN_QUALIFY[category] ?? 1;
      for (const player of players) {
        for (const season of player.seasons) {
          const yr = parseInt(season.season);
          if (yr < yearFrom || yr > yearTo) continue;
          if (!nflTeamInDivision(season.team, conference, division)) continue;
          const stat = (season as any)[category] as number | undefined;
          if (!stat || stat < minQual) continue;
          accumulate(player.player_id, player.player_name, stat, nflDisplayTeam(season.team, conference, division), yr);
        }
      }
    }

    return Array.from(sums.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(({ playerName, playerId, total, team: entryTeam, teamTotals, earliestYr, latestYr }) => ({
        playerName, playerId, stat: total,
        team: singleSeason ? entryTeam : bestTeam(teamTotals ?? {}),
        year: earliestYr === latestYr ? String(earliestYr) : `${earliestYr}–${latestYr}`,
      }));
  }
}

/** Team top N: cumulative or best-single-season stats for players on `teamAbbr` within the window. */
export async function getTopTenTeam(
  sport: 'nba' | 'nfl',
  category: string,
  teamAbbr: string,
  yearFrom: number,
  yearTo: number,
  limit: number,
  singleSeason = false,
): Promise<TopTenEntry[]> {

  if (sport === 'nba') {
    const statField = NBA_PER_GAME_TO_TOTAL[category] || category;
    const players = await loadNBALineupPool();
    const sums = new Map<number, DivSumEntry>();

    for (const player of players) {
      for (const season of player.seasons) {
        const yr = parseInt(season.season.split('-')[0]);
        if (yr < yearFrom || yr >= yearTo) continue;
        if (!nbaTeamMatches(season.team, teamAbbr)) continue;
        const stat = (season as any)[statField] as number | undefined;
        if (!stat || stat <= 0) continue;
        const existing = sums.get(player.player_id);
        if (singleSeason) {
          if (!existing || stat > existing.total) {
            sums.set(player.player_id, { playerName: player.player_name, playerId: player.player_id, total: stat, team: teamAbbr, latestYr: yr, earliestYr: yr });
          }
        } else {
          sums.set(player.player_id, existing
            ? { ...existing, total: existing.total + stat, ...(yr > existing.latestYr ? { latestYr: yr } : {}), ...(yr < existing.earliestYr ? { earliestYr: yr } : {}) }
            : { playerName: player.player_name, playerId: player.player_id, total: stat, team: teamAbbr, latestYr: yr, earliestYr: yr }
          );
        }
      }
    }

    return Array.from(sums.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
      .map(({ playerName, playerId, total, earliestYr, latestYr }) => {
        const yr = singleSeason
          ? `${earliestYr}-${String(earliestYr + 1).slice(-2)}`
          : (earliestYr === latestYr ? `${earliestYr}–${earliestYr + 1}` : `${earliestYr}–${latestYr + 1}`);
        return { playerName, playerId, stat: total, team: teamAbbr, year: yr };
      });
  } else {
    const players = await loadNFLLineupPool();
    const sums = new Map<string, DivSumEntry>();

    function nflTeamAccum(id: string, name: string, stat: number, yr: number, round = false) {
      const existing = sums.get(id);
      if (singleSeason) {
        if (!existing || stat > existing.total) {
          sums.set(id, { playerName: name, playerId: id, total: round ? Math.round(stat * 10) / 10 : stat, team: teamAbbr, latestYr: yr, earliestYr: yr });
        }
      } else if (existing) {
        sums.set(id, { ...existing,
          total: round ? Math.round((existing.total + stat) * 10) / 10 : existing.total + stat,
          ...(yr > existing.latestYr ? { latestYr: yr } : {}),
          ...(yr < existing.earliestYr ? { earliestYr: yr } : {}),
        });
      } else {
        sums.set(id, { playerName: name, playerId: id, total: stat, team: teamAbbr, latestYr: yr, earliestYr: yr });
      }
    }

    if (category === 'fantasy_pts') {
      for (const player of players) {
        for (const season of player.seasons) {
          const yr = parseInt(season.season);
          if (yr < yearFrom || yr > yearTo) continue;
          if (!nflTeamMatches(season.team, teamAbbr)) continue;
          const stat = calcFantasyPts(season);
          if (stat <= 0) continue;
          nflTeamAccum(player.player_id, player.player_name, stat, yr, true);
        }
      }
    } else {
      const minQual = NFL_MIN_QUALIFY[category] ?? 1;
      for (const player of players) {
        for (const season of player.seasons) {
          const yr = parseInt(season.season);
          if (yr < yearFrom || yr > yearTo) continue;
          if (!nflTeamMatches(season.team, teamAbbr)) continue;
          const stat = (season as any)[category] as number | undefined;
          if (!stat || stat < minQual) continue;
          nflTeamAccum(player.player_id, player.player_name, stat, yr);
        }
      }
    }

    return Array.from(sums.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
      .map(({ playerName, playerId, total, earliestYr, latestYr }) => {
        const yr = earliestYr === latestYr ? String(earliestYr) : `${earliestYr}–${latestYr}`;
        return { playerName, playerId, stat: total, team: teamAbbr, year: yr };
      });
  }
}

export function pickRandomCategory(sport: 'nba' | 'nfl', mode: 'league' | 'division' | 'team' = 'league'): StatCategoryDef {
  let cats: StatCategoryDef[];
  if (sport === 'nba') cats = NBA_STAT_CATEGORIES;
  else if (mode === 'team') cats = NFL_TEAM_STAT_CATEGORIES;
  else if (mode === 'division') cats = NFL_STAT_CATEGORIES.filter(c => !c.key.startsWith('award_'));
  else cats = NFL_STAT_CATEGORIES;
  return cats[Math.floor(Math.random() * cats.length)];
}

export function getAvailableYears(sport: 'nba' | 'nfl', category?: string): number[] {
  if (category && category in AWARD_CATEGORY_KEYS) return getAwardYears();
  if (sport === 'nba') return Array.from({ length: 2025 - 1996 + 1 }, (_, i) => 1996 + i);
  return Array.from({ length: 2025 - 1999 + 1 }, (_, i) => 1999 + i);
}

export function getCategoryDef(sport: 'nba' | 'nfl', key: string): StatCategoryDef | undefined {
  if (sport === 'nba') return NBA_STAT_CATEGORIES.find(c => c.key === key);
  return NFL_STAT_CATEGORIES.find(c => c.key === key) ?? NFL_TEAM_STAT_CATEGORIES.find(c => c.key === key);
}

export function formatStat(stat: number, categoryKey: string): string {
  if (categoryKey in AWARD_CATEGORY_KEYS) return `#${stat}`;
  const perGame = ['pts', 'reb', 'ast', 'stl', 'blk'];
  if (perGame.includes(categoryKey) && !Number.isInteger(stat)) return stat.toFixed(1);
  if (categoryKey.startsWith('fantasy_pts')) return stat.toFixed(1);
  return stat.toString();
}

/**
 * Returns up to `limit` player name suggestions for the given input.
 * Requires ≥4 characters. Only prefix matches on the full name or any word —
 * no fuzzy/substring matching — to keep the autocomplete restrictive.
 */
export async function getPlayerSuggestions(
  sport: 'nba' | 'nfl',
  input: string,
  limit = 3,
): Promise<string[]> {
  if (input.length < 4) return [];
  const players = sport === 'nba' ? await loadNBALineupPool() : await loadNFLLineupPool();
  const norm = normalize(input);
  const results: string[] = [];
  const seen = new Set<string>();

  for (const player of players) {
    const name: string = player.player_name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const nameNorm = normalize(name);
    const words = nameNorm.split(' ');
    if (nameNorm.startsWith(norm) || words.some(w => w.length >= 2 && w.startsWith(norm))) {
      results.push(name);
      if (results.length >= limit) break;
    }
  }
  return results;
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

/**
 * Fuzzy-matches a guess against the full player pool for the given sport.
 * Returns the canonical name + id if found, null if no recognizable player matches.
 * Uses the same cached data as round generation so there's no extra network cost.
 */
export async function findPlayerInPool(
  guess: string,
  sport: 'nba' | 'nfl',
): Promise<{ playerName: string; playerId: string | number } | null> {
  const players = sport === 'nba' ? await loadNBALineupPool() : await loadNFLLineupPool();
  for (const p of players) {
    if (areSimilarNames(guess, p.player_name)) {
      return { playerName: p.player_name, playerId: p.player_id };
    }
  }
  return null;
}

// ─── Shared round utilities ────────────────────────────────────────────────────

/** Board size for team mode — varies by stat group and window length. */
export function calcTeamBoardLimit(categoryKey: string, windowYears: number): number {
  if (categoryKey === 'fantasy_pts') return 10;
  const step = (windowYears - 5) / 5;
  if (['passing_yards', 'passing_tds', 'interceptions'].includes(categoryKey)) return Math.min(10, 4 + step);
  if (['rushing_yards', 'rushing_tds'].includes(categoryKey))                   return Math.min(10, 6 + step);
  if (['receiving_yards', 'receiving_tds', 'receptions'].includes(categoryKey)) return Math.min(10, 8 + step);
  return Math.min(10, 6 + step); // NBA stats
}

/** Selects the correct short label for cumulative NBA rounds vs normal. */
export function getStatShortLabel(
  catDef: StatCategoryDef | undefined,
  isCumulative: boolean,
  sport: string,
): string | undefined {
  if (isCumulative && sport === 'nba' && catDef?.divisionShortLabel) return catDef.divisionShortLabel;
  return catDef?.shortLabel;
}

/** Extracts round-type flags from a career_state object. */
export function parseRoundFlags(cs: Record<string, any>): {
  isDivisionRound: boolean;
  isTeamRound: boolean;
  isCumulativeRound: boolean;
  isSingleSeason: boolean;
} {
  const isDivisionRound = Boolean(cs.is_division_round);
  const isTeamRound = Boolean(cs.is_team_round) || cs.top_ten_round_type === 'team';
  const isSingleSeason = Boolean(cs.is_single_season);
  return { isDivisionRound, isTeamRound, isCumulativeRound: isDivisionRound || isTeamRound, isSingleSeason };
}

// ─── generateTopTenRound ──────────────────────────────────────────────────────

export interface GenerateRoundConfig {
  sport: 'nba' | 'nfl';
  roundType: 'league' | 'division' | 'team';
  minYear?: number;
  maxYear?: number;
  windowYears?: number;
  divisionMode?: 'cumulative' | 'single_season';
}

export interface GenerateRoundResult {
  entries: TopTenEntry[];
  cat: StatCategoryDef;
  catLabel: string;
  roundInfo: string;
  isDivisionRound: boolean;
  isTeamRound: boolean;
  isSingleSeason: boolean;
  teamAbbr: string;
}

/** Picks a random category + generates the top-10 list for the given round config. */
export async function generateTopTenRound(config: GenerateRoundConfig): Promise<GenerateRoundResult> {
  const { sport, roundType } = config;
  const windowYears = config.windowYears ?? 10;
  const singleSeason = config.divisionMode === 'single_season';
  const currentYear = 2025;
  const defaultMinYear = sport === 'nba' ? 1996 : 1999;
  const minYear = config.minYear ?? defaultMinYear;
  const maxYear = config.maxYear ?? currentYear;

  let cat = pickRandomCategory(sport, roundType);
  const years = getAvailableYears(sport, cat.key);

  let entries: TopTenEntry[] = [];
  let roundInfo = '';
  let isDivisionRound = false;
  let isTeamRound = false;
  let isSingleSeason = false;
  let teamAbbr = '';

  if (roundType === 'team') {
    const fromYear = sport === 'nba' ? currentYear - windowYears : currentYear - windowYears + 1;
    const allTeams = sport === 'nba' ? teams : nflTeams;
    const picked = allTeams[Math.floor(Math.random() * allTeams.length)];
    teamAbbr = picked.abbreviation;
    entries = await getTopTenTeam(sport, cat.key, teamAbbr, fromYear, currentYear, calcTeamBoardLimit(cat.key, windowYears), singleSeason);
    roundInfo = `${picked.name} · last ${windowYears} years`;
    isTeamRound = true;
    isSingleSeason = singleSeason;
    isDivisionRound = false;
  } else if (roundType === 'division') {
    const fromYear = sport === 'nba' ? currentYear - windowYears : currentYear - windowYears + 1;
    const divs = sport === 'nba' ? getNBADivisions() : getNFLDivisions();
    const div = divs[Math.floor(Math.random() * divs.length)];
    entries = await getTopTenDivision(sport, cat.key, div.conference, div.division, fromYear, currentYear, singleSeason);
    roundInfo = `${div.conference} ${div.division} · last ${windowYears} years`;
    if (entries.length >= 5) {
      isDivisionRound = true;
      isSingleSeason = singleSeason;
    } else {
      const year = years[Math.floor(Math.random() * years.length)];
      entries = await getTopTen(sport, cat.key, year);
      roundInfo = sport === 'nba' ? `${year}-${String(year + 1).slice(-2)} season` : `${year} season`;
    }
  } else {
    const filtered = years.filter(y => y >= minYear && y <= maxYear);
    const pool = filtered.length > 0 ? filtered : years;
    const year = pool[Math.floor(Math.random() * pool.length)];
    entries = await getTopTen(sport, cat.key, year);
    roundInfo = sport === 'nba' ? `${year}-${String(year + 1).slice(-2)} season` : `${year} season`;
  }

  // Final safety fallback — ensure cat is league-compatible (e.g. bare 'fantasy_pts' doesn't work in getTopTen)
  if (entries.length < 5) {
    if (cat.key === 'fantasy_pts') cat = pickRandomCategory(sport, 'league');
    const safeYears = getAvailableYears(sport, cat.key);
    const year = safeYears[Math.floor(Math.random() * safeYears.length)];
    entries = await getTopTen(sport, cat.key, year);
    roundInfo = sport === 'nba' ? `${year}-${String(year + 1).slice(-2)} season` : `${year} season`;
    isDivisionRound = false;
    isTeamRound = false;
    isSingleSeason = false;
    teamAbbr = '';
  }

  const isCumulative = isDivisionRound || isTeamRound;
  const catLabel = isCumulative && sport === 'nba' ? (cat.divisionLabel ?? cat.label) : cat.label;

  return { entries, cat, catLabel, roundInfo, isDivisionRound, isTeamRound, isSingleSeason, teamAbbr };
}
