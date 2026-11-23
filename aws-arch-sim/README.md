# AWS Arch Sim

AWS サービスをボックスとして D&D で配置・接続し、構成図を作って学ぶシミュレーター。
設計は [docs/DESIGN.md](docs/DESIGN.md)（全体）と [docs/LEARNING.md](docs/LEARNING.md)（学習モード・ビジュアル刷新）を参照。

demolition リポジトリのルート直下に、解体アプリ（`../dml/`）と並べて置いている。
依存・設定・lint はすべてこのフォルダ内で完結している。

## 起動

```bash
cd aws-arch-sim
pnpm install
pnpm dev        # http://localhost:5173
```

## コマンド

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー |
| `pnpm build` | 型チェック + 本番ビルド（`dist/`） |
| `pnpm test` | engine / store の単体テスト |
| `pnpm typecheck` | 型チェック |
| `pnpm check` | biome で lint + format（自動修正） |

git フック（ルートの `lefthook.yml`）が、コミット時に biome、push 時に biome・型チェック・テストを実行する。
フックは `dml/` で `pnpm install` したときにインストールされる。

## 実装状況

- [x] フェーズ 1: サンドボックス（D&D 配置、VPC / AZ / サブネットの入れ子、接続、設定編集、SG、undo/redo、自動保存、JSON 入出力）
- [x] フェーズ 2: ビジュアル刷新（立体シェイプ・公式アイコン）
- [ ] フェーズ 3: 判定エンジン
- [ ] フェーズ 4〜5: 学習モード（枠組み・コンテンツ）
- [ ] フェーズ 6: 問題モード
- [ ] フェーズ 7: シミュレーター・インシデントモード
- [ ] フェーズ 8: 仕上げ
