# DML

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js (App Router) |
| 言語 | TypeScript |
| スタイリング | Chakra UI v3 |
| ORM | Prisma 7 |
| DB | PostgreSQL 16 |
| コンテナ | Docker / Docker Compose |
| パッケージマネージャ | pnpm |

## 起動

```bash
pnpm install
docker compose up -d

# 初回のみ
pnpm db:migrate
pnpm db:seed
```

http://localhost:3000

### ローカル開発（Docker なし）

`.env` に `DATABASE_URL` を設定して:

```bash
pnpm dev
```

## コマンド

```bash
pnpm dev          # 開発サーバー
pnpm build        # ビルド
pnpm db:migrate   # マイグレーション
pnpm db:seed      # シード投入
pnpm db:studio    # Prisma Studio
```

## 構成

```
.
├── src/
│   ├── app/               # App Router ページ
│   └── components/ui/     # UI コンポーネント
├── prisma/                # スキーマ・マイグレーション・シード
├── scripts/               # Python データ収集スクリプト
├── data/processed/        # 処理済みデータ（JSON / CSV）
├── prisma.config.ts
├── Dockerfile
└── docker-compose.yml
```
