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

## 文構造の絶対ルール

- 異なる出来事は必ず別の文に分ける。1文に複数の出来事を詰め込まない
- 読点（、）で異なる出来事をつなげない。出来事が変わるなら句点（。）で区切る
- 各文は短く（目安40字以内）、全体で2〜4文程度

## 内容のルール

- 本文の具体的な出来事や感情を拾い、抽象的・汎用的な表現は避ける
- 出力はハイライト本文のみ。前置き・引用符・絵文字は不要`;

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
