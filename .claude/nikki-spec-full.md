# Nikki — Notion連携ジャーナル & AI週次分析アプリ
（コード名: notion-journal）

## コンセプト

**「Notionジャーナルをスマホで書きやすく、AIで振り返りやすく」**

既存のNotionデイリージャーナル・ウィークリージャーナルと連携し、スマホに最適化された記録UIと、AIによるふりかえり機能を提供するiOSアプリ（Expo / React Native）。個人利用ツールとして開発する。

---

## 1. 背景・課題

### ユーザーの現状
- Notionでデイリージャーナル（2026/Daily）をつけている
- プロパティ: Title, Date, Feeling, Good, Highlight, Struggle, Next, Sleep, Tracked, Tasks, Output/Book/Design/English/Exercise（チェックボックス）
- ページ本文に「仕事・制作」「生活」「murmur」などの自由記述
- ウィークリージャーナルで充電ログ/放電ログ、セルフトーク、KPT（Keep/Problem/Try/Knowledge）
- Toggl連携データもジャーナルに記録

### 課題
- Notionモバイルは入力が重い（プロパティ入力、ブロック操作がスマホで煩雑）
- ふりかえりを習慣化しにくい（週次KPTが形骸化しがち）
- 蓄積されたジャーナルデータを横断的に分析する手段がない
- ふりかえりを誰かに壁打ちしたいが、人に見せるには生々しい内容

---

## 2. ターゲットユーザー

### プライマリ
- Notionでジャーナルをつけている人で、モバイル入力に不満を持つ人
- 内省・自己分析をしたいが、一人だとふりかえりが浅くなると感じている人

### セカンダリ
- 日記アプリを探しているが、データはNotionに集約したい人
- セルフコーチングに興味があるフリーランス・クリエイター

---

## 3. 競合分析

| アプリ | 強み | 弱み | 価格 |
|--------|------|------|------|
| **Rosebud** | 会話型AI、パターン認識、音声入力 | Notion非連携、$12.99/月 | Freemium |
| **Reflection** | 100+ガイドプログラム、E2E暗号化 | Notion非連携、汎用的 | $8/月, $69/年 |
| **Mindsera** | 認知バイアス分析、メンタルモデル | Notion非連携、分析寄り | $14.99/月, $149/年 |
| **Daylio** | ムードトラッキング、タップ入力 | テキスト記録が弱い | Freemium |
| **Notionネイティブ** | データ一元管理 | モバイルUI悪い、AI非連携 | — |

### Nikkiの差別化ポイント
1. **Notion双方向同期** — 既存ジャーナルDBとシームレスに連携（競合ゼロ）
2. **構造化入力 × 自由記述** — プロパティのクイック入力 + 本文記述の両立
3. **AI壁打ち** — 蓄積データを文脈にした対話型ふりかえり
4. **日本語ネイティブ** — 日本語ジャーナルに最適化されたAI応答

---

## 4. 技術スタック

| レイヤー | 技術 |
|----------|------|
| フレームワーク | Expo (React Native) — iOS のみ |
| 言語 | TypeScript |
| ルーティング | Expo Router |
| サーバー状態管理 | TanStack Query（永続キャッシュ） |
| ローカル保存 | AsyncStorage（設定・iCal フィードURL）/ expo-secure-store（トークン） |
| バックエンド | Supabase (Auth, Edge Functions — TypeScript/Deno) |
| AI | Claude API (Anthropic) |
| 外部連携 | Notion API (OAuth 2.0) |
| 通知 | expo-notifications |
| ウィジェット | WidgetKit (Swift) ※後フェーズ |
| ビルド/配信 | EAS Build / EAS Submit（TestFlight） |

### アーキテクチャ方針
- **Notion が source of truth**: ローカルDBは持たず、Notion を Supabase Edge Function 経由で読み書き
- **TanStack Query で体感速度を担保**: 取得結果を永続キャッシュし、過去ジャーナルの読み返しを高速化
- **Notion API直接呼び出しはしない**: Supabase Edge Functions 経由でトークン管理・レート制限を吸収
- **AIリクエストもサーバー経由**: APIキーをクライアントに持たせない
- オフライン対応は優先度低（将来必要なら TanStack Query の mutation 永続化で対応）

詳細は `.claude/DATA_MODEL.md` を参照。

