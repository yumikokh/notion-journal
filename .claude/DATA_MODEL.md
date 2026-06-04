# データモデル

Nikki は**ローカルDBを持たない**方針。Notion がジャーナルデータの source of truth で、
端末には「キャッシュ」と「ローカル専用データ（設定・iCal フィードURL）」だけを置く。

> 旧版の Drift/SQLite + 同期キュー（sync_queue）構成は、オフライン優先度を下げたため廃止。

## データの所在

| データ | 置き場所 | 役割 |
|--------|---------|------|
| デイリー/ウィークリージャーナル, KPT | **Notion** | source of truth。Supabase Edge Function 経由で読み書き |
| Notion / Google OAuth トークン | **Supabase**（暗号化） | クライアントには絶対に置かない |
| ジャーナル / カレンダーの取得結果 | 端末: **TanStack Query 永続キャッシュ** | 再表示の高速化。source of truth ではない |
| AI週次分析の結果 | 端末: **TanStack Query キャッシュ**（揮発でも可） | 再生成可能。永続化は任意 |
| アプリ設定（リマインダー, Notionマッピング, iCalフィードURL, テーマ） | 端末: **AsyncStorage** | ローカル専用 |
| Supabase セッショントークン | 端末: **expo-secure-store** | 認証情報 |

## TanStack Query キャッシュ

- `@tanstack/react-query` + `@tanstack/query-async-storage-persister` で永続化
- queryKey 例: `['journal', date]` / `['journal-month', yyyymm]` / `['weekly', weekEndDate]`
- アプリ起動時にキャッシュから即描画 → バックグラウンドで Notion から再取得（stale-while-revalidate）
- これが「気軽に過去を見返す」体感速度を担保する。専用ローカルDBは不要

## expo-sqlite

現バージョンでは未使用。AIチャットの会話履歴用に検討していたが、AI機能を「週次ワンショット分析」に変更したため不要に。
（再生成可能なため、過去分析の永続化が必要になった場合のみ再導入を検討）

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
- key `"ical_feeds"`: `[{ label: string, url: string }]` — iCal フィードの一覧
- key `"google_calendar_connected"`: `boolean` — Google OAuth 接続フラグ（トークン自体は Supabase 側）

## ジャーナルのデータ形（メモリ上の型）

Notion から取得し TanStack Query が保持する。DBスキーマではなく TypeScript の型として定義する。

```ts
type Moment = {
  blockId: string;              // Notion block id（編集・削除用）
  time: string | null;          // HH:MM（callout 先頭から抽出。自由記述ブロックは null）
  feeling: string | null;       // その瞬間の気分（callout アイコン）
  text: string;                 // 本文
  tags: string[];               // 本文中の #tag を抽出
};

type JournalEntry = {
  notionPageId: string;
  date: string;                 // YYYY-MM-DD
  feeling: string | null;       // その日の総合（最後に決める）: (^^), (˙-˙), (- -), (TT), (`A´)
  sleep: string | null;
  tracked: string | null;       // Toggl情報
  habits: {
    output: boolean;
    book: boolean;
    design: boolean;
    english: boolean;
    exercise: boolean;
  };
  moments: Moment[];            // 本文 = Moment の append ストリーム（callout）＋ 自由記述ブロック
  lastEditedAt: string;         // Notion last_edited_time
};
```

**構造化フィールドは廃止**：Good/Highlight/Struggle/Next の4カードと充電/放電ログは Notion のプロパティとして持たない。
「書きたい時に本文へ書く」スタイルとし、Daily の構造化データは Feeling / 習慣 / Sleep のプロパティのみ。
充電/放電のような感情の吐き出しは Daily 本文の自由記述（または Moment）として残す。

`Weekly`（より分析的なふりかえり）と `Kpt`（Keep/Problem/Try/Knowledge）も同様に型として定義する。
Weekly は AI週次分析の結果を素材にした横断的・分析的なレイヤーで、日々の感情の吐き出しは Daily が担う。

## 書き込みフロー

書き込みは性質の違う2系統に分ける：

### A. Moment 追記（append）— 主要な入力導線

1. Today画面（またはウィジェット）から「今の気分を投稿」：本文 + Feelingピッカー
2. mutation → `appendMoment` Edge Function 呼び出し
3. Edge Function が当日の Daily ページを **find-or-create** → `blocks.children.append` で callout を末尾に追加
   - callout: アイコン = Feeling、本文 = `HH:MM 本文 #tag`
4. 成功したら `['journal', date]` を invalidate → 本文ブロックを再取得・再パース
5. 楽観的更新で投稿直後にタイムライン末尾へ即反映

### B. プロパティ更新（update）— Feeling総合 / 習慣 / Sleep

1. Today画面で Feeling・習慣・Sleep を操作
2. mutation → `updateDaily` Edge Function → Notion `pages.update`（プロパティのみ）
3. 該当 queryKey を invalidate

> Daily の自由記述（充電/放電など）は Notion 上で直接、またはアプリの本文エディタで編集する。
> 構造化フィールドが無いので「カードを埋める」mutation は存在しない。

ネットワークが無い場合は mutation が失敗するだけ（オフラインキューは持たない）。
将来オフライン対応する場合は TanStack Query の mutation 永続化（persist + resume）を検討する。

## Moment ブロックのパース

Daily ページ本文は「Moment（callout）」と「自由記述（paragraph 等）」が混在する。
読み取り時に本文ブロック列を走査し、callout は時刻・気分・#tag を抽出して `Moment` に、
その他ブロックは `time: null` の `Moment`（自由記述）として `JournalEntry.moments` に並べる。
`blockId` を保持するので、個別 Moment の編集・削除も後から実装できる。
