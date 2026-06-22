-- Ball Knowledge Database Schema
-- Run this in your Supabase SQL editor to set up the database
--
-- SECURITY: This schema uses Row Level Security (RLS) scoped to auth.uid().
-- Requires Anonymous Auth to be enabled in Supabase dashboard:
--   Auth → Providers → Anonymous → Enable

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game sessions table (solo leaderboard scores)
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  team_abbreviation TEXT NOT NULL,
  season TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  percentage DECIMAL NOT NULL DEFAULT 0,
  guessed_players JSONB NOT NULL DEFAULT '[]',
  incorrect_guesses JSONB NOT NULL DEFAULT '[]',
  time_remaining INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_game_sessions_team_season
  ON game_sessions(team_abbreviation, season);
CREATE INDEX IF NOT EXISTS idx_game_sessions_score
  ON game_sessions(score DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user
  ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created
  ON game_sessions(created_at DESC);

-- ============================================================================
-- MULTIPLAYER LOBBY TABLES
-- ============================================================================

-- Lobbies table — includes all columns referenced by the app (consolidated
-- from the original CREATE TABLE + ALTER TABLE migrations into one definition
-- for new installs; existing installs should run the ALTER statements below).
CREATE TABLE IF NOT EXISTS lobbies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  join_code VARCHAR(6) UNIQUE NOT NULL,
  host_id UUID NOT NULL,
  host_name VARCHAR(50) NOT NULL,
  sport VARCHAR(10) NOT NULL DEFAULT 'nba',
  team_abbreviation VARCHAR(5) NOT NULL,
  season VARCHAR(10) NOT NULL,
  timer_duration INTEGER NOT NULL DEFAULT 90,
  game_mode VARCHAR(10) NOT NULL DEFAULT 'manual',
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  max_players INTEGER NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  -- Columns added via migrations — included here for new installs
  game_type VARCHAR(20) NOT NULL DEFAULT 'roster',
  min_year INTEGER NOT NULL DEFAULT 2015,
  max_year INTEGER NOT NULL DEFAULT 2025,
  selection_scope TEXT NOT NULL DEFAULT 'team',
  division_conference TEXT,
  division_name TEXT,
  career_state JSONB,
  used_nba_teams TEXT[] DEFAULT '{}',
  used_nfl_teams TEXT[] DEFAULT '{}',
  used_nba_divisions TEXT[] DEFAULT '{}',
  used_nfl_divisions TEXT[] DEFAULT '{}'
);

-- Migration: Add columns if they don't exist (for existing installs)
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS game_type VARCHAR(20) NOT NULL DEFAULT 'roster';
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS game_mode VARCHAR(10) NOT NULL DEFAULT 'manual';
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS min_year INTEGER NOT NULL DEFAULT 2015;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS max_year INTEGER NOT NULL DEFAULT 2025;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS selection_scope TEXT NOT NULL DEFAULT 'team';
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS division_conference TEXT;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS division_name TEXT;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS career_state JSONB;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS used_nba_teams TEXT[] DEFAULT '{}';
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS used_nfl_teams TEXT[] DEFAULT '{}';
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS used_nba_divisions TEXT[] DEFAULT '{}';
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS used_nfl_divisions TEXT[] DEFAULT '{}';

-- Lobby players table — includes all columns referenced by the app
CREATE TABLE IF NOT EXISTS lobby_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  player_name VARCHAR(50) NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  is_ready BOOLEAN DEFAULT FALSE,
  score INTEGER DEFAULT 0,
  guessed_count INTEGER DEFAULT 0,
  is_connected BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  -- Columns added via migrations — included here for new installs
  points INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  guessed_players JSONB DEFAULT '[]',
  incorrect_guesses JSONB DEFAULT '[]',
  team_number INTEGER,
  score_multiplier DECIMAL DEFAULT 1.0,
  is_dummy BOOLEAN DEFAULT FALSE,
  UNIQUE(lobby_id, player_id)
);

