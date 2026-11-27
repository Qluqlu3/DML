import type { Comparison, GuideTopic } from '../learning/types';

/**
 * 図鑑の「比べて覚える」。迷いやすいサービス・設定を表で比べ、選び方の目安を書く。
 * 料金は金額ではなく「何に対して課金されるか」を書く（guides.ts と同じ方針）。
 */
export const COMPARISONS: Comparison[] = [
  {
    id: 'alb-nlb',
    title: 'ALB と NLB',
    summary:
      'どちらもリクエストを複数の宛先に振り分けるロードバランサー。リクエストの中身（URL など）を見て振り分けるのが ALB、大量の通信を速くさばくのが NLB。',
    topics: ['alb', 'nlb'],
    columns: ['ALB', 'NLB'],
    rows: [
      { label: '動く層', cells: ['L7（HTTP / HTTPS）', 'L4（TCP / UDP / TLS）'] },
      {
        label: '振り分けの基準',
        cells: ['URL のパス・ホスト名・ヘッダーなど', '送信先のポート（中身は見ない）'],
      },
      {
        label: '得意なこと',
        cells: [
          'Web アプリや API。パスごとに別のサーバー群へ送る',
          '大量の接続を低い遅延でさばく。ゲームや IoT など HTTP 以外の通信',
        ],
      },
      {
        label: '固定 IP',
        cells: ['持てない（DNS 名で使う）', 'AZ ごとに固定の IP（Elastic IP）を持てる'],
      },
      {
        label: '一緒に使えるもの',
        cells: [
          'WAF、ACM の証明書（HTTPS の終端）',
          'ACM の証明書（TLS の終端）。WAF は付けられない',
        ],
      },
    ],
    choose: [
      'Web サイトや REST API なら、まず ALB',
      '取引先に固定 IP を伝えて許可してもらう必要があるなら NLB',
      'HTTP 以外のプロトコル（TCP / UDP）や、極端に大量の接続をさばくなら NLB',
    ],
  },
  {
    id: 'apigw-alb',
    title: 'API Gateway と ALB（API の入口）',
    summary:
      'どちらも API の入口になれる。使った分だけ課金されるサーバーレスの入口が API Gateway、常に動いているサーバーの前に置く入口が ALB。',
    topics: ['apigw', 'alb', 'lambda'],
    columns: ['API Gateway', 'ALB'],
    rows: [
      {
        label: '置き場所',
        cells: ['VPC の外（リージョンのサービス）', 'VPC の中（Public サブネット）'],
      },
      {
        label: '主な転送先',
        cells: [
          'Lambda、HTTP のバックエンド、AWS のサービス',
          'EC2、ECS、Lambda（ターゲットグループ）',
        ],
      },
      {
        label: 'API 向けの機能',
        cells: [
          'スロットリング、API キーと使用量プラン、Cognito での認証、リクエストの検証',
          'パスやホスト名での振り分け、Cognito や OIDC での認証',
        ],
      },
      {
        label: '料金',
        cells: ['リクエスト数に応じた従量課金', '動いている時間 + 処理量（LCU）'],
      },
      {
        label: '向いているアクセス量',
        cells: ['少量〜中量。少ないほど安い', '常に一定以上のアクセスがある'],
      },
    ],
    choose: [
      'Lambda で作るサーバーレスな API なら API Gateway',
      'アクセスが少ない・読めないなら API Gateway（使わない時間は課金されない）',
      'EC2 や ECS で常時動かすアプリの入口なら ALB',
      'API Gateway の統合のタイムアウトは既定で 29 秒。時間のかかる処理は SQS などで非同期にする',
    ],
  },
  {
    id: 'vpc-exits',
    title: 'IGW・NAT Gateway・VPC エンドポイント（VPC の出入口）',
    summary:
      'VPC の外と通信するための 3 つの出入口。インターネットと双方向につなぐのが IGW、Private サブネットから外へ出るだけなのが NAT Gateway、インターネットを通らず AWS のサービスへつなぐのが VPC エンドポイント。',
    topics: ['igw', 'natgw', 'vpce'],
    columns: ['Internet Gateway', 'NAT Gateway', 'VPC エンドポイント'],
    rows: [
      {
        label: '通信の向き',
        cells: [
          '内 → 外 と 外 → 内 の両方',
          '内 → 外 だけ（外からは入れない）',
          '内 → AWS のサービス だけ',
        ],
      },
      {
        label: '置き場所',
        cells: [
          'VPC に 1 つアタッチする',
          'Public サブネット（AZ ごとに置くのが基本）',
          'ゲートウェイ型はルートテーブルに、インターフェース型はサブネットに',
        ],
      },
      {
        label: '行き先',
        cells: [
          'インターネット全体',
          'インターネット全体（IGW を通って出る）',
          'ゲートウェイ型は S3 と DynamoDB。インターフェース型は多くの AWS サービス',
        ],
      },
      {
        label: '使うサブネット',
        cells: [
          'Public サブネット（デフォルトルートを IGW に向ける）',
          'Private サブネット（デフォルトルートを NAT Gateway に向ける）',
          'Private サブネット',
        ],
      },
      {
        label: '料金',
        cells: [
          '無料（データ転送には課金）',
          '動いている時間 + 処理したデータ量',
          'ゲートウェイ型は無料。インターフェース型は時間 + データ量',
        ],
      },
    ],
    choose: [
      'Web サーバーや ALB をインターネットに公開するなら、IGW と Public サブネット',
      'Private サブネットのサーバーが外部 API や OS の更新を取りに行くなら NAT Gateway',
      'Private サブネットから S3 や DynamoDB へたくさん通信するなら、ゲートウェイ型の VPC エンドポイント（NAT Gateway のデータ処理料金を減らせる）',
    ],
  },
  {
    id: 'messaging',
    title: 'SQS・SNS・EventBridge',
    summary:
      'どれもシステムどうしを直接つながずにメッセージを渡す仕組み。ためておいて順に処理させるのが SQS、一斉に配るのが SNS、出来事をルールで振り分けるのが EventBridge。',
    topics: ['sqs', 'sns', 'eventbridge'],
    columns: ['SQS', 'SNS', 'EventBridge'],
    rows: [
      {
        label: '形',
        cells: [
          'キュー（順番待ちの列）',
          'トピック（一斉配信）',
          'イベントバス（ルールで振り分け）',
        ],
      },
      {
        label: '届け先',
        cells: [
          '1 つのメッセージを、処理側の誰か 1 つが受け取る',
          '購読しているすべての宛先へ同じものを配る',
          'ルールに合ったターゲット（複数可）へ送る',
        ],
      },
      {
        label: '受け取り方',
        cells: [
          '処理側が取りに行く（ポーリング）',
          'SNS から送りつける（プッシュ）',
          'EventBridge から送りつける（プッシュ）',
        ],
      },
      {
        label: 'メッセージの保持',
        cells: [
          '最大 14 日間ためておける',
          'ためない。届けられなかった分は DLQ を設定して受ける',
          'ためない。アーカイブを有効にすると保存・再送できる',
        ],
      },
      {
        label: '得意なこと',
        cells: [
          '処理を後回しにして負荷を平らにする。失敗したら再試行する',
          '1 つの出来事を複数のシステムへ知らせる',
          'AWS サービスの出来事や、決まった時刻をきっかけに処理を動かす',
        ],
      },
    ],
    choose: [
      '処理が追いつかないときに待たせたい・取りこぼさず処理したいなら SQS',
      '同じ通知を複数の宛先に配るなら SNS。SNS から複数の SQS へ配る「ファンアウト」が定番',
      '「毎日 3 時に」「S3 にファイルが置かれたら」など、時刻や出来事をきっかけにするなら EventBridge',
    ],
  },
  {
    id: 'databases',
    title: 'RDS・Aurora・DynamoDB',
    summary:
      '表を結合して集計できるリレーショナル DB が RDS と Aurora（Aurora は AWS が性能と可用性を高めたもの）。キーを指定した大量の読み書きを一定の速さでこなす NoSQL が DynamoDB。',
    topics: ['rds', 'aurora', 'dynamodb'],
    columns: ['RDS', 'Aurora', 'DynamoDB'],
    rows: [
      {
        label: '種類',
        cells: [
          'リレーショナル DB（MySQL、PostgreSQL など）',
          'MySQL / PostgreSQL 互換のリレーショナル DB',
          'NoSQL（キーと値の形）',
        ],
      },
      {
        label: '置き場所',
        cells: [
          'VPC の中（Private サブネット）',
          'VPC の中（Private サブネット）',
          'VPC の外（VPC エンドポイントからも使える）',
        ],
      },
      {
        label: '障害への備え',
        cells: [
          'Multi-AZ で別の AZ のスタンバイへ切り替える',
          'データを 3 つの AZ に 6 つ複製。リーダーへ素早く切り替える',
          '最初から複数の AZ に複製されている',
        ],
      },
      {
        label: '読み取りを増やす',
        cells: [
          'リードレプリカを追加する',
          'リーダーを追加する（同じストレージを共有するので遅れが小さい）',
          'キャパシティを増やす（オンデマンドなら自動）',
        ],
      },
      {
        label: '得意なこと',
        cells: [
          '表どうしの結合や集計、トランザクション',
          'RDS と同じ使い方で、より高い性能と可用性',
          'キーを指定した読み書きを、アクセスが増えても一定の速さで',
        ],
      },
      {
        label: '料金',
        cells: [
          'インスタンスの時間 + ストレージ',
          'インスタンスの時間 + 使ったストレージと I/O',
          '読み書きの量 + 保存量（オンデマンド / プロビジョンド）',
        ],
      },
    ],
    choose: [
      '複雑な検索や結合を使う、一般的な業務アプリなら RDS',
      '同じ用途で、読み取りが多い・障害で止まる時間をさらに短くしたいなら Aurora',
      'アクセス数が読めないサーバーレスアプリや、キーで引くだけのデータ（セッション、カートなど）なら DynamoDB',
    ],
  },
  {
    id: 'multiaz-replica',
    title: 'Multi-AZ とリードレプリカ',
    summary:
      'どちらも DB のコピーを別の場所に持つ仕組み。目的が違い、Multi-AZ は「止まらないため」、リードレプリカは「読み取りを分散するため」。',
    topics: ['rds', 'aurora'],
    columns: ['Multi-AZ', 'リードレプリカ'],
    rows: [
      { label: '目的', cells: ['障害に備える（可用性）', '読み取りを分散する（性能）'] },
      {
        label: 'コピーの使い道',
        cells: [
          'スタンバイは待機するだけで、普段は読み書きに使えない（従来の Multi-AZ 配置の場合）',
          '読み取り専用の接続先として使える',
        ],
      },
      {
        label: '複製の仕方',
        cells: ['同期（データの遅れがない）', '非同期（少し遅れることがある）'],
      },
      {
        label: '障害のとき',
        cells: [
          '自動でスタンバイに切り替わる。接続先の DNS 名はそのまま',
          '自動では切り替わらない。手動でレプリカを昇格させる',
        ],
      },
      {
        label: '置ける場所',
        cells: ['同じリージョンの別の AZ', '同じ AZ・別の AZ・別のリージョン'],
      },
    ],
    choose: [
      '「AZ が止まっても DB を使い続けたい」なら Multi-AZ',
      '「読み取りが多くて DB が重い」ならリードレプリカ（アプリ側で読み取りの接続先を分ける）',
      '本番では両方を組み合わせることが多い。Aurora ではリーダーが両方の役割を兼ねる',
    ],
  },
  {
    id: 'compute',
    title: 'EC2・ECS (Fargate)・Lambda',
    summary:
      'アプリを動かす 3 つの方法。自分で管理する範囲が広い順に、仮想サーバーの EC2、コンテナの ECS Fargate、関数の Lambda。',
    topics: ['ec2', 'ecs', 'lambda', 'asg'],
    columns: ['EC2', 'ECS (Fargate)', 'Lambda'],
    rows: [
      { label: '動かす単位', cells: ['仮想サーバー', 'コンテナ', '関数（コードのまとまり）'] },
      {
        label: '自分で管理するもの',
        cells: [
          'OS の更新やミドルウェアまで',
          'コンテナの中身だけ。サーバーは AWS が管理',
          'コードだけ。実行環境は AWS が管理',
        ],
      },
      {
        label: '動いている時間',
        cells: [
          '起動している間ずっと',
          'タスクが動いている間ずっと',
          '呼ばれたときだけ（1 回の実行は最大 15 分）',
        ],
      },
      {
        label: '増やし方',
        cells: [
          'Auto Scaling グループで台数を増減する',
          'サービスのオートスケーリングでタスク数を増減する',
          '呼び出しに応じて自動で同時実行が増える',
        ],
      },
      {
        label: '料金',
        cells: [
          'インスタンスの時間',
          'タスクの vCPU とメモリ × 時間',
          'リクエスト数 + 実行時間 × メモリ',
        ],
      },
    ],
    choose: [
      'OS を細かく設定したい・既存のアプリをそのまま移したいなら EC2',
      'コンテナで作ったアプリを、サーバーの管理なしで常時動かすなら ECS Fargate',
      '短い処理をイベントに応じて動かす・アクセスのない時間が長いなら Lambda',
    ],
  },
  {
    id: 'read-speed',
    title: '読み取りを速くする方法',
    summary:
      '読み取りが重いときの手当ては、どこで効かせるかで選ぶ。ユーザーの近くで返すのが CloudFront、アプリと DB の間でためるのが ElastiCache、DB 自体を増やすのがリーダー / リードレプリカ。',
    topics: ['cloudfront', 'elasticache', 'aurora', 'rds'],
    columns: ['CloudFront', 'ElastiCache', 'Aurora リーダー / リードレプリカ'],
    rows: [
      {
        label: '何を持つか',
        cells: [
          '画像・HTML などのファイルや API の応答',
          'DB の検索結果やセッションなど、よく使うデータ',
          'DB のデータそのもの（複製）',
        ],
      },
      {
        label: 'どこで効くか',
        cells: ['ユーザーの近く（エッジロケーション）', 'アプリと DB の間', 'DB 層'],
      },
      {
        label: '古いデータ',
        cells: [
          'TTL が切れるまで古いものを返すことがある',
          'TTL や更新時の削除を、アプリで管理する',
          '複製の遅れの分だけ古いことがある',
        ],
      },
      {
        label: 'アプリの変更',
        cells: [
          'ほとんど要らない（DNS を CloudFront に向ける）',
          '要る（キャッシュを読み書きする処理）',
          '要る（読み取りの接続先を分ける）',
        ],
      },
    ],
    choose: [
      '誰が見ても同じ内容（静的ファイル・商品画像）なら CloudFront',
      '同じ検索を何度もしている・DB の CPU が高いなら ElastiCache',
      'キャッシュしにくい読み取りが多いなら、Aurora のリーダーや RDS のリードレプリカ',
    ],
  },
  {
    id: 'sg-waf',
    title: 'セキュリティグループと WAF',
    summary:
      'どちらも通信を絞る仕組み。誰が・どのポートに来てよいかを決めるのがセキュリティグループ、HTTP リクエストの中身を見て攻撃を止めるのが WAF。',
    topics: ['sg', 'waf'],
    columns: ['セキュリティグループ', 'WAF'],
    rows: [
      {
        label: '見るもの',
        cells: [
          '送信元（IP アドレスや SG）とポート番号',
          'HTTP リクエストの中身（URL、ヘッダー、本文）',
        ],
      },
      {
        label: '防げるもの',
        cells: [
          '許可していない相手やポートからの通信',
          'SQL インジェクション、XSS、特定の国や IP からのアクセス、大量のアクセス',
        ],
      },
      {
        label: '付ける場所',
        cells: ['EC2・RDS・ALB などの各リソース', 'CloudFront・ALB・API Gateway'],
      },
      {
        label: 'ルールの書き方',
        cells: [
          '許可だけを書く（書いていないものは拒否）',
          '許可・拒否・カウントを書ける。AWS が用意したマネージドルールも使える',
        ],
      },
      { label: '料金', cells: ['無料', 'Web ACL とルールの数 + リクエスト数'] },
    ],
    choose: [
      'どのリソースでも、まず SG を必要最小限にする（必須）',
      'インターネットに公開する Web アプリには、さらに WAF を前に置く',
      'SG は「許可したポートに届く悪意のあるリクエスト」は防げない。それを防ぐのが WAF',
    ],
  },
];

export const COMPARISON_BY_ID: Record<string, Comparison> = Object.fromEntries(
  COMPARISONS.map((c) => [c.id, c]),
);

/** そのトピックが登場する比較 */
export function comparisonsFor(topic: GuideTopic): Comparison[] {
  return COMPARISONS.filter((c) => c.topics.includes(topic));
}
