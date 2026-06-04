// Weekly AI analysis Edge Function.
// Aggregates 2026/Daily entries for a given week and asks Claude for a
// one-shot reflection: summary, patterns, KPT proposals, next-week focus.
//
// Input:  { weekStart: "YYYY-MM-DD", weekEnd: "YYYY-MM-DD" (inclusive) }
// Output: { analysis: WeeklyAnalysis, source: { dailyCount, calendarEventCount } }
//
// `weekEnd` is inclusive (a Sunday-anchored week passes Monday→Sunday).
// When Google Calendar is connected, the week's events are appended as
// an additional context block so Claude can reason about planned vs.
// actual time use. Calendar fetch failures degrade gracefully — the
// journal-only path always runs.

import { handleOptions, json } from '../_shared/cors.ts';
import {
  type CalendarEvent,
  getStoredOAuth,
  listCalendarEvents,
  readGoogleEnv,
  refreshAccessToken,
} from '../_shared/google.ts';
import { NotionClient, NotionError } from '../_shared/notion.ts';

const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN');
const NOTION_DATA_SOURCE_ID =
  Deno.env.get('NOTION_DB_ID') ?? '9d854c37-a54c-835f-b449-876db44cf666';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `あなたは内省支援のコーチです。ユーザーの1週間分のジャーナルを読み、ワンショットで週次ふりかえりを返します。

## 入力

- デイリージャーナル (Notion)
- カレンダー実績 (Google Calendar; 接続している週のみ付帯)

カレンダーが付帯する週では、ジャーナルとカレンダーを突き合わせて
「計画と実態のギャップ」「時間の使い方のパターン」「予定が並んだ日と
感情の関係」など、両方を見ないと気付けない観察を優先してください。
カレンダーが無い週はジャーナルのみで分析します。

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

const ALL_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatEventTime(start: string, end: string): string {
  if (ALL_DAY_RE.test(start)) return '終日';
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    // Format in JST since this is a personal-use tool used in Japan.
    const fmtter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return fmtter.format(d);
  };
  return `${fmt(start)}–${fmt(end)}`;
}

function eventDateKey(iso: string): string {
  if (ALL_DAY_RE.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  // Group by JST calendar date so events past midnight UTC don't get
  // their own date line in the prompt.
  const fmtter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmtter.format(d); // YYYY-MM-DD
}

export function buildCalendarSection(events: CalendarEvent[]): string {
  if (events.length === 0) return '';
  const byDate = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = eventDateKey(ev.start);
    const list = byDate.get(key) ?? [];
    list.push(ev);
    byDate.set(key, list);
  }
  const dates = [...byDate.keys()].sort();
  const sections = dates.map((d) => {
    const list = byDate.get(d)!;
    const rows = list.map((ev) => {
      const time = formatEventTime(ev.start, ev.end);
      const title = ev.summary?.trim() || '(無題)';
      const desc = ev.description?.trim()
        ? ` — ${ev.description.replace(/\s+/g, ' ').slice(0, 120)}`
        : '';
      return `- ${time} ${title}${desc}`;
    });
    return `## ${d}\n${rows.join('\n')}`;
  });
  return `\n\n# カレンダー実績 (${events.length} 件)\n\n${sections.join('\n\n')}`;
}

/**
 * Best-effort calendar fetch. Returns `null` events on any failure so
 * the main analysis pipeline can keep running (graceful degrade per
 * issue #29 acceptance criteria).
 */
async function fetchWeekCalendarEvents(
  weekStart: string,
  weekEnd: string,
): Promise<CalendarEvent[] | null> {
  try {
    const row = await getStoredOAuth();
    if (!row) return null;
    const env = readGoogleEnv();
    if (!env) {
      console.warn('Google Calendar connected but client env not set; skipping events');
      return null;
    }
    const { accessToken } = await refreshAccessToken({
      env,
      refreshToken: row.refresh_token,
    });
    // Use JST window so "the week of Jun 1–7" really means Mon 00:00 JST
    // to Mon 00:00 JST.
    const timeMin = `${weekStart}T00:00:00+09:00`;
    const timeMax = `${nextDay(weekEnd)}T00:00:00+09:00`;
    return await listCalendarEvents({
      accessToken,
      calendarId: 'primary',
      timeMin,
      timeMax,
    });
  } catch (err) {
    console.error('Calendar fetch failed; degrading to journal-only analysis', err);
    return null;
  }
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

    // 2b. Optionally pull the week's calendar events (best-effort).
    const events = await fetchWeekCalendarEvents(body.weekStart, body.weekEnd);
    const promptBody =
      buildPromptBody(body.weekStart, body.weekEnd, digests) +
      buildCalendarSection(events ?? []);

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

    return json({
      analysis,
      source: {
        dailyCount: digests.length,
        calendarEventCount: events?.length ?? 0,
      },
    });
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
