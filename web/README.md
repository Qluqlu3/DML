# DML — 解体業者口コミサイト

解体業者の検索・口コミ投稿ができるサービス。全国 1,000社以上の法人情報をもとに、業者選びをサポート。

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイリング | Chakra UI v3 |
| ORM | Prisma 7 |
| DB | PostgreSQL 16 |
| コンテナ | Docker / Docker Compose |
| パッケージマネージャ | pnpm |

## セットアップ

### 前提条件

- Node.js 22+
- pnpm 11+
- Docker / Docker Compose

### 起動手順

```bash
# 依存関係インストール
pnpm install

# DB + アプリ起動 (Docker)
docker compose up -d

# マイグレーション & シードデータ投入 (初回のみ)
pnpm db:migrate
pnpm db:seed
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く。

### ローカル開発 (Docker なし)

`.env` に `DATABASE_URL` を設定したうえで:

```bash
pnpm dev
```

## 主なコマンド

```bash
pnpm dev          # 開発サーバー起動
pnpm build        # 本番ビルド
pnpm lint         # Lint チェック
pnpm db:migrate   # Prisma マイグレーション
pnpm db:seed      # シードデータ投入
pnpm db:studio    # Prisma Studio 起動
```

## プロジェクト構成

```
web/
├── src/
│   ├── app/          # App Router ページ
│   └── components/   # UI コンポーネント
├── prisma/
│   ├── schema.prisma # DB スキーマ
│   └── seed.ts       # シードスクリプト
├── prisma.config.ts  # Prisma 設定
├── Dockerfile
└── docker-compose.yml
```
