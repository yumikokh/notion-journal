// Diagnostic Edge Function: lists everything the NOTION_TOKEN
// integration can see. Use to verify whether a given database has been
// successfully shared with the integration.
//
// Returns: { integration: { name, id, ... }, accessible: [...] }
//
// Safe to keep deployed: read-only, requires the anon-key auth like
// the other functions.

import { handleOptions, json } from '../_shared/cors.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const NOTION_VERSION = '2025-09-03';
const NOTION_BASE = 'https://api.notion.com/v1';

type NotionRichText = { plain_text?: string };

function extractTitle(obj: Record<string, unknown>): string {
  const titleArr = obj.title as NotionRichText[] | undefined;
  if (Array.isArray(titleArr)) {
    return titleArr.map((t) => t.plain_text ?? '').join('');
  }
  const props = obj.properties as Record<string, unknown> | undefined;
  if (props) {
    for (const v of Object.values(props)) {
      const p = v as { type?: string; title?: NotionRichText[] };
      if (p?.type === 'title' && Array.isArray(p.title)) {
        return p.title.map((t) => t.plain_text ?? '').join('');
      }
    }
  }
  return '(no title)';
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const headers = {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Integration identity
    const meRes = await fetch(`${NOTION_BASE}/users/me`, { headers });
    const me = await meRes.json();

    // 2. List everything the integration can see (top 50)
    const searchRes = await fetch(`${NOTION_BASE}/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ page_size: 50 }),
    });
    const search = await searchRes.json();

    const accessible = (search.results ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      object: r.object,
      title: extractTitle(r),
      url: r.url,
    }));

    return json({
      integration: {
        name: me?.name ?? me?.bot?.owner?.user?.name,
        id: me?.id,
        bot: me?.bot,
      },
      accessibleCount: accessible.length,
      accessible,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
