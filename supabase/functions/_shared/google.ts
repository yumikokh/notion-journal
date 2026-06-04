// Google OAuth 2.0 + Calendar API helpers used by Edge Functions.
// The personal-use Calendar integration stores a single refresh token
// in `public.google_oauth` (one row) and exchanges it for short-lived
// access tokens on demand.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

export class GoogleError extends Error {
  constructor(
    public op: string,
    public detail: string,
    public status: number,
  ) {
    super(`Google ${op} failed (${status}): ${detail}`);
  }
}

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
};

export type GoogleEnv = { clientId: string; clientSecret: string };

export function readGoogleEnv(): GoogleEnv | null {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function postForm(
  url: string,
  params: Record<string, string>,
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
}

export async function exchangeAuthorizationCode(args: {
  env: GoogleEnv;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const res = await postForm(TOKEN_URL, {
    grant_type: 'authorization_code',
    code: args.code,
    code_verifier: args.codeVerifier,
    redirect_uri: args.redirectUri,
    client_id: args.env.clientId,
    client_secret: args.env.clientSecret,
  });
  if (!res.ok) throw new GoogleError('token exchange', await res.text(), res.status);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
  if (!data.refresh_token) {
    // Without `prompt=consent&access_type=offline`, Google omits the
    // refresh_token on the second-and-later consent. Surface this
    // explicitly so the client knows to re-prompt.
    throw new GoogleError(
      'token exchange',
      'response missing refresh_token; ensure prompt=consent&access_type=offline',
      400,
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  };
}

export async function refreshAccessToken(args: {
  env: GoogleEnv;
  refreshToken: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await postForm(TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: args.refreshToken,
    client_id: args.env.clientId,
    client_secret: args.env.clientSecret,
  });
  if (!res.ok) throw new GoogleError('token refresh', await res.text(), res.status);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/** Best-effort: revoke errors are swallowed so disconnect always succeeds locally. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    await postForm(REVOKE_URL, { token: refreshToken });
  } catch {
    // ignore
  }
}

export type CalendarEvent = {
  start: string;
  end: string;
  summary: string;
  description?: string;
  calendarId: string;
};

type RawEvent = {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  summary?: string;
  description?: string;
  status?: string;
};

/** Maps a Google Calendar event payload to the app's flat shape. */
export function mapCalendarEvent(item: RawEvent, calendarId: string): CalendarEvent | null {
  if (item.status === 'cancelled') return null;
  const start = item.start?.dateTime ?? item.start?.date;
  const end = item.end?.dateTime ?? item.end?.date;
  if (!start || !end) return null;
  return {
    start,
    end,
    summary: item.summary ?? '',
    description: item.description,
    calendarId,
  };
}

export async function listCalendarEvents(args: {
  accessToken: string;
  calendarId: string;
  /** ISO 8601 inclusive lower bound */
  timeMin: string;
  /** ISO 8601 exclusive upper bound */
  timeMax: string;
}): Promise<CalendarEvent[]> {
  const url = new URL(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(args.calendarId)}/events`,
  );
  url.searchParams.set('timeMin', args.timeMin);
  url.searchParams.set('timeMax', args.timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '2500');

  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    else url.searchParams.delete('pageToken');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${args.accessToken}` },
    });
    if (!res.ok) throw new GoogleError('events.list', await res.text(), res.status);
    const data = (await res.json()) as {
      items?: RawEvent[];
      nextPageToken?: string;
    };
    for (const item of data.items ?? []) {
      const mapped = mapCalendarEvent(item, args.calendarId);
      if (mapped) events.push(mapped);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return events;
}

// --- Single-row token store backed by `public.google_oauth` -------------

export type OAuthRow = {
  refresh_token: string;
  scope: string;
  connected_at: string;
};

function readSupabaseAdminEnv(): { url: string; serviceRoleKey: string } {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  }
  return { url, serviceRoleKey };
}

function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const { serviceRoleKey } = readSupabaseAdminEnv();
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export class OAuthStoreError extends Error {
  constructor(op: string, status: number, detail: string) {
    super(`google_oauth ${op} failed (${status}): ${detail}`);
  }
}

export async function getStoredOAuth(): Promise<OAuthRow | null> {
  const { url } = readSupabaseAdminEnv();
  const res = await fetch(`${url}/rest/v1/google_oauth?id=eq.1&select=*`, {
    headers: adminHeaders(),
  });
  if (!res.ok) throw new OAuthStoreError('select', res.status, await res.text());
  const rows = (await res.json()) as OAuthRow[];
  return rows[0] ?? null;
}

export async function upsertStoredOAuth(input: {
  refreshToken: string;
  scope: string;
}): Promise<void> {
  const { url } = readSupabaseAdminEnv();
  const res = await fetch(`${url}/rest/v1/google_oauth`, {
    method: 'POST',
    headers: adminHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({
      id: 1,
      refresh_token: input.refreshToken,
      scope: input.scope,
      connected_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new OAuthStoreError('upsert', res.status, await res.text());
}

export async function deleteStoredOAuth(): Promise<void> {
  const { url } = readSupabaseAdminEnv();
  const res = await fetch(`${url}/rest/v1/google_oauth?id=eq.1`, {
    method: 'DELETE',
    headers: adminHeaders({ Prefer: 'return=minimal' }),
  });
  if (!res.ok && res.status !== 404) {
    throw new OAuthStoreError('delete', res.status, await res.text());
  }
}
