import type { ArchDocument } from '../../engine/document';
import {
  configIs,
  connected,
  exists,
  placedIn,
  reachable,
  sgAllows,
  spansAzs,
} from '../../engine/rules/predicates';
import type { Course } from '../../learning/types';
import {
  APIGW,
  COGNITO,
  DDB,
  EB,
  LAMBDA,
  named,
  PRI,
  pri,
  RDS,
  SECRETS,
  USER,
  userOnly,
  webBase,
} from './shared';

const ORIGINAL = named('s3', '元画像');
const THUMBNAIL = named('s3', 'サムネイル');
const RESIZE = named('lambda', '画像変換');
const DAILY = named('lambda', '集計');

/** VPC と、VPC の外にある API Gateway → Lambda */
function apiWithVpc(): ArchDocument {
  const base = webBase();
  return {
    ...base,
    nodes: [
      ...base.nodes,
      {
        id: 'apigw-base',
        kind: 'apigw',
        name: 'API',
        config: { apiType: 'http', throttleRps: 1000, authorizer: 'none' },
        position: { x: -380, y: 40 },
      },
      {
        id: 'lambda-base',
        kind: 'lambda',
        name: '注文処理',
        config: { memory: '512', reservedConcurrency: 0, subnetIds: [], securityGroupIds: [] },
        position: { x: -380, y: 260 },
      },
    ],
    edges: [
      {
        id: 'edge-base-1',
        source: 'client-base',
        target: 'apigw-base',
        sourceHandle: 'l',
        targetHandle: 'r',
        port: 443,
      },
      {
        id: 'edge-base-2',
        source: 'apigw-base',
        target: 'lambda-base',
        sourceHandle: 'b',
        targetHandle: 't',
        port: 443,
      },
    ],
  };
}

