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

export function getGoogleOAuthClientId(): string {
  const id = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  if (!id) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID not set. Add it to .env.local then restart Metro.',
    );
  }
  return id;
}

/** Edge Function URL that bounces Google's redirect back to the app's custom scheme. */
export function getGoogleOAuthRedirectUri(): string {
  const { url } = getSupabaseEnv();
  return `${url.replace(/\/$/, '')}/functions/v1/google-oauth-redirect`;
}
