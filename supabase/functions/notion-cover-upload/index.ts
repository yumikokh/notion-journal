// Upload a photo as the cover image of today's Notion page.
//
// The app sends the photo as base64 + mime type; this function:
//   1. Creates a Notion file_upload session
//   2. POSTs the bytes to the session's upload_url (multipart form-data)
//   3. PATCHes the page's `cover` to reference the uploaded file
//
// On success the Notion page's cover image is set / replaced.

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');

type Req = {
  notionPageId?: string;
  base64?: string;
  mimeType?: string;
  filename?: string;
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);

  const body = (await req.json().catch(() => null)) as Req | null;
  if (!body?.notionPageId || !body?.base64 || !body?.mimeType) {
    return json({ error: 'notionPageId, base64, mimeType are required' }, 400);
  }

  const notion = new NotionClient(NOTION_TOKEN);
  const filename = body.filename ?? `cover-${Date.now()}.jpg`;

  try {
    const bytes = base64ToBytes(body.base64);
    const session = await notion.createFileUpload();
    const uploaded = await notion.sendFileUpload(
      session.upload_url,
      bytes,
      filename,
      body.mimeType,
    );
    await notion.setPageCover(body.notionPageId, uploaded.id);
    return json({ fileUploadId: uploaded.id });
  } catch (err) {
    if (err instanceof NotionError) {
      const status = err.status === 401 || err.status === 404 ? err.status : 502;
      return json({ error: err.message }, status);
    }
    return json({ error: String(err) }, 500);
  }
});
