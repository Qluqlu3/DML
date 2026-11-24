import type { ArchDocument } from '../../engine/document';
import { not, sgHasRule } from '../../engine/rules/predicates';
import { structural } from '../../incidents/checks';
import type { Incident } from '../../incidents/types';
import { ALB, ASG, PRI, pri, RDS, VPC } from '../courses/shared';
import { ENTRANCE, production, recovered } from './shared';

/**
 * 旧アプリの SG（app-sg）だけを DB が許可している状態で、
 * 新しい SG（app-v2-sg）を付けたアプリに入れ替えた構成
 */
function afterDeploy(): ArchDocument {
  const doc = production('i4', [
    ...ENTRANCE,
    {
      op: 'add',
      kind: 'asg',
      in: VPC,
      name: 'アプリ v2',
      config: { instanceType: 't3.medium', scalingPolicy: 'target-cpu', max: 4 },
    },
    { op: 'attachSubnets', target: ASG, subnets: PRI },
    { op: 'add', kind: 'rds', in: pri('first'), name: '在庫 DB', config: { multiAz: true } },
    { op: 'connect', from: ALB, to: ASG },
    { op: 'connect', from: ASG, to: RDS },
    { op: 'createSg', for: ALB, name: 'alb-sg' },
    { op: 'createSg', for: ASG, name: 'app-sg' },
    { op: 'createSg', for: RDS, name: 'db-sg' },
    { op: 'allow', to: ALB, from: { cidr: '0.0.0.0/0' }, port: 443 },
    { op: 'allow', to: ASG, from: ALB, port: 80 },
    { op: 'allow', to: RDS, from: ASG, port: 3306 },
    { op: 'createSg', for: ASG, name: 'app-v2-sg' },
  ]);
  const oldSg = doc.securityGroups.find((g) => g.name === 'app-sg');
  const newSg = doc.securityGroups.find((g) => g.name === 'app-v2-sg');
  if (!oldSg || !newSg) throw new Error('i4: SG がありません');
  return {
    ...doc,
    // 新しいアプリは app-v2-sg だけを持つ。ALB からの許可は app-v2-sg にも入れてある
    nodes: doc.nodes.map((n) =>
      n.kind === 'asg' ? { ...n, config: { ...n.config, securityGroupIds: [newSg.id] } } : n,
    ),
    securityGroups: doc.securityGroups.map((g) =>
      g.id === newSg.id
        ? { ...g, inbound: oldSg.inbound.map((r) => ({ ...r, id: `${r.id}-v2` })) }
        : g,
    ),
  };
}

export const i4 = {
  id: 'i4-sg-deploy',
  title: 'デプロイ後に DB 接続エラー',
  difficulty: 2,
  summary: 'アプリを新しい構成に入れ替えた直後から、すべての画面がエラーになった。',
  initial: afterDeploy(),
  traffic: { rps: 150, readRatio: 0.8, cacheableRatio: 0.5 },
  faults: [],
  alert: { name: 'App-5XX-Rate-High', condition: 'ALB のターゲットが返した 5XX の割合 > 1%' },
  report: `今日の夕方、アプリを v2 に入れ替えました。インフラ担当が **Auto Scaling グループを作り直し、セキュリティグループも新しく「app-v2-sg」を作って付けた**そうです。

入れ替え直後から、全ページが 500 エラーになっています。アプリのコードは v1 から DB まわりを変えていません。ALB のヘルスチェック（DB を使わない \`/health\`）は正常です。

原因を調べて復旧してください。DB はインターネットから触れない状態を保つ必要があります。`,
  resolved: [
    recovered(),
    {
      id: 'not-open',
      label: 'DB の SG がインターネット全体（0.0.0.0/0）に開いていない',
      check: structural(
        not(sgHasRule(RDS, 3306, 'internet'), 'DB がインターネット全体に開いています'),
      ),
    },
  ],
  rootCause:
    'DB の SG「db-sg」は、**旧アプリの SG「app-sg」からの 3306 だけを許可**していました。新しいアプリは「app-v2-sg」しか持っていないため、DB への接続がすべて SG で破棄され、タイムアウトしていました。',
  hints: [
    'アプリのログの ETIMEDOUT の宛先ポートは何番でしょう？',
    '右のインスペクターの「セキュリティグループ」タブで、DB の SG がどこからの通信を許可しているか見てみましょう',
    'DB の SG に、送信元「app-v2-sg」からのポート 3306 を許可するルールを追加しましょう',
  ],
  explanation: `**SG を参照で許可している場合、送信側の SG を付け替えると許可が外れます。** SG 参照は台数が増えても書き換え不要で便利ですが、「どの SG を許可しているか」を入れ替え手順に含める必要があります。

**対策**: DB の SG に「送信元: app-v2-sg、ポート 3306」を追加します（旧 app-sg のルールは、旧アプリを完全に撤去してから消します）。

**やってはいけない対策**: DB の SG を \`0.0.0.0/0\` に開ける。エラーは止まりますが、Private サブネットにあっても VPC 内の他のサーバーや、将来の設定ミスで外から DB に届く危険が残ります。

**再発防止**
- SG やルールも CloudFormation / Terraform などのコードで管理し、アプリと一緒にレビューする
- ヘルスチェックで DB への接続も確かめる（今回は \`/health\` が DB を見ていなかったので、ALB は正常と判断し続けた）`,
  fix: [{ op: 'allow', to: RDS, from: ASG, port: 3306 }],
  wrongFixes: [
    {
      label: 'DB の SG を 0.0.0.0/0 に開ける',
      ops: [{ op: 'allow', to: RDS, from: { cidr: '0.0.0.0/0' }, port: 3306 }],
    },
  ],
  topics: ['sg', 'rds', 'asg'],
} satisfies Incident;