---

## 5. ユーザーストーリー

### Epic 1: Notion連携（認証・同期）

| ID | ストーリー | 優先度 |
|----|-----------|--------|
| U-01 | ユーザーとして、Notion OAuthでログインし、自分のジャーナルDBを選択できる | Must |
| U-02 | ユーザーとして、デイリージャーナルDBのスキーマを自動検出し、アプリのフィールドにマッピングできる | Must |
| U-03 | ユーザーとして、アプリで書いた内容がNotionに自動同期される | Must |
| U-04 | ユーザーとして、Notionで書いた内容がアプリに反映される（双方向同期） | Must |
| U-05 | ユーザーとして、オフライン時もアプリに記録でき、復帰時に同期される | Should |

### Epic 2: デイリージャーナル入力

| ID | ストーリー | 優先度 |
|----|-----------|--------|
| U-10 | ユーザーとして、今日のジャーナルをワンタップで新規作成できる | Must |
| U-11 | ユーザーとして、Feeling（気分）をタップで素早く選択できる | Must |
| U-12 | ユーザーとして、Good / Highlight / Struggle / Next をカード形式で入力できる | Must |
| U-13 | ユーザーとして、習慣チェックボックス（Output, Book, Design, English, Exercise）をワンタップで記録できる | Must |
| U-14 | ユーザーとして、Sleep情報をテキストまたは構造化入力で記録できる | Should |
| U-15 | ユーザーとして、自由記述（仕事・生活・murmur）をMarkdown対応エディタで書ける | Must |
| U-16 | ユーザーとして、過去の日付のジャーナルを閲覧・編集できる | Must |
| U-17 | ユーザーとして、カレンダービューで記録の有無と気分を一覧できる | Should |

### Epic 3: ウィークリーふりかえり

| ID | ストーリー | 優先度 |
|----|-----------|--------|
| U-20 | ユーザーとして、今週のジャーナルをサマリー表示で振り返れる | Must |
| U-21 | ユーザーとして、充電ログ/放電ログを入力できる | Must |
| U-22 | ユーザーとして、KPT（Keep/Problem/Try）をカード形式で追加できる | Must |
| U-23 | ユーザーとして、先週のKPTを参照しながら今週のふりかえりができる | Should |

### Epic 4: AI週次分析（課金ポイント）

> AIチャット（会話形式）は廃止。週次ワンショット分析に絞り、カレンダー実績を入力に取り込むことで「計画と実態のギャップを見える化する」方向に振り切る。

| ID | ストーリー | 優先度 |
|----|-----------|--------|
| U-31 | ユーザーとして、今週のジャーナル + カレンダー実績をAIが分析し、サマリー/気付き/KPT案/次週フォーカスを得られる | Must |
| U-32 | ユーザーとして、過去の分析結果から感情・行動パターンを横断的に確認できる | Should |
| U-33 | ユーザーとして、分析結果のKPT案をワンタップで Notion KPT DB に保存できる | Should |
| U-35 | ユーザーとして、月単位の比較分析（前月との変化）も実行できる | Could |

### Epic 4b: カレンダー連携（AI週次分析の入力ソース）

| ID | ストーリー | 優先度 |
|----|-----------|--------|
| U-37 | ユーザーとして、Googleカレンダー（OAuth）を接続し、指定週のイベントを取得できる | Must |
| U-38 | ユーザーとして、iCal フィードURLを複数登録し、その週のイベントを取得できる | Should |
| U-39 | ユーザーとして、取得したカレンダー情報が AI週次分析の入力に統合される | Must |

### Epic 5: ダッシュボード・可視化

| ID | ストーリー | 優先度 |
|----|-----------|--------|
| U-40 | ユーザーとして、Feelingの推移を週・月単位でグラフ表示できる | Should |
| U-41 | ユーザーとして、習慣チェックボックスの達成率を可視化できる | Should |
| U-42 | ユーザーとして、ジャーナル継続日数（ストリーク）が見える | Should |
| U-43 | ユーザーとして、月間サマリー（よく出てきたキーワード、気分の傾向）が見える | Could |

### Epic 6: 設定・カスタマイズ

