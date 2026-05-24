# データモデル

Nikki は**ローカルDBを持たない**方針。Notion がジャーナルデータの source of truth で、
端末には「キャッシュ」と「ローカル専用データ（AI会話履歴・設定）」だけを置く。

> 旧版の Drift/SQLite + 同期キュー（sync_queue）構成は、オフライン優先度を下げたため廃止。

## データの所在

| データ | 置き場所 | 役割 |
|--------|---------|------|
| デイリー/ウィークリージャーナル, KPT | **Notion** | source of truth。Supabase Edge Function 経由で読み書き |
| Notion OAuth トークン | **Supabase**（暗号化） | クライアントには絶対に置かない |
| ジャーナルの取得結果 | 端末: **TanStack Query 永続キャッシュ** | 再表示の高速化。source of truth ではない |
| AIふりかえりの会話履歴 | 端末: **expo-sqlite** | ローカル専用。Notionには同期しない |
| アプリ設定（リマインダー, Notionマッピング, テーマ） | 端末: **AsyncStorage** | ローカル専用 |
| Supabase セッショントークン | 端末: **expo-secure-store** | 認証情報 |

## TanStack Query キャッシュ

- `@tanstack/react-query` + `@tanstack/query-async-storage-persister` で永続化
- queryKey 例: `['journal', date]` / `['journal-month', yyyymm]` / `['weekly', weekEndDate]`
- アプリ起動時にキャッシュから即描画 → バックグラウンドで Notion から再取得（stale-while-revalidate）
- これが「気軽に過去を見返す」体感速度を担保する。専用ローカルDBは不要

## expo-sqlite: AIふりかえり会話履歴

ローカル専用テーブル（Notionとは同期しない）。

```sql
CREATE TABLE reflect_sessions (
  id                TEXT PRIMARY KEY,   -- UUID
  type              TEXT NOT NULL,      -- daily, weekly, monthly, custom
  target_date_start TEXT,
  target_date_end   TEXT,
  created_at        TEXT NOT NULL
);

CREATE TABLE reflect_messages (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,             -- reflect_sessions.id
  role       TEXT NOT NULL,             -- user, assistant
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## AsyncStorage: 設定（JSON）

```json
// key: "reminder_settings"
{
  "dailyEnabled": true,
  "dailyTime": "22:00",
  "dailyDays": [1, 2, 3, 4, 5, 6, 7],
  "weeklyEnabled": false,
  "weeklyTime": "20:00",
  "weeklyDay": 7,
  "skipIfRecorded": true
}
```

- `dailyDays` / `weeklyDay`: 1=月 〜 7=日
- key `"notion_mapping"`: Notion DB選択とフィールドマッピング（`nikki-spec-full.md` §7.2 参照）
- key `"theme"`: `"system" | "light" | "dark"`

## ジャーナルのデータ形（メモリ上の型）

Notion から取得し TanStack Query が保持する。DBスキーマではなく TypeScript の型として定義する。

```ts
type JournalEntry = {
  notionPageId: string;
  date: string;                 // YYYY-MM-DD
  feeling: string | null;       // (^^), (˙-˙), (- -), (TT), (`A´)
  good: string | null;
  highlight: string | null;
  struggle: string | null;
  next: string | null;
  sleep: string | null;
  tracked: string | null;       // Toggl情報
  habits: {
    output: boolean;
    book: boolean;
    design: boolean;
    english: boolean;
    exercise: boolean;
  };
  bodyMarkdown: string | null;  // 自由記述
  lastEditedAt: string;         // Notion last_edited_time
};
```

`WeeklyJournal`（充電/放電ログ）と `Kpt`（Keep/Problem/Try/Knowledge）も同様に型として定義する。

## 書き込みフロー

1. ユーザーが Today画面で入力
2. TanStack Query の mutation 実行 → Supabase Edge Function 呼び出し
3. Edge Function が Notion API でページ作成/更新
4. 成功したら該当 queryKey を invalidate → 最新を再取得
5. 楽観的更新（optimistic update）で入力直後の表示はすぐ反映

ネットワークが無い場合は mutation が失敗するだけ（オフラインキューは持たない）。
将来オフライン対応する場合は TanStack Query の mutation 永続化（persist + resume）を検討する。
