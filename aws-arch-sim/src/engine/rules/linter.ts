import { defaultPort, SERVICES } from '../catalog';
import type { ArchModel, ModelNode } from '../model';
import { subnetTypeOf } from '../model';
import { cidrContains } from './cidr';

/**
 * ベストプラクティスの Linter（DESIGN.md 5.2）。
 * 正解・不正解ではなく「本番ではまず直したい点」を、理由とともに返す。
 */

export type LintSeverity = 'warning' | 'info';

export type LintIssue = {
  /** 一覧のキー（ルール ID + 対象） */
  id: string;
  rule: string;
  severity: LintSeverity;
  title: string;
  /** なぜ問題か・どう直すか */
  detail: string;
  nodeIds: string[];
};

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const DATA_STORES = new Set(['rds', 'aurora', 'elasticache']);
const VPC_COMPUTE = new Set(['ec2', 'asg', 'ecs']);
const NEEDS_SUBNETS = new Set(['alb', 'nlb', 'asg', 'ecs']);

const isInternet = (cidr: string) => cidrContains(cidr, '0.0.0.0/0');

/** sg のインバウンドに、インターネット全体から port を許可するルールがある */
function openToInternet(m: ArchModel, n: ModelNode, port: number): boolean {
  return strList(n.config.securityGroupIds).some((id) =>
    m.sgById
      .get(id)
      ?.inbound.some(
        (r) => r.port === port && r.source.type === 'cidr' && isInternet(r.source.cidr),
      ),
  );
}

/** 配置サブネットのうち、インターネットに出られないもの */
function subnetsWithoutEgress(m: ArchModel, n: ModelNode): string[] {
  return n.subnetIds.filter((sid) => {
    const route = m.byId.get(sid)?.config.route;
    const target = typeof route === 'string' ? m.byId.get(route) : undefined;
    return target?.kind !== 'igw' && target?.kind !== 'natgw';
  });
}

