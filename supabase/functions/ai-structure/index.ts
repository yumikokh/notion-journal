// Summarize free-form journal text into a short diary highlight via Claude.
// Input:  { bodyText: string, systemPrompt?: string, calendarContext?: string }
// Output: { diary: string }  — plain text, validated client-side
//
// `systemPrompt` lets the user override the default prompt via the
// Settings screen. When provided, it FULLY replaces the default.
//
// `calendarContext` is that day's Google Calendar events, pre-formatted as
// a markdown list on the client (empty/omitted = journal-only). When
// present it's appended to the user message as a clearly-labeled, optional
// grounding block so the model can reference what actually happened —
// labeling it in the user message (not the system prompt) keeps it visible
// even when the user overrides `systemPrompt`.

import { handleOptions, json } from '../_shared/cors.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-4-5-20251001';

const DEFAULT_SYSTEM_PROMPT = `あなたは日記の編集者です。提供される本文から、その日のハイライトを日本語の短い日記としてまとめます。

## 文構造・分量の絶対ルール

- 本文の長さや話題数に関わらず、出力は必ず2〜3文・最大3文に収める。長い日でも文を増やさない
- 本文に話題が複数あっても全部を網羅しない。その日で最も印象的な1〜2件だけを選んで書く
- 異なる出来事は必ず別の文に分ける。1文に複数の出来事を詰め込まない
- 読点（、）で異なる出来事をつなげない。出来事が変わるなら句点（。）で区切る
- 各文は短く（目安40字以内）

## 内容のルール

- 本文の具体的な出来事や感情を拾い、抽象的・汎用的な表現は避ける
- 本文に明示されていない主語・人物・関係・因果を推測で補わない。書かれていないことは書かない（例:「車買ってくれたらいいよと言われた」→誰が言ったか・誰が買うかは不明なので「親が」等と決めつけず、曖昧なまま書く）
- 出力はハイライト本文のみ。前置き・引用符・絵文字は不要

## カレンダー（任意）

- 「その日の予定」が付く場合がある。本文に書かれていない予定も、その日にあった出来事の候補として扱ってよい（上の分量ルールの範囲で、印象的なら織り込む）
- 時刻の羅列や予定の丸写しはしない。本文の流れに自然に溶け込ませ、地の文にする
- 予定のタイトル以上の詳細や感情を捏造しない（例:「草取り」→「草取りをした」は可、「草取りで汗だくになった」は不可）
- 本文と予定が矛盾するときは本文を優先する`;

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
};

type Req = { bodyText?: string; systemPrompt?: string; calendarContext?: string };

/**
 * Build the user message. With no calendar context this is just the raw
 * body (unchanged from the journal-only behavior). With context, both are
 * wrapped in labeled sections so the model can tell facts from grounding.
 */
function buildUserMessage(bodyText: string, calendarContext?: string): string {
  const calendar = calendarContext?.trim();
  if (!calendar) return bodyText;
  return `# 本文\n\n${bodyText}\n\n# その日の予定\n\n${calendar}`;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY env not set' }, 500);

  const body = (await req.json().catch(() => null)) as Req | null;
  if (!body?.bodyText || typeof body.bodyText !== 'string' || body.bodyText.trim().length === 0) {
    return json({ error: 'bodyText is required' }, 400);
  }

  const systemPrompt =
    body.systemPrompt && body.systemPrompt.trim().length > 0
      ? body.systemPrompt
      : DEFAULT_SYSTEM_PROMPT;

  const userMessage = buildUserMessage(body.bodyText, body.calendarContext);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      return json({ error: `Claude API failed (${res.status})`, detail: await res.text() }, 502);
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const diary = text.trim();
    if (diary.length === 0) return json({ error: 'AI returned empty text' }, 502);

    return json({ diary });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
