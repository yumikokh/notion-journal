// Create or update a weekly reflection in the Notion "↩️ Reflection DB".
//
// Request shape:
//   {
//     notionPageId: string | null,   // null → create a new Weekly page
//     date: "YYYY-MM-DD",            // week anchor (Sunday); set as Date on create
//     name?: string,                 // page title on create (e.g. "5/26 - 6/1")
//     properties: { ... },           // reflection rich_text fields
//     bodyMarkdown?: string,         // optional: replace the page body (AI analysis, #16)
//   }
//
// Behaviour:
//   - On create: Name (from `name`, falling back to the date), Date, and
//     Type = "Weekly" are set alongside the supplied reflection properties.
//   - On update: only the supplied `properties` are touched — Name/Date/Type
//     are left as the user set them.
//   - When `bodyMarkdown` is present, the page body is replaced with it after
//     the property write. Used to persist the full AI weekly analysis (#16);
//     omitted by the plain reflection save, which has no body.

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const REFLECTION_DATA_SOURCE_ID =
  Deno.env.get('NOTION_REFLECTION_DB_ID') ?? '13954c37-a54c-81dd-99a8-000be2d63f12';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type SaveRequest = {
  notionPageId: string | null;
  date: string;
  name?: string;
  properties: Record<string, unknown>;
  bodyMarkdown?: string;
};

type PageResponse = { id: string };

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const body = (await req.json().catch(() => null)) as SaveRequest | null;
  if (!body || typeof body.date !== 'string' || !DATE_RE.test(body.date)) {
    return json({ error: 'invalid payload (date YYYY-MM-DD required)' }, 400);
  }
  if (body.properties == null || typeof body.properties !== 'object') {
    return json({ error: 'properties is required' }, 400);
  }

  const notion = new NotionClient(NOTION_TOKEN);

  try {
    let pageId = body.notionPageId;

    if (!pageId) {
      // CREATE: identity (Name + Date + Type) plus the reflection fields.
      const title = body.name?.trim() || body.date;
      const props: Record<string, unknown> = {
        ...body.properties,
        Name: { title: [{ text: { content: title } }] },
        Date: { date: { start: body.date } },
        Type: { select: { name: 'Weekly' } },
      };
      const created = await notion.createPage<PageResponse>(REFLECTION_DATA_SOURCE_ID, props);
      pageId = created.id;
    } else {
      // UPDATE: reflection fields only; leave Name/Date/Type untouched.
      await notion.updatePageProperties(pageId, body.properties);
    }

    // Optionally replace the page body with the supplied markdown (#16).
    // `replace_content` is fine here: the body is a regenerated AI analysis,
    // so there are no hand-authored non-text blocks to preserve.
    if (typeof body.bodyMarkdown === 'string') {
      await notion.replacePageMarkdown(pageId, body.bodyMarkdown);
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
