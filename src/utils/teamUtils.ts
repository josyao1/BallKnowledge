/**
 * teamUtils.ts — Entity-based scoring for multiplayer team mode.
 *
 * Abstracts players into "scoring entities" — either solo players or teams —
 * so the scoreboard, results, and bonus calculations work uniformly regardless
 * of whether teams are enabled. Also computes the uniqueness bonus (+1 per
 * roster player only one entity guessed, requires 3+ entities).
 * Exports `buildScoringEntities`, `computeEntityBonuses`, and entity helpers.
 */

import type { LobbyPlayer } from '../types/database';

export const TEAM_COLORS = [
  { bg: '#3b82f6', text: 'Blue', border: '#2563eb' },
  { bg: '#ef4444', text: 'Red', border: '#dc2626' },
  { bg: '#22c55e', text: 'Green', border: '#16a34a' },
  { bg: '#a855f7', text: 'Purple', border: '#9333ea' },
] as const;

export interface TeamEntity {
  teamNumber: number;
  color: typeof TEAM_COLORS[number];
  members: LobbyPlayer[];
  combinedScore: number;
  combinedGuessedPlayers: string[];
  combinedIncorrectGuesses: string[];
  combinedGuessedCount: number;
}

export type ScoringEntity =
  | { type: 'solo'; player: LobbyPlayer; entityId: string }
  | { type: 'team'; team: TeamEntity; entityId: string };

/**
 * Build scoring entities from the players array.
 * Players with team_number != null are grouped into TeamEntity.
 * Players with team_number == null are solo entities.
 */
export function buildScoringEntities(players: LobbyPlayer[]): ScoringEntity[] {
  const teamMap = new Map<number, LobbyPlayer[]>();
  const solos: LobbyPlayer[] = [];

  for (const p of players) {
    if (p.team_number != null) {
      const existing = teamMap.get(p.team_number) || [];
      existing.push(p);
      teamMap.set(p.team_number, existing);
    } else {
      solos.push(p);
    }
  }

  const entities: ScoringEntity[] = [];

  for (const [teamNum, members] of teamMap.entries()) {
    const allGuessed = members.flatMap(m => m.guessed_players || []);
    const uniqueGuessed = [...new Set(allGuessed)];
    const allIncorrect = members.flatMap(m => m.incorrect_guesses || []);
    const uniqueIncorrect = [...new Set(allIncorrect)];
    // Team score = sum of each member's individual score weighted by their multiplier
    const weightedScore = members.reduce((sum, m) => sum + m.score * (m.score_multiplier ?? 1), 0);

    entities.push({
      type: 'team',
      entityId: `team-${teamNum}`,
      team: {
        teamNumber: teamNum,
        color: TEAM_COLORS[teamNum - 1],
        members,
        combinedScore: weightedScore,
        combinedGuessedPlayers: uniqueGuessed,
        combinedIncorrectGuesses: uniqueIncorrect,
        combinedGuessedCount: uniqueGuessed.length,
      },
    });
  }

  for (const p of solos) {
    entities.push({
      type: 'solo',
      entityId: `solo-${p.player_id}`,
      player: p,
    });
  }

  return entities;
}

/**
 * Get all guessed players for teammates of the current player (excluding self).
 */
export function getTeammateGuessedPlayers(
  players: LobbyPlayer[],
  currentPlayerId: string,
  currentTeamNumber: number | null
): string[] {
  if (currentTeamNumber == null) return [];

  return players
    .filter(p => p.team_number === currentTeamNumber && p.player_id !== currentPlayerId)
    .flatMap(p => p.guessed_players || []);
}

/**
 * Compute bonus points per entity.
 * Bonus only applies when there are 3+ entities.
 */
export function computeEntityBonuses(entities: ScoringEntity[]): Map<string, number> {
  const bonuses = new Map<string, number>();

  if (entities.length < 3) {
    entities.forEach(e => bonuses.set(e.entityId, 0));
    return bonuses;
  }

  const guessCount: Record<string, number> = {};
  for (const entity of entities) {
    const guesses = entity.type === 'team'
      ? entity.team.combinedGuessedPlayers
      : (entity.player.guessed_players || []);

    const uniqueGuesses = [...new Set(guesses)];
    for (const name of uniqueGuesses) {
      guessCount[name] = (guessCount[name] || 0) + 1;
    }
  }

  for (const entity of entities) {
    const guesses = entity.type === 'team'
      ? entity.team.combinedGuessedPlayers
      : (entity.player.guessed_players || []);

    const uniqueGuesses = [...new Set(guesses)];
    const bonus = uniqueGuesses.filter(name => guessCount[name] === 1).length;
    bonuses.set(entity.entityId, bonus);
  }

  return bonuses;
}

/**
 * Check if teams are active in this lobby.
 */
export function hasTeams(players: LobbyPlayer[]): boolean {
  return players.some(p => p.team_number != null);
}

/**
 * Get the display name for an entity.
 */
export function getEntityDisplayName(entity: ScoringEntity): string {
  if (entity.type === 'solo') return entity.player.player_name;
  return entity.team.members.map(m => m.player_name).join(' & ');
}

/**
 * Get the score for an entity (base score without bonus).
 */
export function getEntityScore(entity: ScoringEntity): number {
  if (entity.type === 'solo') return entity.player.score;
  return entity.team.combinedScore;
}

/**
 * Get the guessed count for an entity.
 */
export function getEntityGuessedCount(entity: ScoringEntity): number {
  if (entity.type === 'solo') return entity.player.guessed_count;
  return entity.team.combinedGuessedCount;
}

/**
 * Get incorrect guesses for an entity.
 */
export function getEntityIncorrectGuesses(entity: ScoringEntity): string[] {
  if (entity.type === 'solo') return entity.player.incorrect_guesses || [];
  return entity.team.combinedIncorrectGuesses;
}

/**
 * Check if the current player belongs to this entity.
 */
export function isCurrentPlayerInEntity(entity: ScoringEntity, currentPlayerId: string): boolean {
  if (entity.type === 'solo') return entity.player.player_id === currentPlayerId;
  return entity.team.members.some(m => m.player_id === currentPlayerId);
}
