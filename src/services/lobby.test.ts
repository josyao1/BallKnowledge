import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Lobby, LobbyPlayer } from '../types/database';
import { setStoredPlayerName } from '../lib/supabase';

// Fixed mock auth IDs so tests can assert exact identity behavior.
const MOCK_AUTH_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_AUTH_ID = '00000000-0000-0000-0000-000000000002';

// Captures every Supabase query chain so tests can inspect the calls.
type SingleResult = { data: any; error: null } | { data: null; error: { message: string } };
type SelectResult = { data: any[]; error: null } | { data: null; error: { message: string } };
type UpdateResult = { data: any; error: null } | { data: null; error: { message: string } };
type DeleteResult = { error: null } | { error: { message: string } };

const capture: {
  fromCalls: Array<{ table: string; method: string; args: unknown[] }>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  results: {
    single: SingleResult[];
    select: SelectResult[];
    update: UpdateResult[];
    delete: DeleteResult[];
  };
} = {
  fromCalls: [],
  rpcCalls: [],
  results: { single: [], select: [], update: [], delete: [] },
};

function resetCapture() {
  capture.fromCalls = [];
  capture.rpcCalls = [];
  capture.results = { single: [], select: [], update: [], delete: [] };
}

function setResults(
  overrides: Partial<{
    single: SingleResult | SingleResult[];
    select: SelectResult | SelectResult[];
    update: UpdateResult | UpdateResult[];
    delete: DeleteResult | DeleteResult[];
  }>,
) {
  if (overrides.single) {
    capture.results.single = Array.isArray(overrides.single)
      ? overrides.single
      : [overrides.single];
  }
  if (overrides.select) {
    capture.results.select = Array.isArray(overrides.select)
      ? overrides.select
      : [overrides.select];
  }
  if (overrides.update) {
    capture.results.update = Array.isArray(overrides.update)
      ? overrides.update
      : [overrides.update];
  }
  if (overrides.delete) {
    capture.results.delete = Array.isArray(overrides.delete)
      ? overrides.delete
      : [overrides.delete];
  }
}

function shiftResult<T>(queue: T[], fallback: T): T {
  if (queue.length === 0) return fallback;
  return queue.shift() as T;
}

const DEFAULT_SINGLE: SingleResult = { data: null, error: null };
const DEFAULT_SELECT: SelectResult = { data: [], error: null };
const DEFAULT_UPDATE: UpdateResult = { data: null, error: null };
const DEFAULT_DELETE: DeleteResult = { error: null };

function makeQueryChain(table: string) {
  const chain: unknown = {
    select: vi.fn((columns?: string) => {
      capture.fromCalls.push({ table, method: 'select', args: [columns] });
      return chain;
    }),
    insert: vi.fn((data: unknown) => {
      capture.fromCalls.push({ table, method: 'insert', args: [data] });
      return chain;
    }),
    update: vi.fn((data: unknown) => {
      capture.fromCalls.push({ table, method: 'update', args: [data] });
      return chain;
    }),
    delete: vi.fn(() => {
      capture.fromCalls.push({ table, method: 'delete', args: [] });
      return chain;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      capture.fromCalls.push({ table, method: 'eq', args: [column, value] });
      return chain;
    }),
    is: vi.fn((column: string, value: unknown) => {
      capture.fromCalls.push({ table, method: 'is', args: [column, value] });
      return chain;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      capture.fromCalls.push({ table, method: 'in', args: [column, values] });
      return chain;
    }),
    order: vi.fn(() => chain),
    single: vi.fn(async () => shiftResult(capture.results.single, DEFAULT_SINGLE)),
    then: (resolve: (value: unknown) => unknown) => {
      // The last recorded operation determines what the chain resolves to.
      const last = capture.fromCalls.filter((c) => c.table === table).pop();
      if (last?.method === 'insert')
        return resolve(shiftResult(capture.results.single, DEFAULT_SINGLE));
      if (last?.method === 'update')
        return resolve(shiftResult(capture.results.update, DEFAULT_UPDATE));
      if (last?.method === 'delete')
        return resolve(shiftResult(capture.results.delete, DEFAULT_DELETE));
      return resolve(shiftResult(capture.results.select, DEFAULT_SELECT));
    },
  };
  return chain as {
    select: (columns?: string) => typeof chain;
    insert: (data: unknown) => typeof chain;
    update: (data: unknown) => typeof chain;
    delete: () => typeof chain;
    eq: (column: string, value: unknown) => typeof chain;
    is: (column: string, value: unknown) => typeof chain;
    in: (column: string, values: unknown[]) => typeof chain;
    order: () => typeof chain;
    single: () => Promise<unknown>;
    then: (resolve: (value: unknown) => unknown) => unknown;
  };
}

