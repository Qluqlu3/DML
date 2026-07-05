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

## 管理画面

`/admin` 以下は二重にアクセス制限をかけている。

1. **Basic認証**（常時有効）— `.env` の `ADMIN_BASIC_AUTH_USER` / `ADMIN_BASIC_AUTH_PASSWORD` で設定。未設定の場合は `/admin` 全体が401になる。
2. **ID/パスワードログイン** — `admin_users` テーブルに登録したアカウントで認証。Basic認証を通過した後に表示されるログイン画面。

追加で、IPアドレスによるアクセス制限を任意でかけられる（`ADMIN_ALLOWED_IPS` にカンマ区切りで許可IPを指定）。ただし `X-Forwarded-For` はクライアントが偽装できるヘッダーのため、信頼できるリバースプロキシ（実IPで上書きするもの）を手前に置いている場合のみ有効。現状のdocker-compose構成のようにアプリを直接公開している場合は設定しても効果が無いので注意。

### 管理者アカウントの作成

登録画面は無いため、CLIから作成する。パスワードはランダムな15文字（大小英字・数字・記号混在）で生成し、scryptでハッシュ化してDBに保存する。

```bash
pnpm admin:create-user [username]   # 省略時は "admin"
```

生成された平文の認証情報は `admin-credentials.local.md`（gitignore済み）に書き出される。同じユーザー名で再実行するとパスワードを再発行できる。

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
