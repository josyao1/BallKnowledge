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

const LOCAL_PLAYER_ID_KEY = 'ballknowledge_player_id';

function getOrCreateLocalPlayerId(): string {
  try {
    const existing = localStorage.getItem(LOCAL_PLAYER_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(LOCAL_PLAYER_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Ensure the client has an identity for leaderboard submission.
 * Tries Supabase anonymous auth first; falls back to a stable localStorage UUID
 * if anonymous auth is unavailable (e.g. not enabled on the Supabase project).
 */
export async function ensureAnonymousSession(): Promise<User | null> {
  if (!supabase) return null;

  // Try Supabase anonymous auth
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (!error && data?.user) return data.user;

  // Fall back to localStorage UUID — works as long as RLS policies allow it
  const localId = getOrCreateLocalPlayerId();
  return { id: localId } as User;
}

/**
 * Get the current player's ID for leaderboard submission.
 */
export async function getAuthPlayerId(): Promise<string | null> {
  const user = await ensureAnonymousSession();
  return user?.id ?? null;
}

const PLAYER_NAME_KEY = 'ballknowledge_player_name';

export function getStoredPlayerName(): string | null {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY);
  } catch {
    return null;
  }
}

export function setStoredPlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // localStorage may be unavailable (private browsing)
  }
}