-- Migration: Add columns if they don't exist (for existing installs)
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS guessed_players JSONB DEFAULT '[]';
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS incorrect_guesses JSONB DEFAULT '[]';
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS team_number INTEGER;
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS score_multiplier DECIMAL DEFAULT 1.0;
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS is_dummy BOOLEAN DEFAULT FALSE;

-- Indexes for lobby queries
CREATE INDEX IF NOT EXISTS idx_lobbies_join_code ON lobbies(join_code);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_lobby_players_lobby_id ON lobby_players(lobby_id);
CREATE INDEX IF NOT EXISTS idx_lobby_players_player_id ON lobby_players(player_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- All write operations are scoped to auth.uid() — the authenticated user.
-- Read access is public (anyone can view lobbies to find them by join code).
-- Host-only operations are enforced via SECURITY DEFINER RPC functions that
-- verify the caller is the lobby's host before acting.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;

-- Drop old open policies (idempotent — safe to re-run)
DROP POLICY IF EXISTS "Anyone can create lobbies" ON lobbies;
DROP POLICY IF EXISTS "Anyone can update lobbies" ON lobbies;
DROP POLICY IF EXISTS "Anyone can delete lobbies" ON lobbies;
DROP POLICY IF EXISTS "Anyone can join lobbies" ON lobby_players;
DROP POLICY IF EXISTS "Anyone can update lobby players" ON lobby_players;
DROP POLICY IF EXISTS "Anyone can leave lobbies" ON lobby_players;
DROP POLICY IF EXISTS "Anyone can insert game sessions" ON game_sessions;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Game sessions policies (leaderboard)
-- SELECT is public (leaderboard is visible to all).
-- INSERT requires auth and user_id must match the authenticated user.
-- UPDATE is scoped to own user_id.
-- NOTE: submitScore() is currently dead code — no client writes to this table.
-- When wired up, scores should be validated server-side (Edge Function or RPC).
CREATE POLICY "Game sessions are viewable by everyone"
  ON game_sessions FOR SELECT
  USING (true);

CREATE POLICY "Users insert own game sessions"
  ON game_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own game sessions"
  ON game_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Lobbies policies
-- SELECT is public (needed to find lobbies by join code).
-- INSERT: any authenticated user can create a lobby, but host_id must match
--   their auth UID (prevents creating lobbies under someone else's identity).
-- UPDATE/DELETE: only the host can modify or delete their lobby.
CREATE POLICY "Lobbies are viewable by everyone"
  ON lobbies FOR SELECT USING (true);

CREATE POLICY "Authenticated users create own lobbies"
  ON lobbies FOR INSERT
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Host can update lobby"
  ON lobbies FOR UPDATE
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Host can delete lobby"
  ON lobbies FOR DELETE
  USING (host_id = auth.uid());

-- Lobby players policies
-- SELECT is public (players visible to all lobby members).
-- INSERT: a player can only insert their own row (player_id = auth.uid()).
-- UPDATE: a player can only update their own row (score, ready status, etc.).
--   Host-only cross-player updates (kick, rename, assign team) go through
--   SECURITY DEFINER RPCs that verify host status internally.
-- DELETE: a player can only delete their own row (leave lobby).
--   Host-only kick goes through a SECURITY DEFINER RPC.
CREATE POLICY "Lobby players are viewable by everyone"
  ON lobby_players FOR SELECT USING (true);

CREATE POLICY "Players join own row"
  ON lobby_players FOR INSERT
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "Players update own row"
  ON lobby_players FOR UPDATE
  USING (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "Players leave own row"
  ON lobby_players FOR DELETE
  USING (player_id = auth.uid());

-- ============================================================================
-- SECURITY DEFINER RPC FUNCTIONS
-- ============================================================================
-- These functions run with elevated privileges (bypassing RLS) to perform
-- host-only operations that modify other players' rows. Each function
-- verifies that the caller (auth.uid()) is the host of the lobby before
-- acting. This is the ONLY way to do cross-player writes under RLS.

-- Increment wins for a player (host-only, atomic).
-- Called by incrementPlayerWins() in lobby.ts.
CREATE OR REPLACE FUNCTION public.increment_player_wins(p_lobby_id UUID, p_player_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is the host of this lobby
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can increment wins';
  END IF;

  UPDATE lobby_players
  SET wins = wins + 1
  WHERE lobby_id = p_lobby_id AND player_id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_player_wins TO authenticated;

-- Mark a specific player as finished (host-only).
-- Used to force-end stuck sessions. Skips already-finished players.
-- Called by markPlayerFinished() in lobby.ts.
CREATE OR REPLACE FUNCTION public.mark_player_finished(p_lobby_id UUID, p_player_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can mark players finished';
  END IF;

  UPDATE lobby_players
  SET finished_at = NOW()
  WHERE lobby_id = p_lobby_id
    AND player_id = p_player_id
    AND finished_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_player_finished TO authenticated;

-- Reset all player points to 0 for a lobby (host-only, between games).
-- Session wins are preserved.
-- Called by resetPlayerPoints() in lobby.ts.
CREATE OR REPLACE FUNCTION public.reset_player_points(p_lobby_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can reset player points';
  END IF;

  UPDATE lobby_players
  SET points = 0
  WHERE lobby_id = p_lobby_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_player_points TO authenticated;

-- Add points to a player (host-only, used for scramble/lineup/career scoring).
-- Called by addCareerPoints() in lobby.ts.
CREATE OR REPLACE FUNCTION public.add_career_points(p_lobby_id UUID, p_player_id UUID, p_pts INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can add career points';
  END IF;

  UPDATE lobby_players
  SET points = (points + p_pts)
  WHERE lobby_id = p_lobby_id AND player_id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_career_points TO authenticated;

-- Kick a player from the lobby (host-only).
-- Called by kickPlayer() in lobby.ts.
CREATE OR REPLACE FUNCTION public.kick_player(p_lobby_id UUID, p_player_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can kick players';
  END IF;

  DELETE FROM lobby_players
  WHERE lobby_id = p_lobby_id AND player_id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kick_player TO authenticated;

-- Rename a player in the lobby (host-only).
-- Called by renamePlayer() in lobby.ts.
CREATE OR REPLACE FUNCTION public.rename_player(
  p_lobby_id UUID,
  p_player_id UUID,
  p_new_name VARCHAR(50)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can rename players';
  END IF;

  UPDATE lobby_players
  SET player_name = p_new_name
  WHERE lobby_id = p_lobby_id AND player_id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_player TO authenticated;

-- Update a player's team assignment (host-only).
-- Called by updatePlayerTeam() in lobby.ts.
CREATE OR REPLACE FUNCTION public.update_player_team(
  p_lobby_id UUID,
  p_player_id UUID,
  p_team_number INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can assign teams';
  END IF;

  UPDATE lobby_players
  SET team_number = p_team_number
  WHERE lobby_id = p_lobby_id AND player_id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_player_team TO authenticated;

-- Set a player's score multiplier (host-only).
-- Called by setPlayerScoreMultiplier() in lobby.ts.
CREATE OR REPLACE FUNCTION public.set_player_score_multiplier(
  p_lobby_id UUID,
  p_player_id UUID,
  p_multiplier DECIMAL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can set score multipliers';
  END IF;

  UPDATE lobby_players
  SET score_multiplier = p_multiplier
  WHERE lobby_id = p_lobby_id AND player_id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_player_score_multiplier TO authenticated;

-- Toggle dummy mode for a player (host-only).
-- Called by setPlayerDummyMode() in lobby.ts.
CREATE OR REPLACE FUNCTION public.set_player_dummy_mode(
  p_lobby_id UUID,
  p_player_id UUID,
  p_is_dummy BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can toggle dummy mode';
  END IF;

  UPDATE lobby_players
  SET is_dummy = p_is_dummy
  WHERE lobby_id = p_lobby_id AND player_id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_player_dummy_mode TO authenticated;

-- Start a new career round: reset all player scores, write career_state, set playing.
-- Called by startCareerRound() in lobby.ts.
CREATE OR REPLACE FUNCTION public.start_career_round(
  p_lobby_id UUID,
  p_career_state JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can start a career round';
  END IF;

  -- Reset all player scores and round state
  UPDATE lobby_players
  SET finished_at = NULL,
      score = 0,
      guessed_count = 0,
      guessed_players = '[]'::jsonb,
      incorrect_guesses = '[]'::jsonb
  WHERE lobby_id = p_lobby_id;

  -- Write new career state and set lobby to playing
  UPDATE lobbies
  SET career_state = p_career_state,
      status = 'playing',
      started_at = NOW(),
      finished_at = NULL
  WHERE id = p_lobby_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_career_round TO authenticated;

-- Reset for Play Again: reset all player points/scores, write new career_state.
-- Session wins (wins column) are preserved.
-- Called by resetMatchForPlayAgain() in lobby.ts.
CREATE OR REPLACE FUNCTION public.reset_match_for_play_again(
  p_lobby_id UUID,
  p_career_state JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can reset for play again';
  END IF;

  -- Reset all player points/scores and ready status
  UPDATE lobby_players
  SET points = 0,
      score = 0,
      finished_at = NULL,
      guessed_count = 0,
      guessed_players = '[]'::jsonb,
      incorrect_guesses = '[]'::jsonb,
      is_ready = FALSE
  WHERE lobby_id = p_lobby_id;

  -- Write new career state and set lobby to waiting
  UPDATE lobbies
  SET career_state = p_career_state,
      status = 'waiting',
      finished_at = NULL
  WHERE id = p_lobby_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_match_for_play_again TO authenticated;

-- Reset lobby for a new round: reset status/timestamps, optionally pick new
-- random team/division (the random selection logic runs client-side and
-- passes the result via p_lobby_update). Resets all player scores.
-- Called by resetLobbyForNewRound() in lobby.ts.
CREATE OR REPLACE FUNCTION public.reset_lobby_for_new_round(
  p_lobby_id UUID,
  p_lobby_update JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lobbies WHERE id = p_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can reset for a new round';
  END IF;

  -- Update lobby with the provided update object (status, timestamps, team, season, etc.)
  UPDATE lobbies SET
    status = COALESCE((p_lobby_update->>'status')::varchar, 'waiting'),
    started_at = NULL,
    finished_at = NULL,
    team_abbreviation = COALESCE((p_lobby_update->>'team_abbreviation')::varchar, team_abbreviation),
    season = COALESCE((p_lobby_update->>'season')::varchar, season),
    division_conference = COALESCE(NULLIF(p_lobby_update->>'division_conference', ''), division_conference),
    division_name = COALESCE(NULLIF(p_lobby_update->>'division_name', ''), division_name),
    used_nba_teams = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_lobby_update->'used_nba_teams')),
      used_nba_teams
    ),
    used_nfl_teams = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_lobby_update->'used_nfl_teams')),
      used_nfl_teams
    ),
    used_nba_divisions = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_lobby_update->'used_nba_divisions')),
      used_nba_divisions
    ),
    used_nfl_divisions = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_lobby_update->'used_nfl_divisions')),
      used_nfl_divisions
    )
  WHERE id = p_lobby_id;

  -- Reset non-host player scores and ready status
  UPDATE lobby_players
  SET score = 0,
      points = 0,
      guessed_count = 0,
      guessed_players = '[]'::jsonb,
      incorrect_guesses = '[]'::jsonb,
      is_ready = FALSE,
      finished_at = NULL
  WHERE lobby_id = p_lobby_id AND is_host = FALSE;

  -- Reset host scores but keep ready
  UPDATE lobby_players
  SET score = 0,
      points = 0,
      guessed_count = 0,
      guessed_players = '[]'::jsonb,
      incorrect_guesses = '[]'::jsonb,
      is_ready = TRUE,
      finished_at = NULL
  WHERE lobby_id = p_lobby_id AND is_host = TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_lobby_for_new_round TO authenticated;

-- ============================================================================
-- AUTH TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'Player_' || substr(NEW.id::text, 1, 8)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- LEADERBOARD VIEW
-- ============================================================================

-- Leaderboard view (top scores per team/season)
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  gs.id,
  p.username,
  gs.team_abbreviation,
  gs.season,
  gs.score,
  gs.percentage,
  gs.created_at,
  RANK() OVER (
    PARTITION BY gs.team_abbreviation, gs.season
    ORDER BY gs.score DESC, gs.percentage DESC
  ) as rank
FROM game_sessions gs
LEFT JOIN profiles p ON gs.user_id = p.id;

-- Grant access to the view
GRANT SELECT ON leaderboard TO anon, authenticated;

-- ============================================================================
-- REALTIME
-- ============================================================================

-- Enable realtime for lobby tables
ALTER PUBLICATION supabase_realtime ADD TABLE lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE lobby_players;

-- ============================================================================
-- ROLL CALL TABLES
-- ============================================================================
-- NOTE: These tables are referenced in the app code (rollCall.ts, database.ts)
-- but were not in the original schema.sql. They may exist in your Supabase
-- dashboard already. If not, run the CREATE TABLE statements below.
-- If they already exist, just run the RLS policies.

CREATE TABLE IF NOT EXISTS roll_call_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  player_name VARCHAR(50) NOT NULL,
  entry_text TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roll_call_merges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  suggestion_key TEXT NOT NULL,
  entry_ids UUID[] NOT NULL DEFAULT '{}',
  canonical TEXT NOT NULL,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for roll call tables
ALTER TABLE roll_call_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE roll_call_merges ENABLE ROW LEVEL SECURITY;

-- Drop old open policies if they exist
DROP POLICY IF EXISTS "Anyone can insert roll call entries" ON roll_call_entries;
DROP POLICY IF EXISTS "Anyone can update roll call entries" ON roll_call_entries;
DROP POLICY IF EXISTS "Anyone can delete roll call entries" ON roll_call_entries;
DROP POLICY IF EXISTS "Anyone can insert roll call merges" ON roll_call_merges;
DROP POLICY IF EXISTS "Anyone can update roll call merges" ON roll_call_merges;
DROP POLICY IF EXISTS "Anyone can delete roll call merges" ON roll_call_merges;

-- Roll call entries: public read, players insert/update/delete own entries
CREATE POLICY "Roll call entries viewable by everyone"
  ON roll_call_entries FOR SELECT USING (true);

CREATE POLICY "Players insert own roll call entries"
  ON roll_call_entries FOR INSERT
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "Players update own roll call entries"
  ON roll_call_entries FOR UPDATE
  USING (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "Players delete own roll call entries"
  ON roll_call_entries FOR DELETE
  USING (player_id = auth.uid());

-- Roll call merges: public read, host-only write (via RPC or direct if host)
CREATE POLICY "Roll call merges viewable by everyone"
  ON roll_call_merges FOR SELECT USING (true);

-- Merges are created/dismissed by the host — check via subquery
CREATE POLICY "Host inserts roll call merges"
  ON roll_call_merges FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM lobbies WHERE id = lobby_id AND host_id = auth.uid())
  );

CREATE POLICY "Host updates roll call merges"
  ON roll_call_merges FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM lobbies WHERE id = lobby_id AND host_id = auth.uid())
  );

CREATE POLICY "Host deletes roll call merges"
  ON roll_call_merges FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM lobbies WHERE id = lobby_id AND host_id = auth.uid())
  );

-- Enable realtime for roll call tables
ALTER PUBLICATION supabase_realtime ADD TABLE roll_call_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE roll_call_merges;
