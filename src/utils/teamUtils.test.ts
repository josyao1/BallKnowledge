import { describe, it, expect } from 'vitest';
import {
  buildScoringEntities,
  computeEntityBonuses,
  getTeammateGuessedPlayers,
  hasTeams,
  getEntityDisplayName,
  getEntityScore,
  getEntityGuessedCount,
  getEntityIncorrectGuesses,
  isCurrentPlayerInEntity,
} from './teamUtils';
import type { LobbyPlayer } from '../types/database';

function makeLobbyPlayer(overrides: Partial<LobbyPlayer> = {}): LobbyPlayer {
  return {
    id: 'id-1',
    lobby_id: 'lobby-1',
    player_id: 'p1',
    player_name: 'Player 1',
    is_host: false,
    is_ready: true,
    is_dummy: false,
    score_multiplier: 1,
    score: 0,
    guessed_count: 0,
    guessed_players: [],
    incorrect_guesses: [],
    is_connected: true,
    joined_at: new Date().toISOString(),
    finished_at: null,
    wins: 0,
    points: 0,
    team_number: null,
    ...overrides,
  };
}

describe('buildScoringEntities', () => {
  it('creates solo entities for players without team_number', () => {
    const players = [
      makeLobbyPlayer({ player_id: 'p1', player_name: 'Alice' }),
      makeLobbyPlayer({ player_id: 'p2', player_name: 'Bob' }),
    ];
    const entities = buildScoringEntities(players);
    expect(entities).toHaveLength(2);
    expect(entities.every(e => e.type === 'solo')).toBe(true);
  });

  it('groups players with same team_number into team entities', () => {
    const players = [
      makeLobbyPlayer({ player_id: 'p1', player_name: 'Alice', team_number: 1 }),
      makeLobbyPlayer({ player_id: 'p2', player_name: 'Bob', team_number: 1 }),
      makeLobbyPlayer({ player_id: 'p3', player_name: 'Charlie', team_number: null }),
    ];
    const entities = buildScoringEntities(players);
    expect(entities).toHaveLength(2); // 1 team + 1 solo
    const teamEntity = entities.find(e => e.type === 'team');
    expect(teamEntity).toBeDefined();
    if (teamEntity?.type === 'team') {
      expect(teamEntity.team.members).toHaveLength(2);
      expect(teamEntity.team.teamNumber).toBe(1);
    }
  });

  it('deduplicates guessed players across team members', () => {
    const players = [
      makeLobbyPlayer({
        player_id: 'p1', team_number: 1,
        guessed_players: ['LeBron', 'Curry'],
      }),
      makeLobbyPlayer({
        player_id: 'p2', team_number: 1,
        guessed_players: ['Curry', 'Durant'],
      }),
    ];
    const entities = buildScoringEntities(players);
    const teamEntity = entities.find(e => e.type === 'team');
    if (teamEntity?.type === 'team') {
      expect(teamEntity.team.combinedGuessedPlayers).toEqual(
        expect.arrayContaining(['LeBron', 'Curry', 'Durant'])
      );
      expect(teamEntity.team.combinedGuessedCount).toBe(3);
    }
  });

  it('calculates weighted score for team members', () => {
    const players = [
      makeLobbyPlayer({ player_id: 'p1', team_number: 1, score: 10, score_multiplier: 2 }),
      makeLobbyPlayer({ player_id: 'p2', team_number: 1, score: 5, score_multiplier: 1 }),
    ];
    const entities = buildScoringEntities(players);
    const teamEntity = entities.find(e => e.type === 'team');
    if (teamEntity?.type === 'team') {
      expect(teamEntity.team.combinedScore).toBe(25); // 10*2 + 5*1
    }
  });
});

describe('computeEntityBonuses', () => {
  it('returns 0 bonuses when fewer than 3 entities', () => {
    const players = [
      makeLobbyPlayer({ player_id: 'p1', guessed_players: ['A'] }),
      makeLobbyPlayer({ player_id: 'p2', guessed_players: ['B'] }),
    ];
    const entities = buildScoringEntities(players);
    const bonuses = computeEntityBonuses(entities);
    expect(Array.from(bonuses.values()).every(b => b === 0)).toBe(true);
  });

  it('awards +1 per uniquely guessed player with 3+ entities', () => {
    const players = [
      makeLobbyPlayer({ player_id: 'p1', guessed_players: ['A', 'B'] }),
      makeLobbyPlayer({ player_id: 'p2', guessed_players: ['A', 'C'] }),
      makeLobbyPlayer({ player_id: 'p3', guessed_players: ['D'] }),
    ];
    const entities = buildScoringEntities(players);
    const bonuses = computeEntityBonuses(entities);
    // p1: 'B' is unique → bonus 1
    // p2: 'C' is unique → bonus 1
    // p3: 'D' is unique → bonus 1
    // 'A' is guessed by p1 and p2 → no bonus
    expect(bonuses.get('solo-p1')).toBe(1);
    expect(bonuses.get('solo-p2')).toBe(1);
    expect(bonuses.get('solo-p3')).toBe(1);
  });

  it('gives 0 bonus for commonly guessed players', () => {
    const players = [
      makeLobbyPlayer({ player_id: 'p1', guessed_players: ['A'] }),
      makeLobbyPlayer({ player_id: 'p2', guessed_players: ['A'] }),
      makeLobbyPlayer({ player_id: 'p3', guessed_players: ['A'] }),
    ];
    const entities = buildScoringEntities(players);
    const bonuses = computeEntityBonuses(entities);
    expect(bonuses.get('solo-p1')).toBe(0);
    expect(bonuses.get('solo-p2')).toBe(0);
    expect(bonuses.get('solo-p3')).toBe(0);
  });
});

