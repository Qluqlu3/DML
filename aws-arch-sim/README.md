# AWS Arch Sim

AWS サービスをボックスとして D&D で配置・接続し、構成図を作って学ぶシミュレーター。
設計は [docs/DESIGN.md](docs/DESIGN.md) を参照。

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
- [ ] フェーズ 2: 判定エンジン・問題モード
- [ ] フェーズ 3: シミュレーター・インシデントモード
- [ ] フェーズ 4: 公式アイコン・解説・PNG 書き出し
