# AWS Arch Sim 設計書

AWS サービスをボックスとして D&D で配置・接続し、構成図を作る学習用アプリ。
「自由に作る」「学びながら作る」「指示どおりに作る」「障害を直す」の 4 モードを持つ。
学習モードとビジュアル刷新は [LEARNING.md](LEARNING.md) に分けて書いている。

> demolition リポジトリのルート直下に、解体アプリ（`dml/`）と並べて置いている。アプリとしては完全に独立している。
> 将来別リポジトリに切り出すときは `aws-arch-sim/` をそのまま移せばよい。

---

## 1. 決定事項

| 項目 | 決定 |
|---|---|
| 配置 | `demolition/aws-arch-sim/`（`dml/` と並列。このリポジトリにコミット） |
| 構成 | フロントのみの SPA。バックエンド・DB なし |
| 判定 | ルール判定 ＋ 疑似メトリクス（定常状態の計算） |
| ネットワーク | VPC > AZ > Subnet を入れ子の枠で表現 |
| 対象 | SAA レベル・約 20 サービス、主要設定項目あり |
| アイコン | AWS Architecture Icons（公式）。未配置時は代替表示 |
| インシデント | ターン制（調査 → 変更 → 適用 → 結果確認 を繰り返す） |
| シナリオ | TS のデータファイルで宣言的に定義。初期は問題 5・インシデント 5 |
| 保存 | localStorage ＋ JSON の書き出し・読み込み |

## 2. 技術スタック

| 用途 | 採用 |
|---|---|
| ビルド | Vite + React + TypeScript |
| キャンバス | `@xyflow/react`（React Flow）：D&D、接続、入れ子（`parentId`）、リサイズ |
| 状態管理 | Zustand（undo/redo は操作確定時のスナップショットを自前で保持） |
| UI | CSS Modules（UI ライブラリは入れず軽量に保つ） |
| ルーティング | React Router（hash ルーティング） |
| テスト | Vitest（判定エンジン・シミュレーターは純粋 TS なので単体テスト中心） |
| Lint/Format | Biome（dml と同じ設定方針を独自に持つ） |
| パッケージ管理 | pnpm（独自の `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` を持つ） |

### リポジトリ内での位置づけ

```
demolition/            # git ルート
├── .github/           # CI（dml のみ対象）
├── lefthook.yml       # git フック（dml / aws-arch-sim をフォルダ別ジョブで検査）
├── dml/               # 解体アプリ（Next.js）
└── aws-arch-sim/      # このアプリ
```

- dml と aws-arch-sim は設定・依存を共有しない。互いの tsconfig / biome の対象にも入らない
- git フックはルートの `lefthook.yml` で、各ジョブを `root:` 指定でそれぞれのフォルダで実行する
- aws-arch-sim 用の CI は当面作らない

## 3. ディレクトリ構成

```
aws-arch-sim/
├── docs/DESIGN.md
├── public/icons/aws/          # 公式アイコン SVG（scripts/import-icons で配置）
├── scripts/import-icons.ts    # アセットパッケージ zip から必要な SVG を抽出
├── src/
│   ├── engine/                # React に依存しない純粋ロジック
│   │   ├── catalog/           # サービス定義（種類・設定項目・接続可否・容量・料金）
│   │   ├── model.ts           # ArchModel 型とキャンバス状態からの正規化
│   │   ├── rules/             # ルール判定（述語ライブラリ＋ベストプラクティス Linter）
│   │   ├── simulator/         # 疑似メトリクス計算
│   │   └── scoring.ts
│   ├── scenarios/
│   │   ├── challenges/        # 問題モードのシナリオ（1 ファイル 1 問）
│   │   └── incidents/         # インシデントモードのシナリオ
│   ├── store/                 # Zustand ストア（キャンバス・進捗・永続化）
│   ├── canvas/                # React Flow のノード・エッジ・D&D 処理
│   ├── panels/                # パレット、インスペクター、結果パネル等
│   ├── modes/                 # sandbox / challenge / incident の画面
│   └── main.tsx
├── package.json
└── pnpm-workspace.yaml
```

`engine/` は UI から完全に分離し、シナリオの判定・シミュレーションをテストだけで検証できるようにする。

## 4. ドメインモデル

### 4.1 ノードの種類

