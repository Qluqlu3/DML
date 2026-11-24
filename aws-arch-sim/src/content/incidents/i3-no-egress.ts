import { placedIn, subnetRoute } from '../../engine/rules/predicates';
import { structural } from '../../incidents/checks';
import type { Incident } from '../../incidents/types';
import { ALB, ASG, IGW, NAT, PRI, pri, pub, RDS, VPC } from '../courses/shared';
import { ENTRANCE, production, recovered } from './shared';

const PAYMENT = { kind: 'external', where: { name: '決済' } } as const;

export const i3 = {
  id: 'i3-no-egress',
  title: '外部決済 API に繋がらない',
  difficulty: 2,
  summary: '新しい決済サービスに切り替えた途端、注文の確定がすべて失敗するようになった。',
  initial: production('i3', [
    ...ENTRANCE,
    {
      op: 'add',
      kind: 'asg',
      in: VPC,
      name: '注文アプリ',
      config: { instanceType: 't3.medium', scalingPolicy: 'target-cpu', max: 4 },
    },
    { op: 'attachSubnets', target: ASG, subnets: PRI },
    { op: 'add', kind: 'rds', in: pri('first'), name: '注文 DB', config: { multiAz: true } },
    { op: 'add', kind: 'external', name: '決済 API（PayNow）' },
    { op: 'connect', from: ALB, to: ASG },
    { op: 'connect', from: ASG, to: RDS },
    { op: 'connect', from: ASG, to: PAYMENT },
  ]),
  traffic: { rps: 100, readRatio: 0.3, cacheableRatio: 0 },
  faults: [],
  alert: { name: 'Order-5XX-Rate-High', condition: '注文 API の 5XX の割合 > 1%（5 分間）' },
  report: `今朝、決済サービスを外部の「PayNow」に切り替えるリリースをしました。それ以降、**注文の確定がすべてエラー**になっています。

開発チームは「ステージング環境（Public サブネットに EC2 を 1 台置いただけの構成）では問題なく決済できた」と言っています。PayNow 側のステータスページは正常です。

本番構成を調べて、注文できるようにしてください。アプリのサーバーは今まで通り外から直接触れない場所に置いておく必要があります。`,
  resolved: [
    recovered(),
    {
      id: 'private',
      label: 'アプリは Private サブネットのまま',
      check: structural(placedIn(ASG, 'private')),
    },
    {
      id: 'nat',
      label: 'Private サブネットのデフォルトルートが NAT Gateway を向いている',
      check: structural(subnetRoute('private', 'nat')),
    },
  ],
  rootCause:
    'アプリは **Private サブネット**にあり、そのルートテーブルには**インターネットへの経路がありませんでした**。外部の決済 API への接続はどこにも出ていけず、タイムアウトしていました。ステージングは Public サブネットだったので問題が出ませんでした。',
  hints: [
    'アプリのログに出ている ETIMEDOUT の宛先は、VPC の中ですか、外ですか？',
    'Private サブネットの枠の右上に、デフォルトルートが表示されています',
    'Public サブネットに NAT Gateway を置き、Private サブネットのデフォルトルートを NAT Gateway に向けましょう',
  ],
  explanation: `Private サブネットのサーバーがインターネット上のサービスを呼ぶには、**NAT Gateway** が必要です。

- NAT Gateway は **Public サブネット**に置き、Private サブネットのルートテーブルで \`0.0.0.0/0 → NAT Gateway\` にします
- 外から Private サブネットへは入れないまま、中から外へだけ出られるようになります
- NAT Gateway は AZ ごとに置くのが本番の定石です（1 つだと、その AZ の障害で全 AZ の外向き通信が止まります）

**やってはいけない対策**
- **アプリを Public サブネットに移す**: 動きますが、サーバーがインターネットから直接狙われる場所に出てしまいます
- **Private サブネットのルートを Internet Gateway に向ける**: そのサブネットは実質 Public サブネットになります（パブリック IP がないと通信もできません）

外に出る先が S3 や DynamoDB などの AWS サービスだけなら、NAT Gateway より安い **VPC エンドポイント**も選択肢です。`,
  fix: [
    { op: 'add', kind: 'natgw', in: pub('first'), name: 'NAT a' },
    { op: 'add', kind: 'natgw', in: pub('second'), name: 'NAT c' },
    { op: 'route', subnets: PRI, to: NAT },
  ],
  wrongFixes: [
    {
      label: 'Private サブネットのルートを Internet Gateway に向ける',
      ops: [{ op: 'route', subnets: PRI, to: IGW }],
    },
  ],
  topics: ['natgw', 'subnet', 'igw', 'external'],
} satisfies Incident;
