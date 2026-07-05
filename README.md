# DML

全国の解体業者を検索・口コミ比較できるサイト。国税庁の法人番号データと国土交通省 BizNav（建設業許可情報）を元にした業者データベースを持ち、利用者は都道府県・業者名で検索し、価格・対応・仕上がりの口コミを閲覧できる。管理画面では業者情報の補完（WEBサイトURL登録など）や口コミの公開管理を行う。

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
docker compose up -d
```

これだけで DB の起動・マイグレーション適用・シード投入・開発サーバーの起動まで自動で行われる。

`http://localhost:5050`

### ローカル開発（Docker なし）

`.env` に `DATABASE_URL` を設定して:

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`http://localhost:5050`

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
