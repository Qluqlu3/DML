import {
  configIs,
  connected,
  exists,
  none,
  placedIn,
  sgAllows,
} from '../../engine/rules/predicates';
import type { Course } from '../../learning/types';
import { ASG, AURORA, CACHE, pri, RDS } from './shared';

export const course6: Course = {
  id: 'performance',
  title: 'キャッシュと性能',
  description:
    'データベースの負荷を減らして表示を速くする、キャッシュと読み取りの分散を学びます。コース 1 で作った Web アプリを改良していきます。',
  lessons: [
    // ------------------------------------------------------------------
    {
      id: 'performance-1-cache',
      title: 'ElastiCache で DB の負荷を減らす',
      level: 3,
      summary:
        'よく読まれるデータを ElastiCache に置き、DB への問い合わせを減らします。キャッシュにも SG と冗長化を設定します。',
      goals: [
        'キャッシュで DB の負荷が下がる仕組みが分かる',
        'キャッシュにも SG と Multi-AZ が必要なことが分かる',
      ],
      start: { from: 'lesson', lessonId: 'web-5-rds-ha' },
      steps: [
        {
          id: 'cache',
          title: 'ElastiCache を Private サブネットに置いてつなごう',
          instruction:
            'ElastiCache を 2 つ目の AZ の Private サブネットに置き、Auto Scaling からつないでください。',
          introduces: ['elasticache'],
          checkpoints: [
            {
              id: 'private',
              label: 'ElastiCache が Private サブネットにある',
              rule: placedIn(CACHE, 'private'),
            },
            {
              id: 'connect',
              label: 'Auto Scaling から ElastiCache への接続がある',
              rule: connected(ASG, CACHE),
            },
          ],
          hints: ['キャッシュも DB と同じく、外から触らせない場所に置きます'],
          answer: [
            { op: 'add', kind: 'elasticache', in: pri('second'), name: 'キャッシュ' },
            { op: 'connect', from: ASG, to: CACHE },
          ],
          why: 'アプリはまずキャッシュを見て、あればそれを返し、なければ DB から読んでキャッシュに入れます。人気商品のように何度も読まれるデータほど、DB への問い合わせが減ります。メモリから返すので、とても速いのも特徴です。',
        },
        {
          id: 'sg',
          title: 'キャッシュの SG でアプリからだけ許可しよう',
          instruction:
            'ElastiCache に SG を作り、**アプリの SG** からのポート **6379** を許可してください。',
          checkpoints: [
            {
              id: 'sg',
              label: 'キャッシュの SG がアプリの SG からの通信を許可',
              rule: sgAllows(ASG, CACHE, { sgOnly: true }),
            },
          ],
          hints: ['Valkey / Redis のポートは 6379 です'],
          answer: [
            { op: 'createSg', for: CACHE, name: 'cache-sg' },
            { op: 'allow', to: CACHE, from: ASG, port: 6379 },
          ],
          why: 'キャッシュにも DB と同じくらい大事なデータが入ることがあります。DB と同じく、アプリの SG からだけ許可します。',
        },
        {
          id: 'ha',
          title: 'キャッシュも Multi-AZ にしよう',
          instruction:
            'ElastiCache の **Multi-AZ** を有効にし、**レプリカ数** を 1 以上にしてください。',
          checkpoints: [
            {
              id: 'multiaz',
              label: 'Multi-AZ が有効',
              rule: configIs(CACHE, 'multiAz', '==', true),
            },
            {
              id: 'replica',
              label: 'レプリカが 1 つ以上ある',
              rule: configIs(CACHE, 'replicas', '>=', 1),
            },
          ],
          hints: ['Multi-AZ にはレプリカが必要です'],
          answer: [{ op: 'config', target: CACHE, set: { multiAz: true, replicas: 1 } }],
          why: 'キャッシュが止まると、すべての読み取りが一気に DB に押し寄せ、DB まで倒れることがあります。レプリカを別の AZ に置き、自動で切り替わるようにしておきます。',
          badExample:
            'キャッシュ 1 台だけに頼ると、その 1 台の故障で DB に負荷が集中し、サイト全体が遅く（最悪は停止）なります。',
        },
      ],
      quiz: [
        {
          question: 'ElastiCache に保存するデータとして適しているものは？',
          choices: [
            {
              text: '何度も読まれ、消えても DB から作り直せるデータ',
              correct: true,
              explanation: 'キャッシュはメモリ上にあり、消えることを前提に使います。',
            },
            {
              text: '絶対に失ってはいけない注文データ（唯一の保存先として）',
              correct: false,
              explanation: '大事なデータは必ず DB に保存します。',
            },
          ],
        },
        {
          question: 'キャッシュを冗長化しておく理由は？',
          choices: [
            {
              text: 'キャッシュが止まると読み取りが DB に集中し、DB まで倒れることがあるから',
              correct: true,
              explanation: 'キャッシュは DB の盾の役割も果たしています。',
            },
            {
              text: 'キャッシュの容量が 2 倍になるから',
              correct: false,
              explanation: 'レプリカは同じデータのコピーで、容量は増えません。',
            },
          ],
        },
      ],
      wrapUp:
        'キャッシュで DB の負荷を減らせました。次は、データベースそのものを読み取りに強い Aurora に置き換えます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'performance-2-aurora',
      title: 'Aurora リーダーで読み取りを分散する',
      level: 3,
      summary: 'RDS を Aurora に置き換え、リーダーを増やして読み取りを分散します。',
      goals: ['RDS から Aurora に移す利点が分かる', 'リーダーを増やして読み取り性能を上げられる'],
      start: { from: 'lesson', lessonId: 'web-5-rds-ha' },
      steps: [
        {
          id: 'replace',
          title: 'RDS を Aurora に置き換えよう',
          instruction:
            'RDS を削除し、Aurora を 1 つ目の AZ の Private サブネットに置いて、Auto Scaling からつないでください。',
          introduces: ['aurora'],
          checkpoints: [
            { id: 'no-rds', label: 'RDS がない', rule: none(RDS) },
            { id: 'aurora', label: 'Aurora がある', rule: exists(AURORA) },
            {
              id: 'connect',
              label: 'Auto Scaling から Aurora への接続がある',
              rule: connected(ASG, AURORA),
            },
          ],
          hints: ['実際の移行では、データを移してから切り替えます'],
          answer: [
            { op: 'remove', target: RDS },
            { op: 'add', kind: 'aurora', in: pri('first'), name: 'Aurora' },
            { op: 'connect', from: ASG, to: AURORA },
          ],
          why: 'Aurora は MySQL / PostgreSQL と互換性があるので、多くの場合アプリを大きく変えずに移せます。データは 3 つの AZ に自動でコピーされ、リーダーを最大 15 まで増やせます。',
        },
        {
          id: 'readers',
          title: 'リーダーを 2 つに増やそう',
          instruction: 'Aurora の **リーダー数** を **2** にしてください。',
          checkpoints: [
            {
              id: 'readers',
              label: 'リーダーが 2 つ以上ある',
              rule: configIs(AURORA, 'readers', '>=', 2),
            },
          ],
          hints: [
            'アプリは「リーダーエンドポイント」に接続すると、リーダーに自動で振り分けられます',
          ],
          answer: [{ op: 'config', target: AURORA, set: { readers: 2 } }],
          why: 'リーダーは同じストレージを共有するので、コピーの遅れがとても小さく、増やすのも速いのが特徴です。読み取りが増えたらリーダーを増やすことで対応できます。',
        },
        {
          id: 'sg',
          title: 'Aurora の SG でアプリからだけ許可しよう',
          instruction:
            'Aurora に SG を作り、**アプリの SG** からのポート **3306** を許可してください。',
          checkpoints: [
            {
              id: 'sg',
              label: 'Aurora の SG がアプリの SG からの通信を許可',
              rule: sgAllows(ASG, AURORA, { sgOnly: true }),
            },
          ],
          hints: ['新しく置いた Aurora には、まだ SG が付いていません'],
          answer: [
            { op: 'createSg', for: AURORA, name: 'aurora-sg' },
            { op: 'allow', to: AURORA, from: ASG, port: 3306 },
          ],
          why: 'DB を置き換えたら、SG も忘れずに設定します。置き換えの作業では、こうした「前の構成にはあった設定」の付け忘れがよく起こります。',
          badExample:
            'SG を付け忘れると、アプリから DB に接続できず、切り替えた瞬間にサイトがエラーになります。',
        },
      ],
      quiz: [
        {
          question: 'Aurora のリーダーが RDS のリードレプリカより優れている点は？',
          choices: [
            {
              text: 'ストレージを共有するので、コピーの遅れが小さく、追加も速い',
              correct: true,
              explanation: 'データを丸ごとコピーする必要がありません。',
            },
            {
              text: '書き込みもできる',
              correct: false,
              explanation: 'リーダーは読み取り専用です。',
            },
          ],
        },
        {
          question: '読み取りが多いシステムの性能を上げる方法として適切な組み合わせは？',
          choices: [
            {
              text: 'キャッシュ（ElastiCache）とリーダー（またはリードレプリカ）',
              correct: true,
              explanation: 'どちらも読み取りを DB の書き込み役から逃がす方法です。',
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
        'コース 6 は完了です。キャッシュとリーダーで、読み取りに強いデータ層を作れるようになりました。最後のコースでは、ここまでのすべてを組み合わせます。',
    },
  ],
};
