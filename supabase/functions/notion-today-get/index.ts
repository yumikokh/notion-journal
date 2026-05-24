// GET today's Notion 2026/Daily entry by date (YYYY-MM-DD).
// Returns: { page: NotionPage | null, bodyMarkdown: string }
//
// `NOTION_DB_ID` env var holds a **data_source ID** (2025-09-03+ model).
// The page body is fetched via Notion's first-class markdown endpoint,
// not by walking children blocks.

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const NOTION_DATA_SOURCE_ID =
  Deno.env.get('NOTION_DB_ID') ?? '9d854c37-a54c-835f-b449-876db44cf666';

type QueryResponse = { results?: { id: string }[] };

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const body = (await req.json().catch(() => null)) as { date?: string } | null;
  if (!body?.date || typeof body.date !== 'string') {
    return json({ error: 'date (YYYY-MM-DD) is required' }, 400);
  }

  const notion = new NotionClient(NOTION_TOKEN);

  try {
    const query = await notion.queryDataSource<QueryResponse>(NOTION_DATA_SOURCE_ID, {
      property: 'Date',
      date: { equals: body.date },
    });
    const page = query.results?.[0] ?? null;

    let bodyMarkdown = '';
    if (page) {
      const md = await notion.getPageMarkdown(page.id);
      bodyMarkdown = md.markdown;
    }

    return json({ page, bodyMarkdown });
  } catch (err) {
    if (err instanceof NotionError) {
      const status = err.status === 401 || err.status === 404 ? err.status : 502;
      return json({ error: err.message }, status);
    }
    return json({ error: String(err) }, 500);
  }
});
