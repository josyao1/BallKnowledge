/**
 * database.ts — Supabase schema types for all tables and views.
 *
 * Mirrors the Supabase Postgres schema. Key tables:
 * - profiles: user accounts (extends Supabase auth.users)
 * - game_sessions: individual game records for solo leaderboards
 * - lobbies: multiplayer lobby configuration and lifecycle state
 * - lobby_players: per-player state within a lobby (scores, guesses, wins)
 * - leaderboard (view): materialized ranking view
 *
 * Convenience type aliases (Lobby, LobbyPlayer, etc.) are exported at the bottom.
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          created_at?: string;
        };
      };
      game_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          team_abbreviation: string;
          season: string;
          score: number;
          bonus_points: number;
          percentage: number;
          guessed_players: string[];
          incorrect_guesses: string[];
          time_remaining: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          team_abbreviation: string;
          season: string;
          score: number;
          bonus_points: number;
          percentage: number;
          guessed_players: string[];
          incorrect_guesses: string[];
          time_remaining: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          team_abbreviation?: string;
          season?: string;
          score?: number;
          bonus_points?: number;
          percentage?: number;
          guessed_players?: string[];
          incorrect_guesses?: string[];
          time_remaining?: number;
          created_at?: string;
        };
      };
      lobbies: {
        Row: {
          id: string;
          join_code: string;
          host_id: string;
          host_name: string;
          sport: string;
          team_abbreviation: string;
          season: string;
          timer_duration: number;
          game_mode: 'random' | 'manual';
          min_year: number;
          max_year: number;
          status: 'waiting' | 'countdown' | 'playing' | 'finished';
          max_players: number;
          created_at: string;
          started_at: string | null;
          finished_at: string | null;
          used_nba_teams: string[];
          used_nfl_teams: string[];
          game_type: string;
        };
        Insert: {
          id?: string;
          join_code: string;
          host_id: string;
          host_name: string;
          sport?: string;
          team_abbreviation: string;
          season: string;
          timer_duration?: number;
          game_mode?: 'random' | 'manual';
          min_year?: number;
          max_year?: number;
          status?: 'waiting' | 'countdown' | 'playing' | 'finished';
          max_players?: number;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          used_nba_teams?: string[];
          used_nfl_teams?: string[];
          game_type?: string;
        };
        Update: {
          id?: string;
          join_code?: string;
          host_id?: string;
          host_name?: string;
          sport?: string;
          team_abbreviation?: string;
          season?: string;
          timer_duration?: number;
          game_mode?: 'random' | 'manual';
          min_year?: number;
          max_year?: number;
          status?: 'waiting' | 'countdown' | 'playing' | 'finished';
          max_players?: number;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          used_nba_teams?: string[];
          used_nfl_teams?: string[];
          game_type?: string;
        };
      };
      roll_call_entries: {
        Row: {
          id: string;
          lobby_id: string;
          player_id: string;
          player_name: string;
          entry_text: string;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          lobby_id: string;
          player_id: string;
          player_name: string;
          entry_text: string;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          lobby_id?: string;
          player_id?: string;
          player_name?: string;
          entry_text?: string;
          submitted_at?: string;
        };
      };
      roll_call_merges: {
        Row: {
          id: string;
          lobby_id: string;
          suggestion_key: string;
          entry_ids: string[];
          canonical: string;
          is_dismissed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          lobby_id: string;
          suggestion_key: string;
          entry_ids: string[];
          canonical: string;
          is_dismissed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          lobby_id?: string;
          suggestion_key?: string;
          entry_ids?: string[];
          canonical?: string;
          is_dismissed?: boolean;
          created_at?: string;
        };
      };
      lobby_players: {
        Row: {
          id: string;
          lobby_id: string;
          player_id: string;
          player_name: string;
          is_host: boolean;
          is_ready: boolean;
          is_dummy: boolean;
          score: number;
          guessed_count: number;
          guessed_players: string[];
          incorrect_guesses: string[];
          is_connected: boolean;
          joined_at: string;
          finished_at: string | null;
          wins: number;
          team_number: number | null;
        };
        Insert: {
          id?: string;
          lobby_id: string;
          player_id: string;
          player_name: string;
          is_host?: boolean;
          is_ready?: boolean;
          is_dummy?: boolean;
          score?: number;
          guessed_count?: number;
          guessed_players?: string[];
          incorrect_guesses?: string[];
          is_connected?: boolean;
          joined_at?: string;
          finished_at?: string | null;
          wins?: number;
          team_number?: number | null;
        };
        Update: {
          id?: string;
          lobby_id?: string;
          player_id?: string;
          player_name?: string;
          is_host?: boolean;
          is_ready?: boolean;
          is_dummy?: boolean;
          score?: number;
          guessed_count?: number;
          guessed_players?: string[];
          incorrect_guesses?: string[];
          is_connected?: boolean;
          joined_at?: string;
          finished_at?: string | null;
          wins?: number;
          team_number?: number | null;
        };
      };
    };
    Views: {
      leaderboard: {
        Row: {
          id: string;
          username: string | null;
          team_abbreviation: string;
          season: string;
          score: number;
          percentage: number;
          rank: number;
          created_at: string;
        };
      };
    };
  };
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type GameSession = Database['public']['Tables']['game_sessions']['Row'];
export type GameSessionInsert = Database['public']['Tables']['game_sessions']['Insert'];
export type LeaderboardEntry = Database['public']['Views']['leaderboard']['Row'];

// Lobby types
export type Lobby = Database['public']['Tables']['lobbies']['Row'];
export type LobbyInsert = Database['public']['Tables']['lobbies']['Insert'];
export type LobbyUpdate = Database['public']['Tables']['lobbies']['Update'];
export type LobbyPlayer = Database['public']['Tables']['lobby_players']['Row'];
export type LobbyPlayerInsert = Database['public']['Tables']['lobby_players']['Insert'];
export type LobbyPlayerUpdate = Database['public']['Tables']['lobby_players']['Update'];
export type LobbyStatus = Lobby['status'];

// Roll Call types
export type RollCallEntry = Database['public']['Tables']['roll_call_entries']['Row'];
export type RollCallEntryInsert = Database['public']['Tables']['roll_call_entries']['Insert'];
export type RollCallMerge = Database['public']['Tables']['roll_call_merges']['Row'];
export type RollCallMergeInsert = Database['public']['Tables']['roll_call_merges']['Insert'];