**コンテナ（枠）**: 中に他ノードを入れられる。

| 種類 | 入れられる場所 | 主な設定 |
|---|---|---|
| VPC | キャンバス直下 | CIDR, IGW アタッチ有無 |
| AZ | VPC 内 | AZ 名（a / c / d） |
| Subnet | AZ 内 | 種別 public/private, CIDR, デフォルトルート（IGW / NAT GW / なし） |

**サービス（ボックス）**: 配置場所の制約で 3 種類に分ける。

| 配置区分 | 意味 | 該当サービス |
|---|---|---|
| `global` | VPC の外に置く | Client(ユーザー), Route 53, CloudFront, WAF, S3, DynamoDB, SQS, SNS, API Gateway, Lambda※ |
| `vpc` | VPC 枠内（サブネットの外）に置き、設定で複数サブネットを選ぶ | ALB, NLB, Auto Scaling Group, ECS Service(Fargate), Internet Gateway |
| `subnet` | 特定のサブネット枠内に置く | EC2, NAT Gateway, RDS, Aurora, ElastiCache |

※ Lambda は global に置き、設定「VPC 接続」で private サブネットを選べる。

`vpc` 区分のノードは、選択したサブネットへ点線を自動で描画し、どの AZ にまたがるかを見えるようにする。
RDS / Aurora / ElastiCache は配置したサブネットをプライマリとし、Multi-AZ やレプリカは設定値として持つ（スタンバイは別 AZ の同種サブネットに自動で割り当て、ノード上にバッジ表示）。

### 4.2 サービス一覧と設定項目（初期 19 ＋ Client）

| カテゴリ | サービス | 主な設定項目 |
|---|---|---|
| エッジ | Route 53 | ルーティングポリシー（simple / failover / latency）、ヘルスチェック |
| | CloudFront | キャッシュ率想定、オリジン、OAC 有無 |
| | WAF | ルールセット（マネージド / レートベース） |
| ネットワーク | Internet Gateway | — |
| | NAT Gateway | — |
| LB | ALB | サブネット、リスナー（80/443）、ヘルスチェック |
| | NLB | サブネット、リスナー |
| コンピュート | EC2 | インスタンスタイプ、SG |
| | Auto Scaling Group | サブネット、インスタンスタイプ、min/desired/max、スケーリングポリシー、SG |
| | ECS Service (Fargate) | サブネット、vCPU/メモリ、タスク数、オートスケール、SG |
| | Lambda | メモリ、同時実行数上限（予約）、VPC 接続 |
| 統合 | API Gateway | スロットリング上限 |
| | SQS | 標準 / FIFO、可視性タイムアウト、DLQ 有無 |
| | SNS | — |
| DB | RDS | エンジン、インスタンスタイプ、Multi-AZ、リードレプリカ数、SG |
| | Aurora | インスタンスタイプ、リーダー数、SG |
| | DynamoDB | キャパシティモード（オンデマンド / プロビジョンド）、RCU/WCU |
| | ElastiCache | エンジン、ノードタイプ、レプリカ数、SG |
| ストレージ | S3 | 公開設定（ブロック / 公開）、バージョニング |

各サービスの定義（`engine/catalog/`）は以下を持つ。

```ts
type ServiceDef = {
  kind: ServiceKind;
  label: string;
  category: Category;
  placement: 'global' | 'vpc' | 'subnet';
  icon: string;                    // public/icons/aws/ 内のファイル名
  config: ConfigField[];           // インスペクターに出す項目（型・選択肢・既定値）
  defaultPort?: number;            // 接続時の既定ポート（RDS=3306 等）
  canConnectTo: ServiceKind[];     // 送信先として許可する種類
  capacity: (cfg) => Capacity;     // シミュレーター用：処理能力（rps 等）
  baseLatencyMs: number;
  monthlyCost: (cfg) => number;    // 概算コスト（固定の簡易単価表）
};
```

### 4.3 接続（エッジ）

- 向きあり。`A → B` は「A が B にリクエストを送る」を意味する。
- エッジはプロトコル・ポートを持つ（既定値は送信先の `defaultPort`）。
- `canConnectTo` に無い接続（例: S3 → RDS）はキャンバス上で接続不可にし、理由をツールチップで出す。

