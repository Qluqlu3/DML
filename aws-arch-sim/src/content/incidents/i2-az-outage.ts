import { spansAzs } from '../../engine/rules/predicates';
import { structural } from '../../incidents/checks';
import type { Incident } from '../../incidents/types';
import { ALB, ASG, pri, RDS, VPC } from '../courses/shared';
import { APP, dbHighlyAvailable, ENTRANCE, fastEnough, production, recovered } from './shared';

export const i2 = {
  id: 'i2-az-outage',
  title: '1 つの AZ 障害で全停止',
  difficulty: 2,
  summary: 'AWS の 1 つの AZ で障害が起き、サービスが丸ごと止まった。',
  initial: production('i2', [
    ...ENTRANCE,
    {
      op: 'add',
      kind: 'asg',
      in: VPC,
      name: 'アプリ',
      config: { instanceType: 't3.medium', scalingPolicy: 'target-cpu', max: 4 },
    },
    { op: 'attachSubnets', target: ASG, subnets: pri('first') },
    { op: 'add', kind: 'rds', in: pri('first'), name: '会員 DB' },
    { op: 'connect', from: ALB, to: ASG },
    { op: 'connect', from: ASG, to: RDS },
  ]),
  traffic: { rps: 200, readRatio: 0.9, cacheableRatio: 0.5 },
  faults: [{ type: 'az-down', az: 'ap-northeast-1a' }],
  alert: {
    name: 'Site-HealthCheck-Failed',
    condition: '外形監視（トップページ）が 3 回連続で失敗',
  },
  report: `午前 3 時、外形監視のアラームで起こされました。サイトにまったくつながりません。

AWS Health Dashboard には「**ap-northeast-1a のアベイラビリティーゾーンで接続障害が発生しています。復旧時期は未定です**」と出ています。

ALB は 2 つの AZ に置いてあるはずなのに、なぜ全部止まってしまったのでしょうか。AZ の復旧を待たずに、サービスを再開させてください。`,
  resolved: [
    recovered(),
    fastEnough(300),
    {
      id: 'app-az',
      label: 'アプリが 2 つの AZ にまたがっている',
      check: structural(spansAzs(APP, 2)),
    },
    dbHighlyAvailable,
  ],
  rootCause:
    'ALB は 2 AZ にありましたが、**アプリ（Auto Scaling）は 1a の Private サブネットだけ**、**DB は Multi-AZ なし**で 1a にありました。1a が止まると、後ろの層が全部止まります。',
  hints: [
    'ノードを 1 つずつ選んで、止まっている（灰色の）ノードと、その配置場所を確認しましょう',
    'ALB だけ 2 AZ にあっても、後ろの層が 1 AZ だけなら意味がありません',
    'Auto Scaling の配置サブネットに 1c の Private サブネットを追加し、RDS の Multi-AZ を有効にしましょう',
  ],
  explanation: `**高可用性は、一番弱い層で決まります。** ALB が 2 AZ にあっても、アプリや DB が 1 AZ だけなら、その AZ の障害で全体が止まります。

- **アプリ**: Auto Scaling の配置サブネットに別の AZ のサブネットも選ぶと、障害時は残った AZ で台数を保ちます（入れ替えは自動）
- **DB**: RDS の **Multi-AZ** を有効にすると、別の AZ に待機系（スタンバイ）が作られ、障害時は 1〜2 分で自動的に切り替わります。Aurora ならリーダーが昇格します

**注意**: 障害が起きてから Multi-AZ を有効にしても、その瞬間に止まっている DB は救えません（このシミュレーターでは、設定を変えればすぐ反映される前提にしています）。**平常時から複数 AZ にしておく**ことが大切です。

1 AZ に寄せると料金は安く見えますが、Multi-AZ の追加料金は「AZ 障害で数時間止まる損失」と比べて判断しましょう。`,
  fix: [
    { op: 'attachSubnets', target: ASG, subnets: pri('second') },
    { op: 'config', target: RDS, set: { multiAz: true } },
  ],
  wrongFixes: [
    {
      label: 'アプリだけ 2 AZ にする',
      ops: [{ op: 'attachSubnets', target: ASG, subnets: pri('second') }],
    },
  ],
  topics: ['az', 'asg', 'rds', 'alb'],
} satisfies Incident;