| ID | ストーリー | 優先度 |
|----|-----------|--------|
| U-50 | ユーザーとして、ジャーナルのプロパティ構成をカスタマイズできる（フィールドの表示/非表示） | Should |
| U-52 | ユーザーとして、ダークモード/ライトモードを切り替えられる | Must |
| U-53 | ユーザーとして、アプリロック（生体認証）を設定できる | Should |

### Epic 7: リマインダー

| ID | ストーリー | 優先度 |
|----|-----------|--------|
| U-60 | ユーザーとして、毎日の記録時間にプッシュ通知を受け取れる | Must |
| U-61 | ユーザーとして、通知時間を自分で設定できる（デフォルト: 22:00） | Must |
| U-62 | ユーザーとして、曜日ごとに通知ON/OFFを切り替えられる | Should |
| U-63 | ユーザーとして、今日まだ記録していない場合のみ通知を受け取る（記録済みならスキップ） | Must |
| U-64 | ユーザーとして、ウィークリーふりかえりのリマインダーも設定できる（デフォルト: 日曜20:00） | Should |

---

## 6. 画面構成

```
[タブバー]
├── 📝 Today（デイリー入力・メイン画面）
├── 📅 Calendar（カレンダー + 一覧）
├── 💬 Reflect（AI週次分析）
├── 📊 Insights（ダッシュボード）
└── ⚙️ Settings
```

### 6.1 Today画面
- 上部: 日付セレクター + Feelingピッカー（顔文字タップ）
- 中部: カード形式入力エリア
  - Good / Highlight / Struggle / Next の4枚カード（スワイプまたはタブ切替）
  - 各カードは箇条書き入力に最適化（改行で自動リスト化）
- 下部: 習慣チェックボックス（横一列アイコン）
- フローティング: 自由記述展開ボタン（フルスクリーンエディタ）

### 6.2 Calendar画面
- 月間カレンダー（各日にFeeling顔文字 + 記録有無ドット）
- 日付タップで該当日のジャーナル閲覧/編集

### 6.3 Reflect画面（AI週次分析）
- 週ピッカー（今週 / 先週 / 任意週）
- 「分析する」ボタン → AIが指定週のジャーナル + カレンダー実績を読み込み、ワンショットで結果を生成
- 結果セクション:
  - サマリー（3〜5文）
  - 気付き・パターン（箇条書き）
  - KPT案（Keep / Problem / Try 候補）
  - 次週フォーカス候補
- KPT案カードに「Notion KPT DB に保存」アクション
- チャット形式・ターン制の会話は持たない

### 6.4 Insights画面
- Feeling推移グラフ（折れ線）
- 習慣達成率（円グラフ or バーチャート）
- ジャーナルストリーク
- 月間ワードクラウド or キーワードランキング

---

## 7. データモデル

### 7.1 ローカルデータ

> ⚠️ ローカルDB（Drift/SQLite）+ 同期キュー構成は廃止。Notion を source of truth とし、
> 端末は TanStack Query の永続キャッシュ + AsyncStorage（設定・iCal フィード）+ expo-secure-store（トークン）のみ。
> **最新スキーマは `.claude/DATA_MODEL.md` を参照。** 以下の旧スキーマは歴史的参考。

#### （旧・非推奨）Drift/SQLite スキーマ

