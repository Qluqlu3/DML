import type { Challenge } from '../../challenges/types';
import {
  all,
  any,
  configIs,
  connected,
  not,
  placedIn,
  reachable,
  sgAllows,
  sgHasRule,
  spansAzs,
  withMessage,
} from '../../engine/rules/predicates';
import type { Selector } from '../../engine/rules/selector';
import { ALB, ASG, AURORA, PRI, PUB, pri, RDS, USER, VPC, webBase } from '../courses/shared';

const DB: Selector = { kind: ['rds', 'aurora'] };
/** アプリ層は Auto Scaling でも ECS でもよい */
const APP: Selector = { kind: ['asg', 'ecs'] };

export const c1: Challenge = {
  id: 'c1-web3tier',
  title: '冗長化した Web 3 層',
  difficulty: 2,
  summary: 'AZ が 1 つ止まっても注文を受け続けられる、会員制 Web サービスの基盤を作る。',
  brief: `あなたは会員制のオンライン英会話サービスの基盤担当です。予約が集中する夜の時間帯に、サーバーが 1 台止まっただけでサービスが全停止する事故が起きました。**AZ が 1 つ丸ごと止まっても**動き続ける構成に作り直してください。

VPC（2 つの AZ に Public / Private サブネット、Internet Gateway）は用意してあります。

**要件**

- ユーザーのリクエストはロードバランサーで受け、2 つの AZ に振り分ける
- アプリのサーバーは外から直接触れない場所に置き、2 つの AZ に分ける
- 予約データはリレーショナル DB に保存する。DB も外から触れない場所に置き、障害に備える
- DB にはアプリからしか接続できないようにする

**できれば**

- 各層をセキュリティグループで区切る
- アクセスの増減に合わせてアプリの台数を自動で変える`,
  initial: webBase(),
  rules: [
    {
      id: 'alb-public',
      label: 'ALB が Public サブネットにある',
      severity: 'required',
      rule: placedIn(ALB, 'public'),
    },
    {
      id: 'alb-az',
      label: 'ALB が 2 つの AZ にまたがっている',
      severity: 'required',
      rule: spansAzs(ALB, 2),
    },
    {
      id: 'reach',
      label: 'ユーザーから ALB を通ってアプリに届く',
      severity: 'required',
      rule: reachable(USER, APP, { via: ALB }),
    },
    {
      id: 'app-private',
      label: 'アプリが Private サブネットにある',
      severity: 'required',
      rule: placedIn(APP, 'private'),
    },
    {
      id: 'app-az',
      label: 'アプリが 2 つの AZ にまたがっている',
      severity: 'required',
      rule: spansAzs(APP, 2),
    },
    {
      id: 'db-private',
      label: 'DB（RDS / Aurora）が Private サブネットにある',
      severity: 'required',
      rule: placedIn(DB, 'private'),
    },
    {
      id: 'db-ha',
      label: 'DB が AZ 障害に備えている（RDS の Multi-AZ / Aurora のリーダー）',
      severity: 'required',
      rule: withMessage(
        any(configIs(RDS, 'multiAz', '==', true), configIs(AURORA, 'readers', '>=', 1)),
        'RDS なら Multi-AZ を有効に、Aurora ならリーダーを 1 つ以上にしましょう',
      ),
    },
    {
      id: 'db-connect',
      label: 'アプリから DB への接続がある',
      severity: 'required',
      rule: connected(APP, DB),
    },
    {
      id: 'db-sg',
      label: 'DB の SG がアプリの SG からの通信だけを許可している',
      severity: 'required',
      rule: all(
        sgAllows(APP, DB, { sgOnly: true }),
        not(sgHasRule(DB, 3306, 'internet'), 'DB の SG がインターネット全体に開いています'),
        not(sgHasRule(DB, 5432, 'internet'), 'DB の SG がインターネット全体に開いています'),
      ),
    },
    {
      id: 'alb-sg',
      label: 'ALB の SG がインターネットからの通信を許可している',
      severity: 'recommended',
      rule: sgAllows(USER, ALB),
    },
    {
      id: 'app-sg',
      label: 'アプリの SG が ALB の SG からの通信だけを許可している',
      severity: 'recommended',
      rule: sgAllows(ALB, APP, { sgOnly: true }),
    },
    {
      id: 'scaling',
      label: 'アプリの台数が負荷に応じて自動で変わる',
      severity: 'recommended',
      rule: withMessage(
        any(
          configIs(ASG, 'scalingPolicy', '!=', 'none'),
          configIs({ kind: 'ecs' }, 'autoScaling', '==', true),
        ),
        'Auto Scaling ならスケーリングポリシーを、ECS ならオートスケーリングを設定しましょう',
      ),
    },
  ],
  budgetUsd: 400,
  hints: [
    '入口から順に考えましょう: ユーザー → ALB → アプリ → DB',
    'ALB は Public サブネットを 2 つ、Auto Scaling は Private サブネットを 2 つ、配置サブネットに選びます',
    'RDS はインスペクターで Multi-AZ を有効にできます。DB の SG は「送信元: アプリの SG」で許可します',
  ],
  explanation: `**ポイントは「どの層にも 1 つしかないもの」を作らないこと**です。

- ALB は 2 つの AZ の Public サブネットに置くと、片方の AZ が止まってももう片方で受け付けます
- アプリは Auto Scaling（または ECS）で 2 つの AZ に分けます。1 台が壊れても自動で入れ替わります
- DB は RDS の Multi-AZ（別の AZ に待機系）か、Aurora のリーダーで備えます。DB だけ 1 つの AZ にあると、そこが弱点として残ります

**セキュリティグループは連鎖させる**のが定石です。ALB はインターネットから 443、アプリは ALB の SG から 80、DB はアプリの SG から 3306 だけを許可します。CIDR ではなく SG で許可すると、台数が増えてもルールを書き換える必要がありません。

**別解**: アプリ層を ECS（Fargate）で作っても正解です。DB を Aurora にすると、リーダーが待機系と読み取り分散を兼ねます。`,
  modelAnswer: [
    { op: 'add', kind: 'alb', in: VPC, name: 'ALB' },
    { op: 'attachSubnets', target: ALB, subnets: PUB },
    { op: 'add', kind: 'asg', in: VPC, name: 'アプリ' },
    { op: 'attachSubnets', target: ASG, subnets: PRI },
    { op: 'add', kind: 'rds', in: pri('first'), name: '予約 DB', config: { multiAz: true } },
    { op: 'connect', from: USER, to: ALB },
    { op: 'connect', from: ALB, to: ASG },
    { op: 'connect', from: ASG, to: RDS },
    { op: 'createSg', for: ALB, name: 'alb-sg' },
    { op: 'createSg', for: ASG, name: 'app-sg' },
    { op: 'createSg', for: RDS, name: 'db-sg' },
    { op: 'allow', to: ALB, from: { cidr: '0.0.0.0/0' }, port: 443 },
    { op: 'allow', to: ASG, from: ALB, port: 80 },
    { op: 'allow', to: RDS, from: ASG, port: 3306 },
  ],
  topics: ['alb', 'asg', 'rds', 'aurora', 'sg', 'az'],
};
