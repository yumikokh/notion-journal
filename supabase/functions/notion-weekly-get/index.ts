// GET a weekly reflection from the Notion "↩️ Reflection DB" for a week.
// Returns: { page: NotionPage | null }
//
// The Reflection DB (a data source) holds KPT-style retrospectives shared
// by Weekly and Monthly entries via its `Type` select:
//   よかったこと / よくなかったこと / トライできること / 次の具体目標 (rich_text)
//   Type (select: Weekly | Monthly), Date (date), Name (title)
//
// A week's reflection is matched by Type = "Weekly" AND Date within the
// Monday→Sunday window, so it is found regardless of which day inside the
// week the page happens to be dated.
//
// 充電/放電ログは Daily 本文（Moment / 自由記述）の役割。Weekly は分析的な
// ふりかえりに専念するため、この関数は Reflection DB のみを読む。

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const REFLECTION_DATA_SOURCE_ID =
  Deno.env.get('NOTION_REFLECTION_DB_ID') ?? '13954c37-a54c-81dd-99a8-000be2d63f12';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type QueryResponse = { results?: { id: string }[] };

/** Day after `yyyyMmDd` (UTC), used as an exclusive upper Date bound. */
function nextDay(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const body = (await req.json().catch(() => null)) as
    | { weekStart?: string; weekEnd?: string }
    | null;
  if (!body?.weekStart || !DATE_RE.test(body.weekStart)) {
    return json({ error: 'weekStart (YYYY-MM-DD) is required' }, 400);
  }
  if (!body?.weekEnd || !DATE_RE.test(body.weekEnd)) {
    return json({ error: 'weekEnd (YYYY-MM-DD) is required' }, 400);
  }
  if (body.weekStart > body.weekEnd) {
    return json({ error: 'weekStart must be <= weekEnd' }, 400);
  }

  const notion = new NotionClient(NOTION_TOKEN);

  try {
    const query = await notion.queryDataSource<QueryResponse>(REFLECTION_DATA_SOURCE_ID, {
      and: [
        { property: 'Type', select: { equals: 'Weekly' } },
        { property: 'Date', date: { on_or_after: body.weekStart } },
        { property: 'Date', date: { before: nextDay(body.weekEnd) } },
      ],
    });
    const page = query.results?.[0] ?? null;
    return json({ page });
  } catch (err) {
    if (err instanceof NotionError) {
      const status = err.status === 401 || err.status === 404 ? err.status : 502;
      return json({ error: err.message }, status);
    }
    return json({ error: String(err) }, 500);
  }
});
