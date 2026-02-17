/** teams.ts — Static list of all 30 NBA teams with colors, conference, and division. */

import type { Team } from '../types';

export const teams: Team[] = [
  // Eastern Conference - Atlantic
  { id: 1610612738, abbreviation: 'BOS', name: 'Boston Celtics', city: 'Boston', colors: { primary: '#007A33', secondary: '#BA9653' }, conference: 'Eastern', division: 'Atlantic' },
  { id: 1610612751, abbreviation: 'BKN', name: 'Brooklyn Nets', city: 'Brooklyn', colors: { primary: '#000000', secondary: '#FFFFFF' }, conference: 'Eastern', division: 'Atlantic' },
  { id: 1610612752, abbreviation: 'NYK', name: 'New York Knicks', city: 'New York', colors: { primary: '#006BB6', secondary: '#F58426' }, conference: 'Eastern', division: 'Atlantic' },
  { id: 1610612755, abbreviation: 'PHI', name: 'Philadelphia 76ers', city: 'Philadelphia', colors: { primary: '#006BB6', secondary: '#ED174C' }, conference: 'Eastern', division: 'Atlantic' },
  { id: 1610612761, abbreviation: 'TOR', name: 'Toronto Raptors', city: 'Toronto', colors: { primary: '#CE1141', secondary: '#000000' }, conference: 'Eastern', division: 'Atlantic' },

  // Eastern Conference - Central
  { id: 1610612741, abbreviation: 'CHI', name: 'Chicago Bulls', city: 'Chicago', colors: { primary: '#CE1141', secondary: '#000000' }, conference: 'Eastern', division: 'Central' },
  { id: 1610612739, abbreviation: 'CLE', name: 'Cleveland Cavaliers', city: 'Cleveland', colors: { primary: '#860038', secondary: '#FDBB30' }, conference: 'Eastern', division: 'Central' },
  { id: 1610612765, abbreviation: 'DET', name: 'Detroit Pistons', city: 'Detroit', colors: { primary: '#C8102E', secondary: '#1D42BA' }, conference: 'Eastern', division: 'Central' },
  { id: 1610612754, abbreviation: 'IND', name: 'Indiana Pacers', city: 'Indiana', colors: { primary: '#002D62', secondary: '#FDBB30' }, conference: 'Eastern', division: 'Central' },
  { id: 1610612749, abbreviation: 'MIL', name: 'Milwaukee Bucks', city: 'Milwaukee', colors: { primary: '#00471B', secondary: '#EEE1C6' }, conference: 'Eastern', division: 'Central' },

  // Eastern Conference - Southeast
  { id: 1610612737, abbreviation: 'ATL', name: 'Atlanta Hawks', city: 'Atlanta', colors: { primary: '#E03A3E', secondary: '#C1D32F' }, conference: 'Eastern', division: 'Southeast' },
  { id: 1610612766, abbreviation: 'CHA', name: 'Charlotte Hornets', city: 'Charlotte', colors: { primary: '#1D1160', secondary: '#00788C' }, conference: 'Eastern', division: 'Southeast' },
  { id: 1610612748, abbreviation: 'MIA', name: 'Miami Heat', city: 'Miami', colors: { primary: '#98002E', secondary: '#F9A01B' }, conference: 'Eastern', division: 'Southeast' },
  { id: 1610612753, abbreviation: 'ORL', name: 'Orlando Magic', city: 'Orlando', colors: { primary: '#0077C0', secondary: '#C4CED4' }, conference: 'Eastern', division: 'Southeast' },
  { id: 1610612764, abbreviation: 'WAS', name: 'Washington Wizards', city: 'Washington', colors: { primary: '#002B5C', secondary: '#E31837' }, conference: 'Eastern', division: 'Southeast' },

  // Western Conference - Northwest
  { id: 1610612743, abbreviation: 'DEN', name: 'Denver Nuggets', city: 'Denver', colors: { primary: '#0E2240', secondary: '#FEC524' }, conference: 'Western', division: 'Northwest' },
  { id: 1610612750, abbreviation: 'MIN', name: 'Minnesota Timberwolves', city: 'Minnesota', colors: { primary: '#0C2340', secondary: '#236192' }, conference: 'Western', division: 'Northwest' },
  { id: 1610612760, abbreviation: 'OKC', name: 'Oklahoma City Thunder', city: 'Oklahoma City', colors: { primary: '#007AC1', secondary: '#EF3B24' }, conference: 'Western', division: 'Northwest' },
  { id: 1610612757, abbreviation: 'POR', name: 'Portland Trail Blazers', city: 'Portland', colors: { primary: '#E03A3E', secondary: '#000000' }, conference: 'Western', division: 'Northwest' },
  { id: 1610612762, abbreviation: 'UTA', name: 'Utah Jazz', city: 'Utah', colors: { primary: '#002B5C', secondary: '#00471B' }, conference: 'Western', division: 'Northwest' },

  // Western Conference - Pacific
  { id: 1610612744, abbreviation: 'GSW', name: 'Golden State Warriors', city: 'Golden State', colors: { primary: '#1D428A', secondary: '#FFC72C' }, conference: 'Western', division: 'Pacific' },
  { id: 1610612746, abbreviation: 'LAC', name: 'Los Angeles Clippers', city: 'Los Angeles', colors: { primary: '#C8102E', secondary: '#1D428A' }, conference: 'Western', division: 'Pacific' },
  { id: 1610612747, abbreviation: 'LAL', name: 'Los Angeles Lakers', city: 'Los Angeles', colors: { primary: '#552583', secondary: '#FDB927' }, conference: 'Western', division: 'Pacific' },
  { id: 1610612756, abbreviation: 'PHX', name: 'Phoenix Suns', city: 'Phoenix', colors: { primary: '#1D1160', secondary: '#E56020' }, conference: 'Western', division: 'Pacific' },
  { id: 1610612758, abbreviation: 'SAC', name: 'Sacramento Kings', city: 'Sacramento', colors: { primary: '#5A2D81', secondary: '#63727A' }, conference: 'Western', division: 'Pacific' },

  // Western Conference - Southwest
  { id: 1610612742, abbreviation: 'DAL', name: 'Dallas Mavericks', city: 'Dallas', colors: { primary: '#00538C', secondary: '#002B5E' }, conference: 'Western', division: 'Southwest' },
  { id: 1610612745, abbreviation: 'HOU', name: 'Houston Rockets', city: 'Houston', colors: { primary: '#CE1141', secondary: '#000000' }, conference: 'Western', division: 'Southwest' },
  { id: 1610612763, abbreviation: 'MEM', name: 'Memphis Grizzlies', city: 'Memphis', colors: { primary: '#5D76A9', secondary: '#12173F' }, conference: 'Western', division: 'Southwest' },
  { id: 1610612740, abbreviation: 'NOP', name: 'New Orleans Pelicans', city: 'New Orleans', colors: { primary: '#0C2340', secondary: '#C8102E' }, conference: 'Western', division: 'Southwest' },
  { id: 1610612759, abbreviation: 'SAS', name: 'San Antonio Spurs', city: 'San Antonio', colors: { primary: '#C4CED4', secondary: '#000000' }, conference: 'Western', division: 'Southwest' },
];

export function getTeamByAbbreviation(abbr: string): Team | undefined {
  return teams.find((t) => t.abbreviation === abbr);
}

export function getNBADivisions(): { conference: string; division: string }[] {
  const seen = new Set<string>();
  const result: { conference: string; division: string }[] = [];
  for (const t of teams) {
    const key = `${t.conference}_${t.division}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ conference: t.conference, division: t.division });
    }
  }
  return result;
}

export function getNBATeamsByDivision(conference: string, division: string): Team[] {
  return teams.filter(t => t.conference === conference && t.division === division);
}
