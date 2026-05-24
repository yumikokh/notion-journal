// Summarize free-form journal text into a short diary highlight via Claude.
// Input:  { bodyText: string, systemPrompt?: string }
// Output: { diary: string }  — plain text, validated client-side
//
// `systemPrompt` lets the user override the default prompt via the
// Settings screen. When provided, it FULLY replaces the default.

import { handleOptions, json } from '../_shared/cors.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-4-5-20251001';

const DEFAULT_SYSTEM_PROMPT = `あなたは日記の編集者です。提供される本文から、その日のハイライトを日本語の短い日記としてまとめます。

## 文構造の絶対ルール

- 異なる出来事は必ず別の文に分ける。1文に複数の出来事を詰め込まない
- 読点（、）で異なる出来事をつなげない。出来事が変わるなら句点（。）で区切る
- 各文は短く（目安40字以内）、全体で2〜4文程度

## 内容のルール

- 本文の具体的な出来事や感情を拾い、抽象的・汎用的な表現は避ける
- 出力はハイライト本文のみ。前置き・引用符・絵文字は不要`;

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
};

type Req = { bodyText?: string; systemPrompt?: string };

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
        messages: [{ role: 'user', content: body.bodyText }],
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
