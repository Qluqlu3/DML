import {
  configIs,
  connected,
  exists,
  placedIn,
  reachable,
  spansAzs,
} from '../../engine/rules/predicates';
import type { Course } from '../../learning/types';
import { ALB, AURORA, ECS, PRI, PUB, pri, USER, VPC, webBase } from './shared';

export const course5: Course = {
  id: 'container',
  title: 'コンテナ',
  description:
    'アプリをコンテナにまとめて、サーバーの管理なしに動かせる ECS（Fargate）を使います。データベースには Aurora を組み合わせます。',
  lessons: [
    // ------------------------------------------------------------------
    {
      id: 'container-1-ecs',
      title: 'ECS Fargate と ALB でアプリを動かす',
      level: 3,
      summary: 'ALB の後ろで、コンテナのアプリを ECS（Fargate）で 2 つの AZ に分けて動かします。',
      goals: [
        'コンテナと ECS（Fargate）の関係が分かる',
        'EC2 の構成とコンテナの構成の共通点が分かる',
      ],
      start: { from: 'document', doc: webBase() },
      steps: [
        {
          id: 'alb',
          title: '入口となる ALB を用意しよう',
          instruction:
            'インターネットからのリクエストを受ける ALB を、2 つの AZ の Public サブネットに配置してください。',
          checkpoints: [
            {
              id: 'public',
              label: 'ALB が Public サブネットにある',
              rule: placedIn(ALB, 'public'),
            },
            { id: 'azs', label: 'ALB が 2 つの AZ にまたがっている', rule: spansAzs(ALB, 2) },
          ],
          hints: ['コース 1 と同じ要領です'],
          answer: [
            { op: 'add', kind: 'alb', in: VPC, name: 'ALB' },
            { op: 'attachSubnets', target: ALB, subnets: PUB },
          ],
          why: 'アプリがコンテナになっても、入口の考え方は EC2 のときと同じです。ALB はコンテナにも振り分けられます。',
        },
        {
          id: 'ecs',
          title: 'ECS サービスを Private サブネットで動かそう',
          instruction:
            'ECS サービス (Fargate) を VPC に置き、2 つの Private サブネットに配置して、タスク数を 2 以上にしてください。',
          introduces: ['ecs'],
          checkpoints: [
            { id: 'ecs', label: 'ECS サービスがある', rule: exists(ECS) },
            {
              id: 'private',
              label: 'ECS が Private サブネットにある',
              rule: placedIn(ECS, 'private'),
            },
            { id: 'azs', label: 'ECS が 2 つの AZ にまたがっている', rule: spansAzs(ECS, 2) },
            {
              id: 'count',
              label: 'タスク数が 2 以上',
              rule: configIs(ECS, 'desiredCount', '>=', 2),
            },
          ],
          hints: ['タスク = 動いているコンテナ（のまとまり）1 つ分です'],
          answer: [
            { op: 'add', kind: 'ecs', in: VPC, name: 'Web サービス' },
            { op: 'attachSubnets', target: ECS, subnets: PRI },
          ],
          why: 'Fargate を使うと、コンテナを動かすサーバー（EC2）の用意や OS の更新が不要になります。タスクを 2 つ以上、別々の AZ で動かせば、1 つが止まってもサービスは続きます。',
        },
        {
          id: 'connect',
          title: 'ユーザー → ALB → ECS とつなごう',
          instruction: 'ユーザーから ALB、ALB から ECS サービスへつないでください。',
          checkpoints: [
            {
              id: 'path',
              label: 'ユーザーから ALB を通って ECS に届く',
              rule: reachable(USER, ECS, { via: ALB }),
            },
          ],
          hints: ['ALB は新しく起動したタスクを自動で振り分け先に加えます'],
          answer: [
            { op: 'connect', from: USER, to: ALB },
            { op: 'connect', from: ALB, to: ECS },
          ],
          why: 'ECS は起動したタスクを自動で ALB に登録し、止まったタスクは外します。台数が変わっても ALB の設定を触る必要はありません。',
        },
      ],
      quiz: [
        {
          question: 'Fargate を使う利点は？',
          choices: [
            {
              text: 'コンテナを動かすサーバーの用意や管理が不要になる',
              correct: true,
              explanation: 'サーバーの台数や OS の更新を気にせず、コンテナだけに集中できます。',
            },
            {
              text: 'コンテナを使わずにアプリを動かせる',
              correct: false,
              explanation: 'Fargate はコンテナを動かすための仕組みです。',
            },
          ],
        },
        {
          question: 'ECS のタスクを 2 つの AZ に分けて動かす理由は？',
          choices: [
            {
              text: '1 つの AZ が止まってもサービスを続けるため',
              correct: true,
              explanation: 'EC2 の冗長化と同じ考え方です。',
            },
            {
              text: 'コンテナは 1 つの AZ に 1 つしか置けないため',
              correct: false,
              explanation: '同じ AZ にいくつでも置けます。分けるのは可用性のためです。',
            },
          ],
        },
      ],
      wrapUp:
        'コンテナでアプリを動かせました。次は、負荷に応じてタスク数を増減させ、データベースに Aurora を組み合わせます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'container-2-scale',
      title: 'ECS のオートスケーリングと Aurora',
      level: 3,
      summary:
        'ECS のタスク数を負荷に応じて自動で増やせるようにし、データベースに高い可用性を持つ Aurora を組み合わせます。',
      goals: ['ECS のオートスケーリングが設定できる', 'Aurora のライターとリーダーの関係が分かる'],
      start: { from: 'lesson', lessonId: 'container-1-ecs' },
      steps: [
        {
          id: 'scale',
          title: 'タスク数を最大 10 まで自動で増やせるようにしよう',
          instruction:
            'ECS サービスのオートスケーリングを有効にし、最大タスク数を 10 以上にしてください。',
          checkpoints: [
            {
              id: 'auto',
              label: 'オートスケーリングが有効',
              rule: configIs(ECS, 'autoScaling', '==', true),
            },
            {
              id: 'max',
              label: '最大タスク数が 10 以上',
              rule: configIs(ECS, 'maxCount', '>=', 10),
            },
          ],
          hints: ['EC2 の Auto Scaling と同じく、CPU 使用率などを目安に増減します'],
          answer: [{ op: 'config', target: ECS, set: { autoScaling: true, maxCount: 10 } }],
          why: 'コンテナは EC2 より起動が速いので、急なアクセス増にも素早く追従できます。普段は少ないタスク数で動かし、必要なときだけ増やせば料金も抑えられます。',
        },
        {
          id: 'aurora',
          title: 'Aurora を Private サブネットに置いてつなごう',
          instruction:
            'Aurora を 1 つ目の AZ の Private サブネットに置き、リーダーを 1 つ以上にして、ECS サービスからつないでください。',
          introduces: ['aurora'],
          checkpoints: [
            {
              id: 'private',
              label: 'Aurora が Private サブネットにある',
              rule: placedIn(AURORA, 'private'),
            },
            {
              id: 'reader',
              label: 'リーダーが 1 つ以上ある',
              rule: configIs(AURORA, 'readers', '>=', 1),
            },
            {
              id: 'connect',
              label: 'ECS から Aurora への接続がある',
              rule: connected(ECS, AURORA),
            },
          ],
          hints: ['リーダーがあると、Aurora の後ろに薄い円柱が描かれます'],
          answer: [
            { op: 'add', kind: 'aurora', in: pri('first'), name: 'Aurora' },
            { op: 'connect', from: ECS, to: AURORA },
          ],
          why: 'Aurora は書き込み用のライターと読み取り用のリーダーが同じストレージを共有します。リーダーは読み取りの分散に使えるうえ、ライターが壊れたときには自動で昇格して引き継ぐので、可用性も高くなります。',
        },
      ],
      quiz: [
        {
          question: 'Aurora のリーダーについて正しいものは？',
          choices: [
            {
              text: '読み取りを分散でき、ライターの障害時には昇格して引き継げる',
              correct: true,
              explanation:
                'RDS のリードレプリカと Multi-AZ のスタンバイの両方の役割を兼ねるイメージです。',
            },
            {
              text: '書き込みもできる 2 台目のライター',
              correct: false,
              explanation: 'リーダーは読み取り専用です。',
            },
          ],
        },
        {
          question: 'コンテナのオートスケーリングが EC2 より素早く追従しやすい理由は？',
          choices: [
            {
              text: 'コンテナはサーバー全体ではなくアプリだけを起動するので、起動が速い',
              correct: true,
              explanation: '数秒〜数十秒で起動できることが多く、急な負荷に強くなります。',
            },
            {
              text: 'コンテナは料金がかからない',
              correct: false,
              explanation: 'Fargate はタスクの vCPU とメモリ、動いた時間に応じて課金されます。',
            },
          ],
        },
      ],
      wrapUp:
        'コース 5 は完了です。コンテナで動くアプリを、負荷に応じて伸び縮みさせ、Aurora で支える構成ができました。',
    },
  ],
};
