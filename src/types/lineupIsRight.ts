/**
 * lineupIsRight.ts — Types for the "Lineup Is Right" multiplayer game mode.
 *
 * Games where players build lineups in a specific sport (NBA/NFL) by selecting
 * player-seasons from randomly assigned teams. Goal: accumulate a stat total
 * as close as possible to a randomly generated cap without exceeding it.
 */

import type { Sport } from './game';

export type LineupPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | 'QB' | 'RB' | 'WR' | 'TE' | 'DEF';

export interface PlayerSeason {
  playerId: string | number;
  playerName: string;
  season: string;
  team: string;
  position: string;
  stats: Record<string, number>;
}

/**
 * Represents a player selected for the lineup with their chosen year.
 */
export interface SelectedPlayer {
  playerName: string;
  team: string;
  selectedYear: string;
  playerSeason?: PlayerSeason | null;
  statValue: number; // The actual stat value achieved (0 if not on team that year)
}

export interface PlayerLineup {
  playerId: string;
  playerName: string;
  selectedPlayers: SelectedPlayer[]; // Now includes year + stat for each selection
  totalStat: number;
  isBusted: boolean;
  isFinished: boolean;
}

export type StatCategory =
  | 'pts'    // NBA: points
  | 'ast'    // NBA: assists
  | 'reb'    // NBA: rebounds
  | 'min'    // NBA: minutes
  | 'passing_yards'  // NFL: passing yards
  | 'passing_tds'    // NFL: passing touchdowns
  | 'rushing_yards'  // NFL: rushing yards
  | 'rushing_tds'    // NFL: rushing touchdowns
  | 'receiving_yards'  // NFL: receiving yards
  | 'receiving_tds';   // NFL: receiving touchdowns

export interface LineupIsRightGameState {
  sport: Sport;
  statCategory: StatCategory;
  targetCap: number;
  round: number;
  win_target: number;

  // Current turn state
  activePlayerId: string;
  assignedTeam: string | null;
  currentSlotIndex: number; // which slot the active player is filling

  // All player lineups
  lineups: PlayerLineup[];

  // Game progress: 'setup' -> 'playing' -> 'finished'
  phase: 'setup' | 'playing' | 'finished';

  // History of completed turns (for display/undo)
  turnHistory: TurnRecord[];
}

export interface TurnRecord {
  playerName: string;
  playerId: string;
  slotPosition: LineupPosition;
  assignedTeam: string;
  selectedPlayer: PlayerSeason;
  totalAfter: number;
  timestamp: string;
}

export interface NBASeason {
  season: string;
  team: string;
  gp?: number;
  min?: number;
  pts?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  fg_pct?: number;
  fg3_pct?: number;
  [key: string]: any;
}

export interface NFLSeason {
  season: string;
  team: string;
  gp?: number;
  passing_yards?: number;
  passing_tds?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  [key: string]: any;
}

export interface NBALineupIsRightPlayer {
  player_id: number;
  player_name: string;
  position: string;
  seasons: NBASeason[];
}

export interface NFLLineupIsRightPlayer {
  player_id: string;
  player_name: string;
  position: string;
  seasons: NFLSeason[];
}
