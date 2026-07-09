// Thin Notion REST client used by Edge Functions.
// The Notion access token lives only in the Supabase secret store and
// is never exposed to the device.
//
// Uses Notion API `2026-03-11`, which exposes first-class Markdown
// endpoints for reading and updating page body content:
//   GET   /v1/pages/{id}/markdown   → returns `{ markdown: "…" }`
//   PATCH /v1/pages/{id}/markdown   → replace / insert / search-replace
//
// Database queries go through data sources (introduced in 2025-09-03):
//   POST  /v1/data_sources/{id}/query
//
// Pages are created with a `parent` that references a data source.

const NOTION_VERSION = '2026-03-11';
const NOTION_BASE = 'https://api.notion.com/v1';

export class NotionError extends Error {
  constructor(
    public op: string,
    public detail: string,
    public status: number,
  ) {
    super(`Notion ${op} failed (${status}): ${detail}`);
  }
}

export class NotionClient {
  constructor(private token: string) {}

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Notion-Version': NOTION_VERSION,
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  private async request<T>(op: string, url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new NotionError(op, await res.text(), res.status);
    }
    return (await res.json()) as T;
  }

  /** Query a data source (the 2025-09-03 replacement for `/databases/{id}/query`). */
  queryDataSource<T = unknown>(
    dataSourceId: string,
    filter: unknown,
    options: { pageSize?: number; startCursor?: string; sorts?: unknown[] } = {},
  ): Promise<T> {
    const body: Record<string, unknown> = {
      filter,
      page_size: options.pageSize ?? 1,
    };
    if (options.startCursor) body.start_cursor = options.startCursor;
    if (options.sorts) body.sorts = options.sorts;
    return this.request(
      'query data source',
      `${NOTION_BASE}/data_sources/${dataSourceId}/query`,
      {
        method: 'POST',
        headers: this.headers(true),
        body: JSON.stringify(body),
      },
    );
  }

  /** Create a page in a data source (2025-09-03 parent format). */
  createPage<T = unknown>(
    dataSourceId: string,
    properties: Record<string, unknown>,
  ): Promise<T> {
    return this.request('create page', `${NOTION_BASE}/pages`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({
        parent: { type: 'data_source_id', data_source_id: dataSourceId },
        properties,
      }),
    });
  }

  updatePageProperties<T = unknown>(
    pageId: string,
    properties: Record<string, unknown>,
  ): Promise<T> {
    return this.request('update page', `${NOTION_BASE}/pages/${pageId}`, {
      method: 'PATCH',
      headers: this.headers(true),
      body: JSON.stringify({ properties }),
    });
  }

  /** Create a Notion file_upload session for a single-part upload (<=20MB). */
  createFileUpload(): Promise<{ id: string; upload_url: string; status: string }> {
    return this.request('create file upload', `${NOTION_BASE}/file_uploads`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ mode: 'single_part' }),
    });
  }

  /** Send raw bytes to a Notion file upload session URL (multipart form-data). */
  async sendFileUpload(
    uploadUrl: string,
    fileBytes: Uint8Array,
    filename: string,
    mimeType: string,
  ): Promise<{ id: string; status: string }> {
    const blob = new Blob([fileBytes], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, filename);
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Notion-Version': '2026-03-11',
      },
      body: formData,
    });
    if (!res.ok) {
      throw new NotionError('upload file bytes', await res.text(), res.status);
    }
    return res.json();
  }

  /** PATCH a page's cover image. Pass `null` to remove the cover. */
  setPageCover<T = unknown>(pageId: string, fileUploadId: string | null): Promise<T> {
    return this.request('set page cover', `${NOTION_BASE}/pages/${pageId}`, {
      method: 'PATCH',
      headers: this.headers(true),
      body: JSON.stringify({
        cover: fileUploadId
          ? { type: 'file_upload', file_upload: { id: fileUploadId } }
          : null,
      }),
    });
  }

  /** GET /v1/pages/{id}/markdown → returns the page body as enhanced markdown. */
  getPageMarkdown(
    pageId: string,
  ): Promise<{ markdown: string; truncated?: boolean }> {
    return this.request(
      'get page markdown',
      `${NOTION_BASE}/pages/${pageId}/markdown`,
      { headers: this.headers() },
    );
  }

  /**
   * Replace the entire page body with the supplied markdown.
   * Uses `type: "replace_content"` per Notion 2026-03-11.
   *
   * Warning: lossy for non-text blocks (image, embed, …). Prefer
   * `updatePageMarkdown` for edits of existing pages so non-text blocks
   * survive.
   */
  replacePageMarkdown<T = unknown>(pageId: string, markdown: string): Promise<T> {
    return this.request(
      'replace page markdown',
      `${NOTION_BASE}/pages/${pageId}/markdown`,
      {
        method: 'PATCH',
        headers: this.headers(true),
        body: JSON.stringify({
          type: 'replace_content',
          replace_content: { new_str: markdown },
        }),
      },
    );
  }

  /**
   * Targeted body update: find `oldStr` in the page markdown and replace
   * it with `newStr`. Non-text blocks (images, embeds, callouts, …)
   * outside the matched range stay intact, which is why we prefer this
   * over `replace_content` whenever we have the previously-loaded body
   * to diff against.
   */
  updatePageMarkdown<T = unknown>(
    pageId: string,
    oldStr: string,
    newStr: string,
  ): Promise<T> {
    return this.request(
      'update page markdown',
      `${NOTION_BASE}/pages/${pageId}/markdown`,
      {
        method: 'PATCH',
        headers: this.headers(true),
        body: JSON.stringify({
          type: 'update_content',
          update_content: {
            content_updates: [{ old_str: oldStr, new_str: newStr }],
          },
        }),
      },
    );
  }
}
