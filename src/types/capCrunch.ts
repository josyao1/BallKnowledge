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
  statValue: number;      // The actual stat value achieved
  isBust?: boolean;       // true if this pick pushed over the cap — counts as 0, game continues
  neverOnTeam?: boolean;  // true if the player was never on the assigned team (total_gp / career stats only)
  actualTeam?: string;    // the team the player actually played for that year (shown when neverOnTeam due to wrong NFL team)
  actualNflConf?: string; // the NFL conf the player was actually in (shown when neverOnTeam due to wrong NFL conf)
  actualCollege?: string; // the player's college(s) from bio (shown when neverOnTeam due to wrong college conf)
  playerId?: string | number; // ESPN player ID — used for headshot URL
  /** True when this pick slot was auto-skipped (timer expired with no selection) */
  isSkipped?: boolean;
}

export interface PlayerLineup {
  playerId: string;
  playerName: string;
  selectedPlayers: SelectedPlayer[]; // Now includes year + stat for each selection
  totalStat: number;
  bustCount: number;   // how many picks busted (exceeded cap) — each counts as 0
  isBusted?: boolean;  // legacy / compat field — no longer used to end the game
  isFinished: boolean;
}

export type StatCategory =
  | 'pts'    // NBA: points per game
  | 'ast'    // NBA: assists per game
  | 'reb'    // NBA: rebounds per game
  | 'min'    // NBA: minutes per game
  | 'pra'    // NBA: points + rebounds + assists per game
  | 'passing_yards'  // NFL: passing yards
  | 'passing_tds'    // NFL: passing touchdowns
  | 'interceptions'  // NFL: interceptions thrown (QB)
  | 'rushing_yards'  // NFL: rushing yards
  | 'rushing_tds'    // NFL: rushing touchdowns
  | 'receiving_yards'  // NFL: receiving yards
  | 'receiving_tds'    // NFL: receiving touchdowns
  | 'receptions'       // NFL: receptions (RB/WR/TE)
  | 'total_gp'         // NBA/NFL: total career games played for a team (no year selection)
  | 'career_passing_yards'    // NFL: total career passing yards (all teams summed)
  | 'career_passing_tds'      // NFL: total career passing TDs (all teams summed)
  | 'career_rushing_yards'    // NFL: total career rushing yards (all teams summed)
  | 'career_rushing_tds'      // NFL: total career rushing TDs (all teams summed)
  | 'career_receiving_yards'  // NFL: total career receiving yards (all teams summed)
  | 'career_receiving_tds';   // NFL: total career receiving TDs (all teams summed)

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
  interceptions?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  receptions?: number;
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
