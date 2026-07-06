// Append one timestamped log line to today's Notion 2026/Daily page body.
//
// Backs the きょう (Today) tab's quick-capture bar: the client sends short
// text fragments through the day and the daily page body accumulates them
// as `**HH:MM** text` paragraphs. The page is found by Date (created when
// missing), and the append is a targeted `update_content` anchored on the
// current last line so non-text blocks elsewhere in the body survive.
//
// Request shape:
//   { date: "YYYY-MM-DD", timeLabel: "HH:MM", text: string }
// Response:
//   { notionPageId: string, bodyMarkdown: string }  // body after append

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const NOTION_DATA_SOURCE_ID =
  Deno.env.get('NOTION_DB_ID') ?? '9d854c37-a54c-835f-b449-876db44cf666';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type AppendRequest = {
  date: string;
  /** Client-local time label — the server has no idea of the user's TZ. */
  timeLabel: string;
  text: string;
};

type QueryResponse = { results?: { id: string }[] };
type PageResponse = { id: string };

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const body = (await req.json().catch(() => null)) as AppendRequest | null;
  if (
    !body ||
    typeof body.date !== 'string' ||
    typeof body.timeLabel !== 'string' ||
    typeof body.text !== 'string' ||
    body.text.trim().length === 0
  ) {
    return json({ error: 'invalid payload (date, timeLabel, text required)' }, 400);
  }

  const notion = new NotionClient(NOTION_TOKEN);
  const logLine = `**${body.timeLabel}** ${body.text.trim()}`;

  try {
    // Find (or create) the daily page for the date.
    const query = await notion.queryDataSource<QueryResponse>(NOTION_DATA_SOURCE_ID, {
      property: 'Date',
      date: { equals: body.date },
    });
    let pageId = query.results?.[0]?.id ?? null;
    let current = '';

    if (!pageId) {
      const created = await notion.createPage<PageResponse>(NOTION_DATA_SOURCE_ID, {
        Title: { title: [{ text: { content: `@${formatTitleDate(body.date)}` } }] },
        Date: { date: { start: body.date } },
      });
      pageId = created.id;
    } else {
      const md = await notion.getPageMarkdown(pageId);
      current = md.markdown ?? '';
    }

    const trimmed = current.replace(/\s+$/, '');
    const next = trimmed.length > 0 ? `${trimmed}\n\n${logLine}` : logLine;

    if (trimmed.length === 0) {
      // Empty (or brand-new) body — nothing to anchor on.
      await notion.replacePageMarkdown(pageId, next);
    } else {
      // Anchor the append on the current last line so update_content only
      // needs to match the tail, leaving earlier non-text blocks intact.
      const lines = trimmed.split('\n');
      const anchor = lines[lines.length - 1];
      try {
        await notion.updatePageMarkdown(pageId, anchor, `${anchor}\n\n${logLine}`);
      } catch (err) {
        // Anchor didn't match (markdown normalisation drift) — fall back
        // to a full replace so the log is never lost.
        if (err instanceof NotionError && err.status === 400) {
          await notion.replacePageMarkdown(pageId, next);
        } else {
          throw err;
        }
      }
    }

    return json({ notionPageId: pageId, bodyMarkdown: next });
  } catch (err) {
    if (err instanceof NotionError) {
      const status = err.status === 401 || err.status === 404 ? err.status : 502;
      return json({ error: err.message }, status);
    }
    return json({ error: String(err) }, 500);
  }
});

function formatTitleDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return date;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
