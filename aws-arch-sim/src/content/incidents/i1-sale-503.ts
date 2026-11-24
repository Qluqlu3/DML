import { all, any, configIs, reachable, spansAzs } from '../../engine/rules/predicates';
import { structural } from '../../incidents/checks';
import type { Incident } from '../../incidents/types';
import { ALB, ASG, CF, EC2, PRI, pri, RDS, USER, VPC } from '../courses/shared';
import { ENTRANCE, fastEnough, production, recovered } from './shared';

const WEB1 = { kind: 'ec2', where: { name: 'Web 1' } } as const;
const WEB2 = { kind: 'ec2', where: { name: 'Web 2' } } as const;

export const i1 = {
  id: 'i1-sale-503',
  title: 'セール開始で 503 多発',
  difficulty: 1,
  summary: 'タイムセール開始と同時にアクセスが 4 倍になり、多くの利用者にエラー画面が出ている。',
  initial: production('i1', [
    ...ENTRANCE,
    {
      op: 'add',
      kind: 'ec2',
      in: pri('first'),
      name: 'Web 1',
      config: { instanceType: 't3.medium' },
    },
    {
      op: 'add',
      kind: 'ec2',
      in: pri('second'),
      name: 'Web 2',
      config: { instanceType: 't3.medium' },
    },
    {
      op: 'add',
      kind: 'rds',
      in: pri('first'),
      name: '商品 DB',
      config: { instanceClass: 'db.r6g.xlarge', multiAz: true },
    },
    { op: 'connect', from: ALB, to: EC2 },
    { op: 'connect', from: EC2, to: RDS },
  ]),
  traffic: { rps: 300, readRatio: 0.9, cacheableRatio: 0.75 },
  faults: [{ type: 'traffic-spike', multiplier: 4 }],
  alert: { name: 'ALB-5XX-Rate-High', condition: 'ALB が返した 5XX の割合 > 1%（5 分間）' },
  report: `20:00 にタイムセールが始まった直後から、問い合わせ窓口に「**Service Unavailable と表示されて買えない**」という連絡が相次いでいます。

マーケティング担当によると、セール中のアクセスは**普段の 4 倍**程度で、この状態は 2 時間続く見込みです。セールの告知ページや商品画像など、**アクセスの多くは誰が見ても同じ内容**です。

構成を調べて原因を突き止め、セール中もエラーが出ないようにしてください。`,
  resolved: [
    recovered(),
    fastEnough(300),
    {
      id: 'elastic',
      label: '負荷の増加に追従できる（Auto Scaling で台数が増える / CloudFront でキャッシュする）',
      check: structural(
        any(
          all(configIs(ASG, 'scalingPolicy', '!=', 'none'), spansAzs(ASG, 2)),
          reachable(USER, ALB, { via: CF }),
        ),
      ),
    },
  ],
  rootCause:
    'Web サーバーが **台数固定の EC2 2 台**で、普段の 4 倍のアクセスを処理しきれず CPU が飽和していました。処理しきれないリクエストに ALB が 503 を返していました。',
  hints: [
    'ノードを選ぶと、メトリクスとログが見られます。CPU が飽和しているのはどこでしょう？',
    'アクセスの増減に合わせて台数を変えられる仕組みがあれば、セールのたびに慌てずに済みます',
    'EC2 を Auto Scaling（スケーリングポリシーあり・2 AZ）に置き換えるか、ALB の前に CloudFront を置いてキャッシュで返しましょう',
  ],
  explanation: `**根本原因は「台数固定」**です。普段は余裕があっても、アクセスが急増すると処理能力を超えます。

**対策 1: Auto Scaling**（模範解答）
EC2 を Auto Scaling グループに置き換え、スケーリングポリシー（CPU のターゲット追跡など）を設定します。負荷が上がると最大台数まで自動で増え、セールが終われば減るので、料金も使った分だけです。

**対策 2: CloudFront**
アクセスの多くが「誰が見ても同じ内容」なら、ALB の前に CloudFront を置いてキャッシュから返すと、サーバーに届くリクエスト自体が減ります。

**やりがちな対策: インスタンスを大きくする**
EC2 を大きなタイプに変えても今回のエラーは止まりますが、普段も高い料金を払い続けることになり、次にもっと大きなセールが来ればまた止まります。この問題では解決扱いにしていません。

実際の運用では、セールのように時刻が分かっている急増には、**スケジュールに合わせて事前に台数を増やす**（スケジュールドスケーリング）のも有効です。`,
  fix: [
    {
      op: 'add',
      kind: 'asg',
      in: VPC,
      name: 'Web',
      config: { instanceType: 't3.medium', scalingPolicy: 'target-cpu', max: 8 },
    },
    { op: 'attachSubnets', target: ASG, subnets: PRI },
    { op: 'connect', from: ALB, to: ASG },
    { op: 'connect', from: ASG, to: RDS },
    { op: 'remove', target: WEB1 },
    { op: 'remove', target: WEB2 },
  ],
  wrongFixes: [
    {
      label: 'EC2 を大きなインスタンスタイプにする',
      ops: [{ op: 'config', target: EC2, set: { instanceType: 'c6i.2xlarge' } }],
    },
  ],
  topics: ['asg', 'cloudfront', 'alb', 'ec2'],
} satisfies Incident;
