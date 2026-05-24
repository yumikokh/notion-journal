// GET all 2026/Daily entries for a given month (YYYY-MM).
// Returns: { entries: MonthEntry[] }
//
// Used by the Calendar screen to render per-day feeling chips. We return
// just the visual surface the calendar needs: feeling name + Notion select
// color + the page icon. Body & other properties are loaded per-day by
// `notion-today-get` when the user opens a day.

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const NOTION_DATA_SOURCE_ID =
  Deno.env.get('NOTION_DB_ID') ?? '9d854c37-a54c-835f-b449-876db44cf666';

type NotionPage = {
  id: string;
  icon?: NotionIcon | null;
  properties?: Record<string, unknown>;
};

type NotionIcon =
  | { type: 'emoji'; emoji: string }
  | { type: 'external'; external: { url: string } }
  | { type: 'file'; file: { url: string } };

type QueryResponse = {
  results?: NotionPage[];
  has_more?: boolean;
  next_cursor?: string;
};

type MonthEntryIcon =
  | { type: 'emoji'; emoji: string }
  | { type: 'external'; url: string };

type MonthEntry = {
  pageId: string;
  date: string;
  feeling: string | null;
  feelingColor: string | null;
  icon: MonthEntryIcon | null;
};

function normalizeIcon(icon: NotionIcon | null | undefined): MonthEntryIcon | null {
  if (!icon) return null;
  if (icon.type === 'emoji') return { type: 'emoji', emoji: icon.emoji };
  if (icon.type === 'external') return { type: 'external', url: icon.external.url };
  if (icon.type === 'file') return { type: 'external', url: icon.file.url };
  return null;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const body = (await req.json().catch(() => null)) as { yearMonth?: string } | null;
  if (!body?.yearMonth || !/^\d{4}-\d{2}$/.test(body.yearMonth)) {
    return json({ error: 'yearMonth (YYYY-MM) is required' }, 400);
  }

  const [year, month] = body.yearMonth.split('-').map(Number);
  const firstDay = `${body.yearMonth}-01`;
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const notion = new NotionClient(NOTION_TOKEN);

  try {
    const entries: MonthEntry[] = [];
    let cursor: string | undefined;

    do {
      const query: QueryResponse = await notion.queryDataSource(
        NOTION_DATA_SOURCE_ID,
        {
          and: [
            { property: 'Date', date: { on_or_after: firstDay } },
            { property: 'Date', date: { before: nextMonth } },
          ],
        },
        { pageSize: 100, startCursor: cursor },
      );

      for (const page of query.results ?? []) {
        const props = (page.properties ?? {}) as Record<string, unknown>;
        const dateProp = props.Date as { date?: { start?: string } } | undefined;
        const feelingProp = props.Feeling as
          | { select?: { name?: string; color?: string } | null }
          | undefined;
        const date = dateProp?.date?.start;
        if (!date) continue;
        entries.push({
          pageId: page.id,
          date,
          feeling: feelingProp?.select?.name ?? null,
          feelingColor: feelingProp?.select?.color ?? null,
          icon: normalizeIcon(page.icon ?? null),
        });
      }

      cursor = query.has_more ? query.next_cursor : undefined;
    } while (cursor);

    return json({ entries });
  } catch (err) {
    if (err instanceof NotionError) {
      const status = err.status === 401 || err.status === 404 ? err.status : 502;
      return json({ error: err.message }, status);
    }
    return json({ error: String(err) }, 500);
  }
});