### 4.4 セキュリティグループ

- SG は画面横の「Security Groups」パネルで独立に定義し、VPC 内のノードが参照する（複数可）。
- インバウンドルール: `{ port, source: { sgId } | { cidr } }`。アウトバウンドは全許可固定（SAA 範囲では簡略化）。
- 判定時、`A → B` のエッジごとに「B の SG が A の SG（または CIDR）からそのポートを許可しているか」を検査する。

### 4.5 正規化モデル

React Flow のノード・エッジから、判定とシミュレーション用の `ArchModel` を作る。

```ts
type ModelNode = DocNode & {
  vpcId: string | null;    // 所属 VPC（Lambda はサブネット指定から決まる）
  subnetIds: string[];     // 置かれている・配置先に選ばれているサブネット
  azIds: string[];         // 上のサブネットが属する AZ
};
type ArchModel = {
  doc: ArchDocument;
  nodes: ModelNode[];
  byId: Map<string, ModelNode>;
  edges: DocEdge[];
  outgoing: Map<string, DocEdge[]>;
  securityGroups: SecurityGroup[];
  sgById: Map<string, SecurityGroup>;
};
```

判定・シミュレーターは `ArchModel` だけを入力とし、UI の座標などには依存しない。

## 5. 判定エンジン

### 5.1 ルール

```ts
type Rule = {
  id: string;
  title: string;                   // 「DB がプライベートサブネットにある」
  severity: 'required' | 'recommended';
  check: (m: ArchModel) => { pass: boolean; message?: string; nodeIds?: string[] };
};
```

シナリオは、よく使う述語ライブラリを組み合わせてルールを宣言する。

| 述語 | 例 |
|---|---|
| `exists(kind, where?)` | ALB が存在する |
| `count(kind) op n` | EC2 が 2 台以上（ASG の desired も合算） |
| `spansAzs(kind, n)` | ALB / ASG が 2 AZ 以上にまたがる |
| `inSubnetType(kind, 'private')` | RDS がプライベートサブネットにある |
| `config(kind, key, op, value)` | RDS の Multi-AZ が有効 |
| `pathExists(from, to, { via? })` | Client → CloudFront → S3 の経路がある |
| `noPath(from, to)` | Client から RDS に直接届かない |
| `sgAllows(from, to, port)` | ASG から RDS への 3306 が許可されている |
| `egressToInternet(kind)` | 対象からインターネットへ出られる（NAT / IGW の経路） |
| `costBelow(usd)` | 月額概算が予算内 |

正解の構成は 1 つに限らず、要件をすべて満たせば正解とする（例: キャッシュは ElastiCache でも CloudFront でも可、などを OR で書ける）。

### 5.2 ベストプラクティス Linter

全モードで常時動く警告。サンドボックスでは学習のヒントになる。

- DB / キャッシュが public サブネットにある
- EC2 / ASG が単一 AZ のみ
- RDS が Multi-AZ でない
- private サブネットにインターネットへの経路が無いのに外部への通信がある
- SG が 0.0.0.0/0 から DB ポートを許可している
- S3 が公開設定で、CloudFront から OAC 経由になっていない

#### 実装メモ（フェーズ 8）

`src/engine/rules/linter.ts`。警告（warning）と情報（info）の 2 段階で、上の 6 項目に加えて「SSH の全開放」「ロードバランサーが 1 AZ」「配置サブネット未選択」「NAT Gateway が Private サブネット」「SQS に DLQ なし」を見る。
表示はサンドボックスだけにしている（学習・問題モードで出すと答えになってしまうため）。問題モードの模範解答で警告が出ないことをテストで確かめている。

## 6. 疑似メトリクス（シミュレーター）

ターン制なので時間変化は追わず、「ある負荷と障害条件での定常状態」を 1 回計算する。

### 6.1 入力

```ts
type TrafficProfile = {
  rps: number;            // Client からの総リクエスト/秒
  readRatio: number;      // 読み取り比率
  cacheableRatio: number; // CDN / キャッシュで返せる比率
};
type Fault =
  | { type: 'az-down'; az: string }
  | { type: 'instance-fail'; nodeId: string }
  | { type: 'traffic-spike'; multiplier: number }
  | { type: 'ddos'; rps: number }
  | { type: 'dependency-slow'; nodeId: string; addLatencyMs: number };
```