// Mock the supabase module before importing lobby.ts.
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: MOCK_AUTH_ID } } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        capture.fromCalls.push({ table, method: 'from', args: [] });
        return makeQueryChain(table);
      }),
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        capture.rpcCalls.push({ fn, args });
        return { data: null, error: null };
      }),
    },
    getAuthPlayerId: vi.fn(async () => MOCK_AUTH_ID),
    getStoredPlayerName: vi.fn(() => null),
    setStoredPlayerName: vi.fn(),
    isSupabaseEnabled: true,
  };
});

// Now import the functions under test.
import {
  getOrCreatePlayerId,
  getPlayerId,
  createLobby,
  joinLobby,
  updatePlayerScore,
  updateLobbyStatus,
  deleteLobby,
  updateLobbySettings,
  kickPlayer,
  renamePlayer,
  updatePlayerTeam,
  addCareerPoints,
  setPlayerScoreMultiplier,
  setPlayerDummyMode,
  resetPlayerPoints,
  markPlayerFinished,
  incrementPlayerWins,
  startCareerRound,
  resetMatchForPlayAgain,
  resetLobbyForNewRound,
  updateCareerState,
  leaveLobby,
  getLobbyPlayers,
  checkAllPlayersFinished,
  setPlayerReady,
} from './lobby';

describe('lobby.ts auth & identity', () => {
  beforeEach(() => {
    resetCapture();
    localStorage.clear();
  });

  it('getPlayerId returns the Supabase auth ID', async () => {
    const id = await getPlayerId();
    expect(id).toBe(MOCK_AUTH_ID);
  });

  it('getOrCreatePlayerId falls back to localStorage when no auth', () => {
    const id = getOrCreatePlayerId();
    expect(localStorage.getItem('ballknowledge_player_id')).toBe(id);
    expect(id).toHaveLength(36);
  });
});

describe('createLobby', () => {
  beforeEach(() => {
    resetCapture();
    localStorage.clear();
  });

  it('rejects empty or whitespace-only host names', async () => {
    const result = await createLobby('', 'nba', 'LAL', '2024-25');
    expect(result.lobby).toBeNull();
    expect(result.error).toBe('Player name is required');
  });

  it('rejects host names over 50 characters', async () => {
    const longName = 'a'.repeat(51);
    const result = await createLobby(longName, 'nba', 'LAL', '2024-25');
    expect(result.lobby).toBeNull();
    expect(result.error).toBe('Player name must be 50 characters or less');
  });

  it('trims host names before validation and storage', async () => {
    setResults({
      single: {
        data: {
          id: 'lobby-1',
          join_code: 'ABCDEF',
          host_id: MOCK_AUTH_ID,
          host_name: 'Alice',
          sport: 'nba',
          team_abbreviation: 'LAL',
          season: '2024-25',
          timer_duration: 90,
          game_mode: 'manual',
          min_year: 2015,
          max_year: 2025,
          status: 'waiting',
          game_type: 'roster',
          selection_scope: 'team',
          division_conference: null,
          division_name: null,
        } as unknown as Lobby,
        error: null,
      },
    });

    const result = await createLobby('  Alice  ', 'nba', 'LAL', '2024-25');
    expect(result.error).toBeNull();
    expect(result.lobby).not.toBeNull();
    expect(result.lobby!.host_name).toBe('Alice');
    expect(setStoredPlayerName).toHaveBeenCalledWith('Alice');
  });

  it('creates a lobby with the authenticated user as host', async () => {
    setResults({
      single: {
        data: {
          id: 'lobby-1',
          join_code: 'ABCDEF',
          host_id: MOCK_AUTH_ID,
          host_name: 'Alice',
          sport: 'nba',
          team_abbreviation: 'LAL',
          season: '2024-25',
          timer_duration: 90,
          game_mode: 'manual',
          min_year: 2015,
          max_year: 2025,
          status: 'waiting',
          game_type: 'roster',
          selection_scope: 'team',
          division_conference: null,
          division_name: null,
        } as unknown as Lobby,
        error: null,
      },
    });

    await createLobby('Alice', 'nba', 'LAL', '2024-25');

    const insertCall = capture.fromCalls.find(
      (c) => c.method === 'insert' && c.table === 'lobbies',
    );
    expect(insertCall).toBeDefined();
    expect((insertCall!.args[0] as Record<string, unknown>).host_id).toBe(MOCK_AUTH_ID);
    expect((insertCall!.args[0] as Record<string, unknown>).host_name).toBe('Alice');
  });
});

