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
  hasSolo: boolean;
  popular?: boolean;
  soloPath?: string;
  multiPath?: string;
  image: string;
  imageBySport?: Partial<Record<'nba' | 'nfl', string>>;
  taglineBySport?: Partial<Record<'nba' | 'nfl', string>>;
};

export const GAMES: GameCard[] = [
  { id: 'roster',         abbr: 'RR', name: 'Roster Royale',      tagline: 'Name every player from a mystery team & season',    color: '#d4af37', hasSolo: true,  popular: true,  soloPath: '/roster-royale',   image: '/images/roster-royale.svg' },
  { id: 'guess-player',   abbr: 'GP', name: 'Guess the Player',   tagline: 'Career arc, name scramble, or face reveal',         color: '#3b82f6', hasSolo: true,  popular: true,  image: '/images/name-scramble.svg' },
  { id: 'lineup',         abbr: 'CC', name: 'Cap Crunch',         tagline: "Chase the stat cap with a lineup — don't bust",     color: '#ec4899', hasSolo: true,  popular: true,  soloPath: '/lineup-is-right', image: '/images/cap-crunch.svg' },
  { id: 'starting-lineup',abbr: 'SL', name: 'Starting Lineup',   tagline: 'Guess the team from their starters',                color: '#ea580c', hasSolo: true,  soloPath: '/starting-lineup',  image: '/images/starting-lineup-placeholder.svg', imageBySport: { nfl: '/images/starting-lineup-placeholder.svg', nba: '/images/starting-lineup-nba-placeholder.svg' }, taglineBySport: { nfl: 'Guess the NFL team from their starters', nba: 'Guess the NBA team from their starters' } },
  { id: 'rollcall',       abbr: 'RC', name: 'Roll Call',          tagline: 'Work together to name as many athletes as you can', color: '#a855f7', hasSolo: false, multiPath: '/roll-call/create', image: '/images/roll-call.svg' },
];

// Fan arc positions: x/y offsets from card center origin, and rotation degrees (one entry per game)
export const FAN_POSITIONS = [
  { x: -270, y: 72, rotate: -27 },
  { x: -135, y: 30, rotate: -13 },
  { x:    0, y:  6, rotate:   0 },
  { x:  135, y: 30, rotate:  13 },
  { x:  270, y: 72, rotate:  27 },
];
