# demolition

独立した 2 つのアプリを置いているリポジトリ。設定・依存はフォルダごとに完結している。

| フォルダ | 内容 | 技術 |
|---|---|---|
| [dml/](dml/) | 全国の解体業者を検索・口コミ比較できるサイト | Next.js / Prisma / PostgreSQL |
| [aws-arch-sim/](aws-arch-sim/) | AWS 構成図を作って学ぶシミュレーター | Vite / React / React Flow |

起動方法はそれぞれのフォルダの README を参照。

## 共通の設定

- `.github/workflows/ci.yml`: CI（dml の lint・型チェック・ビルド）
- `lefthook.yml`: git フック。フォルダごとのジョブで、それぞれの biome などを実行する。
  フックは `dml/` で `pnpm install` したときにインストールされる
