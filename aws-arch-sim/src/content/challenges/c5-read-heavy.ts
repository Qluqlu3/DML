import type { Challenge } from '../../challenges/types';
import { applyAnswer } from '../../engine/answers';
import {
  all,
  any,
  configIs,
  connected,
  costBelow,
  placedIn,
  reachable,
  sgAllows,
  withMessage,
} from '../../engine/rules/predicates';
import type { Selector } from '../../engine/rules/selector';
import {
  ALB,
  ASG,
  AURORA,
  CACHE,
  CF,
  PRI,
  PUB,
  pri,
  RDS,
  USER,
  VPC,
  webBase,
} from '../courses/shared';

const DB: Selector = { kind: ['rds', 'aurora'] };
const BUDGET = 700;

/** 動いてはいるが、DB を大きくしすぎて予算を超えている構成 */
function overgrown() {
  let n = 0;
  return applyAnswer(
    webBase(),
    [
      { op: 'add', kind: 'alb', in: VPC, name: 'ALB' },
      { op: 'attachSubnets', target: ALB, subnets: PUB },
      { op: 'add', kind: 'asg', in: VPC, name: 'アプリ', config: { instanceType: 't3.medium' } },
      { op: 'attachSubnets', target: ASG, subnets: PRI },
      {
        op: 'add',
        kind: 'rds',
        in: pri('first'),
        name: 'レシピ DB',
        config: { instanceClass: 'db.r6g.2xlarge', multiAz: true },
      },
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
    (p) => `${p}-c5-${++n}`,
  ).doc;
}

export const c5: Challenge = {
  id: 'c5-read-heavy',
  title: '読み取りが多いサービス',
  difficulty: 3,
  summary: 'DB を大きくしすぎて予算を超えたレシピサイトを、読み取りの分散で予算内に戻す。',
  brief: `人気のレシピ検索サイトです。アクセスの **9 割はレシピの閲覧（読み取り）** で、投稿や更新はわずかです。

去年、表示が遅くなったときに DB のインスタンスを最大の \`db.r6g.2xlarge\` まで大きくして乗り切りました。ところが月額が予算を大きく超えてしまい、経理から「月 **$${BUDGET}** 以内に戻してほしい」と言われています。

計測したところ、同じレシピが何度も読まれており、**読み取りを DB 本体から逃がせば、DB は \`db.r6g.large\` で足りる**ことが分かっています。

**要件**

- 読み取りの負荷を DB 本体から逃がす仕組みを入れる
- DB の障害への備え（Multi-AZ など）は残す
- 月額の概算を $${BUDGET} 以内にする
- 今まで通り、ユーザー → ALB → アプリ → DB の経路で動く

**できれば**

- 新しく足したものにもセキュリティグループで適切な制限をかける
- 画像などの静的なファイルは CDN からも返せるようにする`,
  initial: overgrown(),
  rules: [
    {
      id: 'offload',
      label: '読み取りを DB 本体から逃がしている（キャッシュ / リードレプリカ / Aurora リーダー）',
      severity: 'required',
      rule: withMessage(
        any(
          all(placedIn(CACHE, 'private'), connected(ASG, CACHE)),
          configIs(RDS, 'readReplicas', '>=', 1),
          configIs(AURORA, 'readers', '>=', 1),
        ),
        'Private サブネットの ElastiCache をアプリにつなぐか、RDS のリードレプリカを増やしましょう',
      ),
    },
    {
      id: 'db-ha',
      label: 'DB が AZ 障害に備えている',
      severity: 'required',
      rule: withMessage(
        any(configIs(RDS, 'multiAz', '==', true), configIs(AURORA, 'readers', '>=', 1)),
        'DB の Multi-AZ を無効にしてはいけません',
      ),
    },
    {
      id: 'budget',
      label: `月額の概算が $${BUDGET} 以内`,
      severity: 'required',
      rule: costBelow(BUDGET),
    },
    {
      id: 'path',
      label: 'ユーザー → ALB → アプリ → DB の経路がある',
      severity: 'required',
      rule: all(reachable(USER, ASG, { via: ALB }), connected(ASG, DB)),
    },
    {
      id: 'cache-sg',
      label: '追加したキャッシュの SG がアプリの SG から許可している（キャッシュを使う場合）',
      severity: 'recommended',
      rule: withMessage(
        any(
          sgAllows(ASG, CACHE, { sgOnly: true }),
          configIs(RDS, 'readReplicas', '>=', 1),
          configIs(AURORA, 'readers', '>=', 1),
        ),
        'ElastiCache に SG を付け、アプリの SG からの 6379 を許可しましょう',
      ),
    },
    {
      id: 'cdn',
      label: 'CloudFront を通って ALB に届く',
      severity: 'recommended',
      rule: reachable(USER, ALB, { via: CF }),
    },
  ],
  budgetUsd: BUDGET,
  hints: [
    '問題パネルに月額の概算が出ています。サービスの設定を変えると、すぐに金額が変わります',
    '同じデータが何度も読まれるなら ElastiCache、DB の読み取りを分けるならリードレプリカです',
    'キャッシュを入れたら、RDS のインスタンスクラスを db.r6g.large に下げます。リードレプリカを使う場合は、さらに小さいクラスにしないと予算に収まりません',
  ],
  explanation: `読み取りが多いシステムでは、**DB を大きくする（スケールアップ）前に、読み取りを逃がす**のが定石です。

- **ElastiCache**: よく読まれるデータをメモリに置き、DB に問い合わせずに返します。同じレシピが何度も読まれるこのサイトには特に効きます。キャッシュは DB より安く、応答も速くなります
- **リードレプリカ**: DB のコピーに読み取りを振り分けます。アプリ側で「読み取りはレプリカへ」と書き分ける必要があります。レプリカの分だけ DB の料金がかかる点に注意
- **Aurora** なら、リーダーが待機系と読み取り分散を兼ねます

この問題では、キャッシュを入れて DB を \`db.r6g.large\`（Multi-AZ）に下げると、月額はおよそ $1,945 から $635 になります（CloudFront を足しても $655）。リードレプリカで解く場合は、\`db.m6g.large\` まで下げると予算に収まります。

**やってはいけない節約**: Multi-AZ を切ると安くなりますが、AZ 障害で DB が止まります。可用性の要件を削って予算に合わせるのは最後の手段です。`,
  modelAnswer: [
    { op: 'config', target: RDS, set: { instanceClass: 'db.r6g.large' } },
    { op: 'add', kind: 'elasticache', in: pri('second'), name: 'レシピキャッシュ' },
    { op: 'connect', from: ASG, to: CACHE },
    { op: 'createSg', for: CACHE, name: 'cache-sg' },
    { op: 'allow', to: CACHE, from: ASG, port: 6379 },
    { op: 'add', kind: 'cloudfront', name: 'CDN' },
    { op: 'connect', from: USER, to: CF },
    { op: 'connect', from: CF, to: ALB },
  ],
  topics: ['elasticache', 'rds', 'aurora', 'cloudfront'],
};
