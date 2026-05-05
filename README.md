# 婚活偏差値診断（AI）

- **Backend**: Go（Chi）— 任意。Vercel では Next の Route Handlers が `/api/*` を兼ねられる
- **Frontend**: Next.js（App Router）

## Vercel デプロイ

1. Vercel の **Root Directory** を **`frontend`** に設定する
2. **Framework Preset** は **Next.js**（Go にしない）
3. 環境変数（任意）:
   - `OPENAI_API_KEY` … 未設定ならモック診断
   - `OPENAI_MODEL` … 既定 `gpt-4o-mini`
   - `NEXT_PUBLIC_SITE_URL` … 本番 URL（未設定時は `VERCEL_URL` を利用）

`NEXT_PUBLIC_API_URL` は **空のまま**でよい（同一オリジンの `/api/questions`・`/api/diagnose` を使用。共有ページはトークンを直接デコード）。

## 開発

### Next のみ（API も `next dev` 内の `/api/*`）

```bash
cd konkatsu-diagnosis/frontend
cp .env.example .env.local
npm install
npm run dev
# http://localhost:3000
```

### Go API と分離して開発

ターミナル1（API）:

```bash
cd konkatsu-diagnosis
go run ./cmd/server
# http://localhost:8080/health
```

ターミナル2（Next）— `.env.local` に `NEXT_PUBLIC_API_URL=http://localhost:8080` など:

```bash
cd konkatsu-diagnosis/frontend
npm install
npm run dev
```

Go 側の CORS は既定で `http://localhost:3000` を許可。別オリジンの場合:

```bash
export CORS_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

## Docker Compose（API + Next）

プロジェクト直下で:

```bash
cd konkatsu-diagnosis
cp .env.example .env   # 必要なら OPENAI_API_KEY を記入
docker compose up --build
```

- フロント: <http://localhost:3000>
- API: <http://localhost:8080/health>

ブラウザは **ホストの** `localhost:8080` へ直接リクエストするため、`NEXT_PUBLIC_API_URL=http://localhost:8080` にしています。共有ページ `/share/...` は URL 内トークンをサーバーで直接復元するため、SSR 向けの別 API URL は不要です。

## 環境変数

| 変数 | 場所 | 説明 |
|------|------|------|
| `OPENAI_API_KEY` | Go または **Next（Vercel）** | 未設定時はモック診断 |
| `OPENAI_MODEL` | 同上 | 既定 `gpt-4o-mini` |
| `NEXT_PUBLIC_API_URL` | Next | **空**＝同一オリジンの Route Handlers。Go 分離時のみ Go の URL |
| `NEXT_PUBLIC_SITE_URL` | Next | OGP の絶対URL（本番推奨） |
| `CORS_ORIGINS` | Go | ブラウザから別オリジンの Go を叩くとき必須 |

## 本番の例

- **Vercel のみ**: `frontend` をデプロイし、必要なら `OPENAI_API_KEY` を設定（上記）。
- **Go を別ホストに置く場合**: `NEXT_PUBLIC_API_URL` に Go の URL、`CORS_ORIGINS` にフロントのオリジン。
# konkatsu-diagnosis
