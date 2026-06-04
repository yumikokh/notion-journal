// Exchange a Google OAuth 2.0 authorization code (PKCE) for tokens and
// persist the refresh_token in `public.google_oauth`. The access_token
// is discarded — `google-calendar-list` refreshes on demand.

import { handleOptions, json } from '../_shared/cors.ts';
import {
  exchangeAuthorizationCode,
  GoogleError,
  OAuthStoreError,
  readGoogleEnv,
  upsertStoredOAuth,
} from '../_shared/google.ts';

type Body = {
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
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
  if (!body?.code || !body.codeVerifier || !body.redirectUri) {
    return json(
      { error: 'code, codeVerifier, redirectUri are required' },
      400,
    );
  }

  try {
    const tokens = await exchangeAuthorizationCode({
      env,
      code: body.code,
      codeVerifier: body.codeVerifier,
      redirectUri: body.redirectUri,
    });
    await upsertStoredOAuth({
      refreshToken: tokens.refreshToken,
      scope: tokens.scope,
    });
    return json({ ok: true, scope: tokens.scope });
  } catch (err) {
    if (err instanceof GoogleError) return json({ error: err.message }, err.status);
    if (err instanceof OAuthStoreError) return json({ error: err.message }, 500);
    return json({ error: String(err) }, 500);
  }
});
