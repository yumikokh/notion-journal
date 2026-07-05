# 開発フェーズ

iOS 単体・個人利用ツールとして開発。Web対応・課金（RevenueCat）・オフライン同期はスコープ外。
配布は TestFlight（`eas submit`）。App Store 公開申請は必須ゲートにしない。

## Phase 0: セットアップ（数日）

- [ ] Expo プロジェクト作成（`npx create-expo-app`, TypeScript テンプレート）
- [ ] ディレクトリ構成: `app/`（Expo Router）+ `src/features/`
- [ ] ESLint / Prettier / Jest (jest-expo) セットアップ
- [ ] Supabase プロジェクト作成、Edge Functions 雛形
- [ ] Notion OAuth Integration（public integration）作成
- [ ] タブナビゲーション骨格（Today / Calendar / Reflect / Settings）
- [ ] テーマ（ダーク/ライト）

ゲート条件: 実機（dev client）でアプリが起動し、タブ移動できる

## Phase 1: デイリー入力 → Notion 書き込み（1.5〜2週間）

- [ ] Notion OAuth 認証フロー（Supabase Edge Function 経由）
- [ ] DB選択 + スキーママッピングUI
- [ ] Today画面: Feelingピッカー（その日の総合気分・プロパティ）
- [ ] Today画面: Moment 投稿（本文 + 瞬間の Feeling）→ Daily 本文に callout を append
- [ ] Today画面: Moment タイムライン表示（当日の投稿を時系列で）
- [ ] Today画面: 習慣チェックボックス
- [ ] 自由記述エディタ（充電/放電などの吐き出しを本文に）
- [ ] `appendMoment` Edge Function（Daily ページ find-or-create + blocks.children.append）
- [ ] `updateDaily` Edge Function（Feeling / 習慣 / Sleep プロパティ更新）
- [ ] 本文ブロックパーサ（callout → Moment 型）
- [ ] TanStack Query mutation + 楽観的更新

ゲート条件: アプリで Moment を投稿 → Notion の当日ページ本文に反映される

## Phase 2: 閲覧 + AI週次分析 + カレンダー連携 + 通知（2-3週間）

- [ ] Notion読み取り Edge Function（当日 / 月範囲 / 週範囲）
- [ ] TanStack Query 永続キャッシュ設定
- [ ] Calendar画面: 月間カレンダー（Feeling表示・記録ドット）
- [ ] 過去エントリ閲覧・編集
- [ ] Googleカレンダー OAuth + 期間イベント取得 Edge Function
- [ ] iCal フィードURL からのイベント取得（Should）
- [ ] 週次AI分析 Edge Function（Claude API、ワンショット）
- [ ] Reflect画面: 週ピッカー + 分析結果表示
- [ ] カレンダー実績を週次AI分析の入力に統合
- [ ] **リマインダー通知**（expo-notifications, 時間設定, 記録済みスキップ）

ゲート条件: 過去ジャーナルを快適に読み返せて、週次AI分析（カレンダー込み）と通知が動く

## Phase 3: ホーム画面ウィジェット（1週間）

唯一 Swift（WidgetKit）を書くフェーズ。`@bacons/apple-targets` 等で App Extension を追加する。

- [ ] Apple Targets config plugin 導入
- [ ] ウィジェット: 今日の記録状況 / 直近のふりかえりを表示
- [ ] ウィジェットタップ → アプリの該当画面へディープリンク
- [ ] App Group でアプリ⇄ウィジェット間データ共有

ゲート条件: ホーム画面ウィジェットから「気軽な見返し」ができる

## 個人利用版 完成（TestFlight 配布）

---

## Phase 4: ウィークリー + Insights + コンテキストソース拡張（任意・後回し可）

- [ ] ウィークリージャーナル連携（分析的ふりかえり。充電/放電は Daily 本文へ移動済み）
- [ ] KPT入力・連携
- [x] ~~Insights画面~~ → タブとしては廃止し統合済み: 週データ（Feeling推移/習慣達成率）は Reflect 内、ストリークは Calendar ヘッダーへ（2026-07）
- [ ] HealthKit 連携: 睡眠 / 歩数 / 運動 / 心拍などを取得し、Today 表示と週次AI分析の入力に統合
- [ ] 当日撮影写真の取り込み: PhotoKit メタデータ取得、Today で振り返り素材として表示、AI 週次分析の入力ソース化

## Phase 5: 拡張（任意）

- [ ] 月次AIレポート自動生成
- [ ] フィールド表示/非表示カスタマイズ
- [ ] 生体認証ロック
- [ ] オフライン記録 → 復帰時同期
- [ ] （将来プロダクト化する場合）課金・マーケティング → `nikki-spec-full.md` §9, §12
