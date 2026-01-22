import { supabase, isSupabaseEnabled } from '../lib/supabase';
import type { LeaderboardEntry } from '../types/database';

interface GameSessionRow {
  id: string;
  user_id: string | null;
  team_abbreviation: string;
  season: string;
  score: number;
  percentage: number;
  created_at: string;
}

interface GameSessionInput {
  user_id?: string | null;
  team_abbreviation: string;
  season: string;
  score: number;
  percentage: number;
  guessed_players: string[];
  incorrect_guesses: string[];
  time_remaining: number;
}

/**
 * Submit a game score to the leaderboard
 */
export async function submitScore(session: GameSessionInput): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isSupabaseEnabled || !supabase) {
    return { success: false, error: 'Leaderboard not available' };
  }

  try {
    const { error } = await supabase
      .from('game_sessions')
      .insert(session);

    if (error) {
      console.error('Error submitting score:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error submitting score:', err);
    return { success: false, error: 'Failed to submit score' };
  }
}

/**
 * Get leaderboard for a specific team and season
 */
export async function getLeaderboard(
  teamAbbreviation: string,
  season: string,
  limit = 10
): Promise<{ data: LeaderboardEntry[] | null; error?: string }> {
  if (!isSupabaseEnabled || !supabase) {
    return { data: null, error: 'Leaderboard not available' };
  }

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, user_id, team_abbreviation, season, score, percentage, created_at')
      .eq('team_abbreviation', teamAbbreviation)
      .eq('season', season)
      .order('score', { ascending: false })
      .order('percentage', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return { data: null, error: error.message };
    }

    // Transform to LeaderboardEntry format with rank
    const rows = (data || []) as GameSessionRow[];
    const entries: LeaderboardEntry[] = rows.map((row, index) => ({
      id: row.id,
      username: null, // Will be joined with profiles if user is logged in
      team_abbreviation: row.team_abbreviation,
      season: row.season,
      score: row.score,
      percentage: row.percentage,
      rank: index + 1,
      created_at: row.created_at,
    }));

    return { data: entries };
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return { data: null, error: 'Failed to fetch leaderboard' };
  }
}

/**
 * Get global leaderboard (all teams/seasons combined)
 */
export async function getGlobalLeaderboard(limit = 10): Promise<{
  data: LeaderboardEntry[] | null;
  error?: string;
}> {
  if (!isSupabaseEnabled || !supabase) {
    return { data: null, error: 'Leaderboard not available' };
  }

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, user_id, team_abbreviation, season, score, percentage, created_at')
      .order('score', { ascending: false })
      .order('percentage', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching global leaderboard:', error);
      return { data: null, error: error.message };
    }

    const rows = (data || []) as GameSessionRow[];
    const entries: LeaderboardEntry[] = rows.map((row, index) => ({
      id: row.id,
      username: null,
      team_abbreviation: row.team_abbreviation,
      season: row.season,
      score: row.score,
      percentage: row.percentage,
      rank: index + 1,
      created_at: row.created_at,
    }));

    return { data: entries };
  } catch (err) {
    console.error('Error fetching global leaderboard:', err);
    return { data: null, error: 'Failed to fetch leaderboard' };
  }
}

/**
 * Get user's personal best scores
 */
export async function getUserBestScores(
  userId: string,
  limit = 10
): Promise<{ data: LeaderboardEntry[] | null; error?: string }> {
  if (!isSupabaseEnabled || !supabase) {
    return { data: null, error: 'Leaderboard not available' };
  }

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, user_id, team_abbreviation, season, score, percentage, created_at')
      .eq('user_id', userId)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user scores:', error);
      return { data: null, error: error.message };
    }

    const rows = (data || []) as GameSessionRow[];
    const entries: LeaderboardEntry[] = rows.map((row, index) => ({
      id: row.id,
      username: null,
      team_abbreviation: row.team_abbreviation,
      season: row.season,
      score: row.score,
      percentage: row.percentage,
      rank: index + 1,
      created_at: row.created_at,
    }));

    return { data: entries };
  } catch (err) {
    console.error('Error fetching user scores:', err);
    return { data: null, error: 'Failed to fetch scores' };
  }
}
