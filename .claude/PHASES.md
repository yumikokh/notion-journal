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
- [ ] Today画面: Feelingピッカー
- [ ] Today画面: Good / Highlight / Struggle / Next の4カード入力
- [ ] Today画面: 習慣チェックボックス
- [ ] 自由記述エディタ
- [ ] Notion書き込み Edge Function（ページ作成・更新）
- [ ] TanStack Query mutation + 楽観的更新

ゲート条件: アプリで入力 → Notion に反映される

## Phase 2: 閲覧 + AIふりかえり + 通知（2週間）

- [ ] Notion読み取り Edge Function（当日 / 月範囲 / 週範囲）
- [ ] TanStack Query 永続キャッシュ設定
- [ ] Calendar画面: 月間カレンダー（Feeling表示・記録ドット）
- [ ] 過去エントリ閲覧・編集
- [ ] **日次送り閲覧**（左右スワイプで前後日遷移）
- [ ] AIチャット Edge Function（Claude API）
- [ ] Reflect画面: チャットUI + プリセットプロンプト
- [ ] AI会話履歴を expo-sqlite に保存
- [ ] **リマインダー通知**（expo-notifications, 時間設定, 記録済みスキップ）

ゲート条件: 過去ジャーナルを快適に読み返せて、AIふりかえりと通知が動く

## Phase 3: ホーム画面ウィジェット（1週間）

唯一 Swift（WidgetKit）を書くフェーズ。`@bacons/apple-targets` 等で App Extension を追加する。

- [ ] Apple Targets config plugin 導入
- [ ] ウィジェット: 今日の記録状況 / 直近のふりかえりを表示
- [ ] ウィジェットタップ → アプリの該当画面へディープリンク
- [ ] App Group でアプリ⇄ウィジェット間データ共有

ゲート条件: ホーム画面ウィジェットから「気軽な見返し」ができる

## 個人利用版 完成（TestFlight 配布）

---

## Phase 4: ウィークリー + Insights（任意・後回し可）

- [ ] ウィークリージャーナル連携（充電/放電ログ）
- [ ] KPT入力・連携
- [ ] Insights画面: Feeling推移 / 習慣達成率 / ストリーク

## Phase 5: 拡張（任意）

- [ ] AIアクション（KPT・Nextに直接追加）
- [ ] 月次AIレポート自動生成
- [ ] 生体認証ロック
- [ ] （将来プロダクト化する場合）課金・マーケティング → `nikki-spec-full.md` §9, §12
