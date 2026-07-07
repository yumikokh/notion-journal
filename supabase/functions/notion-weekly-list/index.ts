// List the dates of all saved weekly reflections in the Notion
// "↩️ Reflection DB" (Type = Weekly).
// Returns: { dates: string[] } — each entry is the page's Date property
// (YYYY-MM-DD; any day inside its week — the client normalizes to the
// week's Monday).
//
// Used by the app's week picker to mark which weeks already have a saved
// reflection, without issuing one notion-weekly-get per week.

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const REFLECTION_DATA_SOURCE_ID =
  Deno.env.get('NOTION_REFLECTION_DB_ID') ?? '13954c37-a54c-81dd-99a8-000be2d63f12';

type PageResult = { properties?: { Date?: { date?: { start?: string } } } };
type QueryResponse = {
  results?: PageResult[];
  has_more?: boolean;
  next_cursor?: string | null;
};

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const notion = new NotionClient(NOTION_TOKEN);

  try {
    const dates: string[] = [];
    let cursor: string | undefined;
    // Page cap as a runaway guard — 10 × 100 weeklies ≈ 19 years of history.
    for (let i = 0; i < 10; i++) {
      const query = await notion.queryDataSource<QueryResponse>(
        REFLECTION_DATA_SOURCE_ID,
        { property: 'Type', select: { equals: 'Weekly' } },
        { pageSize: 100, startCursor: cursor },
      );
      for (const page of query.results ?? []) {
        const start = page.properties?.Date?.date?.start;
        if (start) dates.push(start.slice(0, 10));
      }
      if (!query.has_more || !query.next_cursor) break;
      cursor = query.next_cursor;
    }
    return json({ dates });
  } catch (err) {
    if (err instanceof NotionError) {
      const status = err.status === 401 || err.status === 404 ? err.status : 502;
      return json({ error: err.message }, status);
    }
    return json({ error: String(err) }, 500);
  }
});