```sql
-- ジャーナルエントリ
CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,           -- UUID
  notion_page_id TEXT,           -- Notion同期用
  date TEXT NOT NULL,            -- YYYY-MM-DD
  feeling TEXT,                  -- (^^), (˙-˙), (- -), (TT), (`A´)
  good TEXT,
  highlight TEXT,
  struggle TEXT,
  next TEXT,
  sleep TEXT,
  tracked TEXT,                  -- Toggl情報
  habit_output INTEGER DEFAULT 0,
  habit_book INTEGER DEFAULT 0,
  habit_design INTEGER DEFAULT 0,
  habit_english INTEGER DEFAULT 0,
  habit_exercise INTEGER DEFAULT 0,
  body_markdown TEXT,            -- 自由記述
  synced_at TEXT,                -- 最終同期日時
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ウィークリージャーナル
CREATE TABLE weekly_journals (
  id TEXT PRIMARY KEY,
  notion_page_id TEXT,
  week_end_date TEXT NOT NULL,   -- 週の終わり
  charge_log TEXT,               -- 充電ログ
  discharge_log TEXT,            -- 放電ログ
  charge_self_talk TEXT,         -- 充電セルフトーク
  discharge_self_talk TEXT,      -- 放電セルフトーク
  synced_at TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- KPT
CREATE TABLE kpts (
  id TEXT PRIMARY KEY,
  notion_page_id TEXT,
  weekly_journal_id TEXT REFERENCES weekly_journals(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,            -- Keep, Problem, Try, Knowledge
  synced_at TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- (旧) AIふりかえり会話履歴用テーブル: チャット機能廃止に伴い不採用

-- 同期キュー
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,     -- journal_entry, weekly_journal, kpt
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,          -- create, update
  payload TEXT NOT NULL,         -- JSON
  status TEXT DEFAULT 'pending', -- pending, syncing, synced, failed
  retry_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- リマインダー設定
CREATE TABLE reminder_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  daily_enabled INTEGER DEFAULT 1,
  daily_time TEXT DEFAULT '22:00',    -- HH:mm
  daily_days TEXT DEFAULT '[1,2,3,4,5,6,7]',  -- 1=月〜7=日
  weekly_enabled INTEGER DEFAULT 0,
  weekly_time TEXT DEFAULT '20:00',
  weekly_day INTEGER DEFAULT 7,       -- 7=日曜
  skip_if_recorded INTEGER DEFAULT 1, -- 記録済みならスキップ
  updated_at TEXT NOT NULL
);
```

### 7.2 Notion DBマッピング設定

```json
{
  "daily_journal": {
    "data_source_id": "9d854c37-a54c-835f-b449-876db44cf666",
    "field_mapping": {
      "title": "Title",
      "date": "Date",
      "feeling": "Feeling",
      "good": "Good",
      "highlight": "Highlight",
      "struggle": "Struggle",
      "next": "Next",
      "sleep": "Sleep",
      "tracked": "Tracked",
      "habit_output": "Output",
      "habit_book": "Book",
      "habit_design": "Design",
      "habit_english": "English",
      "habit_exercise": "Exercise"
    }
  },
  "weekly_journal": {
    "data_source_id": "15b54c37-a54c-81fe-9921-000b5bdf062c",
    "field_mapping": {
      "title": "名前",
      "week_end": "週の終わり",
      "charge_log": "🔋充電ログ",
      "discharge_log": "⚡️放電ログ",
      "charge_self_talk": "🔋充電セルフトーク",
      "discharge_self_talk": "⚡️放電セルフトーク"
    }
  },
  "kpt": {
    "data_source_id": "15b54c37-a54c-8162-a954-000b56738655",
    "field_mapping": {
      "title": "名前",
      "type": " KPT",
      "weekly_journal_relation": "ウィークリージャーナル"
    }
  }
}
```

---

## 8. AI機能の設計（週次ワンショット分析）

> ターン制のチャットは持たない。1回の API 呼び出しで、その週のジャーナル + カレンダー実績を入力として、構造化された分析結果を返す。

### 8.1 システムプロンプト

```
[System]
あなたはユーザーの内省を支援する週次コーチです。
入力された1週間分のジャーナルとカレンダー実績を読み、以下を JSON で出力してください。

出力スキーマ:
{
  "summary": "3〜5文の要約",
  "insights": ["気付き・パターンを箇条書きで"],
  "kpt": {
    "keep":    ["継続したいこと"],
    "problem": ["うまくいかなかったこと"],
    "try":     ["来週試したいこと"]
  },
  "next_focus": "来週の最重要フォーカス（1文）"
}

ルール:
- 説教や押し付けはしない
- ユーザーの言葉をそのまま引用して認識を確認する
- カレンダー予定と実際のジャーナル記録のギャップに注目する
- KPTフレームワークを自然に活用する

[Context]
# 期間
{week_start} 〜 {week_end}

# その週のデイリージャーナル
{daily_entries}

# その週のカレンダーイベント（Google / iCal を統合済み）
{calendar_events}

# 先週のKPT（参照用）
{previous_kpts}
```

### 8.2 トリガーとコンテキスト範囲

| トリガー | コンテキスト範囲 | 出力 |
|----------|-----------------|------|
| Reflect画面の「今週を分析」 | その週の月〜日 + カレンダー | 上記スキーマ |
| Reflect画面の「先週を分析」 | 先週分 + カレンダー | 上記スキーマ |
| Reflect画面の「任意週を分析」 | 指定週分 + カレンダー | 上記スキーマ |
| 月次レポート（Phase 5） | 先月の4〜5週分 + 先月の月次KPT | 拡張スキーマ |

### 8.3 出力からのアクション

分析結果カードからワンタップで:
- **KPT候補を Notion KPT DB に保存** (Keep/Problem/Try 別)
- **次週フォーカスを今週初日のNextに追記**（任意）

---

## 9. マネタイズ設計

> ⚠️ 現在は個人利用ツールとして開発中のため当面スコープ外。
> 将来プロダクトとして配布する場合の参考として以下を残す。

### 推奨: フリーミアム（AI回数制限型）

| プラン | 内容 | 価格案 |
|--------|------|--------|
| **Free** | デイリー入力、Notion同期、カレンダー表示、習慣トラッキング、Insights基本表示 | ¥0 |
| **Pro** | AI週次分析無制限、月次レポート、ワードクラウド、過去分析の再閲覧、KPT自動提案 | ¥580〜980/月 or ¥4,800〜7,800/年 |

### 課金の線引き根拠
- 無料でも「Notionのモバイル入力を改善する」価値が成立する → 定着率を確保
- AI機能は変動コスト（API利用料）が発生するため課金対象として自然
- 競合（Rosebud $12.99、Reflection $8）より安価に設定し、Notion連携の独自性で訴求

### 無料プランでのAI制限案
- 月2回までAI週次分析を実行可能

---

## 10. Notion API連携の技術詳細

### 10.1 認証フロー

```
[アプリ] → OAuth認証開始 → [Notion] → 認可コード → [Supabase Edge Function]
→ アクセストークン取得 → [Supabase DB] に暗号化保存
→ [アプリ] にセッション返却
```

### 10.2 同期戦略

| 方向 | トリガー | 方式 |
|------|---------|------|
| App → Notion | エントリ保存時 | TanStack Query mutation → Edge Function で即書き込み（楽観的更新） |
| Notion → App | アプリ起動時 / Pull-to-refresh | 差分取得（last_edited_time基準） |
| 競合解決 | 単一ユーザー前提のため最小限 | 基本は last-write-wins（Notionの最新を採用） |

### 10.3 必要なNotion APIスコープ

```
read_content
update_content
insert_content
read_user_info
```

### 10.4 スキーマ自動検出

初回セットアップ時:
1. ユーザーがジャーナルDBを選択
2. APIでDB schemaを取得
3. プロパティ名 → アプリフィールドの自動マッピング提案
4. ユーザーが確認・修正
5. マッピング設定をローカルに保存

---

## 11. MVP定義（v1.0）

> 開発フェーズと MVP の区切りは `.claude/PHASES.md` を正とする。本節は概要。

### Must（リリースに必須）
- [ ] Notion OAuth認証
- [ ] デイリージャーナルDB選択・スキーママッピング
- [ ] デイリー入力画面（Feeling、4カード、習慣チェック）
- [ ] 自由記述エディタ
- [ ] App → Notion 同期（作成・更新）
- [ ] Notion → App 同期（読み取り）
- [ ] 過去エントリ閲覧・編集
- [ ] Googleカレンダー OAuth + 取得
- [ ] AI週次分析（ジャーナル + カレンダー実績）
- [ ] ダークモード対応
- [ ] ホーム画面ウィジェット（WidgetKit）

### Should（v1.1〜v1.2）
- [ ] カレンダービュー
- [ ] iCal フィードURL からのカレンダー取得
- [ ] ウィークリージャーナル連携
- [ ] KPT入力・同期（AI週次分析の結果をワンタップ保存）
- [ ] Insights画面（Feeling推移、習慣達成率）
- [ ] リマインダー通知
- [ ] 生体認証ロック

### Could（v2.0〜）
- [ ] 月次AIレポート自動生成
- [ ] ワードクラウド / キーワード分析
- [ ] 音声入力 → テキスト変換
- [ ] Apple Watch コンパニオン

---

## 12. マーケティング評価

> ⚠️ §9 と同じく、プロダクト配布を前提とした評価。個人利用ツールとしては当面スコープ外。

### 12.1 ポジショニング

**「Notionジャーナラーのための、入力とふりかえりの専用アプリ」**

Notion利用者の中でもジャーナルをつけている層は、自己改善意識が高く、ツールへの投資意欲もある。このニッチを明確に狙うことで、汎用ジャーナルアプリとの競争を回避できる。

### 12.2 強み（マーケティング観点）

- **Notion連携が唯一の差別化軸**: 「Notionジャーナル × モバイル × AI」の組み合わせは現時点で競合ゼロ
- **既存データ資産を活かせる**: 他のAIジャーナルは蓄積ゼロからスタートだが、Kaerimiは初日からデータがある
- **明確なペインポイント**: 「Notionモバイルが使いにくい」は広く共有された不満
- **課金ハードルが低い**: 無料で入力改善の価値を体感 → AIに課金する導線が自然

### 12.3 リスク・懸念

| リスク | 影響 | 対策 |
|--------|------|------|
| Notionが公式モバイルUIを改善 | 入力改善の価値が薄れる | AI分析・ふりかえりの価値を軸にシフト |
| Notion APIの制限・変更 | 同期が壊れる | APIバージョニング対応、オフライン動作の堅牢化 |
| ターゲットが狭すぎる | ユーザー獲得上限が低い | Notion非連携モード（スタンドアロン）を将来追加 |
| AI API費用の増大 | 利益を圧迫 | レート制限、キャッシュ、トークン最適化 |

### 12.4 初期マーケティングチャネル

| チャネル | アクション |
|----------|----------|
| X (Twitter) | Notion活用系・ジャーナル系アカウントへのリーチ、開発過程の共有 |
| Product Hunt | ローンチ時のバースト |
| Notion テンプレートコミュニティ | ジャーナルテンプレートとセットで紹介 |
| Zenn / note | 「Notionジャーナルをモバイル対応した話」的な技術・体験記事 |
| App Store ASO | 「Notion ジャーナル」「ふりかえり AI」などのキーワード最適化 |

### 12.5 TAM推定

- Notion利用者: 全世界1億人超（2025年時点）
- うちジャーナル利用: 推定5〜10%（500万〜1000万人）
- うちモバイル入力に不満: 推定30%
- 到達可能市場: 150万〜300万人
- 現実的初年度目標: 5,000〜10,000 DL、有料転換率5%で250〜500人

---

## 13. 開発ロードマップ

詳細は `.claude/PHASES.md` を正とする。

| フェーズ | 期間 | 内容 |
|----------|------|------|
| **Phase 0** | 数日 | Expo セットアップ、Supabase、Notion OAuth、ナビ骨格 |
| **Phase 1** | 1.5〜2週間 | デイリー入力、Notion書き込み（Edge Function） |
| **Phase 2** | 2-3週間 | 閲覧（カレンダー）、Googleカレンダー連携、AI週次分析、リマインダー |
| **Phase 3** | 1週間 | ホーム画面ウィジェット（WidgetKit） |
| **個人利用版 完成** | — | TestFlight 配布 |
| **Phase 4** | 任意 | ウィークリー連携、KPT、Insights |
| **Phase 5** | 任意 | AIアクション、月次レポート、生体認証ロック |

---

## 14. アプリ名

仮名: **Nikki**（日記のローマ字読み。シンプルで覚えやすい）
Expo の slug: `notion-journal`（iOS bundle identifier は別途決定）
リポジトリ名: `notion-journal`

正式名は App Store / ドメインの空き状況を確認して決定。

---

## 15. Claude Code への渡し方

このリポジトリには Progressive Disclosure 構成でドキュメントを配置済み:

```
notion-journal/
├── .claude/
│   ├── CLAUDE.md            ← 毎セッション自動読み込み（簡潔に）
│   ├── SPEC.md              ← プロダクト仕様（ユーザーストーリー、画面）
│   ├── DATA_MODEL.md        ← データの所在・ローカル保存スキーマ
│   ├── PHASES.md            ← 開発フェーズ・MVP定義
│   └── nikki-spec-full.md   ← 本ファイル（全体仕様の詳細リファレンス）
├── app/                     ← Expo Router のルート
└── src/features/            ← feature-first の実装
```

### セッション運用ルール:
- 1セッション = 1フェーズまたは1機能に集中
- フェーズ完了時に学びを CLAUDE.md / 各docに反映
- 新しいフェーズは新セッションで開始
