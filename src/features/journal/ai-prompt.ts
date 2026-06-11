/**
 * Default system prompt sent to Claude for diary highlight summarization.
 *
 * The user can override this via the Settings screen — see
 * `src/features/settings/prompt-storage.ts`. When overridden, the user's
 * prompt fully replaces this one.
 *
 * The AI returns plain text (no JSON). The text populates the `diary`
 * field on the today draft; feeling and habits remain user-controlled.
 */
export const AI_STRUCTURE_SYSTEM = `あなたは日記の編集者です。提供される本文から、その日のハイライトを日本語の短い日記としてまとめます。

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

/** Flat shape returned by the Edge Function. */
export type AIDiaryOutput = {
  diary: string;
};

/**
 * Defensive validation of the AI response. Custom prompts can occasionally
 * fail in unexpected ways; we verify the diary is a non-empty string before
 * applying to the UI.
 */
export function isValidAIOutput(value: unknown): value is AIDiaryOutput {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.diary === 'string' && v.diary.trim().length > 0;
}
