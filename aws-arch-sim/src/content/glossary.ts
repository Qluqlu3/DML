import type { GlossaryCategory, GlossaryTerm } from '../learning/types';

export const GLOSSARY_CATEGORIES: { id: GlossaryCategory; label: string }[] = [
  { id: 'network', label: 'ネットワーク' },
  { id: 'availability', label: '可用性・性能' },
  { id: 'async', label: 'サーバーレス・非同期' },
  { id: 'security', label: 'セキュリティ' },
  { id: 'operation', label: '運用・料金' },
];

/**
 * 用語集。レッスン・問題・インシデントの文章に出てくる用語を、短く説明する。
 * サービスそのものの説明は guides.ts に書き、ここには書かない。
 */
export const GLOSSARY: GlossaryTerm[] = [
  // ---- ネットワーク ----
  {
    id: 'region',
    term: 'リージョン',
    category: 'network',
    description:
      'AWS のデータセンターがある地域（東京、大阪、バージニア北部など）。1 つのリージョンの中に複数の AZ がある。データはリージョンの外に勝手には出ない。',
    topics: ['az'],
  },
  {
    id: 'cidr',
    term: 'CIDR',
    aka: 'Classless Inter-Domain Routing',
    category: 'network',
    description:
      'IP アドレスの範囲の書き方。10.0.0.0/16 の「/16」は、先頭 16 ビットが固定という意味で、約 6.5 万個のアドレスを表す。数字が大きいほど範囲は狭い（/24 は 256 個）。',
    topics: ['vpc', 'subnet'],
  },
  {
    id: 'route-table',
    term: 'ルートテーブル',
    category: 'network',
    description:
      'サブネットから出ていく通信を、宛先ごとにどこへ送るかを決める表。VPC の中どうしの通信は自動で届く。それ以外の行き先は自分で書く。',
    topics: ['subnet', 'igw', 'natgw'],
  },
  {
    id: 'default-route',
    term: 'デフォルトルート',
    aka: '0.0.0.0/0',
    category: 'network',
    description:
      'ルートテーブルのどの行にも当てはまらない宛先（＝インターネット）への通信の送り先。IGW に向けると Public サブネット、NAT Gateway に向けると Private サブネットになる。',
    topics: ['subnet', 'igw', 'natgw'],
  },
  {
    id: 'public-subnet',
    term: 'Public サブネット / Private サブネット',
    category: 'network',
    description:
      'デフォルトルートが IGW に向いているのが Public、向いていないのが Private。名前で決まるのではなく、ルートテーブルの中身で決まる。',
    topics: ['subnet'],
  },
  {
    id: 'public-ip',
    term: 'パブリック IP / プライベート IP',
    category: 'network',
    description:
      'インターネットから届く住所がパブリック IP、VPC の中だけで使う住所がプライベート IP。Public サブネットにあっても、パブリック IP がなければ外からは届かない。',
    topics: ['ec2', 'subnet'],
  },
  {
    id: 'osi-layer',
    term: 'L4 / L7',
    aka: 'レイヤー 4 / レイヤー 7',
    category: 'network',
    description:
      '通信の階層の呼び方。L4 は TCP / UDP（IP アドレスとポート）の階層、L7 は HTTP などのアプリケーションの階層。L7 で動くものは URL やヘッダーを見て判断できる。',
    topics: ['alb', 'nlb'],
  },
  {
    id: 'port',
    term: 'ポート番号',
    category: 'network',
    description:
      '同じサーバーの中で、どのサービス宛ての通信かを区別する番号。HTTP は 80、HTTPS は 443、SSH は 22、MySQL は 3306、PostgreSQL は 5432。',
    topics: ['sg'],
  },
  {
    id: 'dns',
    term: 'DNS',
    aka: 'Domain Name System',
    category: 'network',
    description:
      'example.com のような名前を、IP アドレスなどの接続先に変換する仕組み。Route 53 は AWS の DNS サービス。',
    topics: ['route53'],
  },
  {
    id: 'alias-record',
    term: 'エイリアスレコード',
    category: 'network',
    description:
      'Route 53 独自のレコードで、ALB や CloudFront などの AWS リソースに名前を向ける。ドメインの頂点（example.com そのもの）にも使え、問い合わせ料金がかからない。',
    topics: ['route53'],
  },
  {
    id: 'edge-location',
    term: 'エッジロケーション',
    category: 'network',
    description:
      '世界中の都市に置かれた、CloudFront の配信拠点。ユーザーの近くからコンテンツを返すので速い。',
    topics: ['cloudfront'],
  },
  {
    id: 'origin',
    term: 'オリジン',
    category: 'network',
    description:
      'CloudFront がキャッシュを持っていないときに、本物のデータを取りに行く元。S3 バケットや ALB などを指定する。',
    topics: ['cloudfront', 's3', 'alb'],
  },

  // ---- 可用性・性能 ----
  {
    id: 'redundancy',
    term: '冗長化',
    category: 'availability',
    description:
      '同じ役割のものを複数用意し、1 つが壊れても動き続けるようにすること。AWS では「2 つ以上の AZ に分けて置く」が基本。',
    topics: ['az'],
  },
  {
    id: 'spof',
    term: '単一障害点',
    aka: 'SPOF: Single Point of Failure',
    category: 'availability',
    description:
      'そこが 1 つ止まるだけでシステム全体が止まる部分。1 台だけの DB、1 つの AZ にしかない NAT Gateway などが典型。',
    topics: ['natgw', 'rds'],
  },
  {
    id: 'failover',
    term: 'フェイルオーバー',
    category: 'availability',
    description:
      '障害が起きたときに、予備の仕組みへ自動で切り替えること。RDS の Multi-AZ や、Route 53 のフェイルオーバールーティングが行う。',
    topics: ['rds', 'route53'],
  },
  {
    id: 'health-check',
    term: 'ヘルスチェック',
    category: 'availability',
    description:
      '相手が正常に応答するかを定期的に確かめること。ALB は異常なサーバーへの振り分けを止め、Route 53 は異常な接続先を DNS の答えから外す。',
    topics: ['alb', 'route53', 'asg'],
  },
  {
    id: 'target-group',
    term: 'ターゲットグループ',
    category: 'availability',
    description:
      'ロードバランサーが振り分ける先（EC2、ECS のタスク、IP など）のまとまり。ヘルスチェックの設定もここに持つ。',
    topics: ['alb', 'nlb'],
  },
  {
    id: 'scale-out',
    term: 'スケールアウト / スケールアップ',
    category: 'availability',
    description:
      '台数を増やして処理能力を上げるのがスケールアウト（減らすのはスケールイン）、1 台を大きくするのがスケールアップ。クラウドでは止めずに増やせるスケールアウトが基本。',
    topics: ['asg', 'ecs'],
  },
  {
    id: 'target-tracking',
    term: 'ターゲット追跡ポリシー',
    category: 'availability',
    description:
      '「CPU 使用率を 50% に保つ」のように目標値を決めると、Auto Scaling がそれに合わせて台数を自動で増減する設定。',
    topics: ['asg', 'ecs', 'cloudwatch'],
  },
  {
    id: 'latency',
    term: 'レイテンシ / p95',
    category: 'availability',
    description:
      'リクエストを送ってから応答が返るまでの時間がレイテンシ。p95 は「遅い方から 5% を除いた中で最も遅い値」で、平均では見えない遅いユーザーの体感を表す。',
  },
  {
    id: 'throughput',
    term: 'スループット',
    category: 'availability',
    description: '一定時間にさばける処理の量。req/s（1 秒あたりのリクエスト数）などで表す。',
  },
  {
    id: 'cache-hit',
    term: 'キャッシュヒット率',
    category: 'availability',
    description:
      'キャッシュに答えがあって、元（DB やオリジン）まで取りに行かずに済んだ割合。高いほど元の負荷が減り、応答も速くなる。',
    topics: ['elasticache', 'cloudfront'],
  },
  {
    id: 'ttl',
    term: 'TTL',
    aka: 'Time To Live',
    category: 'availability',
    description:
      'キャッシュや DNS の答えを使い回してよい期間。長いほど元への問い合わせは減るが、変更が反映されるまで時間がかかる。',
    topics: ['cloudfront', 'elasticache', 'route53'],
  },
  {
    id: 'replication-lag',
    term: 'レプリケーションの遅延',
    category: 'availability',
    description:
      '非同期で複製するとき、コピー先のデータが元より少し遅れること。リードレプリカから読むと、書いた直後のデータがまだ見えないことがある。',
    topics: ['rds', 'aurora'],
  },
  {
    id: 'rpo-rto',
    term: 'RPO / RTO',
    category: 'availability',
    description:
      '障害時の目標。RPO は「どの時点までのデータを失ってよいか」、RTO は「どれだけの時間で復旧するか」。短いほど費用のかかる構成になる。',
  },

  // ---- サーバーレス・非同期 ----
  {
    id: 'serverless',
    term: 'サーバーレス',
    category: 'async',
    description:
      'サーバーの起動・更新・台数の管理を AWS に任せる使い方。使った分だけ課金される。Lambda、API Gateway、DynamoDB、SQS などが代表。',
    topics: ['lambda', 'apigw', 'dynamodb'],
  },
  {
    id: 'managed',
    term: 'マネージドサービス',
    category: 'async',
    description:
      'OS の更新やバックアップなどの面倒な運用を AWS が引き受けるサービス。RDS は、EC2 に自分で DB を入れるより運用が楽になる。',
    topics: ['rds'],
  },
  {
    id: 'concurrency',
    term: '同時実行数',
    category: 'async',
    description:
      'Lambda が同時に動いている数。アカウント全体に上限があり、予約同時実行数を決めると、その関数がほかの関数の分を使い切らないように守れる。',
    topics: ['lambda'],
  },
  {
    id: 'cold-start',
    term: 'コールドスタート',
    category: 'async',
    description:
      'Lambda がしばらく呼ばれていないときや、新しく実行環境を増やすときに、準備の分だけ最初の応答が遅くなること。',
    topics: ['lambda'],
  },
  {
    id: 'throttling',
    term: 'スロットリング',
    category: 'async',
    description:
      '決めた上限を超えたリクエストを断って、後ろのシステムを守ること。API Gateway では、超えた分は 429 エラーになる。',
    topics: ['apigw', 'lambda'],
  },
  {
    id: 'loose-coupling',
    term: '疎結合',
    category: 'async',
    description:
      'システムどうしを直接つながず、キューなどを間にはさむこと。片方が止まったり遅くなったりしても、もう片方は影響を受けにくい。',
    topics: ['sqs', 'sns'],
  },
  {
    id: 'visibility-timeout',
    term: '可視性タイムアウト',
    category: 'async',
    description:
      'SQS で、取り出したメッセージを他の処理側から見えなくしておく時間。処理が終わる前に切れると、同じメッセージがもう一度処理される。',
    topics: ['sqs'],
  },
  {
    id: 'dlq',
    term: 'DLQ',
    aka: 'デッドレターキュー',
    category: 'async',
    description:
      '何度試しても処理できなかったメッセージを移しておく別のキュー。失敗し続けるメッセージがキューを詰まらせないようにし、後から原因を調べられる。',
    topics: ['sqs'],
  },
  {
    id: 'fanout',
    term: 'ファンアウト',
    category: 'async',
    description:
      '1 つのメッセージを複数の宛先に同時に配ること。SNS から複数の SQS キューへ配り、それぞれ別の処理をさせる形が定番。',
    topics: ['sns', 'sqs'],
  },
  {
    id: 'idempotent',
    term: '冪等性（べきとうせい）',
    category: 'async',
    description:
      '同じ処理を何度実行しても結果が同じになる性質。SQS は同じメッセージが 2 回届くことがあるので、処理側は冪等に作る。',
    topics: ['sqs', 'lambda'],
  },
  {
    id: 'event-driven',
    term: 'イベント駆動',
    category: 'async',
    description:
      '「ファイルが置かれた」「注文が入った」などの出来事をきっかけに処理を動かす作り方。S3 のイベント通知や EventBridge で組む。',
    topics: ['eventbridge', 's3', 'lambda'],
  },

  // ---- セキュリティ ----
  {
    id: 'least-privilege',
    term: '最小権限の原則',
    category: 'security',
    description:
      '必要な相手に、必要な操作だけを許可すること。SG なら「0.0.0.0/0 を全ポート許可」ではなく、ALB の SG から 80 番だけ、のように絞る。',
    topics: ['sg'],
  },
  {
    id: 'stateful',
    term: 'ステートフル',
    category: 'security',
    description:
      'セキュリティグループの性質。許可した通信への返事は、戻り方向のルールがなくても自動で通る。',
    topics: ['sg'],
  },
  {
    id: 'sg-reference',
    term: 'SG の参照',
    category: 'security',
    description:
      'SG のルールの送信元に、IP アドレスではなく別の SG を指定すること。「アプリの SG が付いたものからだけ DB に入れる」のように書け、台数が増えても書き直さなくてよい。',
    topics: ['sg'],
  },
  {
    id: 'iam-role',
    term: 'IAM ロール',
    category: 'security',
    description:
      'EC2 や Lambda などに「この操作をしてよい」という権限を渡す仕組み。アクセスキーをコードに書かずに、AWS のサービスを呼び出せる。',
    topics: ['ec2', 'lambda'],
  },
  {
    id: 'tls',
    term: 'HTTPS / TLS',
    category: 'security',
    description:
      'HTTPS は通信を TLS で暗号化した HTTP。証明書が必要で、AWS では ACM の証明書を ALB や CloudFront に付けて使う。',
    topics: ['acm', 'alb', 'cloudfront'],
  },
  {
    id: 'oac',
    term: 'OAC',
    aka: 'Origin Access Control',
    category: 'security',
    description:
      'S3 バケットを CloudFront からだけ読めるようにする設定。バケットを公開せずに、CloudFront 経由で配信できる。',
    topics: ['cloudfront', 's3'],
  },
  {
    id: 'encryption-at-rest',
    term: '保存時の暗号化',
    category: 'security',
    description:
      'ディスクや S3 に保存したデータを暗号化しておくこと。RDS・S3・DynamoDB などで設定でき、鍵は KMS で管理する。',
    topics: ['rds', 's3', 'dynamodb'],
  },

  // ---- 運用・料金 ----
  {
    id: 'metrics',
    term: 'メトリクス',
    category: 'operation',
    description:
      'CPU 使用率やリクエスト数など、時間とともに変わる数値。CloudWatch で集めてグラフにし、アラームのもとにする。',
    topics: ['cloudwatch'],
  },
  {
    id: 'alarm',
    term: 'アラーム',
    category: 'operation',
    description:
      'メトリクスがしきい値を一定時間超えたら動く仕組み。SNS で通知したり、Auto Scaling で台数を増やしたりする。',
    topics: ['cloudwatch', 'sns', 'asg'],
  },
  {
    id: 'pay-as-you-go',
    term: '従量課金',
    category: 'operation',
    description:
      '使った量（時間、リクエスト数、データ量など）に応じて払う料金の形。止めているものや、呼ばれていない Lambda には基本的にかからない。',
  },
  {
    id: 'data-transfer',
    term: 'データ転送料金',
    category: 'operation',
    description:
      'AWS からインターネットへ出ていくデータ量や、AZ・リージョンをまたぐ通信にかかる料金。入ってくる通信は基本的に無料。',
    topics: ['natgw', 'cloudfront'],
  },
  {
    id: 'rightsizing',
    term: 'ライトサイジング',
    category: 'operation',
    description:
      '実際の使用量に合わせて、インスタンスの大きさや台数を適切に見直すこと。余裕を持たせすぎた構成は、費用だけがかさむ。',
    topics: ['ec2', 'rds'],
  },
];
