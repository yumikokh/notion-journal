// Returns Google Calendar events in a time range. Refreshes the
// access_token on every call using the stored refresh_token — the
// personal-use app calls this rarely (weekly analysis only) so caching
// the access_token isn't worth the storage round-trip.

import { handleOptions, json } from '../_shared/cors.ts';
import {
  GoogleError,
  OAuthStoreError,
  getStoredOAuth,
  listCalendarEvents,
  readGoogleEnv,
  refreshAccessToken,
} from '../_shared/google.ts';

type Body = {
  timeMin?: string;
  timeMax?: string;
  calendarId?: string;
};

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const env = readGoogleEnv();
  if (!env) {
    return json({ error: 'GOOGLE_OAUTH_CLIENT_ID/SECRET not set' }, 500);
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.timeMin || !body.timeMax) {
    return json({ error: 'timeMin and timeMax (ISO 8601) are required' }, 400);
  }
  const calendarId = body.calendarId ?? 'primary';

  try {
    const row = await getStoredOAuth();
    if (!row) return json({ error: 'Google Calendar is not connected' }, 401);

    const { accessToken } = await refreshAccessToken({
      env,
      refreshToken: row.refresh_token,
    });
    const events = await listCalendarEvents({
      accessToken,
      calendarId,
      timeMin: body.timeMin,
      timeMax: body.timeMax,
    });
    return json({ events });
  } catch (err) {
    if (err instanceof GoogleError) {
      // 401 from Google means the refresh token is no longer valid
      // (revoked from the user's Google account, scope dropped, …).
      const status = err.status === 401 ? 401 : 502;
      return json({ error: err.message }, status);
    }
    if (err instanceof OAuthStoreError) return json({ error: err.message }, 500);
    return json({ error: String(err) }, 500);
  }
});