describe('getTeammateGuessedPlayers', () => {
  it('returns empty for solo player (no team)', () => {
    const players = [
      makeLobbyPlayer({ player_id: 'p1', team_number: null, guessed_players: ['A'] }),
    ];
    expect(getTeammateGuessedPlayers(players, 'p1', null)).toEqual([]);
  });

  it('returns guessed players from teammates (excluding self)', () => {
    const players = [
      makeLobbyPlayer({ player_id: 'p1', team_number: 1, guessed_players: ['A'] }),
      makeLobbyPlayer({ player_id: 'p2', team_number: 1, guessed_players: ['B', 'C'] }),
      makeLobbyPlayer({ player_id: 'p3', team_number: 2, guessed_players: ['D'] }),
    ];
    const result = getTeammateGuessedPlayers(players, 'p1', 1);
    expect(result).toEqual(['B', 'C']);
  });
});

describe('hasTeams', () => {
  it('returns false when no players have team_number', () => {
    const players = [
      makeLobbyPlayer({ team_number: null }),
    ];
    expect(hasTeams(players)).toBe(false);
  });

  it('returns true when at least one player has team_number', () => {
    const players = [
      makeLobbyPlayer({ player_id: 'p1', team_number: 1 }),
      makeLobbyPlayer({ player_id: 'p2', team_number: null }),
    ];
    expect(hasTeams(players)).toBe(true);
  });
});

describe('entity helpers', () => {
  it('getEntityDisplayName returns player name for solo', () => {
    const entities = buildScoringEntities([
      makeLobbyPlayer({ player_name: 'Alice' }),
    ]);
    expect(getEntityDisplayName(entities[0])).toBe('Alice');
  });

  it('getEntityDisplayName joins team member names', () => {
    const entities = buildScoringEntities([
      makeLobbyPlayer({ player_id: 'p1', player_name: 'Alice', team_number: 1 }),
      makeLobbyPlayer({ player_id: 'p2', player_name: 'Bob', team_number: 1 }),
    ]);
    const teamEntity = entities[0];
    expect(getEntityDisplayName(teamEntity)).toBe('Alice & Bob');
  });

  it('getEntityScore returns player score for solo', () => {
    const entities = buildScoringEntities([
      makeLobbyPlayer({ score: 42 }),
    ]);
    expect(getEntityScore(entities[0])).toBe(42);
  });

  it('getEntityGuessedCount returns guessed_count for solo', () => {
    const entities = buildScoringEntities([
      makeLobbyPlayer({ guessed_count: 7 }),
    ]);
    expect(getEntityGuessedCount(entities[0])).toBe(7);
  });

  it('getEntityIncorrectGuesses returns incorrect_guesses for solo', () => {
    const entities = buildScoringEntities([
      makeLobbyPlayer({ incorrect_guesses: ['X', 'Y'] }),
    ]);
    expect(getEntityIncorrectGuesses(entities[0])).toEqual(['X', 'Y']);
  });

  it('isCurrentPlayerInEntity identifies solo player', () => {
    const entities = buildScoringEntities([
      makeLobbyPlayer({ player_id: 'p1' }),
    ]);
    expect(isCurrentPlayerInEntity(entities[0], 'p1')).toBe(true);
    expect(isCurrentPlayerInEntity(entities[0], 'p2')).toBe(false);
  });

  it('isCurrentPlayerInEntity identifies team member', () => {
    const entities = buildScoringEntities([
      makeLobbyPlayer({ player_id: 'p1', team_number: 1 }),
      makeLobbyPlayer({ player_id: 'p2', team_number: 1 }),
    ]);
    expect(isCurrentPlayerInEntity(entities[0], 'p1')).toBe(true);
    expect(isCurrentPlayerInEntity(entities[0], 'p2')).toBe(true);
    expect(isCurrentPlayerInEntity(entities[0], 'p3')).toBe(false);
  });
});