describe('joinLobby', () => {
  beforeEach(() => {
    resetCapture();
    localStorage.clear();
  });

  function makeLobby(overrides: Partial<Lobby> = {}): Lobby {
    return {
      id: 'lobby-1',
      join_code: 'ABCDEF',
      host_id: OTHER_AUTH_ID,
      host_name: 'Bob',
      sport: 'nba',
      team_abbreviation: 'LAL',
      season: '2024-25',
      timer_duration: 90,
      game_mode: 'manual',
      min_year: 2015,
      max_year: 2025,
      status: 'waiting',
      max_players: 8,
      game_type: 'roster',
      selection_scope: 'team',
      division_conference: null,
      division_name: null,
      used_nba_teams: [],
      used_nfl_teams: [],
      used_nba_divisions: [],
      used_nfl_divisions: [],
      career_state: null,
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
      ...overrides,
    } as Lobby;
  }

  function makeLobbyPlayer(overrides: Partial<LobbyPlayer> = {}): LobbyPlayer {
    return {
      id: 'player-row-1',
      lobby_id: 'lobby-1',
      player_id: MOCK_AUTH_ID,
      player_name: 'Alice',
      is_host: false,
      is_ready: false,
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
    } as LobbyPlayer;
  }

  it('rejects empty or whitespace-only player names', async () => {
    setResults({ single: { data: makeLobby(), error: null } });
    const result = await joinLobby('lobby-1', '   ');
    expect(result.player).toBeNull();
    expect(result.error).toBe('Player name is required');
  });

  it('rejects player names over 50 characters', async () => {
    setResults({ single: { data: makeLobby(), error: null } });
    const result = await joinLobby('lobby-1', 'a'.repeat(51));
    expect(result.player).toBeNull();
    expect(result.error).toBe('Player name must be 50 characters or less');
  });

  it('trims player names before validation and storage', async () => {
    // joinLobby flow: 1) single() for lobby fetch, 2) select(then) for current players,
    // 3) single() for the updated player (reconnect path)
    setResults({
      single: [
        { data: makeLobby(), error: null },
        { data: makeLobbyPlayer(), error: null },
      ],
      select: [{ data: [makeLobbyPlayer()], error: null }],
    });

    const result = await joinLobby('lobby-1', '  Alice  ');
    expect(result.error).toBeNull();
    expect(result.player).not.toBeNull();
    expect(result.player!.player_name).toBe('Alice');
    expect(setStoredPlayerName).toHaveBeenCalledWith('Alice');
  });

  it('reconnects same-device player by player_id', async () => {
    setResults({
      single: [
        { data: makeLobby(), error: null },
        { data: makeLobbyPlayer(), error: null },
      ],
      select: [{ data: [makeLobbyPlayer()], error: null }],
    });

    const result = await joinLobby('lobby-1', 'Alice');
    expect(result.error).toBeNull();
    expect(result.player!.player_id).toBe(MOCK_AUTH_ID);

    const updateCall = capture.fromCalls.find(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(updateCall).toBeDefined();
    expect((updateCall!.args[0] as Record<string, unknown>).player_id).toBeUndefined();
  });

  it('does NOT take over another player by matching username', async () => {
    // Same device check fails (different player_id); another player with same name exists.
    // joinLobby flow: 1) single() for lobby fetch, 2) select(then) for current players,
    // 3) single() for the inserted new player (new player path)
    setResults({
      single: [
        { data: makeLobby(), error: null },
        { data: makeLobbyPlayer({ player_id: MOCK_AUTH_ID }), error: null },
      ],
      select: [
        {
          data: [
            makeLobbyPlayer({
              id: 'other-row',
              player_id: OTHER_AUTH_ID,
              player_name: 'Alice',
            }),
          ],
          error: null,
        },
      ],
    });

    const result = await joinLobby('lobby-1', 'Alice');
    expect(result.error).toBeNull();
    expect(result.player!.player_id).toBe(MOCK_AUTH_ID);

    // Should NOT have updated the other player's row
    const updateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(updateCalls.length).toBe(0);

    // Should have inserted a new row
    const insertCall = capture.fromCalls.find(
      (c) => c.method === 'insert' && c.table === 'lobby_players',
    );
    expect(insertCall).toBeDefined();
    expect((insertCall!.args[0] as Record<string, unknown>).player_id).toBe(MOCK_AUTH_ID);
  });

  it('rejects new joins to an in-progress game', async () => {
    setResults({
      single: { data: makeLobby({ status: 'playing', game_type: 'roster' }), error: null },
      select: { data: [], error: null },
    });

    const result = await joinLobby('lobby-1', 'Alice');
    expect(result.player).toBeNull();
    expect(result.error).toBe('Game already started');
  });
});

describe('player-scoped updates', () => {
  beforeEach(() => {
    resetCapture();
    localStorage.clear();
  });

  it('updatePlayerScore only updates the authenticated players row', async () => {
    setResults({ update: { data: null, error: null } });
    await updatePlayerScore('lobby-1', 100, 5, ['a'], ['b'], true);

    const updateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(updateCalls.length).toBe(1);
    expect((updateCalls[0].args[0] as Record<string, unknown>).score).toBe(100);

    const eqCalls = capture.fromCalls.filter(
      (c) => c.method === 'eq' && c.table === 'lobby_players',
    );
    expect(eqCalls.map((c) => c.args)).toContainEqual(['player_id', MOCK_AUTH_ID]);
  });

  it('setPlayerReady only updates the authenticated players row', async () => {
    setResults({ update: { data: null, error: null } });
    await setPlayerReady('lobby-1', true);

    const eqCalls = capture.fromCalls.filter(
      (c) => c.method === 'eq' && c.table === 'lobby_players',
    );
    expect(eqCalls.map((c) => c.args)).toContainEqual(['player_id', MOCK_AUTH_ID]);
  });

  it('leaveLobby only deletes the authenticated players row', async () => {
    setResults({ delete: { error: null } });
    await leaveLobby('lobby-1');

    const eqCalls = capture.fromCalls.filter(
      (c) => c.method === 'eq' && c.table === 'lobby_players',
    );
    expect(eqCalls.map((c) => c.args)).toContainEqual(['player_id', MOCK_AUTH_ID]);
  });
});

describe('host-scoped direct updates', () => {
  beforeEach(() => {
    resetCapture();
    localStorage.clear();
  });

  it('updateLobbyStatus updates the lobbies table by id', async () => {
    setResults({ update: { data: null, error: null } });
    await updateLobbyStatus('lobby-1', 'playing');

    const eqCalls = capture.fromCalls.filter((c) => c.method === 'eq' && c.table === 'lobbies');
    expect(eqCalls.map((c) => c.args)).toContainEqual(['id', 'lobby-1']);
  });

  it('deleteLobby deletes from lobbies by id', async () => {
    setResults({ delete: { error: null } });
    await deleteLobby('lobby-1');

    const eqCalls = capture.fromCalls.filter((c) => c.method === 'eq' && c.table === 'lobbies');
    expect(eqCalls.map((c) => c.args)).toContainEqual(['id', 'lobby-1']);
  });

  it('updateLobbySettings updates the lobbies table by id', async () => {
    setResults({ update: { data: null, error: null } });
    await updateLobbySettings('lobby-1', { sport: 'nfl' });

    const eqCalls = capture.fromCalls.filter((c) => c.method === 'eq' && c.table === 'lobbies');
    expect(eqCalls.map((c) => c.args)).toContainEqual(['id', 'lobby-1']);
  });

  it('updateCareerState updates the lobbies table by id', async () => {
    setResults({ update: { data: null, error: null } });
    await updateCareerState('lobby-1', { round: 1 });

    const eqCalls = capture.fromCalls.filter((c) => c.method === 'eq' && c.table === 'lobbies');
    expect(eqCalls.map((c) => c.args)).toContainEqual(['id', 'lobby-1']);
  });
});

describe('host-only direct DB operations', () => {
  beforeEach(() => {
    resetCapture();
    localStorage.clear();
  });

  it('kickPlayer deletes from lobby_players by lobby_id and player_id', async () => {
    await kickPlayer('lobby-1', OTHER_AUTH_ID);
    expect(capture.rpcCalls).toHaveLength(0);
    const deleteCalls = capture.fromCalls.filter(
      (c) => c.method === 'delete' && c.table === 'lobby_players',
    );
    expect(deleteCalls.length).toBeGreaterThan(0);
    const eqCalls = capture.fromCalls.filter(
      (c) => c.method === 'eq' && c.table === 'lobby_players',
    );
    expect(eqCalls.map((c) => c.args)).toContainEqual(['player_id', OTHER_AUTH_ID]);
  });

  it('renamePlayer updates lobby_players with the new name', async () => {
    await renamePlayer('lobby-1', OTHER_AUTH_ID, 'NewName');
    expect(capture.rpcCalls).toHaveLength(0);
    const updateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(updateCalls.length).toBeGreaterThan(0);
    expect((updateCalls[0].args[0] as Record<string, unknown>).player_name).toBe('NewName');
  });

  it('updatePlayerTeam updates lobby_players with the team_number', async () => {
    await updatePlayerTeam('lobby-1', OTHER_AUTH_ID, 2);
    expect(capture.rpcCalls).toHaveLength(0);
    const updateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(updateCalls.length).toBeGreaterThan(0);
    expect((updateCalls[0].args[0] as Record<string, unknown>).team_number).toBe(2);
  });

  it('addCareerPoints fetches current points then updates lobby_players', async () => {
    setResults({
      single: { data: { points: 5 }, error: null },
      update: { data: null, error: null },
    });
    await addCareerPoints('lobby-1', OTHER_AUTH_ID, 10);
    expect(capture.rpcCalls).toHaveLength(0);
    const updateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(updateCalls.length).toBeGreaterThan(0);
    expect((updateCalls[0].args[0] as Record<string, unknown>).points).toBe(15);
  });

  it('setPlayerScoreMultiplier updates lobby_players with the multiplier', async () => {
    await setPlayerScoreMultiplier('lobby-1', OTHER_AUTH_ID, 2.5);
    expect(capture.rpcCalls).toHaveLength(0);
    const updateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(updateCalls.length).toBeGreaterThan(0);
    expect((updateCalls[0].args[0] as Record<string, unknown>).score_multiplier).toBe(2.5);
  });

  it('setPlayerDummyMode updates lobby_players with is_dummy', async () => {
    await setPlayerDummyMode('lobby-1', OTHER_AUTH_ID, true);
    expect(capture.rpcCalls).toHaveLength(0);
    const updateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(updateCalls.length).toBeGreaterThan(0);
    expect((updateCalls[0].args[0] as Record<string, unknown>).is_dummy).toBe(true);
  });

  it('resetPlayerPoints updates all lobby_players points to 0', async () => {
    await resetPlayerPoints('lobby-1');
    expect(capture.rpcCalls).toHaveLength(0);
    const updateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(updateCalls.length).toBeGreaterThan(0);
    expect((updateCalls[0].args[0] as Record<string, unknown>).points).toBe(0);
  });

  it('markPlayerFinished updates lobby_players finished_at for the target player', async () => {
    await markPlayerFinished('lobby-1', OTHER_AUTH_ID);
    expect(capture.rpcCalls).toHaveLength(0);
    const updateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(updateCalls.length).toBeGreaterThan(0);
    const eqCalls = capture.fromCalls.filter(
      (c) => c.method === 'eq' && c.table === 'lobby_players',
    );
    expect(eqCalls.map((c) => c.args)).toContainEqual(['player_id', OTHER_AUTH_ID]);
  });

  it('incrementPlayerWins calls the increment_player_wins RPC', async () => {
    await incrementPlayerWins('lobby-1', OTHER_AUTH_ID);
    expect(capture.rpcCalls).toContainEqual({
      fn: 'increment_player_wins',
      args: { p_lobby_id: 'lobby-1', p_player_id: OTHER_AUTH_ID },
    });
  });

  it('startCareerRound resets lobby_players and sets lobby status to playing', async () => {
    await startCareerRound('lobby-1', { round: 1 });
    expect(capture.rpcCalls).toHaveLength(0);

    const playerUpdateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(playerUpdateCalls.length).toBeGreaterThan(0);
    expect((playerUpdateCalls[0].args[0] as Record<string, unknown>).score).toBe(0);

    const lobbyUpdateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobbies',
    );
    expect(lobbyUpdateCalls.length).toBeGreaterThan(0);
    expect((lobbyUpdateCalls[0].args[0] as Record<string, unknown>).status).toBe('playing');
    expect((lobbyUpdateCalls[0].args[0] as Record<string, unknown>).career_state).toEqual({
      round: 1,
    });
  });

  it('resetMatchForPlayAgain resets lobby_players and sets lobby status to waiting', async () => {
    await resetMatchForPlayAgain('lobby-1', 3, 2000, 2025, { extra: true });
    expect(capture.rpcCalls).toHaveLength(0);

    const playerUpdateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(playerUpdateCalls.length).toBeGreaterThan(0);
    expect((playerUpdateCalls[0].args[0] as Record<string, unknown>).points).toBe(0);

    const lobbyUpdateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobbies',
    );
    expect(lobbyUpdateCalls.length).toBeGreaterThan(0);
    const lobbyUpdate = lobbyUpdateCalls[0].args[0] as Record<string, unknown>;
    expect(lobbyUpdate.status).toBe('waiting');
    expect((lobbyUpdate.career_state as Record<string, unknown>).win_target).toBe(3);
  });
});