export function lint(m: ArchModel): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (
    rule: string,
    severity: LintSeverity,
    nodes: ModelNode[],
    title: string,
    detail: string,
  ) => {
    issues.push({
      id: `${rule}:${nodes.map((n) => n.id).join(',')}`,
      rule,
      severity,
      title,
      detail,
      nodeIds: nodes.map((n) => n.id),
    });
  };
  const services = m.nodes.filter((n) => n.kind in SERVICES);

  for (const n of services) {
    const label = `「${n.name}」`;

    // DB・キャッシュが Public サブネットにある
    if (DATA_STORES.has(n.kind) && n.subnetIds.some((s) => subnetTypeOf(m, s) === 'public')) {
      add(
        'data-public',
        'warning',
        [n],
        `${label}が Public サブネットにあります`,
        'DB やキャッシュはインターネットから直接触れない Private サブネットに置きます。アプリからだけ接続できれば十分です。',
      );
    }

    // DB・キャッシュの SG がインターネット全体に開いている
    if (DATA_STORES.has(n.kind)) {
      const ports = new Set([defaultPort(n.kind, n.config), 3306, 5432, 6379]);
      const open = [...ports].filter((p) => openToInternet(m, n, p));
      if (open.length) {
        add(
          'data-open',
          'warning',
          [n],
          `${label}の SG がインターネット全体（0.0.0.0/0）からポート ${open.join(', ')} を許可しています`,
          '送信元はアプリの SG に絞ります。SG 参照で許可すると、台数が増えてもルールを変えずに済みます。',
        );
      }
    }

    // SSH がインターネット全体に開いている
    if (openToInternet(m, n, 22)) {
      add(
        'ssh-open',
        'warning',
        [n],
        `${label}の SG が SSH（22）をインターネット全体に開いています`,
        '総当たり攻撃の標的になります。接続元を社内の IP に絞るか、SSH を使わずに Systems Manager の Session Manager で接続します。',
      );
    }

    // RDS が Multi-AZ でない
    if (n.kind === 'rds' && !n.config.multiAz) {
      add(
        'rds-single-az',
        'warning',
        [n],
        `${label}の Multi-AZ が無効です`,
        'DB のある AZ が止まるとサービス全体が止まります。Multi-AZ を有効にすると、別の AZ の待機系へ自動で切り替わります。',
      );
    }
    if (n.kind === 'aurora' && Number(n.config.readers ?? 1) === 0) {
      add(
        'aurora-no-reader',
        'info',
        [n],
        `${label}にリーダーがありません`,
        'リーダーが 1 つ以上あれば、ライターの障害時に昇格して処理を続けられます。',
      );
    }

    // ロードバランサーが 1 AZ だけ
    if ((n.kind === 'alb' || n.kind === 'nlb') && n.subnetIds.length && n.azIds.length < 2) {
      add(
        'lb-single-az',
        'warning',
        [n],
        `${label}が 1 つの AZ にしかありません`,
        'ロードバランサーは 2 つ以上の AZ のサブネットに置きます（ALB は作成時に 2 AZ 以上が必須です）。',
      );
    }

    // 配置サブネットを選んでいない
    if (NEEDS_SUBNETS.has(n.kind) && !n.subnetIds.length) {
      add(
        'no-subnets',
        'warning',
        [n],
        `${label}の配置サブネットが選ばれていません`,
        'インスペクターで配置サブネットを選ぶまで、どの AZ でも動きません。',
      );
    }

    // NAT Gateway が Private サブネットにある
    if (n.kind === 'natgw' && n.subnetIds.some((s) => subnetTypeOf(m, s) === 'private')) {
      add(
        'nat-private',
        'warning',
        [n],
        `${label}が Private サブネットにあります`,
        'NAT Gateway はインターネットに出られる Public サブネットに置き、Private サブネットのルートをそこへ向けます。',
      );
    }

    // 外部サービスを呼ぶのに、インターネットへの経路がない
    if (n.vpcId && n.kind !== 'natgw') {
      const callsOut = (m.outgoing.get(n.id) ?? []).some(
        (e) => m.byId.get(e.target)?.kind === 'external',
      );
      if (callsOut && subnetsWithoutEgress(m, n).length) {
        add(
          'no-egress',
          'warning',
          [n],
          `${label}から外部サービスへ出る経路がありません`,
          'Private サブネットからインターネットへ出るには、Public サブネットの NAT Gateway へのルートが必要です。',
        );
      }
    }

    // S3 が公開されている
    if (n.kind === 's3' && n.config.blockPublicAccess === false) {
      add(
        's3-public',
        'warning',
        [n],
        `${label}のブロックパブリックアクセスが無効です`,
        '公開したいファイルは CloudFront + OAC で配信し、バケット自体は非公開にします。',
      );
    }

    // CloudFront → S3 で OAC を使っていない
    if (n.kind === 'cloudfront' && !n.config.oac) {
      const toS3 = (m.outgoing.get(n.id) ?? []).some((e) => m.byId.get(e.target)?.kind === 's3');
      if (toS3) {
        add(
          'cf-no-oac',
          'info',
          [n],
          `${label}の OAC が無効です`,
          'OAC を有効にすると、S3 を非公開のまま CloudFront からだけ読めるようにできます。',
        );
      }
    }

    // SQS に DLQ がない
    if (n.kind === 'sqs' && !n.config.dlq) {
      add(
        'sqs-no-dlq',
        'info',
        [n],
        `${label}にデッドレターキューがありません`,
        '処理に失敗し続けるメッセージが再試行され続け、ほかのメッセージの処理を遅らせることがあります。',
      );
    }
  }

  // VPC 内のアプリのサーバーが 1 AZ にしかない（VPC ごと）
  const byVpc = new Map<string, ModelNode[]>();
  for (const n of services) {
    if (!VPC_COMPUTE.has(n.kind) || !n.vpcId || !n.azIds.length) continue;
    byVpc.set(n.vpcId, [...(byVpc.get(n.vpcId) ?? []), n]);
  }
  for (const nodes of byVpc.values()) {
    const azs = new Set(nodes.flatMap((n) => n.azIds));
    if (azs.size === 1) {
      add(
        'compute-single-az',
        'warning',
        nodes,
        'アプリのサーバーが 1 つの AZ にしかありません',
        'その AZ が止まるとサービスが止まります。Auto Scaling や ECS の配置サブネットに、別の AZ のサブネットも選びましょう。',
      );
    }
  }

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'warning' ? -1 : 1));
}
