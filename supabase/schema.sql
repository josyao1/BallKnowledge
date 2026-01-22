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
