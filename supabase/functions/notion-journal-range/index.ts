// GET the date of the earliest 2026/Daily entry.
// Returns: { earliest: string | null } — YYYY-MM-DD, or null when the DB
// has no dated entries yet.
//
// Backs the app's week/month pickers: instead of an arbitrary rolling
// window (e.g. "the last 104 weeks"), their range starts at the first day
// the user actually journaled.

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const NOTION_DATA_SOURCE_ID =
  Deno.env.get('NOTION_DB_ID') ?? '9d854c37-a54c-835f-b449-876db44cf666';

type QueryResponse = {
  results?: { properties?: { Date?: { date?: { start?: string } } } }[];
};

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const notion = new NotionClient(NOTION_TOKEN);

  try {
    const query = await notion.queryDataSource<QueryResponse>(
      NOTION_DATA_SOURCE_ID,
      { property: 'Date', date: { is_not_empty: true } },
      { pageSize: 1, sorts: [{ property: 'Date', direction: 'ascending' }] },
    );
    const start = query.results?.[0]?.properties?.Date?.date?.start;
    return json({ earliest: start ? start.slice(0, 10) : null });
  } catch (err) {
    if (err instanceof NotionError) {
      const status = err.status === 401 || err.status === 404 ? err.status : 502;
      return json({ error: err.message }, status);
    }
    return json({ error: String(err) }, 500);
  }
});