export const course3: Course = {
  id: 'serverless',
  title: 'サーバーレス',
  description:
    'サーバーを用意せずに動く API Gateway・Lambda・DynamoDB を中心に、イベントで動く仕組みや認証、定期実行まで、サーバーレスな構成を組み立てます。',
  lessons: [
    // ------------------------------------------------------------------
    {
      id: 'serverless-1-api',
      title: 'API Gateway と Lambda で API を作る',
      level: 2,
      summary:
        'API Gateway で受けたリクエストを Lambda で処理する、いちばん基本的なサーバーレス API を作ります。',
      goals: [
        'Lambda が「リクエストのたびに動く関数」だと分かる',
        'API Gateway のスロットリングの役割が分かる',
      ],
      start: { from: 'document', doc: userOnly() },
      steps: [
        {
          id: 'api',
          title: 'ユーザー → API Gateway → Lambda とつなごう',
          instruction:
            '**API Gateway** と **Lambda** を置き、**ユーザー → API Gateway → Lambda** とつないでください。どちらも VPC の外に置きます。',
          introduces: ['apigw', 'lambda'],
          highlight: { palette: ['apigw', 'lambda'] },
          checkpoints: [
            { id: 'apigw', label: 'API Gateway がある', rule: exists(APIGW) },
            { id: 'lambda', label: 'Lambda がある', rule: exists(LAMBDA) },
            {
              id: 'path',
              label: 'ユーザーから API Gateway を通って Lambda に届く',
              rule: reachable(USER, LAMBDA, { via: APIGW }),
            },
          ],
          hints: [
            'API Gateway は「アプリケーション統合」、Lambda は「コンピュート」グループにあります',
          ],
          answer: [
            { op: 'add', kind: 'apigw', name: 'API' },
            { op: 'add', kind: 'lambda', name: 'API 処理' },
            { op: 'connect', from: USER, to: APIGW },
            { op: 'connect', from: APIGW, to: LAMBDA },
          ],
          why: 'Lambda はリクエストが来たときだけ動き、動いた時間だけ料金がかかります。サーバーの起動・OS の更新・台数の調整は AWS がやってくれるので、コードを書くことに集中できます。',
        },
        {
          id: 'throttle',
          title: 'スロットリング上限を 1000 req/s にしよう',
          instruction: '**API Gateway** の **スロットリング上限** を **1000** にしてください。',
          checkpoints: [
            {
              id: 'throttle',
              label: 'スロットリング上限が 1000 req/s 以下',
              rule: configIs(APIGW, 'throttleRps', '<=', 1000),
            },
          ],
          hints: ['想定しているアクセス数に合わせて上限を決めます'],
          answer: [{ op: 'config', target: APIGW, set: { throttleRps: 1000 } }],
          why: 'スロットリングは「1 秒あたり何回まで受け付けるか」の上限です。想定外の大量アクセスや攻撃で Lambda が動き続け、料金が膨らんだり後ろの DB が止まったりするのを防ぎます。',
          badExample:
            '上限が大きすぎると、不具合のあるクライアントが同じ API を連打したときにも全部処理してしまい、思わぬ請求につながります。',
        },
      ],
      quiz: [
        {
          question: 'Lambda の料金の考え方は？',
          choices: [
            {
              text: 'リクエスト数と、関数が動いた時間に応じて課金',
              correct: true,
              explanation: 'リクエストがなければ料金はほぼかかりません。',
            },
            {
              text: '1 か月ごとの固定料金',
              correct: false,
              explanation: '使った分だけの従量課金です。',
            },
          ],
        },
        {
          question: 'API Gateway のスロットリングの目的は？',
          choices: [
            {
              text: '受け付けるリクエストの数に上限を設け、使いすぎや過負荷を防ぐ',
              correct: true,
              explanation: '上限を超えたリクエストは 429 エラーで断られます。',
            },
            {
              text: '通信を暗号化する',
              correct: false,
              explanation: '暗号化は HTTPS の役割です。',
            },
          ],
        },
      ],
      wrapUp: 'サーバーレスな API ができました。次はデータを保存する先として DynamoDB を加えます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'serverless-2-dynamodb',
      title: 'DynamoDB でデータを保存する',
      level: 2,
      summary:
        'Lambda から DynamoDB にデータを保存し、Lambda の同時実行数を予約して暴走を防ぎます。',
      goals: [
        'DynamoDB の特徴（キーで引く・サーバー管理不要）が分かる',
        'Lambda の同時実行数の考え方が分かる',
      ],
      start: { from: 'lesson', lessonId: 'serverless-1-api' },
      steps: [
        {
          id: 'dynamodb',
          title: 'Lambda から DynamoDB へつなごう',
          instruction: '**DynamoDB** を置き、**Lambda → DynamoDB** とつないでください。',
          introduces: ['dynamodb'],
          highlight: { palette: ['dynamodb'] },
          checkpoints: [
            { id: 'ddb', label: 'DynamoDB がある', rule: exists(DDB) },
            {
              id: 'connect',
              label: 'Lambda から DynamoDB への接続がある',
              rule: connected(LAMBDA, DDB),
            },
          ],
          hints: ['DynamoDB も VPC の外で動くサービスです'],
          answer: [
            { op: 'add', kind: 'dynamodb', name: '注文テーブル' },
            { op: 'connect', from: LAMBDA, to: DDB },
          ],
          why: 'DynamoDB はサーバーの管理が不要で、アクセスが増えても速さが落ちにくいデータベースです。Lambda と同じく使った分だけの料金にでき、サーバーレスと相性が抜群です。',
        },
        {
          id: 'concurrency',
          title: 'Lambda の予約同時実行数を 100 にしよう',
          instruction: '**Lambda** の **予約同時実行数** を **100** にしてください。',
          checkpoints: [
            {
              id: 'reserved',
              label: 'Lambda に予約同時実行数が設定されている',
              rule: configIs(LAMBDA, 'reservedConcurrency', '>=', 1),
            },
          ],
          hints: ['同時実行数 = 同じ瞬間に動いている Lambda の数です'],
          answer: [{ op: 'config', target: LAMBDA, set: { reservedConcurrency: 100 } }],
          why: 'Lambda の同時実行数はアカウント全体で上限が決まっています。予約しておくと、この関数が使える数を確保しつつ、それ以上には増えないので、ほかの関数を巻き込んだり、後ろのシステムに負荷をかけすぎたりするのを防げます。',
        },
      ],
      quiz: [
        {
          question: 'DynamoDB が得意なことは？',
          choices: [
            {
              text: 'キーを指定して、大量のデータを高速に読み書きする',
              correct: true,
              explanation:
                'どう読み出すかを決めてキーを設計すれば、規模が大きくなっても速いままです。',
            },
            {
              text: 'いろいろな条件で自由に集計する',
              correct: false,
              explanation: '自由な検索や集計は RDS（SQL）の方が得意です。',
            },
          ],
        },
        {
          question: 'Lambda に予約同時実行数を設定する効果は？',
          choices: [
            {
              text: 'その関数が使える数を確保し、同時にそれ以上には増えないようにする',
              correct: true,
              explanation: '確保と上限の両方の役割があります。',
            },
            {
              text: 'Lambda の実行時間を延ばす',
              correct: false,
              explanation: '実行時間（最大 15 分）とは関係ありません。',
            },
          ],
        },
      ],
      wrapUp:
        'API とデータ保存がそろいました。次は、ユーザーのリクエストではなく「ファイルのアップロード」をきっかけに動く仕組みを作ります。',
    },
    // ------------------------------------------------------------------
    {
      id: 'serverless-3-s3-event',
      title: 'S3 へのアップロードで処理を起動する',
      level: 3,
      summary:
        'S3 に画像がアップロードされたら Lambda が自動で動き、サムネイルを作って別のバケットに保存する、イベント駆動の構成を作ります。',
      goals: ['「イベント駆動」の考え方が分かる', 'S3 のイベント通知で Lambda を動かせる'],
      start: { from: 'document', doc: userOnly() },
      steps: [
        {
          id: 'upload',
          title: 'ユーザーが画像をアップロードする先を用意しよう',
          instruction: '名前が **元画像** の S3 を置き、ユーザーからつないでください。',
          checkpoints: [
            {
              id: 'connect',
              label: 'ユーザーから「元画像」の S3 への接続がある',
              rule: connected(USER, ORIGINAL),
            },
          ],
          hints: ['S3 を置いたら、プロパティで名前を「元画像」に変えます'],
          answer: [
            { op: 'add', kind: 's3', name: '元画像' },
            { op: 'connect', from: USER, to: ORIGINAL },
          ],
          why: '大きなファイルは、サーバーを経由せず S3 に直接アップロードさせるのが定番です。サーバーの負荷も通信量も減らせます。',
        },
        {
          id: 'event',
          title: 'アップロードをきっかけに Lambda を動かそう',
          instruction:
            '名前が **画像変換** の Lambda を置き、**元画像の S3 → 画像変換** とつないでください（S3 のイベント通知）。',
          checkpoints: [
            {
              id: 'event',
              label: '「元画像」から「画像変換」への接続がある',
              rule: connected(ORIGINAL, RESIZE),
            },
          ],
          hints: ['矢印は「イベントの通知先」を表します'],
          answer: [
            { op: 'add', kind: 'lambda', name: '画像変換' },
            { op: 'connect', from: ORIGINAL, to: RESIZE },
          ],
          why: 'S3 は「ファイルが置かれた」などのイベントを Lambda に通知できます。誰かが処理を呼び出さなくても、出来事をきっかけに自動で処理が動く、これがイベント駆動です。',
        },
        {
          id: 'thumbnail',
          title: 'サムネイルを別のバケットに保存しよう',
          instruction:
            '名前が **サムネイル** の S3 をもう 1 つ置き、**画像変換 → サムネイル** とつないでください。',
          checkpoints: [
            { id: 'two', label: 'S3 が 2 つある', rule: exists({ kind: 's3' }, 2) },
            {
              id: 'save',
              label: '「画像変換」から「サムネイル」への接続がある',
              rule: connected(RESIZE, THUMBNAIL),
            },
          ],
          hints: ['元画像と同じバケットに保存すると、どうなるか考えてみましょう'],
          answer: [
            { op: 'add', kind: 's3', name: 'サムネイル' },
            { op: 'connect', from: RESIZE, to: THUMBNAIL },
          ],
          why: '保存先を別のバケットにすると、サムネイルの保存が新しいイベントを起こして Lambda がまた動く…という無限ループを防げます。',
          badExample:
            '元画像と同じバケットに保存すると、「保存 → イベント → 変換 → 保存 → …」と Lambda が延々と動き続け、料金が膨れ上がります。実際によくある事故です。',
        },
      ],
      quiz: [
        {
          question: 'イベント駆動の構成の特徴は？',
          choices: [
            {
              text: 'ファイルの追加などの出来事をきっかけに、自動で処理が動く',
              correct: true,
              explanation: '処理を定期的に確認しに行く必要がありません。',
            },
            {
              text: '常にサーバーを起動して待ち受ける',
              correct: false,
              explanation: 'Lambda はイベントが来たときだけ動きます。',
            },
          ],
        },
        {
          question: 'サムネイルを元画像と別のバケットに保存する理由は？',
          choices: [
            {
              text: '保存がまたイベントを起こし、Lambda が無限に動くのを防ぐため',
              correct: true,
              explanation:
                '同じバケットにする場合は、フォルダ（プレフィックス）でイベントの対象を絞る必要があります。',
            },
            {
              text: '同じバケットには 2 つのファイルを置けないため',
              correct: false,
              explanation: 'バケットにはファイルをいくつでも置けます。',
            },
          ],
        },
      ],
      wrapUp:
        'イベントで動く仕組みを作れました。次は、Lambda から VPC の中にある RDS に接続する方法を学びます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'serverless-4-vpc',
      title: 'Lambda から VPC 内の RDS へ',
      level: 3,
      summary:
        'Lambda を VPC に接続し、Private サブネットの RDS に安全につなぎます。パスワードは Secrets Manager から取り出します。',
      goals: ['Lambda を VPC に接続する方法が分かる', 'Lambda にも SG を付けて DB を守れる'],
      start: { from: 'document', doc: apiWithVpc() },
      steps: [
        {
          id: 'rds',
          title: 'RDS を Private サブネットに置こう',
          instruction: 'RDS を 1 つ目の AZ の Private サブネットに置いてください。',
          checkpoints: [
            {
              id: 'private',
              label: 'RDS が Private サブネットにある',
              rule: placedIn(RDS, 'private'),
            },
          ],
          hints: ['DB を外にさらさないのは、サーバーレスでも同じです'],
          answer: [{ op: 'add', kind: 'rds', in: pri('first'), name: 'DB' }],
          why: 'Lambda を使う場合でも、RDS は Private サブネットに置いて外から届かないようにします。',
        },
        {
          id: 'attach',
          title: 'Lambda を VPC の Private サブネットに接続しよう',
          instruction:
            'Lambda の **VPC 接続サブネット** に、2 つの Private サブネットを選んでください。',
          checkpoints: [
            {
              id: 'private',
              label: 'Lambda が Private サブネットに接続している',
              rule: placedIn(LAMBDA, 'private'),
            },
            {
              id: 'azs',
              label: 'Lambda の接続先が 2 つの AZ にまたがっている',
              rule: spansAzs(LAMBDA, 2),
            },
          ],
          hints: ['Lambda 自体は VPC の外に描いたまま、設定で接続先のサブネットを選びます'],
          answer: [{ op: 'attachSubnets', target: LAMBDA, subnets: PRI }],
          why: 'Lambda は普段 VPC の外で動くので、そのままでは Private サブネットの RDS に届きません。VPC 接続を設定すると、指定したサブネットからネットワークにつながるようになります。',
        },
        {
          id: 'connect',
          title: 'SG を付けて Lambda から RDS へつなごう',
          instruction:
            'Lambda と RDS にそれぞれ SG を作り、RDS の SG で **Lambda の SG** からの **3306** を許可して、**Lambda → RDS** とつないでください。',
          checkpoints: [
            {
              id: 'connect',
              label: 'Lambda から RDS への接続がある',
              rule: connected(LAMBDA, RDS),
            },
            {
              id: 'sg',
              label: 'RDS の SG が Lambda の SG からの通信を許可',
              rule: sgAllows(LAMBDA, RDS, { sgOnly: true }),
            },
          ],
          hints: ['Lambda の SG は、VPC 接続サブネットを選んだあとで作れるようになります'],
          answer: [
            { op: 'createSg', for: LAMBDA, name: 'lambda-sg' },
            { op: 'createSg', for: RDS, name: 'db-sg' },
            { op: 'allow', to: RDS, from: LAMBDA, port: 3306 },
            { op: 'connect', from: LAMBDA, to: RDS },
          ],
          why: 'VPC に接続した Lambda は SG を持てます。RDS 側で「Lambda の SG からだけ」許可すれば、コース 1 の EC2 と同じように DB を守れます。',
        },
        {
          id: 'secrets',
          title: 'DB のパスワードを Secrets Manager から取り出そう',
          instruction: 'Secrets Manager を置き、Lambda からつないでください。',
          checkpoints: [
            {
              id: 'connect',
              label: 'Lambda から Secrets Manager への接続がある',
              rule: connected(LAMBDA, SECRETS),
            },
          ],
          hints: [
            'VPC 内の Lambda から VPC 外のサービスを呼ぶには、NAT Gateway か VPC エンドポイントが必要です（コース 1 で学びました）',
          ],
          answer: [
            { op: 'add', kind: 'secrets', name: 'DB パスワード' },
            { op: 'connect', from: LAMBDA, to: SECRETS },
          ],
          why: 'Lambda の環境変数にパスワードを直接書くより、Secrets Manager から取り出す方が安全です。なお、Lambda は同時にたくさん動くので、DB への接続数が増えすぎないよう、実際には RDS Proxy を間に置くこともよくあります。',
        },
      ],
      quiz: [
        {
          question: 'Lambda から Private サブネットの RDS に接続するために必要な設定は？',
          choices: [
            {
              text: 'Lambda の VPC 接続（サブネットと SG の指定）',
              correct: true,
              explanation: 'VPC に接続しないと、Private サブネットには届きません。',
            },
            {
              text: 'RDS を Public サブネットに移す',
              correct: false,
              explanation: 'DB を外にさらすことになり、危険です。',
            },
          ],
        },
        {
          question:
            'VPC に接続した Lambda がインターネット上の API を呼べないとき、考えられる原因は？',
          choices: [
            {
              text: 'Private サブネットに NAT Gateway へのルートがない',
              correct: true,
              explanation:
                'VPC 内の Lambda も、外に出るには NAT Gateway（または VPC エンドポイント）が必要です。',
            },
            {
              text: 'Lambda のメモリが少ない',
              correct: false,
              explanation:
                'メモリは処理の速さに関係しますが、ネットワークの到達性とは関係ありません。',
            },
          ],
        },
      ],
      wrapUp:
        'サーバーレスと VPC の組み合わせ方が分かりました。次は、API にログイン機能を付けます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'serverless-5-cognito',
      title: 'Cognito でユーザー認証を付ける',
      level: 3,
      summary:
        'Cognito でユーザーのサインインを提供し、API Gateway でログインしたユーザーのリクエストだけを受け付けるようにします。',
      goals: [
        '認証（だれか確認する）を Cognito に任せられる',
        'API Gateway のオーソライザーの役割が分かる',
      ],
      start: { from: 'lesson', lessonId: 'serverless-2-dynamodb' },
      steps: [
        {
          id: 'cognito',
          title: 'ユーザーが Cognito でサインインできるようにしよう',
          instruction: 'Cognito を置き、ユーザーから Cognito へつないでください。',
          introduces: ['cognito'],
          checkpoints: [
            {
              id: 'connect',
              label: 'ユーザーから Cognito への接続がある',
              rule: connected(USER, COGNITO),
            },
          ],
          hints: ['Cognito は「セキュリティ」グループにあります'],
          answer: [
            { op: 'add', kind: 'cognito', name: 'ユーザープール' },
            { op: 'connect', from: USER, to: COGNITO },
          ],
          why: 'サインアップ・ログイン・パスワードの再設定・多要素認証などを自分で作るのは大変で、作り間違えると危険です。Cognito に任せれば安全な仕組みをすぐに使えます。',
        },
        {
          id: 'authorizer',
          title: 'API Gateway でログインしたユーザーだけを通そう',
          instruction:
            'API Gateway の **認可** を **Cognito** にし、API Gateway から Cognito へつないでください。',
          checkpoints: [
            {
              id: 'authorizer',
              label: 'API Gateway の認可が Cognito',
              rule: configIs(APIGW, 'authorizer', '==', 'cognito'),
            },
            {
              id: 'connect',
              label: 'API Gateway から Cognito への接続がある',
              rule: connected(APIGW, COGNITO),
            },
          ],
          hints: ['ユーザーは Cognito から受け取ったトークンを付けて API を呼びます'],
          answer: [
            { op: 'config', target: APIGW, set: { authorizer: 'cognito' } },
            { op: 'connect', from: APIGW, to: COGNITO },
          ],
          why: 'API Gateway がリクエストに付いたトークンを Cognito で確かめ、ログインしていないリクエストは Lambda に届く前に断ります。Lambda のコードで認証を書く必要がありません。',
          badExample:
            '認可を設定しないと、URL さえ分かれば誰でも API を呼べてしまい、他人のデータを読まれる危険があります。',
        },
      ],
      quiz: [
        {
          question: 'API Gateway の Cognito オーソライザーの役割は？',
          choices: [
            {
              text: 'リクエストのトークンを確かめ、ログインしたユーザーだけを通す',
              correct: true,
              explanation: '認証されていないリクエストは Lambda に届く前に拒否されます。',
            },
            {
              text: 'ユーザーのパスワードを保存する',
              correct: false,
              explanation: 'パスワードを管理するのは Cognito のユーザープールです。',
            },
          ],
        },
        {
          question: 'ログイン機能を Cognito に任せる利点は？',
          choices: [
            {
              text: 'パスワードの保管や多要素認証など、難しく危険な部分を自分で作らずに済む',
              correct: true,
              explanation:
                '認証は作り間違えると大きな事故につながるので、専用のサービスに任せるのが安全です。',
            },
            {
              text: 'API が速くなる',
              correct: false,
              explanation: '目的は速さではなく、安全な認証です。',
            },
          ],
        },
      ],
      wrapUp:
        'ログインしたユーザーだけが使える API になりました。最後に、決まった時刻に自動で動く処理を加えます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'serverless-6-schedule',
      title: 'EventBridge で定期実行する',
      level: 3,
      summary:
        'EventBridge のスケジュールで、毎日決まった時刻に集計用の Lambda を動かします。サーバーなしの「cron」です。',
      goals: [
        'EventBridge のスケジュールの使い方が分かる',
        '定期実行にサーバーが不要なことが分かる',
      ],
      start: { from: 'lesson', lessonId: 'serverless-2-dynamodb' },
      steps: [
        {
          id: 'schedule',
          title: 'EventBridge のスケジュールを作ろう',
          instruction:
            'EventBridge を置き、ルールの種類を **スケジュール（定期実行）** にしてください。',
          introduces: ['eventbridge'],
          checkpoints: [
            { id: 'eb', label: 'EventBridge がある', rule: exists(EB) },
            {
              id: 'schedule',
              label: 'ルールの種類がスケジュール',
              rule: configIs(EB, 'ruleType', '==', 'schedule'),
            },
          ],
          hints: ['スケジュール式は rate(1 day) や cron(0 3 * * ? *) のように書きます'],
          answer: [
            {
              op: 'add',
              kind: 'eventbridge',
              name: '毎日 3 時',
              config: { ruleType: 'schedule', schedule: 'cron(0 18 * * ? *)' },
            },
          ],
          why: '「毎日 3 時に集計する」ような処理のために、サーバーを 1 台動かし続ける必要はありません。EventBridge のスケジュールが、決まった時刻に処理を呼び出してくれます（時刻は UTC で書くので、日本時間の 3 時は 18 時です）。',
        },
        {
          id: 'job',
          title: '集計用の Lambda を動かそう',
          instruction:
            '名前が **日次集計** の Lambda を置き、**EventBridge → 日次集計 → DynamoDB** とつないでください。',
          checkpoints: [
            {
              id: 'path',
              label: 'EventBridge から「日次集計」を通って DynamoDB に届く',
              rule: reachable(EB, DDB, { via: DAILY }),
            },
          ],
          hints: ['API 用の Lambda とは別に、集計用の Lambda を用意します'],
          answer: [
            { op: 'add', kind: 'lambda', name: '日次集計' },
            { op: 'connect', from: EB, to: DAILY },
            { op: 'connect', from: DAILY, to: DDB },
          ],
          why: '用途ごとに Lambda を分けておくと、設定（メモリ・実行時間・権限）をそれぞれに合わせられ、片方の不具合がもう片方に影響しません。',
        },
      ],
      quiz: [
        {
          question: '毎晩 1 回だけ動く集計処理の置き場所として最も適切なものは？',
          choices: [
            {
              text: 'EventBridge のスケジュールで Lambda を動かす',
              correct: true,
              explanation: '動いた時間だけの料金で済み、サーバーの管理も不要です。',
            },
            {
              text: 'EC2 を常に起動して cron で動かす',
              correct: false,
              explanation: '1 日のほとんどの時間、何もしないサーバーに料金を払うことになります。',
            },
          ],
        },
        {
          question: 'EventBridge のスケジュール式の時刻の基準は？',
          choices: [
            {
              text: 'UTC（協定世界時）',
              correct: true,
              explanation:
                '日本時間は UTC より 9 時間進んでいます（タイムゾーンを指定できる EventBridge Scheduler もあります）。',
            },
            {
              text: '常に日本時間',
              correct: false,
              explanation: '基本は UTC です。時刻のずれはよくある落とし穴です。',
            },
          ],
        },
      ],
      wrapUp:
        'コース 3 は完了です。API Gateway・Lambda・DynamoDB を中心に、イベント駆動・VPC 接続・認証・定期実行まで、サーバーレスの主な使い方を一通り体験しました。次のコースでは、処理を分けてつなぐ「疎結合」を学びます。',
    },
  ],
};
