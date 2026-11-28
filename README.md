# demolition

解体アプリを置いているリポジトリ。設定・依存はフォルダごとに完結している。

| フォルダ | 内容 | 技術 |
|---|---|---|
| [dml/](dml/) | 全国の解体業者を検索・口コミ比較できるサイト | Next.js / Prisma / PostgreSQL |

起動方法はそれぞれのフォルダの README を参照。

AWS 構成図シミュレーター（旧 `aws-arch-sim/`）は [Qluqlu3/cloud-arch-sim](https://github.com/Qluqlu3/cloud-arch-sim) に履歴ごと移した。

## 共通の設定

- `.github/workflows/ci.yml`: CI（dml の lint・型チェック・ビルド）
- `lefthook.yml`: git フック。フォルダごとのジョブで、それぞれの biome などを実行する。
  フックは `dml/` で `pnpm install` したときにインストールされる
