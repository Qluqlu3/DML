import {
  any,
  configIs,
  connected,
  exists,
  hasSg,
  placedIn,
  reachable,
  sgAllows,
  spansAzs,
  withMessage,
} from '../../engine/rules/predicates';
import type { Selector } from '../../engine/rules/selector';
import type { Course } from '../../learning/types';
import {
  ALB,
  APIGW,
  ASG,
  AURORA,
  CACHE,
  CF,
  COGNITO,
  CW,
  DDB,
  EB,
  named,
  PRI,
  PUB,
  pri,
  R53,
  RDS,
  S3,
  SQS,
  USER,
  userOnly,
  VPC,
  WAF,
  webBase,
} from './shared';

/** DB は RDS でも Aurora でもよい */
const DB: Selector = { kind: ['rds', 'aurora'] };
const REGISTER = named('lambda', '登録');
const DELIVER = named('lambda', '配信');
const DELIVERY_TOPIC = named('sns', '配信');
const OPS = named('sns', '運用');

export const course7: Course = {
  id: 'capstone',
  title: '総まとめ',
  description:
    'これまでに学んだサービスを組み合わせて、実際のサービスに近い構成を目標だけを頼りに組み立てます。正解は 1 つではありません。',
  lessons: [
    // ------------------------------------------------------------------
    {
      id: 'capstone-1-ec',
      title: '本格的な EC サイト',
      level: 3,
      summary:
        '入口（DNS・WAF・CDN・ALB）、アプリ層、データ層、静的コンテンツ、セキュリティグループまで、EC サイトに必要な構成を一から組み立てます。',
      goals: [
        '層ごとに必要なサービスを自分で選べる',
        '可用性・性能・セキュリティを同時に満たす構成を作れる',
      ],
      start: { from: 'document', doc: webBase() },
      steps: [
        {
          id: 'entrance',
          title: '入口を作ろう',
          instruction:
            '独自ドメインでアクセスでき、攻撃を防ぎ、世界中から速く届く入口を作ってください。リクエストは最終的に、2 つの AZ にまたがる ALB に届くようにします。',
          checkpoints: [
            { id: 'alb', label: 'ALB が Public サブネットにある', rule: placedIn(ALB, 'public') },
            { id: 'alb-az', label: 'ALB が 2 つの AZ にまたがっている', rule: spansAzs(ALB, 2) },
            { id: 'dns', label: 'Route 53 を通って届く', rule: reachable(USER, ALB, { via: R53 }) },
            { id: 'waf', label: 'WAF を通って届く', rule: reachable(USER, ALB, { via: WAF }) },
            {
              id: 'cdn',
              label: 'CloudFront を通って届く',
              rule: reachable(USER, ALB, { via: CF }),
            },
          ],
          hints: [
            'コース 2 の構成を思い出しましょう: ユーザー → Route 53 → WAF → CloudFront → ALB',
            'ALB の配置サブネットは Public サブネットを 2 つ選びます',
          ],
          answer: [
            { op: 'add', kind: 'alb', in: VPC, name: 'ALB' },
            { op: 'attachSubnets', target: ALB, subnets: PUB },
            { op: 'add', kind: 'route53', name: 'shop.example.com' },
            { op: 'add', kind: 'waf', name: 'WAF' },
            { op: 'add', kind: 'cloudfront', name: 'CDN' },
            { op: 'connect', from: USER, to: R53 },
            { op: 'connect', from: R53, to: WAF },
            { op: 'connect', from: WAF, to: CF },
            { op: 'connect', from: CF, to: ALB },
          ],
          why: '入口は「名前で案内する（Route 53）→ 攻撃を止める（WAF）→ 近くから速く返す（CloudFront）→ サーバーに振り分ける（ALB）」の順に役割を重ねます。',
        },
        {
          id: 'app',
          title: 'アプリ層を作ろう',
          instruction:
            'アプリのサーバーは外から直接触れない場所に置き、2 つの AZ に分け、アクセスに応じて台数が自動で変わるようにしてください。',
          checkpoints: [
            {
              id: 'private',
              label: 'Auto Scaling が Private サブネットにある',
              rule: placedIn(ASG, 'private'),
            },
            { id: 'azs', label: '2 つの AZ にまたがっている', rule: spansAzs(ASG, 2) },
            {
              id: 'policy',
              label: 'スケーリングポリシーがある',
              rule: configIs(ASG, 'scalingPolicy', '!=', 'none'),
            },
            { id: 'connect', label: 'ALB から振り分けられる', rule: connected(ALB, ASG) },
          ],
          hints: [
            'ECS（Fargate）で作りたくなったら、コース 5 の構成を参考にしてください（このステップの判定は Auto Scaling 向けです）',
          ],
          answer: [
            { op: 'add', kind: 'asg', in: VPC, name: 'アプリ' },
            { op: 'attachSubnets', target: ASG, subnets: PRI },
            { op: 'connect', from: ALB, to: ASG },
          ],
          why: 'アプリ層は Private サブネット・複数 AZ・自動スケーリングの 3 点セットが基本です。',
        },
        {
          id: 'data',
          title: 'データ層を作ろう',
          instruction:
            '注文データを保存する DB と、商品一覧を速く返すためのキャッシュを用意してください。DB は障害に備え、どちらも外から触れない場所に置きます。',
          checkpoints: [
            {
              id: 'db',
              label: 'DB（RDS か Aurora）が Private サブネットにある',
              rule: placedIn(DB, 'private'),
            },
            {
              id: 'db-ha',
              label: 'DB が障害に備えている（RDS の Multi-AZ か Aurora のリーダー）',
              rule: withMessage(
                any(configIs(RDS, 'multiAz', '==', true), configIs(AURORA, 'readers', '>=', 1)),
                'RDS なら Multi-AZ、Aurora ならリーダーを用意しましょう',
              ),
            },
            { id: 'db-connect', label: 'アプリから DB への接続がある', rule: connected(ASG, DB) },
            {
              id: 'cache',
              label: 'キャッシュが Private サブネットにある',
              rule: placedIn(CACHE, 'private'),
            },
            {
              id: 'cache-connect',
              label: 'アプリからキャッシュへの接続がある',
              rule: connected(ASG, CACHE),
            },
          ],
          hints: [
            'RDS（Multi-AZ）でも Aurora（リーダーあり）でも正解です',
            'キャッシュには ElastiCache を使います',
          ],
          answer: [
            { op: 'add', kind: 'aurora', in: pri('first'), name: '注文 DB' },
            { op: 'connect', from: ASG, to: AURORA },
            { op: 'add', kind: 'elasticache', in: pri('second'), name: 'キャッシュ' },
            { op: 'connect', from: ASG, to: CACHE },
          ],
          why: 'DB は止まると注文が受けられなくなるので必ず冗長化し、読み取りの多い商品一覧はキャッシュで DB の負荷を減らします。',
        },
        {
          id: 'static',
          title: '商品画像を配信しよう',
          instruction:
            '商品画像は、サーバーを通さずに入口の CDN から配信してください。画像の保存先は非公開のままにします。',
          checkpoints: [
            { id: 'connect', label: 'CloudFront から S3 への接続がある', rule: connected(CF, S3) },
            { id: 'oac', label: 'CloudFront の OAC が有効', rule: configIs(CF, 'oac', '==', true) },
            {
              id: 'private',
              label: 'S3 は非公開のまま',
              rule: configIs(S3, 'blockPublicAccess', '==', true),
            },
          ],
          hints: ['コース 2 の「動的なサイトを CloudFront で速くする」と同じ形です'],
          answer: [
            { op: 'add', kind: 's3', name: '商品画像' },
            { op: 'connect', from: CF, to: S3 },
            { op: 'config', target: CF, set: { oac: true } },
          ],
          why: '画像は S3 + CloudFront に任せると、アプリのサーバーは注文などの処理に集中でき、表示も速くなります。',
        },
        {
          id: 'security',
          title: 'セキュリティグループで層を分けよう',
          instruction:
            'インターネット → ALB → アプリ → DB / キャッシュ の順にしか通信できないよう、各層に SG を付けて許可してください。アプリより後ろは SG 参照で許可します。',
          checkpoints: [
            {
              id: 'sgs',
              label: 'ALB・アプリ・DB・キャッシュに SG がある',
              rule: hasSg({ kind: ['alb', 'asg', 'rds', 'aurora', 'elasticache'] }),
            },
            {
              id: 'alb',
              label: 'ALB がインターネットからの 443 を許可',
              rule: sgAllows(USER, ALB),
            },
            {
              id: 'app',
              label: 'アプリが ALB の SG から許可',
              rule: sgAllows(ALB, ASG, { sgOnly: true }),
            },
            {
              id: 'db',
              label: 'DB がアプリの SG から許可',
              rule: sgAllows(ASG, DB, { sgOnly: true }),
            },
            {
              id: 'cache',
              label: 'キャッシュがアプリの SG から許可',
              rule: sgAllows(ASG, CACHE, { sgOnly: true }),
            },
          ],
          hints: ['ポートは ALB 443、アプリ 80、DB 3306、キャッシュ 6379 です'],
          answer: [
            { op: 'createSg', for: ALB, name: 'alb-sg' },
            { op: 'createSg', for: ASG, name: 'app-sg' },
            { op: 'createSg', for: DB, name: 'db-sg' },
            { op: 'createSg', for: CACHE, name: 'cache-sg' },
            { op: 'allow', to: ALB, from: { cidr: '0.0.0.0/0' }, port: 443 },
            { op: 'allow', to: ASG, from: ALB, port: 80 },
            { op: 'allow', to: DB, from: ASG, port: 3306 },
            { op: 'allow', to: CACHE, from: ASG, port: 6379 },
          ],
          why: 'SG を層ごとに連鎖させると、どこか 1 か所が破られても、その先へは簡単に進めません（多層防御）。',
        },
      ],
      quiz: [
        {
          question:
            'この EC サイトで、AZ が 1 つ止まったときにもサービスが続く理由として正しいものは？',
          choices: [
            {
              text: 'ALB・アプリ・DB がそれぞれ 2 つの AZ に備えているから',
              correct: true,
              explanation: 'どれか 1 つの層でも 1 AZ だけだと、そこが弱点になります。',
            },
            {
              text: 'CloudFront があるから',
              correct: false,
              explanation:
                'CloudFront は配信を速くしますが、後ろのサーバーや DB の冗長化の代わりにはなりません。',
            },
          ],
        },
        {
          question: '「多層防御」の考え方として正しいものは？',
          choices: [
            {
              text: 'WAF・SG・Private サブネットなど、守りを何重にも重ねる',
              correct: true,
              explanation: '1 つの守りが破られても、次の守りで止められます。',
            },
            {
              text: '一番強い守りを 1 つだけ置けば十分',
              correct: false,
              explanation: '1 つだけだと、それが破られた時点ですべてが危険になります。',
            },
          ],
        },
      ],
      wrapUp:
        '入口からデータ層まで、本番の EC サイトに近い構成を自分の力で組み立てました。これが AWS の Web システムの「完成形」の 1 つです。',
    },
    // ------------------------------------------------------------------
    {
      id: 'capstone-2-notify',
      title: 'サーバーレスな通知システム',
      level: 3,
      summary:
        'ログインしたユーザーが通知を登録し、毎朝決まった時刻にメールとプッシュ通知を一斉に配信する仕組みを、サーバーを持たずに組み立てます。',
      goals: [
        'サーバーレスのサービスを組み合わせて 1 つのシステムを作れる',
        '認証・定期実行・ファンアウト・監視を組み合わせられる',
      ],
      start: { from: 'document', doc: userOnly() },
      steps: [
        {
          id: 'api',
          title: 'ログインしたユーザーが通知を登録できる API を作ろう',
          instruction:
            'ユーザーはサインインしてから API を呼び、名前に「登録」を含む Lambda が購読者の情報をデータベースに保存します。ログインしていないリクエストは API で断ってください。',
          checkpoints: [
            {
              id: 'cognito',
              label: 'ユーザーが Cognito でサインインできる',
              rule: connected(USER, COGNITO),
            },
            {
              id: 'auth',
              label: 'API Gateway の認可が Cognito',
              rule: configIs(APIGW, 'authorizer', '==', 'cognito'),
            },
            {
              id: 'save',
              label: 'API から「登録」Lambda を通って DynamoDB に届く',
              rule: reachable(USER, DDB, { via: REGISTER }),
            },
          ],
          hints: ['コース 3 の Cognito のレッスンの構成がそのまま使えます'],
          answer: [
            { op: 'add', kind: 'cognito', name: 'ユーザープール' },
            { op: 'add', kind: 'apigw', name: '通知 API', config: { authorizer: 'cognito' } },
            { op: 'add', kind: 'lambda', name: '通知登録' },
            { op: 'add', kind: 'dynamodb', name: '購読者' },
            { op: 'connect', from: USER, to: COGNITO },
            { op: 'connect', from: USER, to: APIGW },
            { op: 'connect', from: APIGW, to: COGNITO },
            { op: 'connect', from: APIGW, to: REGISTER },
            { op: 'connect', from: REGISTER, to: DDB },
          ],
          why: '認証は Cognito、受付は API Gateway、処理は Lambda、保存は DynamoDB。それぞれを専用のサービスに任せると、どれもサーバーの管理が要りません。',
        },
        {
          id: 'schedule',
          title: '毎朝、配信処理を動かそう',
          instruction:
            '毎朝決まった時刻に、名前に「配信」を含む Lambda が動き、購読者の一覧を読み出すようにしてください。',
          checkpoints: [
            {
              id: 'eb',
              label: 'EventBridge のスケジュールがある',
              rule: configIs(EB, 'ruleType', '==', 'schedule'),
            },
            {
              id: 'path',
              label: 'EventBridge から「配信」Lambda を通って DynamoDB に届く',
              rule: reachable(EB, DDB, { via: DELIVER }),
            },
          ],
          hints: ['登録用とは別に、配信用の Lambda を用意します'],
          answer: [
            {
              op: 'add',
              kind: 'eventbridge',
              name: '毎朝 7 時',
              config: { ruleType: 'schedule', schedule: 'cron(0 22 * * ? *)' },
            },
            { op: 'add', kind: 'lambda', name: '一斉配信' },
            { op: 'connect', from: EB, to: DELIVER },
            { op: 'connect', from: DELIVER, to: DDB },
          ],
          why: '定期実行は EventBridge のスケジュールに任せます。日本時間の朝 7 時は、UTC では前日の 22 時です。',
        },
        {
          id: 'fanout',
          title: 'メールとプッシュ通知に一斉に配ろう',
          instruction:
            '配信処理は名前に「配信」を含む SNS に送るだけにし、そこからメール用とプッシュ通知用の 2 つのキューに配ってください。失敗したメッセージはキューを詰まらせないようにします。',
          checkpoints: [
            {
              id: 'topic',
              label: '配信 Lambda から「配信」SNS への接続がある',
              rule: connected(DELIVER, DELIVERY_TOPIC),
            },
            { id: 'queues', label: 'SQS が 2 つある', rule: exists(SQS, 2) },
            {
              id: 'fanout',
              label: 'SNS からすべてのキューへ接続がある',
              rule: connected(DELIVERY_TOPIC, SQS, { every: 'to' }),
            },
            {
              id: 'dlq',
              label: 'すべてのキューで DLQ が有効',
              rule: configIs(SQS, 'dlq', '==', true),
            },
          ],
          hints: ['コース 4 のファンアウトと DLQ のレッスンを組み合わせます'],
          answer: [
            { op: 'add', kind: 'sns', name: '配信イベント' },
            { op: 'add', kind: 'sqs', name: 'メールキュー', config: { dlq: true } },
            { op: 'add', kind: 'sqs', name: 'プッシュキュー', config: { dlq: true } },
            { op: 'connect', from: DELIVER, to: DELIVERY_TOPIC },
            { op: 'connect', from: DELIVERY_TOPIC, to: SQS },
          ],
          why: 'SNS でファンアウトすれば、あとから「LINE にも送る」といった配信先を増やしても、配信処理を変えずに済みます。DLQ があれば、送れなかった通知を後から調べられます。',
        },
        {
          id: 'monitor',
          title: '詰まりに気づけるようにしよう',
          instruction:
            'キューにメッセージがたまり続けたら、名前に「運用」を含む SNS で運用担当に知らせてください。',
          checkpoints: [
            {
              id: 'alarm',
              label: 'アラームがキューの滞留',
              rule: configIs(CW, 'alarm', '==', 'queue'),
            },
            {
              id: 'notify',
              label: 'CloudWatch から「運用」SNS への接続がある',
              rule: connected(CW, OPS),
            },
          ],
          hints: ['配信用の SNS とは別に、運用担当向けの SNS を用意します'],
          answer: [
            { op: 'add', kind: 'cloudwatch', name: '滞留アラーム', config: { alarm: 'queue' } },
            { op: 'add', kind: 'sns', name: '運用アラート' },
            { op: 'connect', from: CW, to: OPS },
          ],
          why: 'サーバーレスはサーバーの面倒を見なくてよい代わりに、「処理が詰まっていないか」を監視することが大切になります。',
        },
      ],
      quiz: [
        {
          question:
            'このシステムで、新しい配信先（例: チャットアプリ）を追加するときに変更が少なくて済む理由は？',
          choices: [
            {
              text: 'SNS でファンアウトしているので、購読先のキューと処理を追加するだけで済むから',
              correct: true,
              explanation: '配信処理は SNS に送るだけで、配信先を知らないからです。',
            },
            {
              text: 'Lambda は自動で配信先を見つけるから',
              correct: false,
              explanation: '自動では見つけません。疎結合な設計のおかげです。',
            },
          ],
        },
        {
          question: 'このシステムの料金の特徴は？',
          choices: [
            {
              text: '使った分だけの料金が中心で、通知がなければほとんどかからない',
              correct: true,
              explanation: 'サーバーを常時動かしていないので、待ち時間の料金がかかりません。',
            },
            {
              text: 'サーバー台数に応じた固定料金がかかる',
              correct: false,
              explanation: 'この構成にはサーバー（EC2）がありません。',
            },
          ],
        },
      ],
      wrapUp:
        'すべてのコースが完了しました。おつかれさまでした！ 学んだ構成はサンドボックスで自由に組み替えて試せます。問題モード・インシデントモード（準備中）で、さらに実践的な力を試してみましょう。',
    },
  ],
};
