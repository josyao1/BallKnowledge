import { createClient, SupabaseClient, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not found. Leaderboard features will be disabled.\n' +
      'To enable, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
  );
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseEnabled = !!supabase;

/**
 * Ensure the client has an anonymous Supabase auth session.
 * Returns the authenticated user, or null if Supabase is not configured or auth fails.
 *
 * This replaces the old localStorage UUID approach with real JWT-based identity.
 * RLS policies use auth.uid() to scope writes to the authenticated user.
 */
export async function ensureAnonymousSession(): Promise<User | null> {
  if (!supabase) return null;

  // Check for existing session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user;

  // Create a new anonymous session
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('Anonymous auth failed:', error.message);
    return null;
  }
  return data?.user ?? null;
}

/**
 * Get the current authenticated user's ID.
 * Ensures an anonymous session exists first.
 * Returns null if Supabase is not configured (solo mode).
 */
export async function getAuthPlayerId(): Promise<string | null> {
  const user = await ensureAnonymousSession();
  return user?.id ?? null;
}