### 6.2 計算

1. Client から有向グラフをたどり、各ノードの流入負荷を求める。
   - 振り分け: LB は配下へ均等に分配し、障害中の AZ やノードは除外する。
   - キャッシュ: CloudFront / ElastiCache は `cacheableRatio` 分を自分で返し、残りだけ下流へ流す。
   - 読み書き分離: リードレプリカ / Aurora リーダーがあれば読み取りを分散する。
   - 非同期: SQS の下流は処理能力分だけ流れ、超過分は「滞留メッセージ」として計上する（エラーにはしない）。
2. ノードごとに `利用率 = 負荷 / 容量` を出す。容量はインスタンスタイプ×台数などから算出する（ASG は max までスケールした値、ただしスケーリングポリシー無しなら desired）。
3. レイテンシ = 基本レイテンシ × 待ち行列係数 `1 / (1 - min(利用率, 0.95))`。経路上で合算して p95 相当とする。
4. エラー率 = 容量超過分 / 負荷。障害で到達できない経路は 100% エラー。SG 不許可・経路なしもエラーとして扱う。
5. コスト = 各ノードの `monthlyCost` の合計。

### 6.3 出力

- ノードごと: 利用率、負荷、エラー率、レイテンシ → ノードに色付きバッジ（緑 / 黄 / 赤）で表示
- 全体: 成功率、p95 レイテンシ、月額コスト、SQS 滞留
- ノードごとの「ログ」: 計算結果から定型文を生成（例: `ERROR connect ETIMEDOUT 10.0.2.15:3306`、`WARN CPUUtilization 98%`）。インシデントの調査材料にする。

数値は学習用の目安で、実際の AWS 性能値とは一致しない旨を UI に明記する。

### 6.4 実装メモ（フェーズ 7）

`src/engine/simulator/`（`capacity.ts` に処理能力・基本応答時間、`simulate.ts` に計算本体）。

- ノードの役割を 4 つに分けて負荷を流す
  - 振り分け役（ユーザー・Route 53・WAF・CloudFront・ALB/NLB・API Gateway など）: 正常な接続先に均等に分ける
  - 処理役（EC2・ASG・ECS・Lambda）: 1 リクエストごとに接続先（DB など）をすべて呼ぶ。ElastiCache があれば読み取りの `cacheableRatio` 分は DB に行かない
  - 配信役（SNS・EventBridge）: 接続先すべてに配る。SQS は処理側の能力を超えた分を滞留にする
  - 認証・証明書・監視・秘密情報（Cognito・ACM・CloudWatch・Secrets Manager）はリクエストの流れに乗せない
- 接続できない（停止中・SG で不許可・VPC 外から Private サブネットへ・外部サービスへの経路なし）接続は、振り分け役なら転送先から外し、処理役ならタイムアウト（3 秒）として失敗に数える
- AZ 障害: サブネットに置くサービスは止まる。RDS Multi-AZ・Aurora のリーダー・レプリカ付き ElastiCache はフェイルオーバーする。複数 AZ にまたがる ASG / ECS / ALB は残りの AZ で台数を保つ
- ASG / ECS はスケーリングを設定していれば最大台数まで処理できる（料金は希望台数で計算）
- 障害の対象は ID ではなくセレクターで指定する（構成を作り直しても同じ意味になるように）
- `ddos` の障害は未実装（WAF の効果を計算する仕組みが必要なため）

## 7. モード

### 7.1 サンドボックス

- 左: サービスパレット（カテゴリ別、検索可）→ キャンバスへ D&D
- 中央: キャンバス（ズーム、パン、複数選択、削除、コピー、undo/redo）
- 右: インスペクター（選択ノードの設定、SG 割当、メトリクス、ログ）
- 下: Linter 警告一覧 ／ シミュレーション結果（負荷スライダーと障害注入を自分で設定して実行）
- 保存: localStorage に自動保存、JSON の書き出し・読み込み

#### 実装メモ（フェーズ 8）

