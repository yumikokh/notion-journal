/**
 * Expo replaces `process.env.EXPO_PUBLIC_*` at bundle time. Values are
 * read lazily so a missing env produces a clear runtime error rather
 * than crashing the bundle entry.
 */

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase env not set. Copy .env.example → .env.local, fill in the values, then restart Metro.',
    );
  }
  return { url, anonKey };
}

export function isSupabaseEnvConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  );
}
