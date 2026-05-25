// Weekly AI analysis Edge Function.
// Aggregates 2026/Daily entries for a given week and asks Claude for a
// one-shot reflection: summary, patterns, KPT proposals, next-week focus.
//
// Input:  { weekStart: "YYYY-MM-DD", weekEnd: "YYYY-MM-DD" (inclusive) }
// Output: { analysis: WeeklyAnalysis, source: { dailyCount: number } }
//
// `weekEnd` is inclusive (a Sunday-anchored week passes Monday→Sunday).
// Calendar event input (#27/#29) is not wired up yet — that hook lands
// later as an additional context block before the daily summaries.

import { handleOptions, json } from '../_shared/cors.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const NOTION_DATA_SOURCE_ID =
  Deno.env.get('NOTION_DB_ID') ?? '9d854c37-a54c-835f-b449-876db44cf666';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `あなたは内省支援のコーチです。ユーザーの1週間分のジャーナルを読み、ワンショットで週次ふりかえりを返します。

## 出力フォーマット (厳守)

必ず以下の JSON のみを返してください。前置き・コードフェンス・説明文を一切含めないこと。

{
  "summary": "string (3〜5文。具体的な出来事と感情の流れを織り込む)",
  "patterns": ["string", ...],     // 3〜6項目。気付き・行動/感情のパターン
  "kpt": {
    "keep":    ["string", ...],    // 1〜4項目
    "problem": ["string", ...],    // 1〜4項目
    "try":     ["string", ...]     // 1〜4項目
  },
  "nextFocus": ["string", ...]     // 2〜4項目。来週フォーカスすべきテーマ
}

## 内容のルール

- 抽象的・汎用的なアドバイスではなく、ユーザーが書いた具体的な出来事・感情を引用すること
- KPT は「やめる/続ける/試す」が一目で分かる動詞で始める
- 出力は日本語。1項目あたり40〜80字を目安に簡潔に
- ジャーナルが薄い日は無理に膨らませず、観察できた範囲で正直に書く`;

type RichTextItem = { plain_text?: string };
type NotionPage = {
  id: string;
  properties?: Record<string, unknown>;
};
type QueryResponse = {
  results?: NotionPage[];
  has_more?: boolean;
  next_cursor?: string;
};

type DailyDigest = {
  date: string;
  feeling: string | null;
  diary: string;
  habits: string[]; // checked habit names only
  body: string; // page markdown, trimmed
};

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
};

type Req = { weekStart?: string; weekEnd?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function richTextToString(rt: RichTextItem[] | undefined): string {
  if (!rt || rt.length === 0) return '';
  return rt.map((r) => r.plain_text ?? '').join('');
}

function nextDay(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildPromptBody(weekStart: string, weekEnd: string, digests: DailyDigest[]): string {
  const header = `# 対象期間\n${weekStart} 〜 ${weekEnd}\n\n# デイリージャーナル (${digests.length}日分)\n`;
  if (digests.length === 0) {
    return `${header}\n(この週は記録がありません。観察できない旨を率直に伝え、来週に向けた問いを返してください)`;
  }
  const parts = digests.map((d) => {
    const lines: string[] = [`## ${d.date}`];
    if (d.feeling) lines.push(`- Feeling: ${d.feeling}`);
    if (d.habits.length > 0) lines.push(`- 習慣: ${d.habits.join(', ')}`);
    if (d.diary.trim().length > 0) lines.push(`- Diary: ${d.diary.trim()}`);
    if (d.body.trim().length > 0) lines.push(`\n${d.body.trim()}`);
    return lines.join('\n');
  });
  return `${header}\n${parts.join('\n\n---\n\n')}`;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!NOTION_TOKEN) return json({ error: 'NOTION_TOKEN env not set' }, 500);
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY env not set' }, 500);

  const body = (await req.json().catch(() => null)) as Req | null;
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
  const endExclusive = nextDay(body.weekEnd);

  try {
    // 1. Collect daily pages in the week.
    const pages: NotionPage[] = [];
    let cursor: string | undefined;
    do {
      const query: QueryResponse = await notion.queryDataSource(
        NOTION_DATA_SOURCE_ID,
        {
          and: [
            { property: 'Date', date: { on_or_after: body.weekStart } },
            { property: 'Date', date: { before: endExclusive } },
          ],
        },
        { pageSize: 100, startCursor: cursor },
      );
      pages.push(...(query.results ?? []));
      cursor = query.has_more ? query.next_cursor : undefined;
    } while (cursor);

    // 2. Fetch body markdown per page in parallel + reduce to digests.
    const digests: DailyDigest[] = await Promise.all(
      pages.map(async (page) => {
        const props = (page.properties ?? {}) as Record<string, unknown>;
        const dateProp = props.Date as { date?: { start?: string } } | undefined;
        const date = dateProp?.date?.start ?? '';
        const feelingProp = props.Feeling as
          | { select?: { name?: string } | null }
          | undefined;
        const diaryProp = props.Diary as { rich_text?: RichTextItem[] } | undefined;

        const habits: string[] = [];
        for (const [name, raw] of Object.entries(props)) {
          const prop = raw as { type?: string; checkbox?: boolean } | undefined;
          if (prop?.type === 'checkbox' && prop.checkbox === true) habits.push(name);
        }

        let bodyMarkdown = '';
        try {
          const md = await notion.getPageMarkdown(page.id);
          bodyMarkdown = md.markdown ?? '';
        } catch {
          // Body fetch is best-effort; the digest can still summarize from properties.
        }

        return {
          date,
          feeling: feelingProp?.select?.name ?? null,
          diary: richTextToString(diaryProp?.rich_text),
          habits,
          body: bodyMarkdown,
        };
      }),
    );

    digests.sort((a, b) => a.date.localeCompare(b.date));
    const promptBody = buildPromptBody(body.weekStart, body.weekEnd, digests);

    // 3. Call Claude with JSON-only system prompt.
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: promptBody }],
      }),
    });

    if (!res.ok) {
      return json({ error: `Claude API failed (${res.status})`, detail: await res.text() }, 502);
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const trimmed = text.trim();
    if (trimmed.length === 0) return json({ error: 'AI returned empty text' }, 502);

    let analysis: unknown;
    try {
      analysis = JSON.parse(trimmed);
    } catch {
      return json({ error: 'AI returned non-JSON output', detail: trimmed.slice(0, 500) }, 502);
    }

    if (!isWeeklyAnalysisShape(analysis)) {
      return json({ error: 'AI returned malformed JSON', detail: trimmed.slice(0, 500) }, 502);
    }

    return json({ analysis, source: { dailyCount: digests.length } });
  } catch (err) {
    if (err instanceof NotionError) {
      const status = err.status === 401 || err.status === 404 ? err.status : 502;
      return json({ error: err.message }, status);
    }
    return json({ error: String(err) }, 500);
  }
});

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isWeeklyAnalysisShape(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.summary !== 'string' || o.summary.trim().length === 0) return false;
  if (!isStringArray(o.patterns)) return false;
  if (!isStringArray(o.nextFocus)) return false;
  const kpt = o.kpt as Record<string, unknown> | undefined;
  if (!kpt || typeof kpt !== 'object') return false;
  return isStringArray(kpt.keep) && isStringArray(kpt.problem) && isStringArray(kpt.try);
}
