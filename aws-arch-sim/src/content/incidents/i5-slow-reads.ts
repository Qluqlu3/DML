import { all, any, configIs, connected, placedIn } from '../../engine/rules/predicates';
import { structural } from '../../incidents/checks';
import type { Incident } from '../../incidents/types';
import { ALB, ASG, AURORA, CACHE, PRI, pri, RDS, VPC } from '../courses/shared';
import { dbHighlyAvailable, ENTRANCE, fastEnough, production, recovered } from './shared';

export const i5 = {
  id: 'i5-slow-reads',
  title: '画面表示が遅い',
  difficulty: 3,
  summary: 'エラーは出ていないが、記事一覧の表示がどんどん遅くなっている。',
  initial: production('i5', [
    ...ENTRANCE,
    {
      op: 'add',
      kind: 'asg',
      in: VPC,
      name: 'アプリ',
      config: { instanceType: 't3.medium', scalingPolicy: 'target-cpu', max: 6 },
    },
    { op: 'attachSubnets', target: ASG, subnets: PRI },
    {
      op: 'add',
      kind: 'rds',
      in: pri('first'),
      name: '記事 DB',
      config: { instanceClass: 'db.t3.medium', multiAz: true },
    },
    { op: 'connect', from: ALB, to: ASG },
    { op: 'connect', from: ASG, to: RDS },
  ]),
  traffic: { rps: 280, readRatio: 0.9, cacheableRatio: 0.75 },
  faults: [],
  alert: {
    name: 'ALB-TargetResponseTime-High',
    condition: 'TargetResponseTime（p95）> 150ms（15 分間）',
  },
  report: `ニュースサイトです。ここ 1 か月で読者が倍になり、**記事一覧の表示が遅い**という声が増えています。エラーは出ていません。

アプリのサーバーは Auto Scaling で増えるようにしてあるので、サーバーは足りているはずだとアプリ担当は言っています。アクセスの **9 割は記事の閲覧**で、人気の記事は何度も読まれます。

表示を速くしてください。DB の障害への備え（Multi-AZ）は外さないでください。`,
  resolved: [
    recovered(),
    fastEnough(150),
    {
      id: 'offload',
      label: '読み取りを DB 本体から逃がしている（キャッシュ / リードレプリカ / Aurora リーダー）',
      check: structural(
        any(
          all(placedIn(CACHE, 'private'), connected(ASG, CACHE)),
          configIs(RDS, 'readReplicas', '>=', 1),
          configIs(AURORA, 'readers', '>=', 1),
        ),
      ),
    },
    dbHighlyAvailable,
  ],
  rootCause:
    '**読み取りのクエリで RDS の CPU が飽和**していました。待ち行列ができて 1 回の問い合わせに時間がかかり、それが画面の表示時間になっていました。アプリのサーバーは余裕があり、増やしても速くなりません。',
  hints: [
    'アプリと DB、それぞれの利用率を見比べてみましょう',
    'DB のログに「ReadIOPS が高い」と出ています。読み取りを DB 本体以外で受ける方法は？',
    'ElastiCache をアプリにつなぐか、RDS のリードレプリカを 1 つ以上にしましょう',
  ],
  explanation: `**遅さの原因は、利用率が一番高い層にあります。** 待ち行列の性質上、利用率が 70% を超えると応答時間は急に伸びます。今回は DB でした。

- **ElastiCache**（模範解答）: よく読まれる記事をメモリに置き、DB に問い合わせずに返します。人気記事が何度も読まれるニュースサイトには特に効きます
- **リードレプリカ**: 読み取りをコピーに振り分けます。アプリ側で読み取り先を分ける必要があります
- **Aurora**: リーダーが読み取り分散と待機系を兼ねます

**やりがちな対策: DB を大きくする**
インスタンスクラスを上げても速くなりますが、料金が大きく上がり、読者がさらに増えればまた遅くなります。この問題では解決扱いにしていません。

**関係ない対策: アプリのサーバーを増やす**
アプリは余裕があるので、台数を増やしても DB への問い合わせは減らず、速くなりません。`,
  fix: [
    { op: 'add', kind: 'elasticache', in: pri('second'), name: '記事キャッシュ' },
    { op: 'connect', from: ASG, to: CACHE },
  ],
  wrongFixes: [
    {
      label: 'DB のインスタンスクラスを上げるだけ',
      ops: [{ op: 'config', target: RDS, set: { instanceClass: 'db.r6g.large' } }],
    },
    {
      label: 'アプリの台数を増やすだけ',
      ops: [{ op: 'config', target: ASG, set: { max: 12, instanceType: 'm6i.large' } }],
    },
  ],
  topics: ['elasticache', 'rds', 'aurora'],
} satisfies Incident;
