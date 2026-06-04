// Returns whether a Google refresh token is stored. Used by the Settings
// screen to show the connection state without revealing token bytes.

import { handleOptions, json } from '../_shared/cors.ts';
import { getStoredOAuth, OAuthStoreError } from '../_shared/google.ts';

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  // Allow both GET and POST so the Supabase JS client (which always uses POST)
  // and curl/GET probes both work.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const row = await getStoredOAuth();
    if (!row) return json({ connected: false });
    return json({
      connected: true,
      scope: row.scope,
      connectedAt: row.connected_at,
    });
  } catch (err) {
    if (err instanceof OAuthStoreError) return json({ error: err.message }, 500);
    return json({ error: String(err) }, 500);
  }
});
