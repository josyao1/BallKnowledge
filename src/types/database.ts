/**
 * Supabase Database Types
 *
 * These types match the schema defined in plan.txt:
 * - profiles: User profiles (extends auth.users)
 * - game_sessions: Individual game records
 * - leaderboard: Materialized view for rankings
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