describe('resetLobbyForNewRound', () => {
  beforeEach(() => {
    resetCapture();
    localStorage.clear();
  });

  function makeLobbyForReset(overrides: Partial<Lobby> = {}): Lobby {
    return {
      id: 'lobby-1',
      join_code: 'ABCDEF',
      host_id: MOCK_AUTH_ID,
      host_name: 'Bob',
      sport: 'nba',
      team_abbreviation: 'LAL',
      season: '2024-25',
      timer_duration: 90,
      game_mode: 'manual',
      min_year: 2015,
      max_year: 2025,
      status: 'playing',
      max_players: 8,
      game_type: 'roster',
      selection_scope: 'team',
      division_conference: null,
      division_name: null,
      used_nba_teams: [],
      used_nfl_teams: [],
      used_nba_divisions: [],
      used_nfl_divisions: [],
      career_state: null,
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      ...overrides,
    } as Lobby;
  }

  it('directly updates lobbies with status waiting and resets all player scores', async () => {
    setResults({ single: { data: makeLobbyForReset(), error: null } });
    await resetLobbyForNewRound('lobby-1');

    expect(capture.rpcCalls).toHaveLength(0);

    const lobbyUpdateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobbies',
    );
    expect(lobbyUpdateCalls.length).toBeGreaterThan(0);
    expect((lobbyUpdateCalls[0].args[0] as Record<string, unknown>).status).toBe('waiting');

    const playerUpdateCalls = capture.fromCalls.filter(
      (c) => c.method === 'update' && c.table === 'lobby_players',
    );
    expect(playerUpdateCalls.length).toBeGreaterThan(0);
    expect((playerUpdateCalls[0].args[0] as Record<string, unknown>).score).toBe(0);
  });
});

