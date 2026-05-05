# 婚活偏差値診断（AI）

- **Backend**: Go（Chi）— `OPENAI_API_KEY` はサーバーのみ
- **Frontend**: Next.js（App Router）— Vercel 向け

## 開発

ターミナル1（API）:

```bash
cd konkatsu-diagnosis
go run ./cmd/server
# http://localhost:8080/health
```

ターミナル2（Next）:

```bash
cd konkatsu-diagnosis/frontend
cp .env.example .env.local
npm install
npm run dev
# http://localhost:3000
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

ブラウザは **ホストの** `localhost:8080` へ直接リクエストするため、`NEXT_PUBLIC_API_URL=http://localhost:8080` にしています。Next のサーバー（共有ページのメタ取得）だけ `http://api:8080`（Compose 内のサービス名）を使います。

## 環境変数

| 変数 | 場所 | 説明 |
|------|------|------|
| `OPENAI_API_KEY` | Go | 未設定時はモック診断 |
| `OPENAI_MODEL` | Go | 既定 `gpt-4o-mini` |
| `NEXT_PUBLIC_API_URL` | Next | ブラウザから参照する Go の URL |
| `API_URL` | Next | SSR で `/api/share/...` メタ取得時に使う Go の URL |
| `NEXT_PUBLIC_SITE_URL` | Next | OGP の絶対URL（本番推奨） |
| `CORS_ORIGINS` | Go | カンマ区切りで許可オリジン |

## 本番の例

- **Next.js** を Vercel にデプロイ。環境変数に公開 Go API の URL を設定。
- **Go API** は Fly.io / Railway / Render 等にデプロイし、`CORS_ORIGINS` に Vercel の URL を追加。

同一オリジンにしない限り、ブラウザから Go を叩くには CORS 設定が必須です。
# konkatsu-diagnosis
