import {
  configIs,
  connected,
  exists,
  hasSg,
  noDirect,
  none,
  not,
  placedIn,
  reachable,
  sgAllows,
  spansAzs,
  subnetRoute,
} from '../../engine/rules/predicates';
import type { Selector } from '../../engine/rules/selector';
import type { Course } from '../../learning/types';
import {
  ALB,
  ASG,
  CW,
  EC2,
  IGW,
  NAT,
  named,
  PRI,
  PUB,
  pri,
  pub,
  RDS,
  S3,
  SECRETS,
  SNS,
  USER,
  VPC,
  webBase,
} from './shared';

const VPCE_GW: Selector = { kind: 'vpce', where: { config: { endpointType: 'gateway' } } };
const VPCE_IF: Selector = { kind: 'vpce', where: { config: { endpointType: 'interface' } } };
const PAYMENT = named('external', '決済');
const MAIL = named('external', 'メール');

export const course1: Course = {
  id: 'web',
  title: 'Web アプリの定番構成',
  description:
    'ロードバランサー・複数 AZ・Auto Scaling・データベース・NAT Gateway など、Web アプリでいちばんよく使われる「3 層構成」を一歩ずつ組み立てます。',
  lessons: [
    // ------------------------------------------------------------------
    {
      id: 'web-1-alb',
      title: 'ALB でリクエストを受け付ける',
      level: 1,
      summary:
        'Public サブネットに ALB を置き、Private サブネットの EC2 へリクエストを振り分けます。サーバーを外に直接さらさない、定番の入口の作り方です。',
      goals: [
        'ALB（ロードバランサー）の役割が分かる',
        'ALB は Public、サーバーは Private に置く理由が分かる',
      ],
      start: { from: 'document', doc: webBase() },
      steps: [
        {
          id: 'alb',
          title: 'ALB を置いて 2 つの Public サブネットに配置しよう',
          instruction:
            'パレットの **Application Load Balancer** を、光っている **VPC の中**（AZ の外の空いた場所）にドラッグしてください。\n\n次に ALB を選択し、プロパティの **配置サブネット** で **Public a** と **Public c** の両方にチェックを入れます。',
          introduces: ['alb'],
          highlight: { palette: ['alb'], nodes: [VPC] },
          checkpoints: [
            { id: 'alb', label: 'ALB がある', rule: exists(ALB) },
            {
              id: 'public',
              label: 'ALB の配置先が Public サブネット',
              rule: placedIn(ALB, 'public'),
            },
            { id: 'azs', label: 'ALB が 2 つの AZ にまたがっている', rule: spansAzs(ALB, 2) },
          ],
          hints: [
            'ALB は VPC の中（サブネットの外）に置き、どのサブネットで動くかを設定で選びます',
            '配置サブネットを選ぶと、ALB からサブネットへ点線が引かれます',
          ],
          answer: [
            { op: 'add', kind: 'alb', in: VPC, name: 'ALB' },
            { op: 'attachSubnets', target: ALB, subnets: PUB },
          ],
          why: 'ALB はインターネットからのリクエストを受け付けて、後ろのサーバーに振り分ける受付係です。インターネットと直接やり取りするので Public サブネットに置き、AZ 障害に備えて 2 つの AZ にまたがらせます（AWS でも 2 つ以上の AZ が必須です）。',
        },
        {
          id: 'ec2',
          title: 'EC2 を Private サブネットに置こう',
          instruction:
            '**EC2 インスタンス** を、光っている **1 つ目の AZ の Private サブネット** にドラッグしてください。',
          introduces: ['ec2'],
          highlight: { palette: ['ec2'], nodes: [pri('first')] },
          checkpoints: [
            { id: 'ec2', label: 'EC2 がある', rule: exists(EC2) },
            {
              id: 'private',
              label: 'EC2 が Private サブネットにある',
              rule: placedIn(EC2, 'private'),
            },
          ],
          hints: ['Private サブネットは青い枠です（AZ の下半分）'],
          answer: [{ op: 'add', kind: 'ec2', in: pri('first'), name: 'Web 1' }],
          why: 'サーバーは Private サブネットに置き、外からは ALB を通してしか届かないようにします。サーバーが直接インターネットにさらされないので、攻撃される入口が ALB だけに絞られます。',
          badExample:
            'コース 0 のように EC2 を Public サブネットに置くと、ALB を経由しない直接のアクセスも受けてしまいます。',
        },
        {
          id: 'connect',
          title: 'ユーザー → ALB → EC2 とつなごう',
          instruction:
            '**ユーザー** から **ALB** へ、**ALB** から **EC2** へ線をつないでください。',
          highlight: { nodes: [USER, ALB, EC2] },
          checkpoints: [
            {
              id: 'user-alb',
              label: 'ユーザーから ALB への接続がある',
              rule: connected(USER, ALB),
            },
            { id: 'alb-ec2', label: 'ALB から EC2 への接続がある', rule: connected(ALB, EC2) },
            {
              id: 'reach',
              label: 'ユーザーのリクエストが ALB を通って EC2 に届く',
              rule: reachable(USER, EC2, { via: ALB }),
            },
          ],
          hints: [
            'インターネットからの通信は IGW を通りますが、図ではユーザー → ALB と省略して描くのが一般的です',
          ],
          answer: [
            { op: 'connect', from: USER, to: ALB },
            { op: 'connect', from: ALB, to: EC2 },
          ],
          why: 'リクエストは必ず ALB を通って EC2 に届きます。ALB は HTTPS の終端やヘルスチェック（壊れたサーバーへ送らない）も担当してくれます。',
        },
      ],
      quiz: [
        {
          question: 'ALB を Public サブネット、EC2 を Private サブネットに置く理由は？',
          choices: [
            {
              text: 'EC2 を外に直接さらさず、入口を ALB だけに絞るため',
              correct: true,
              explanation: '外から届くのは ALB だけになり、守るべき入口がはっきりします。',
            },
            {
              text: 'Private サブネットの方が EC2 の料金が安いため',
              correct: false,
              explanation: 'サブネットの種類で EC2 の料金は変わりません。',
            },
            {
              text: 'ALB は Private サブネットに置けないため',
              correct: false,
              explanation:
                '社内向けの「内部 ALB」は Private に置くこともあります。インターネット向けは Public です。',
            },
          ],
        },
        {
          question: 'ALB を 2 つの AZ にまたがらせる理由は？',
          choices: [
            {
              text: '1 つの AZ が止まっても受付を続けるため',
              correct: true,
              explanation:
                'ALB 自体も AZ ごとに動いているので、複数 AZ に置くことで止まりにくくなります。',
            },
            {
              text: '処理を 2 倍速くするため',
              correct: false,
              explanation: '目的は速さではなく可用性（止まりにくさ）です。',
            },
          ],
        },
      ],
      wrapUp:
        'ALB を入口にして、Private サブネットの EC2 へ届く経路ができました。ただし EC2 は 1 台だけ。次のレッスンで 2 台目を別の AZ に置き、どちらかが止まっても動き続ける構成にします。',
    },
    // ------------------------------------------------------------------
    {
      id: 'web-2-multiaz',
      title: '2 つの AZ で冗長化する',
      level: 1,
      summary:
        '2 台目の EC2 を別の AZ に置き、ALB から両方へ振り分けます。1 台・1 AZ が止まってもサービスが続く「冗長化」の基本です。',
      goals: [
        '冗長化（同じ役割を複数用意すること）の意味が分かる',
        'ALB が複数のサーバーに振り分ける仕組みが分かる',
      ],
      start: { from: 'lesson', lessonId: 'web-1-alb' },
      steps: [
        {
          id: 'ec2',
          title: '2 台目の EC2 を別の AZ に置こう',
          instruction:
            '**EC2 インスタンス** を、光っている **2 つ目の AZ の Private サブネット** にドラッグしてください。',
          highlight: { palette: ['ec2'], nodes: [pri('second')] },
          checkpoints: [
            { id: 'two', label: 'EC2 が 2 台ある', rule: exists(EC2, 2) },
            { id: 'azs', label: 'EC2 が 2 つの AZ に分かれている', rule: spansAzs(EC2, 2) },
          ],
          hints: ['同じ AZ に 2 台置いても、その AZ が止まると両方止まります'],
          answer: [{ op: 'add', kind: 'ec2', in: pri('second'), name: 'Web 2' }],
          why: '同じ役割のサーバーを別々の AZ に置くと、片方の AZ で障害が起きても、もう片方が処理を続けられます。',
          badExample: '2 台とも同じ AZ に置くと、台数は増えても AZ 障害には耐えられません。',
        },
        {
          id: 'connect',
          title: 'ALB から 2 台目へもつなごう',
          instruction:
            '**ALB** から **2 台目の EC2** へ線をつないで、両方に振り分けられるようにします。',
          highlight: { nodes: [ALB, EC2] },
          checkpoints: [
            {
              id: 'all',
              label: 'ALB からすべての EC2 へ接続がある',
              rule: connected(ALB, EC2, { every: 'to' }),
            },
          ],
          hints: ['ALB の縁の点からドラッグして、2 台目の EC2 の上で離します'],
          answer: [{ op: 'connect', from: ALB, to: EC2 }],
          why: 'ALB は登録された複数のサーバーにリクエストを分散し、ヘルスチェックで異常なサーバーを自動で外します。1 台が壊れても、残りのサーバーでサービスが続きます。',
        },
      ],
      quiz: [
        {
          question: 'ALB のヘルスチェックの役割は？',
          choices: [
            {
              text: '異常なサーバーを見つけて、リクエストを送らないようにする',
              correct: true,
              explanation:
                '正常なサーバーだけに振り分けるので、1 台の故障がサービス停止につながりません。',
            },
            {
              text: 'サーバーのウイルスを検査する',
              correct: false,
              explanation: 'ヘルスチェックは応答があるかどうかを確かめる仕組みです。',
            },
          ],
        },
        {
          question: '冗長化として最も効果があるのは？',
          choices: [
            {
              text: '2 台を別々の AZ に置く',
              correct: true,
              explanation: '1 台の故障にも、1 つの AZ の障害にも耐えられます。',
            },
            {
              text: '1 台を大きなインスタンスタイプにする',
              correct: false,
              explanation: '性能は上がりますが、その 1 台が止まればサービスも止まります。',
            },
            {
              text: '2 台を同じサブネットに置く',
              correct: false,
              explanation: 'サーバー 1 台の故障には耐えられますが、AZ 障害には耐えられません。',
            },
          ],
        },
      ],
      wrapUp:
        '2 つの AZ に分かれた冗長な Web 層ができました。ただ、アクセスが急に増えたら 2 台では足りません。次のレッスンでは、負荷に応じて台数が自動で増減する Auto Scaling に置き換えます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'web-3-asg',
      title: 'Auto Scaling で台数を自動調整する',
      level: 2,
      summary:
        '手で置いた EC2 を、負荷に応じて台数を増減する Auto Scaling グループに置き換えます。',
      goals: [
        'Auto Scaling の最小・希望・最大台数の意味が分かる',
        'スケーリングポリシーで自動的に増減する仕組みが分かる',
      ],
      start: { from: 'lesson', lessonId: 'web-2-multiaz' },
      steps: [
        {
          id: 'asg',
          title: 'Auto Scaling を Private サブネットに配置しよう',
          instruction:
            '**EC2 Auto Scaling** を VPC の中に置き、配置サブネットに **2 つの Private サブネット** を選んでください。',
          introduces: ['asg'],
          highlight: { palette: ['asg'] },
          checkpoints: [
            { id: 'asg', label: 'Auto Scaling がある', rule: exists(ASG) },
            { id: 'private', label: '配置先が Private サブネット', rule: placedIn(ASG, 'private') },
            { id: 'azs', label: '2 つの AZ にまたがっている', rule: spansAzs(ASG, 2) },
          ],
          hints: ['ALB と同じく、VPC の中に置いて配置サブネットを選びます'],
          answer: [
            { op: 'add', kind: 'asg', in: VPC, name: 'Web ASG' },
            { op: 'attachSubnets', target: ASG, subnets: PRI },
          ],
          why: 'Auto Scaling グループは、指定したサブネットに EC2 を自動で起動・終了します。複数 AZ のサブネットを選んでおくと、AZ をまたいでバランスよく台数を配置してくれます。',
        },
        {
          id: 'capacity',
          title: 'セールに備えて最大 6 台まで増やせるようにしよう',
          instruction:
            'Auto Scaling を選択し、**最小 2 台・最大 6 台** にしてください。スケーリングポリシーは **ターゲット追跡 (CPU)** のままにします。',
          highlight: { nodes: [ASG] },
          checkpoints: [
            { id: 'min', label: '最小台数が 2 台以上', rule: configIs(ASG, 'min', '>=', 2) },
            { id: 'max', label: '最大台数が 6 台以上', rule: configIs(ASG, 'max', '>=', 6) },
            {
              id: 'policy',
              label: 'スケーリングポリシーが設定されている',
              rule: configIs(ASG, 'scalingPolicy', '!=', 'none'),
            },
          ],
          hints: [
            '最小 = これより減らさない台数、最大 = これより増やさない台数、希望 = 今動かしたい台数です',
            'ターゲット追跡は「CPU 使用率 50% を保つ」のように目標値に合わせて台数を調整します',
          ],
          answer: [{ op: 'config', target: ASG, set: { min: 2, max: 6 } }],
          why: '最小を 2 にしておけば、夜間でも 2 つの AZ に 1 台ずつ残り冗長性を保てます。最大を大きめにしておけば、セールなどの急なアクセス増にも自動で台数を増やして対応できます。',
          badExample:
            'スケーリングポリシーがないと台数は固定のまま。アクセスが急増すると CPU が 100% に張り付き、エラーが増えます。',
        },
        {
          id: 'switch',
          title: 'ALB の振り分け先を Auto Scaling に切り替えよう',
          instruction:
            '**ALB** から **Auto Scaling** へ線をつなぎ、手で置いた **EC2 2 台は削除** してください（EC2 を選んで Delete キー）。',
          highlight: { nodes: [ALB, ASG, EC2] },
          checkpoints: [
            {
              id: 'connect',
              label: 'ALB から Auto Scaling への接続がある',
              rule: connected(ALB, ASG),
            },
            { id: 'no-ec2', label: '手で置いた EC2 がない', rule: none(EC2) },
          ],
          hints: ['複数のノードを選ぶには、Shift キーを押しながらクリックします'],
          answer: [
            { op: 'connect', from: ALB, to: ASG },
            { op: 'remove', target: EC2 },
          ],
          why: 'Auto Scaling で起動した EC2 は、自動で ALB の振り分け先に登録されます。台数が増えても減っても、ALB の設定を変える必要はありません。',
        },
      ],
      quiz: [
        {
          question: 'Auto Scaling の「最小台数」を 2 にする主な理由は？',
          choices: [
            {
              text: 'アクセスが少ないときも 2 つの AZ に 1 台ずつ残し、冗長性を保つため',
              correct: true,
              explanation: '最小 1 台だと、その 1 台や AZ が止まった瞬間にサービスが止まります。',
            },
            {
              text: '料金を最も安くするため',
              correct: false,
              explanation: '料金だけなら 1 台の方が安いですが、可用性が下がります。',
            },
          ],
        },
        {
          question: 'ターゲット追跡スケーリングの動きとして正しいものは？',
          choices: [
            {
              text: '目標の CPU 使用率を保つように台数を増減する',
              correct: true,
              explanation: '負荷が上がれば増やし、下がれば最小台数まで減らします。',
            },
            {
              text: '毎日決まった時刻に台数を変える',
              correct: false,
              explanation: 'それは「スケジュールされたスケーリング」です。',
            },
          ],
        },
      ],
      wrapUp:
        '負荷に合わせて台数が変わる Web 層になりました。次はいよいよデータを保存するデータベースを加え、セキュリティグループで層ごとに通信を絞ります。',
    },
    // ------------------------------------------------------------------
    {
      id: 'web-4-db',
      title: 'DB を Private に置き、SG で層を分ける',
      level: 2,
      summary:
        'RDS を Private サブネットに置き、「インターネット → ALB → アプリ → DB」の順にしか通信できないよう、セキュリティグループを連鎖させます。',
      goals: [
        'DB を Private サブネットに置く理由が分かる',
        'SG の送信元に別の SG を指定する「SG の連鎖」が書ける',
      ],
      start: { from: 'lesson', lessonId: 'web-3-asg' },
      steps: [
        {
          id: 'rds',
          title: 'RDS を Private サブネットに置こう',
          instruction: '**RDS** を **1 つ目の AZ の Private サブネット** に置いてください。',
          introduces: ['rds'],
          highlight: { palette: ['rds'] },
          checkpoints: [
            { id: 'rds', label: 'RDS がある', rule: exists(RDS) },
            {
              id: 'private',
              label: 'RDS が Private サブネットにある',
              rule: placedIn(RDS, 'private'),
            },
          ],
          hints: ['RDS はサブネットの中に置きます'],
          answer: [{ op: 'add', kind: 'rds', in: pri('first'), name: 'DB' }],
          why: 'DB には顧客情報などの大切なデータが入ります。インターネットへの経路がない Private サブネットに置けば、外から直接攻撃される心配がありません。',
          badExample:
            'DB を Public サブネットに置くと、SG の設定ミス 1 つでインターネットから DB に接続されてしまいます。',
        },
        {
          id: 'connect',
          title: 'アプリから DB へつなごう',
          instruction:
            '**Auto Scaling** から **RDS** へ線をつないでください。ユーザーから DB へは直接つなぎません。',
          checkpoints: [
            {
              id: 'asg-rds',
              label: 'Auto Scaling から RDS への接続がある',
              rule: connected(ASG, RDS),
            },
            {
              id: 'no-direct',
              label: 'ユーザーから RDS へ直接つながっていない',
              rule: noDirect(USER, RDS),
            },
          ],
          hints: ['接続のポートは自動で 3306（MySQL）になります'],
          answer: [{ op: 'connect', from: ASG, to: RDS }],
          why: 'DB に話しかけるのはアプリ（Auto Scaling の EC2）だけ。ユーザーはアプリを通してしかデータに触れられないようにします。',
        },
        {
          id: 'sg-alb',
          title: 'ALB の SG でインターネットからの HTTPS を許可しよう',
          instruction:
            'ALB に SG を作って割り当て、**ポート 443** を **0.0.0.0/0** から許可するルールを追加してください。',
          checkpoints: [
            { id: 'sg', label: 'ALB に SG がある', rule: hasSg(ALB) },
            {
              id: 'https',
              label: 'ALB がインターネットからの 443 を許可',
              rule: sgAllows(USER, ALB),
            },
          ],
          hints: [
            'ALB を選択し「+ 新しい SG を作成して割り当て」、その後「セキュリティグループ」タブでルールを追加します',
          ],
          answer: [
            { op: 'createSg', for: ALB, name: 'alb-sg' },
            { op: 'allow', to: ALB, from: { cidr: '0.0.0.0/0' }, port: 443 },
          ],
          why: 'ALB は誰からでもアクセスされる入口なので、HTTPS(443) だけをインターネット全体に開けます。',
        },
        {
          id: 'sg-chain',
          title: 'アプリと DB の SG を「前の層の SG」からだけ許可しよう',
          instruction:
            'Auto Scaling と RDS にそれぞれ SG を作り、次のルールを追加してください。送信元は **CIDR ではなく SG** を選びます。\n\n- アプリの SG: ポート **80** を **ALB の SG** から許可\n- DB の SG: ポート **3306** を **アプリの SG** から許可',
          checkpoints: [
            {
              id: 'sgs',
              label: 'Auto Scaling と RDS に SG がある',
              rule: hasSg({ kind: ['asg', 'rds'] }),
            },
            {
              id: 'app',
              label: 'アプリの SG が ALB の SG からの通信を許可',
              rule: sgAllows(ALB, ASG, { sgOnly: true }),
            },
            {
              id: 'db',
              label: 'DB の SG がアプリの SG からの通信を許可',
              rule: sgAllows(ASG, RDS, { sgOnly: true }),
            },
          ],
          hints: [
            'ルールの「送信元」で CIDR の代わりに「SG: alb-sg」のように選べます',
            'ポート番号は接続線に表示されている値（:80、:3306）です',
          ],
          answer: [
            { op: 'createSg', for: ASG, name: 'app-sg' },
            { op: 'createSg', for: RDS, name: 'db-sg' },
            { op: 'allow', to: ASG, from: ALB, port: 80 },
            { op: 'allow', to: RDS, from: ASG, port: 3306 },
          ],
          why: '送信元に SG を指定すると「その SG が付いたものからだけ許可」になります。Auto Scaling で EC2 が増えて IP が変わっても、ルールを書き換える必要がありません。結果として、インターネット → ALB → アプリ → DB の順にしか通信できない構成になります。',
          badExample:
            'DB の SG で 0.0.0.0/0 や VPC 全体（10.0.0.0/16）を許可すると、アプリ以外のサーバーが乗っ取られたときにも DB に届いてしまいます。',
        },
      ],
      quiz: [
        {
          question: 'DB の SG の送信元を「アプリの SG」にする利点は？',
          choices: [
            {
              text: 'アプリのサーバーが増減して IP が変わっても、ルールを変えずにアプリからだけ許可できる',
              correct: true,
              explanation:
                'SG 参照は IP ではなく「その SG を持つもの」を表すので、Auto Scaling と相性が良いです。',
            },
            {
              text: '通信が暗号化される',
              correct: false,
              explanation: 'SG は通信の許可・拒否だけで、暗号化はしません。',
            },
          ],
        },
        {
          question: 'この構成で、ユーザーが DB に直接アクセスできない理由として正しいものは？',
          choices: [
            {
              text: 'DB が Private サブネットにあり、DB の SG もアプリからしか許可していないから',
              correct: true,
              explanation: 'ネットワーク（ルート）と SG の二重で守られています。',
            },
            {
              text: 'DB にパスワードがかかっているから',
              correct: false,
              explanation:
                'パスワードも大事ですが、まずネットワークで届かないようにするのが基本です。',
            },
          ],
        },
      ],
      wrapUp:
        'Web アプリの基本形「3 層構成」が完成しました。ただ、今の DB は 1 台だけで、その AZ が止まるとデータに触れなくなります。次のレッスンで DB も冗長化します。',
    },
    // ------------------------------------------------------------------
    {
      id: 'web-5-rds-ha',
      title: 'RDS の Multi-AZ とリードレプリカ',
      level: 2,
      summary:
        'RDS を Multi-AZ にして障害に備え、リードレプリカで読み取りの負荷を分散します。似ているようで目的が違う 2 つの機能を区別します。',
      goals: [
        'Multi-AZ は「止まらないため」の機能だと分かる',
        'リードレプリカは「読み取りを分散するため」の機能だと分かる',
      ],
      start: { from: 'lesson', lessonId: 'web-4-db' },
      steps: [
        {
          id: 'multiaz',
          title: 'RDS を Multi-AZ にしよう',
          instruction: '**RDS** を選択し、プロパティの **Multi-AZ** を有効にしてください。',
          highlight: { nodes: [RDS] },
          checkpoints: [
            {
              id: 'multiaz',
              label: 'RDS の Multi-AZ が有効',
              rule: configIs(RDS, 'multiAz', '==', true),
            },
          ],
          hints: ['有効にすると、RDS の後ろに薄い円柱（スタンバイ）が描かれます'],
          answer: [{ op: 'config', target: RDS, set: { multiAz: true } }],
          why: 'Multi-AZ にすると、別の AZ に同じデータを持つスタンバイが常に用意されます。メインの DB や AZ に障害が起きると、自動でスタンバイに切り替わります。',
          badExample:
            'Multi-AZ でない DB は、その AZ の障害で数時間使えなくなることもあります。Web 層だけ冗長化しても、DB が止まればサービスは止まります。',
        },
        {
          id: 'replica',
          title: 'リードレプリカを 1 つ追加しよう',
          instruction: 'RDS の **リードレプリカ数** を **1** にしてください。',
          highlight: { nodes: [RDS] },
          checkpoints: [
            {
              id: 'replica',
              label: 'リードレプリカが 1 つ以上ある',
              rule: configIs(RDS, 'readReplicas', '>=', 1),
            },
          ],
          hints: [
            'Multi-AZ のスタンバイは読み取りには使えません。読み取りを分散したいときはリードレプリカを使います',
          ],
          answer: [{ op: 'config', target: RDS, set: { readReplicas: 1 } }],
          why: '商品一覧の表示など、Web アプリは書き込みより読み取りが圧倒的に多いもの。読み取り専用のコピー（リードレプリカ）に読み取りを回せば、メインの DB の負荷を減らせます。',
        },
      ],
      quiz: [
        {
          question: 'RDS の Multi-AZ のスタンバイについて正しいものは？',
          choices: [
            {
              text: '障害時の切り替え用で、普段は読み取りにも使えない',
              correct: true,
              explanation:
                'スタンバイは「止まらないため」の待機役。読み取りの分散にはリードレプリカを使います。',
            },
            {
              text: '読み取りの負荷分散に使える',
              correct: false,
              explanation: 'それはリードレプリカの役割です。混同しやすいポイントです。',
            },
          ],
        },
        {
          question: '「商品ページの表示が遅い。DB の CPU が読み取りクエリで高い」ときの対策は？',
          choices: [
            {
              text: 'リードレプリカを追加し、読み取りをそちらに回す',
              correct: true,
              explanation:
                '読み取りの負荷をメインの DB から逃がせます（キャッシュを使う方法もあります）。',
            },
            {
              text: 'Multi-AZ を有効にする',
              correct: false,
              explanation: 'Multi-AZ は可用性のための機能で、読み取り性能は上がりません。',
            },
          ],
        },
      ],
      wrapUp:
        'DB も障害に強くなり、読み取りの負荷分散もできるようになりました。次は、Private サブネットのサーバーから外部の API を呼び出せるようにします。',
    },
    // ------------------------------------------------------------------
    {
      id: 'web-6-nat',
      title: 'Private サブネットから外へ（NAT Gateway）',
      level: 2,
      summary:
        'Private サブネットのアプリから外部の決済 API を呼べるよう、NAT Gateway とルートを設定します。外へは出られるが外からは入れない、という通信の作り方です。',
      goals: [
        'NAT Gateway の役割と置き場所が分かる',
        'Private サブネットのルートを NAT に向けられる',
      ],
      start: { from: 'lesson', lessonId: 'web-5-rds-ha' },
      steps: [
        {
          id: 'nat',
          title: '各 AZ の Public サブネットに NAT Gateway を置こう',
          instruction:
            '**NAT Gateway** を、**2 つの Public サブネットにそれぞれ 1 つずつ** 置いてください。',
          introduces: ['natgw'],
          highlight: { palette: ['natgw'] },
          checkpoints: [
            { id: 'two', label: 'NAT Gateway が 2 つある', rule: exists(NAT, 2) },
            {
              id: 'public',
              label: 'NAT Gateway が Public サブネットにある',
              rule: placedIn(NAT, 'public'),
            },
            { id: 'azs', label: 'NAT Gateway が 2 つの AZ に分かれている', rule: spansAzs(NAT, 2) },
          ],
          hints: ['NAT Gateway 自身はインターネットと通信するので、Public サブネットに置きます'],
          answer: [
            { op: 'add', kind: 'natgw', in: pub('first'), name: 'NAT a' },
            { op: 'add', kind: 'natgw', in: pub('second'), name: 'NAT c' },
          ],
          why: 'NAT Gateway は Private サブネットからの通信を代わりにインターネットへ送り出す中継役です。AZ ごとに置いておくと、1 つの AZ が止まっても、もう一方の AZ のサーバーは外に出られます。',
          badExample:
            'NAT Gateway を 1 つの AZ にしか置かないと、その AZ の障害で全サーバーが外部 API を呼べなくなります。',
        },
        {
          id: 'route',
          title: 'Private サブネットのルートを NAT Gateway に向けよう',
          instruction:
            '2 つの **Private サブネット** のデフォルトルートを、**同じ AZ の NAT Gateway** に向けてください。',
          highlight: { nodes: [PRI] },
          checkpoints: [
            {
              id: 'route',
              label: 'Private サブネットのデフォルトルートが NAT Gateway',
              rule: subnetRoute('private', 'nat'),
            },
          ],
          hints: ['Private a は NAT a、Private c は NAT c に向けるのが基本です'],
          answer: [{ op: 'route', subnets: PRI, to: NAT }],
          why: 'ルートを NAT に向けても、サブネットは Private のまま。中から外へ出る通信はできますが、外から中へ入ってくる通信は受け付けません。',
        },
        {
          id: 'external',
          title: 'アプリから外部の決済 API へつなごう',
          instruction:
            '**外部サービス** を置いて名前を **決済 API** にし、**Auto Scaling → NAT Gateway → IGW → 決済 API** の順につないでください。',
          introduces: ['external'],
          highlight: { palette: ['external'] },
          checkpoints: [
            { id: 'external', label: '決済 API（外部サービス）がある', rule: exists(PAYMENT) },
            {
              id: 'path',
              label: 'アプリから NAT Gateway を通って決済 API に届く',
              rule: reachable(ASG, PAYMENT, { via: NAT }),
            },
          ],
          hints: [
            '名前はノードを選択してプロパティで変えられます',
            'NAT Gateway から IGW を経由してインターネットに出ます',
          ],
          answer: [
            { op: 'add', kind: 'external', name: '決済 API' },
            { op: 'connect', from: ASG, to: NAT },
            { op: 'connect', from: NAT, to: IGW },
            { op: 'connect', from: IGW, to: PAYMENT },
          ],
          why: 'Private サブネットのサーバーは、NAT Gateway → IGW を通ってインターネットに出ます。外部 API の呼び出しや OS のアップデートなど、外への通信が必要な場面でよく使う構成です。',
        },
      ],
      quiz: [
        {
          question: 'NAT Gateway を置くサブネットは？',
          choices: [
            {
              text: 'Public サブネット',
              correct: true,
              explanation:
                'NAT Gateway 自身がインターネットと通信するため、IGW へのルートがある Public に置きます。',
            },
            {
              text: 'Private サブネット',
              correct: false,
              explanation:
                'Private に置くと NAT Gateway 自身が外に出られません。よくある間違いです。',
            },
          ],
        },
        {
          question: 'Private サブネットのルートを NAT Gateway に向けたときの状態は？',
          choices: [
            {
              text: '中から外へは出られるが、外から中へは入れない',
              correct: true,
              explanation: 'NAT は内側から始まった通信の返事だけを通します。',
            },
            {
              text: 'Public サブネットと同じく外からも入れる',
              correct: false,
              explanation: '外から入れるようにするには IGW へのルートが必要です。',
            },
          ],
        },
      ],
      wrapUp:
        'Private のまま外部 API を呼べるようになりました。ただし NAT Gateway は通るデータ量にも料金がかかります。次のレッスンでは、S3 への通信を NAT を通さずに済ませる方法を学びます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'web-7-endpoint',
      title: 'VPC エンドポイントで NAT を通さず S3 へ',
      level: 2,
      summary:
        'アプリから S3 への通信を、ゲートウェイ型の VPC エンドポイント経由にします。NAT Gateway のデータ料金を節約し、インターネットも通らない構成です。',
      goals: ['VPC エンドポイントの役割が分かる', 'ゲートウェイ型エンドポイントで S3 へ接続できる'],
      start: { from: 'lesson', lessonId: 'web-6-nat' },
      steps: [
        {
          id: 'endpoint',
          title: 'S3 とゲートウェイ型の VPC エンドポイントを置こう',
          instruction:
            '**S3** を VPC の外に置いて名前を **画像バケット** にし、**VPC エンドポイント** を VPC の中に置いてください。エンドポイントの種類は **ゲートウェイ型** のままにします。',
          introduces: ['vpce'],
          highlight: { palette: ['s3', 'vpce'] },
          checkpoints: [
            { id: 's3', label: 'S3 がある', rule: exists(S3) },
            {
              id: 'vpce',
              label: 'ゲートウェイ型の VPC エンドポイントがある',
              rule: exists(VPCE_GW),
            },
          ],
          hints: ['VPC エンドポイントは VPC の中（AZ の外）に置きます'],
          answer: [
            { op: 'add', kind: 's3', name: '画像バケット' },
            {
              op: 'add',
              kind: 'vpce',
              in: VPC,
              name: 'S3 エンドポイント',
              config: { endpointType: 'gateway' },
            },
          ],
          why: 'ゲートウェイ型の VPC エンドポイントは、VPC から S3（と DynamoDB）へ直接つながる専用の出口です。追加料金なしで使えます。',
        },
        {
          id: 'path',
          title: 'アプリ → エンドポイント → S3 とつなごう',
          instruction:
            '**Auto Scaling → VPC エンドポイント → S3** の順につないでください。アプリから S3 へ直接はつなぎません。',
          checkpoints: [
            {
              id: 'via',
              label: 'アプリからエンドポイントを通って S3 に届く',
              rule: reachable(ASG, S3, { via: VPCE_GW }),
            },
            {
              id: 'no-direct',
              label: 'アプリから S3 へ直接つながっていない',
              rule: not(
                connected(ASG, S3),
                'アプリから S3 へ直接つながっています（NAT 経由になり料金がかかります）',
              ),
            },
          ],
          hints: [
            'エンドポイントがないと、S3 への通信は NAT Gateway を通ってインターネット経由になります',
          ],
          answer: [
            { op: 'connect', from: ASG, to: VPCE_GW },
            { op: 'connect', from: VPCE_GW, to: S3 },
          ],
          why: 'S3 は VPC の外にあるので、何もしなければ NAT Gateway 経由で通信し、データ量に応じた NAT の料金がかかります。エンドポイントを使えば料金を節約でき、通信もインターネットに出ないので安全です。',
          badExample:
            '画像やログを大量に S3 へ送るアプリで NAT 経由のままにすると、NAT のデータ処理料金が大きく膨らむことがあります。',
        },
      ],
      quiz: [
        {
          question: 'ゲートウェイ型 VPC エンドポイントで接続できるサービスは？',
          choices: [
            {
              text: 'S3 と DynamoDB',
              correct: true,
              explanation: 'ゲートウェイ型はこの 2 つ専用で、追加料金はかかりません。',
            },
            {
              text: 'すべての AWS サービス',
              correct: false,
              explanation: 'ほかのサービスにはインターフェース型（PrivateLink）を使います。',
            },
          ],
        },
        {
          question:
            'Private サブネットから S3 へ大量のデータを送るとき、エンドポイントを使う主な利点は？',
          choices: [
            {
              text: 'NAT Gateway のデータ料金を節約でき、通信がインターネットに出ない',
              correct: true,
              explanation: 'コスト面とセキュリティ面の両方で効果があります。',
            },
            {
              text: 'S3 の保存料金が安くなる',
              correct: false,
              explanation: '保存料金は変わりません。変わるのは通信の経路と NAT の料金です。',
            },
          ],
        },
      ],
      wrapUp:
        'S3 への通信を安く安全にできました。次は、DB のパスワードのような秘密情報を安全に扱う方法を学びます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'web-8-secrets',
      title: 'DB のパスワードを Secrets Manager で管理',
      level: 2,
      summary:
        'DB のパスワードを Secrets Manager に保管し、アプリはインターフェース型の VPC エンドポイント経由で取り出します。',
      goals: [
        '秘密情報をコードや設定ファイルに書かない理由が分かる',
        'インターフェース型 VPC エンドポイントの使いどころが分かる',
      ],
      start: { from: 'lesson', lessonId: 'web-7-endpoint' },
      steps: [
        {
          id: 'secrets',
          title: 'Secrets Manager を置こう',
          instruction:
            '**Secrets Manager** を VPC の外に置き、名前を **DB パスワード** にしてください。',
          introduces: ['secrets'],
          highlight: { palette: ['secrets'] },
          checkpoints: [{ id: 'secrets', label: 'Secrets Manager がある', rule: exists(SECRETS) }],
          hints: ['パレットの「セキュリティ」グループにあります'],
          answer: [{ op: 'add', kind: 'secrets', name: 'DB パスワード' }],
          why: 'パスワードをソースコードや設定ファイルに書くと、リポジトリの共有や流出でそのまま漏れてしまいます。Secrets Manager に預けておけば、アプリは実行時に取り出すだけ。自動ローテーション（定期的な変更）もできます。',
          badExample:
            'パスワードをコードに書いたまま GitHub に公開してしまう事故は、今でもよく起きています。',
        },
        {
          id: 'endpoint',
          title: 'インターフェース型エンドポイント経由で取り出そう',
          instruction:
            '**VPC エンドポイント** をもう 1 つ置いて種類を **インターフェース型** にし、配置サブネットに **2 つの Private サブネット** を選んでください。\n\nそのうえで **Auto Scaling → インターフェース型エンドポイント → Secrets Manager** とつなぎます。',
          highlight: { palette: ['vpce'] },
          checkpoints: [
            { id: 'vpce', label: 'インターフェース型エンドポイントがある', rule: exists(VPCE_IF) },
            {
              id: 'azs',
              label: 'エンドポイントが 2 つの AZ のサブネットにある',
              rule: spansAzs(VPCE_IF, 2),
            },
            {
              id: 'path',
              label: 'アプリからエンドポイントを通って Secrets Manager に届く',
              rule: reachable(ASG, SECRETS, { via: VPCE_IF }),
            },
          ],
          hints: [
            'ゲートウェイ型は S3 / DynamoDB 専用。それ以外のサービスにはインターフェース型を使います',
          ],
          answer: [
            {
              op: 'add',
              kind: 'vpce',
              in: VPC,
              name: 'Secrets エンドポイント',
              config: { endpointType: 'interface' },
            },
            { op: 'attachSubnets', target: VPCE_IF, subnets: PRI },
            { op: 'connect', from: ASG, to: VPCE_IF },
            { op: 'connect', from: VPCE_IF, to: SECRETS },
          ],
          why: 'インターフェース型エンドポイントは、指定したサブネットの中に AWS サービスへの専用の入口を作ります。秘密情報の取り出しがインターネットを通らず、VPC の中で完結します。',
        },
      ],
      quiz: [
        {
          question: 'DB のパスワードの扱いとして最も適切なものは？',
          choices: [
            {
              text: 'Secrets Manager に保管し、アプリが実行時に取り出す',
              correct: true,
              explanation: 'コードに残らず、ローテーションもできます。',
            },
            {
              text: 'ソースコードの中に書いておく',
              correct: false,
              explanation: 'コードが共有・流出すると、パスワードも漏れます。',
            },
          ],
        },
        {
          question: 'Secrets Manager へ VPC の中から接続するのに使うエンドポイントは？',
          choices: [
            {
              text: 'インターフェース型',
              correct: true,
              explanation: 'S3 / DynamoDB 以外のサービスはインターフェース型（PrivateLink）です。',
            },
            {
              text: 'ゲートウェイ型',
              correct: false,
              explanation: 'ゲートウェイ型は S3 と DynamoDB 専用です。',
            },
          ],
        },
      ],
      wrapUp:
        '秘密情報も安全に扱えるようになりました。最後に、システムを監視して、異常時に自動で台数を増やし、担当者に通知する仕組みを加えます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'web-9-cloudwatch',
      title: 'CloudWatch で監視し、自動で対応する',
      level: 2,
      summary:
        'CloudWatch のアラームで CPU 使用率を監視し、Auto Scaling の台数を増やすとともに、SNS で運用担当者にメールで知らせます。',
      goals: [
        'CloudWatch のメトリクスとアラームの関係が分かる',
        'アラームから自動対応と通知につなげられる',
      ],
      start: { from: 'lesson', lessonId: 'web-8-secrets' },
      steps: [
        {
          id: 'alarm',
          title: 'CloudWatch アラームで Auto Scaling を動かそう',
          instruction:
            '**CloudWatch** を置き、アラームが **CPU 使用率が高い** になっていることを確認して、**CloudWatch → Auto Scaling** とつないでください。',
          introduces: ['cloudwatch'],
          highlight: { palette: ['cloudwatch'] },
          checkpoints: [
            { id: 'cw', label: 'CloudWatch がある', rule: exists(CW) },
            { id: 'cpu', label: 'アラームが CPU 使用率', rule: configIs(CW, 'alarm', '==', 'cpu') },
            {
              id: 'asg',
              label: 'CloudWatch から Auto Scaling への接続がある',
              rule: connected(CW, ASG),
            },
          ],
          hints: ['矢印は「アラームが発生したときの動作先」を表します'],
          answer: [
            { op: 'add', kind: 'cloudwatch', name: 'CPU アラーム', config: { alarm: 'cpu' } },
            { op: 'connect', from: CW, to: ASG },
          ],
          why: 'EC2 などの使用状況は、CloudWatch にメトリクス（数値）として自動で集まります。アラームで「CPU 70% 以上が 5 分続いたら」のような条件を決めておけば、Auto Scaling が自動で台数を増やします。',
        },
        {
          id: 'notify',
          title: 'SNS で運用担当者にメールで知らせよう',
          instruction:
            '**SNS** を置いて名前を **運用通知** にし、**外部サービス** を置いて名前を **メール（運用担当）** にしてください。\n\n**CloudWatch → SNS → メール（運用担当）** とつなぎます。',
          introduces: ['sns'],
          highlight: { palette: ['sns', 'external'] },
          checkpoints: [
            { id: 'sns', label: 'SNS がある', rule: exists(SNS) },
            {
              id: 'path',
              label: 'アラームが SNS を通って運用担当に届く',
              rule: reachable(CW, MAIL, { via: SNS }),
            },
          ],
          hints: ['外部サービスの名前に「メール」を含めてください'],
          answer: [
            { op: 'add', kind: 'sns', name: '運用通知' },
            { op: 'add', kind: 'external', name: 'メール（運用担当）' },
            { op: 'connect', from: CW, to: SNS },
            { op: 'connect', from: SNS, to: MAIL },
          ],
          why: '自動で台数が増えても、何が起きたかを人が知っておくことは大切です。SNS はメール・SMS・チャットなど複数の宛先に一斉に通知を送れます。',
        },
      ],
      quiz: [
        {
          question: 'CloudWatch アラームの役割は？',
          choices: [
            {
              text: 'メトリクスがしきい値を超えたら、通知や Auto Scaling などの動作を起こす',
              correct: true,
              explanation: '監視と自動対応をつなぐのがアラームです。',
            },
            {
              text: 'サーバーの OS を自動でアップデートする',
              correct: false,
              explanation: 'それは別のサービス（Systems Manager など）の役割です。',
            },
          ],
        },
        {
          question: '1 つのアラームを、メールとチャットの両方に知らせたい。使うサービスは？',
          choices: [
            {
              text: 'SNS',
              correct: true,
              explanation: 'SNS のトピックに複数の購読先を登録すれば、一斉に届きます。',
            },
            {
              text: 'S3',
              correct: false,
              explanation: 'S3 はファイルの保存先で、通知には使いません。',
            },
          ],
        },
      ],
      wrapUp:
        'コース 1 は完了です。ALB・複数 AZ・Auto Scaling・RDS・NAT Gateway・VPC エンドポイント・Secrets Manager・CloudWatch を組み合わせた、本番で使える Web アプリの定番構成ができあがりました。次のコースでは、DNS と CDN でこの構成を世界に速く安全に届けます。',
    },
  ],
};
