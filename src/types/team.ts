/** team.ts — NBA team type definitions. */

export interface Team {
  id: number;
  abbreviation: string;
  name: string;
  city: string;
  colors: {
    primary: string;
    secondary: string;
  };
  conference: 'Eastern' | 'Western';
  division: string;
}

export interface TeamRoster {
  team: string; // abbreviation
  season: string; // e.g., "2023-24"
  players: import('./player').Player[];
}
