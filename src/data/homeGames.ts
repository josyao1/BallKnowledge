/**
 * homeGames.ts — Static data and shared types for the HomePage game picker.
 *
 * Keeping this separate lets the fan card component and setup panels import
 * the game list without pulling in the full HomePage module.
 */

export type LoadingStatus = 'idle' | 'checking' | 'fetching' | 'success' | 'error';

export type GenericTeam = {
  id: number;
  abbreviation: string;
  name: string;
  colors: { primary: string; secondary: string };
};

export type GameCard = {
  id: string;
  abbr: string;
  name: string;
  tagline: string;
  color: string;
  accent?: string;
  hasSolo: boolean;
  popular?: boolean;
  popularLabel?: string;
  disabled?: boolean;
  soloPath?: string;
  multiPath?: string;
  image: string;
  imageBySport?: Partial<Record<'nba' | 'nfl', string>>;
  taglineBySport?: Partial<Record<'nba' | 'nfl', string>>;
};

export const HOME_TILES: GameCard[] = [
  { id: 'cap-crunch', abbr: 'CC', name: 'Cap Crunch', tagline: "Chase the stat cap with a lineup — don't bust", color: '#FDF100', accent: '#FDF100', hasSolo: true, popular: true, popularLabel: 'Most Popular', soloPath: '/lineup-is-right', image: '/images/home/cap-crunch.svg' },
  { id: 'roster', abbr: 'RR', name: 'Roster Royale', tagline: 'Name every player from a mystery team and season', color: '#68BBE5', accent: '#68BBE5', hasSolo: true, image: '/images/home/roster-royale.svg' },
  { id: 'top-ten', abbr: 'T10', name: 'Top Ten', tagline: 'Name the top 10 leaders in a stat category', color: '#68BBE5', accent: '#68BBE5', hasSolo: true, soloPath: '/top-ten', image: '/images/home/top-ten.svg' },
  { id: 'guess-player', abbr: 'GP', name: 'Guess the Player', tagline: 'Career arc, name scramble, or face reveal', color: '#E2008A', accent: '#E2008A', hasSolo: true, image: '/images/home/guess-player.svg' },
  { id: 'starting-lineup', abbr: 'SL', name: 'Starting Lineup', tagline: 'Guess the team from its starters', color: '#4E53A5', accent: '#4E53A5', hasSolo: true, soloPath: '/starting-lineup', image: '/images/home/starting-lineup.svg' },
  { id: 'rollcall', abbr: 'RC', name: 'Roll Call', tagline: 'Work together to name as many athletes as you can', color: '#70BE5B', accent: '#70BE5B', hasSolo: false, multiPath: '/roll-call/create', image: '/images/home/roll-call.svg' },
  { id: 'coming-soon', abbr: '', name: 'Coming Soon', tagline: 'Another sports game mode is on the way.', color: '#FDF100', accent: '#E2008A', hasSolo: false, disabled: true, image: '/images/home/coming-soon.svg' },
];

export const GAMES: GameCard[] = HOME_TILES;

// Fan arc positions: x/y offsets from card center origin, and rotation degrees (one entry per game)
export const FAN_POSITIONS = [
  { x: -225, y: 60, rotate: -22 },
  { x: -135, y: 28, rotate: -13 },
  { x:  -45, y:  6, rotate:  -4 },
  { x:   45, y:  6, rotate:   4 },
  { x:  135, y: 28, rotate:  13 },
  { x:  225, y: 60, rotate:  22 },
];
