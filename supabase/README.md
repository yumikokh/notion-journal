# Supabase Edge Functions

このディレクトリは Notion + Claude へのアクセスを担うサーバー側コード。
すべての関数は TypeScript / Deno で書かれ、Supabase でホストされる。
**Notion トークンと Claude APIキーは Supabase secrets にだけ存在し、端末に出ない**。

## 関数

| 関数 | 入力 | 出力 | 役割 |
|---|---|---|---|
| `notion-today-get` | `{ date: "YYYY-MM-DD" }` | `{ page, bodyMarkdown }` | 2026/Daily DB から指定日のページ + 本文を取得 |
| `notion-today-save` | `{ notionPageId, date, properties, bodyMarkdown }` | `{ notionPageId }` | ページ作成 or 更新 + 本文置換 |
| `ai-structure` | `{ bodyText }` | `{ structured }` | Claude で本文を構造化 |

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

# 6. デプロイ
supabase functions deploy notion-today-get
supabase functions deploy notion-today-save
supabase functions deploy ai-structure
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
