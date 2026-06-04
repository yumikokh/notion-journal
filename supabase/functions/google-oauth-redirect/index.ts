// Bridges Google's HTTPS-only OAuth redirect to the app's custom scheme.
// Google "Web application" clients reject custom schemes in
// redirect_uri, so we register this function as the redirect target and
// it 302s to `notion-journal://google-oauth?...` where
// `WebBrowser.openAuthSessionAsync` is listening.
//
// Why a hard 302 instead of meta-refresh/JS: iOS's
// ASWebAuthenticationSession only intercepts custom-scheme navigations
// that come from real HTTP redirects (or a user tap). Script-driven
// navigations to a custom scheme are silently dropped, which leaves
// the user stranded on a blank page.

const APP_SCHEME = 'notion-journal://google-oauth';

Deno.serve((req) => {
  const url = new URL(req.url);
  const out = new URL(APP_SCHEME);
  // Forward `code`, `state`, `error` verbatim. Anything else (scope,
  // authuser, …) is dropped — the client only needs these three.
  for (const key of ['code', 'state', 'error']) {
    const v = url.searchParams.get(key);
    if (v) out.searchParams.set(key, v);
  }

  const target = out.toString();
  // Fallback link in case the user lands here via a context that
  // suppresses the 302 (e.g. opened in a non-auth-session browser).
  const escaped = target.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const fallback = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Nikki</title>
<body style="font:16px -apple-system,sans-serif;padding:24px;text-align:center">
<p>Nikki に戻ります…</p>
<p><a href="${escaped}" style="color:#208AEF">戻らない場合はこちらをタップ</a></p>
</body></html>`;

  return new Response(fallback, {
    status: 302,
    headers: {
      Location: target,
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
});
