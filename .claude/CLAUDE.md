# Nikki (notion-journal)

Notion連携のジャーナル & AI週次分析アプリ（iOS）。
既存のNotionデイリー/ウィークリージャーナルDBと連携し、スマホ最適化UIと、カレンダー実績を取り込んだ週次AI分析機能を提供する。
個人利用ツールとして開発する（Web対応・課金・オフライン同期はスコープ外）。

## Stack

- Expo (React Native) — iOS のみ
- TypeScript
- Expo Router（ファイルベースルーティング）
- TanStack Query（サーバー状態管理・永続キャッシュ）
- Supabase (Auth, Edge Functions / TypeScript・Deno)
- Notion API (OAuth 2.0)
- Google Calendar API (OAuth 2.0) + iCal フィード取得
- Claude API (週次分析のワンショット呼び出し)
- expo-notifications（リマインダー）
- ウィジェット: WidgetKit (Swift) ※後フェーズ。`@bacons/apple-targets` 等で App Extension として追加

## Commands

```bash
npm install                       # 依存インストール
npx expo start                    # 開発サーバー起動（dev client / 実機にQR接続）
npx expo start --ios              # iOSシミュレータで起動（要Xcode）
npm test                          # テスト実行 (Jest + React Native Testing Library)
npx tsc --noEmit                  # 型チェック
npx expo lint                     # Lint
npx eas build --platform ios      # クラウドビルド (EAS Build)
npx eas submit --platform ios     # TestFlight 提出
```

## Architecture

- feature-first 構成。`src/features/{feature}/` 配下に screens, components, hooks, api, types を置く
- ルーティングは `app/` ディレクトリ（Expo Router）
- サーバー状態は TanStack Query で管理。**Notion がデータの source of truth**
- Notion へのアクセスは必ず Supabase Edge Function 経由（クライアントから直接叩かない）
- ローカルDBは持たない。設定は AsyncStorage、トークンは expo-secure-store（AI週次分析の結果は TanStack Query のキャッシュに乗るだけで、永続化しない）
- オフライン対応は優先度低（TanStack Query の永続キャッシュで読み返しの体感速度を担保する程度）

## Conventions

- ファイル名: コンポーネントは `PascalCase.tsx`、フック・ユーティリティは `camelCase.ts`、ルートファイルは Expo Router の規約（小文字）
- React は関数コンポーネント + Hooks
- 型は明示する。`any` 禁止
- テストは対象ファイルと同じ階層に `*.test.ts(x)` で配置
- コミットメッセージ: Conventional Commits (feat:, fix:, chore:, docs:, refactor:)
- 日本語UIだが、コード内の変数名・コメントは英語

## Key docs (read on demand)

仕様・設計の詳細は以下を参照。作業に関連するファイルだけ読むこと:

- `.claude/SPEC.md` — プロダクト仕様（ユーザーストーリー、画面構成）
- `.claude/DATA_MODEL.md` — データの所在とローカル保存スキーマ
- `.claude/PHASES.md` — 開発フェーズとMVP定義
- `.claude/nikki-spec-full.md` — 全体仕様の詳細リファレンス（背景、競合分析、AI設計など）

## Rules

- Notion API のアクセストークンをクライアントに持たせない。必ず Supabase Edge Functions 経由
- AI APIキーもサーバー経由。クライアントにハードコードしない
- Supabase のセッショントークンは expo-secure-store に保存
- 日本語UIだが、コード内の変数名・コメントは英語
- IMPORTANT: テスト追加なしで機能PRを出さない