- 下部パネルではなく、他のモードと同じ左上のパネルに「チェック（Linter）」と「シミュレーション」のタブを置いた
- シミュレーションはタブを開いている間だけ計算し、構成を変えるたびに再計算する。負荷（リクエスト数・読み取り比率・キャッシュ可能比率）、AZ 障害、選んだノードの停止を指定でき、ノードを選ぶとメトリクスとログが見られる
- PNG 書き出しは表示範囲ではなく全ノードを対象にする。判定やシミュレーションの色・接続点は書き出しに含めない

### 7.2 問題モード

```ts
type Challenge = {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  brief: string;                   // 要件文（Markdown）
  initial?: SerializedCanvas;      // 途中まで作られた構成（無ければ空）
  palette?: ServiceKind[];         // 使えるサービスの制限（任意）
  rules: Rule[];                   // 要件（required）と加点（recommended）
  budgetUsd?: number;
  hints: string[];                 // 段階的に開示
  explanation: string;             // 解説（Markdown）
  modelAnswer: SerializedCanvas;   // 模範解答（読み取り専用で表示）
};
```

流れ: 要件を読む → 構築 → 「提出」→ ルールごとの合否チェックリスト（失敗ノードをハイライト）→ 全 required を満たせばクリア → 解説・模範解答を閲覧できる。
スコアは required の達成 ＋ recommended の数 − ヒント使用数 ＋ 予算内ボーナス。

#### 実装メモ（フェーズ 6）

- 型は `src/challenges/types.ts`、問題は `src/content/challenges/` に 1 ファイル 1 問で置く。
- 学習モードと同じく、模範解答は完成形の構成ではなく `AnswerOp[]` で持ち、初期構成に適用して作る（`modelDoc`）。テストで「初期構成ではクリアにならない」「模範解答は必須・推奨・予算をすべて満たす」を全問で確かめる。
- 採点（100 点満点）: クリアで 60 点、推奨の達成率で最大 30 点（予算がない問題は 40 点）、予算内で 10 点、ヒント 1 つにつき −5 点。
- クリア前に模範解答を見た挑戦は、クリアは記録するが点数は記録しない。「最初から」でやり直すと再び記録できる。
- 模範解答はキャンバスの構成を一時的に差し替えて表示する。表示中は自動保存を止め、自分の構成は退避して戻せる。
- チェックリストでは「〜がありません」という理由は出さない（必要なサービスを教えてしまうため）。
- 月額コストは `src/engine/cost.ts` の概算（東京リージョンのオンデマンド料金を丸めた目安）。インスペクターではなく問題パネルに常時表示する。

### 7.3 インシデントモード（ターン制）

```ts
type Incident = {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  initial: SerializedCanvas;       // 障害が起きている本番構成
  traffic: TrafficProfile;
  faults: Fault[];                 // 構成変更では消えない外的要因（AZ 障害、スパイク等）
  alert: string;                   // 発報内容（CloudWatch アラーム風）
  report: string;                  // 利用者からの報告など状況説明
  resolved: Rule[];                // 解決条件（メトリクス条件 + 構成条件）
  rootCause: string;
  hints: string[];
  explanation: string;             // 根本原因と、別解を含む対策の解説
};
```

1 ターンの流れ:

1. **調査**: アラーム、全体メトリクス、ノードを選んでメトリクスとログを見る（何度でも、ターンを消費しない）
2. **変更**: 構成を編集する（ノード追加・削除・設定変更・SG 修正）。変更内容は差分として一覧表示
3. **適用**: 「変更を適用」でターンを 1 消費し、シミュレーターを再計算
4. **結果**: 前ターンとのメトリクス比較を表示。`resolved` をすべて満たせば解決

解決条件の例: 「成功率 99.9% 以上」かつ「p95 < 300ms」かつ「根本原因に対応する構成条件（例: RDS Multi-AZ）」。
メトリクスだけで判定すると「とりあえず全部増強」で解けてしまうため、構成条件も組み合わせる。

スコア: 使用ターン数、ヒント数、コスト増加（過剰増強の減点）、不要な変更数。
ターン履歴を残し、解決後に「各ターンで何を変えて何が改善したか」を振り返れるようにする。

#### 実装メモ（フェーズ 7）

