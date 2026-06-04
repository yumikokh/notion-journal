# Supabase Edge Functions

このディレクトリは Notion + Claude へのアクセスを担うサーバー側コード。
すべての関数は TypeScript / Deno で書かれ、Supabase でホストされる。
**Notion トークンと Claude APIキーは Supabase secrets にだけ存在し、端末に出ない**。

## 関数

| 関数 | 入力 | 出力 | 役割 |
|---|---|---|---|
| `notion-today-get` | `{ date: "YYYY-MM-DD" }` | `{ page, bodyMarkdown }` | 2026/Daily DB から指定日のページ + 本文を取得 |
| `notion-today-save` | `{ notionPageId, date, properties, bodyMarkdown }` | `{ notionPageId }` | ページ作成 or 更新 + 本文置換 |
| `notion-month-get` | `{ yearMonth: "YYYY-MM" }` | `{ entries }` | カレンダー表示用の月次サマリー取得 |
| `notion-cover-upload` | `{ notionPageId, base64, mime, filename }` | `{ ok }` | ページカバー画像のアップロード |
| `ai-structure` | `{ bodyText, systemPrompt? }` | `{ diary }` | Claude で本文を日記ハイライトに要約 |
| `ai-weekly-analyze` | `{ weekStart, weekEnd }` (どちらも YYYY-MM-DD、weekEnd は含む) | `{ analysis, source }` | 指定週の Daily を集約して週次AI分析（summary / patterns / kpt / nextFocus）|
| `google-oauth-exchange` | `{ code, codeVerifier, redirectUri }` | `{ ok, scope }` | PKCE 認可コードを refresh_token に交換し `public.google_oauth` に保存 |
| `google-oauth-status` | なし | `{ connected, scope?, connectedAt? }` | 接続状態を返す |
| `google-oauth-disconnect` | なし | `{ ok }` | refresh_token を削除 + Google に revoke (best-effort) |
| `google-calendar-list` | `{ timeMin, timeMax, calendarId? }` (ISO 8601) | `{ events: { start, end, summary, description?, calendarId }[] }` | 指定範囲の予定を取得（refresh_token から access_token を都度更新） |
| `google-oauth-redirect` | (GET, ブラウザから) | HTML (302 相当) | Google が HTTPS のみ許可する OAuth redirect を受け、`notion-journal://google-oauth?...` にブリッジするだけ |

## 初回セットアップ

```bash
# 1. CLI 導入（未導入なら）
brew install supabase/tap/supabase

# 2. Supabase にログイン
supabase login

# 3. このディレクトリで `supabase init`（config.toml 生成）
supabase init

# 4. Web ダッシュボードで作ったプロジェクトに紐付け
supabase link --project-ref <your-project-ref>

# 5. シークレットを設定
supabase secrets set NOTION_TOKEN=secret_xxx
supabase secrets set NOTION_DB_ID=9d854c37-a54c-835f-b449-876db44cf666
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET=xxx

# 6. デプロイ
supabase functions deploy notion-today-get
supabase functions deploy notion-today-save
supabase functions deploy notion-month-get
supabase functions deploy notion-cover-upload
supabase functions deploy ai-structure
supabase functions deploy ai-weekly-analyze
supabase functions deploy google-oauth-exchange
supabase functions deploy google-oauth-status
supabase functions deploy google-oauth-disconnect
supabase functions deploy google-calendar-list
supabase functions deploy google-oauth-redirect

# DB migration (google_oauth テーブル) を反映
supabase db push
```

## ローカルでのテスト

```bash
# 全関数をローカル起動（Docker 必要）
supabase functions serve --env-file ./supabase/.env.local

# 別ターミナルで叩く
curl -i -X POST http://127.0.0.1:54321/functions/v1/notion-today-get \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-05-24"}'

# 週次AI分析（weekEnd は含む。日曜終わりの週なら 2026-05-18 〜 2026-05-24）
curl -i -X POST http://127.0.0.1:54321/functions/v1/ai-weekly-analyze \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"weekStart":"2026-05-18","weekEnd":"2026-05-24"}'
```

ローカル用の `supabase/.env.local`（gitignore 推奨）:
```
NOTION_TOKEN=secret_xxx
NOTION_DB_ID=9d854c37-a54c-835f-b449-876db44cf666
ANTHROPIC_API_KEY=sk-ant-xxx
```

## アプリ側の env

アプリは Supabase に接続するための **URL + anon key** が必要。
プロジェクトルートの `.env.local`（gitignore 済み）に:
```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```
anon key は Supabase が「公開してよい」鍵として設計されているもの ── 端末バンドルに入っても問題ない。