describe('utility functions', () => {
  beforeEach(() => {
    resetCapture();
    localStorage.clear();
  });

  it('getLobbyPlayers selects by lobby_id and orders by joined_at', async () => {
    setResults({ select: { data: [], error: null } });
    await getLobbyPlayers('lobby-1');

    const eqCalls = capture.fromCalls.filter(
      (c) => c.method === 'eq' && c.table === 'lobby_players',
    );
    expect(eqCalls.map((c) => c.args)).toContainEqual(['lobby_id', 'lobby-1']);
  });

  it('checkAllPlayersFinished returns true when all connected players finished', async () => {
    setResults({
      select: {
        data: [
          { finished_at: new Date().toISOString(), is_connected: true },
          { finished_at: new Date().toISOString(), is_connected: true },
        ],
        error: null,
      },
    });
    const result = await checkAllPlayersFinished('lobby-1');
    expect(result).toBe(true);
  });

  it('checkAllPlayersFinished returns false when a connected player has not finished', async () => {
    setResults({
      select: {
        data: [
          { finished_at: new Date().toISOString(), is_connected: true },
          { finished_at: null, is_connected: true },
        ],
        error: null,
      },
    });
    const result = await checkAllPlayersFinished('lobby-1');
    expect(result).toBe(false);
  });
});
