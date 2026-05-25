// Remove the cover image from a Notion page.
//
// Mirrors `notion-cover-upload` but PATCHes `cover: null` instead of
// running the file upload dance. Used by the day drawer's trash button
// when the user wants to clear a previously-saved cover.

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');

type Req = {
  notionPageId?: string;
};

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const body = (await req.json().catch(() => null)) as Req | null;
  if (!body?.notionPageId) {
    return json({ error: 'notionPageId is required' }, 400);
  }

  const notion = new NotionClient(NOTION_TOKEN);

  try {
    await notion.setPageCover(body.notionPageId, null);
    return json({ ok: true });
  } catch (err) {
    if (err instanceof NotionError) {
      const status = err.status === 401 || err.status === 404 ? err.status : 502;
      return json({ error: err.message }, status);
    }
    return json({ error: String(err) }, 500);
  }
});