- 型は `src/incidents/types.ts`、シナリオは `src/content/incidents/` に 1 ファイル 1 件で置く
- 模範的な対策 `fix` と、解決扱いにしない対策 `wrongFixes`（「とりあえず増強」など）を `AnswerOp[]` で持ち、テストで確かめる
- 解決条件のうち構成の条件は、メトリクスが回復しても解決しないときだけ画面に出す（最初から出すと答えになるため）
- 採点: 100 点から、2 ターン目以降 −10 点/ターン、ヒント −5 点/個、模範的な対策より月額が 2 割以上高ければ最大 −20 点
- 進捗は `aws-arch-sim:incidents`、編集中の構成は `aws-arch-sim:attempt:incident:<id>`、最後に適用した構成は `…:applied` に保存する（問題モードの進捗とは別のキー）
- サンドボックスのシミュレーションはフェーズ 8 で追加（7.1 の実装メモ参照）

## 8. 初期シナリオ

### 問題モード

| # | タイトル | 主な要件 |
|---|---|---|
| C1 | 冗長化した Web 3 層 | ALB が 2 AZ、ASG が 2 AZ、RDS は private かつ Multi-AZ、SG を最小限に |
| C2 | 静的サイト配信 | Route 53 → CloudFront → S3（OAC、S3 は非公開）、WAF |
| C3 | サーバーレス API | API Gateway → Lambda → DynamoDB、VPC 不要 |
| C4 | 非同期処理の疎結合化 | SNS ファンアウト → SQS ×2 → ワーカー、DLQ あり |
| C5 | 読み取りが多いサービス | ElastiCache または Aurora リーダーで DB 負荷を下げ、予算内に収める |

### インシデントモード

| # | タイトル | 根本原因 | 想定する対策（別解あり） |
|---|---|---|---|
| I1 | セール開始で 503 多発 | 固定台数の EC2 が CPU 飽和 | ASG 化・max 引き上げ ／ CloudFront でキャッシュ |
| I2 | 1 つの AZ 障害で全停止 | EC2・RDS が単一 AZ | 2 AZ 化 ＋ RDS Multi-AZ |
| I3 | 外部決済 API に繋がらない | private サブネットにインターネットへの経路が無い | NAT Gateway 追加 ＋ ルート設定 |
| I4 | デプロイ後に DB 接続エラー | 新しい ASG の SG が RDS の SG で許可されていない | RDS の SG に ASG の SG を追加 |
| I5 | 画面表示が遅い | 読み取りクエリで RDS が飽和 | リードレプリカ ／ ElastiCache |

## 9. 画面とルーティング

| パス | 画面 |
|---|---|
| `#/` | トップ（モード選択、進捗） |
| `#/sandbox` | サンドボックス |
| `#/challenges` | 問題一覧（難易度・クリア状況） |
| `#/challenges/:id` | 問題プレイ |
| `#/incidents` | インシデント一覧 |
| `#/incidents/:id` | インシデントプレイ |

3 モードとも同じキャンバス・パレット・インスペクターを使い、モードごとに上部バーと下部パネルの中身だけを差し替える。

## 10. アイコン

- AWS Architecture Icons（https://aws.amazon.com/architecture/icons/）のアセットパッケージを使う。AWS は構成図での利用を許可している。
- zip はリポジトリに含めず、`pnpm import-icons <zipのパス>` で必要な SVG だけを `public/icons/aws/` に抽出してコミットする。
- アイコンが無い場合は、カテゴリ色（Compute=オレンジ、Database=青 など）の角丸ボックスにサービス名の略称を出す。

## 11. 永続化

| キー | 内容 |
|---|---|
| `aws-arch-sim:sandbox` | サンドボックスの最新キャンバス（自動保存） |
| `aws-arch-sim:progress` | 問題・インシデントごとのクリア状況、ベストスコア |
| `aws-arch-sim:attempt:<id>` | 途中のプレイ状態（中断・再開用） |

localStorage の読み書きは try/catch で包み、使えない環境でも動くようにする。
JSON の書き出しは `SerializedCanvas`（ノード・エッジ・SG・バージョン番号）とし、読み込み時にスキーマを検証する。

## 12. 実装フェーズ

学習モードを先に作ることにしたため、実装順は [LEARNING.md 10 章](LEARNING.md#10-実装フェーズ改訂) に改訂した。
各シナリオ・レッスンには「初期構成では失敗し、模範解答では成功する」テストを必ず付け、追加したときに壊れていないかを機械的に確認できるようにする。
