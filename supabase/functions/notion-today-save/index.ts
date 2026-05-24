// Create or update today's Notion 2026/Daily entry.
//
// Saves are split into two independent paths so the caller can update
// properties (feeling/diary/habits — auto-save on tap) without touching
// the page body, and update the body separately (manual save with
// conflict check on the client).
//
// Request shape:
//   {
//     notionPageId: string | null,   // null → create a new page
//     date: "YYYY-MM-DD",
//     properties?: { ... },          // if present, update properties
//     bodyMarkdown?: string,         // if present, replace body
//   }
//
// Behaviour:
//   - On create (notionPageId === null): Title + Date are always set;
//     properties merged in if provided; body set if provided.
//   - On update: only the supplied half is touched. Omitting `properties`
//     leaves them untouched. Omitting `bodyMarkdown` leaves body untouched.

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const NOTION_DATA_SOURCE_ID =
  Deno.env.get('NOTION_DB_ID') ?? '9d854c37-a54c-835f-b449-876db44cf666';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type SaveRequest = {
  notionPageId: string | null;
  date: string;
  properties?: Record<string, unknown>;
  /** New body markdown. Omit to skip body changes entirely. */
  bodyMarkdown?: string;
  /**
   * Body markdown as last loaded from Notion. When present alongside
   * `bodyMarkdown`, we use Notion's `update_content` (targeted
   * search-and-replace) so non-text blocks (images, embeds, …) outside
   * the user's edit survive. Omit (or pass empty) on first save / new
   * pages — we fall back to `replace_content` in that case.
   */
  lastSyncedBody?: string;
};

type PageResponse = { id: string };

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const body = (await req.json().catch(() => null)) as SaveRequest | null;
  if (!body || typeof body.date !== 'string') {
    return json({ error: 'invalid payload (date required)' }, 400);
  }

  const notion = new NotionClient(NOTION_TOKEN);

  try {
    let pageId = body.notionPageId;

    if (!pageId) {
      // CREATE: always set identity (Title + Date), plus any caller props.
      const props = {
        ...(body.properties ?? {}),
        Title: { title: [{ text: { content: `@${formatTitleDate(body.date)}` } }] },
        Date: { date: { start: body.date } },
      };
      const created = await notion.createPage<PageResponse>(NOTION_DATA_SOURCE_ID, props);
      pageId = created.id;
    } else if (body.properties !== undefined) {
      // UPDATE PROPERTIES: only the caller-provided fields, leave Title/Date alone.
      await notion.updatePageProperties(pageId, body.properties);
    }

    if (body.bodyMarkdown !== undefined && pageId) {
      const lastSynced = body.lastSyncedBody ?? '';
      if (lastSynced.length > 0 && lastSynced !== body.bodyMarkdown) {
        // Line-level diff: shrink to the smallest changed span.
        // Lines the user didn't touch (incl. image lines with expiring
        // signed URLs) are excluded from `old_str`, so Notion's
        // `update_content` doesn't need them to match against the live
        // page markdown.
        const diff = shrinkDiff(lastSynced, body.bodyMarkdown);
        if (diff) {
          try {
            await notion.updatePageMarkdown(pageId, diff.oldStr, diff.newStr);
          } catch (err) {
            // Last-resort fallback: if the targeted update still can't
            // match (normalisation drift, etc.), fall back to a full
            // replace. The body change saves; non-text blocks may be lost.
            if (err instanceof NotionError && err.status === 400) {
              await notion.replacePageMarkdown(pageId, body.bodyMarkdown);
            } else {
              throw err;
            }
          }
        }
      } else {
        // First save (empty previous body) or full overwrite.
        await notion.replacePageMarkdown(pageId, body.bodyMarkdown);
      }
    }

    return json({ notionPageId: pageId });
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

/**
 * Reduce a (old, new) text pair to the smallest changed span by stripping
 * the matching prefix and suffix. Returns `null` when there is no real
 * change. We keep at least one anchor line if the middle would otherwise
 * be empty (pure append / prepend), so `update_content` always has
 * something concrete to find.
 */
function shrinkDiff(
  oldText: string,
  newText: string,
): { oldStr: string; newStr: string } | null {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }
  // Provide an anchor line so we never end up with an empty `old_str`.
  const oldMidLen = oldLines.length - prefix - suffix;
  const newMidLen = newLines.length - prefix - suffix;
  if ((oldMidLen === 0 || newMidLen === 0) && prefix > 0) {
    prefix--;
  }
  const oldStr = oldLines.slice(prefix, oldLines.length - suffix).join('\n');
  const newStr = newLines.slice(prefix, newLines.length - suffix).join('\n');
  if (oldStr === newStr) return null;
  if (oldStr === '') return null; // can't update_content with empty pattern
  return { oldStr, newStr };
}
