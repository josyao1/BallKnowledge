-- Ball Knowledge Database Schema
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game sessions table
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

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Game sessions policies
CREATE POLICY "Game sessions are viewable by everyone"
  ON game_sessions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert game sessions"
  ON game_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own game sessions"
  ON game_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to automatically create profile on signup
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
-- MULTIPLAYER LOBBY TABLES
-- ============================================================================

-- Lobbies table
CREATE TABLE IF NOT EXISTS lobbies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  join_code VARCHAR(6) UNIQUE NOT NULL,
  host_id UUID NOT NULL,
  host_name VARCHAR(50) NOT NULL,
  sport VARCHAR(10) NOT NULL DEFAULT 'nba',
  team_abbreviation VARCHAR(5) NOT NULL,
  season VARCHAR(10) NOT NULL,
  timer_duration INTEGER NOT NULL DEFAULT 90,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  max_players INTEGER NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Lobby players table
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
  UNIQUE(lobby_id, player_id)
);

-- Indexes for lobby queries
CREATE INDEX IF NOT EXISTS idx_lobbies_join_code ON lobbies(join_code);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_lobby_players_lobby_id ON lobby_players(lobby_id);
CREATE INDEX IF NOT EXISTS idx_lobby_players_player_id ON lobby_players(player_id);

-- RLS for lobbies
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;

-- Lobby policies (public access for anonymous play)
CREATE POLICY "Lobbies are viewable by everyone"
  ON lobbies FOR SELECT USING (true);

CREATE POLICY "Anyone can create lobbies"
  ON lobbies FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update lobbies"
  ON lobbies FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete lobbies"
  ON lobbies FOR DELETE USING (true);

-- Lobby players policies
CREATE POLICY "Lobby players are viewable by everyone"
  ON lobby_players FOR SELECT USING (true);

CREATE POLICY "Anyone can join lobbies"
  ON lobby_players FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update lobby players"
  ON lobby_players FOR UPDATE USING (true);

CREATE POLICY "Anyone can leave lobbies"
  ON lobby_players FOR DELETE USING (true);

-- Enable realtime for lobby tables
ALTER PUBLICATION supabase_realtime ADD TABLE lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE lobby_players;
