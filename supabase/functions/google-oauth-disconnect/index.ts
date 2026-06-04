// Removes the stored Google refresh token and best-effort revokes it
// upstream. Always succeeds locally so the UI can reflect disconnect
// even if Google's revoke endpoint is unreachable.

import { handleOptions, json } from '../_shared/cors.ts';
import {
  deleteStoredOAuth,
  getStoredOAuth,
  OAuthStoreError,
  revokeRefreshToken,
} from '../_shared/google.ts';

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const row = await getStoredOAuth();
    if (row) await revokeRefreshToken(row.refresh_token);
    await deleteStoredOAuth();
    return json({ ok: true });
  } catch (err) {
    if (err instanceof OAuthStoreError) return json({ error: err.message }, 500);
    return json({ error: String(err) }, 500);
  }
});
