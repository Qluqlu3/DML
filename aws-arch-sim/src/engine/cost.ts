import { type Config, defaultConfig, isContainerKind, type NodeKind } from './catalog';
import type { ArchDocument, DocNode } from './document';

/**
 * 月額コストの概算（USD、東京リージョンのオンデマンド料金をおおまかに丸めた目安）。
 * 学習用の目安で、実際の請求額とは一致しない。データ転送量やリクエスト数による従量課金は、
 * 小規模な利用を想定した定額で近似している。
 */

const EC2: Record<string, number> = {
  't3.micro': 10,
  't3.small': 20,
  't3.medium': 40,
  'm6i.large': 90,
  'm6i.xlarge': 180,
  'c6i.large': 80,
  'c6i.xlarge': 160,
  'c6i.2xlarge': 320,
};

const RDS: Record<string, number> = {
  'db.t3.micro': 20,
  'db.t3.medium': 80,
  'db.m6g.large': 170,
  'db.r6g.large': 230,
  'db.r6g.xlarge': 460,
  'db.r6g.2xlarge': 920,
};

const CACHE: Record<string, number> = {
  'cache.t3.micro': 18,
  'cache.t3.medium': 70,
  'cache.m6g.large': 150,
  'cache.r6g.large': 200,
};

/** Fargate の 1 タスクあたり（vCPU に比例したメモリを含む） */
const FARGATE_PER_VCPU = 45;

/** 構成に依存しない定額の目安 */
const FLAT: Partial<Record<NodeKind, number>> = {
  alb: 25,
  nlb: 25,
  natgw: 45,
  route53: 1,
  cloudfront: 20,
  waf: 10,
  apigw: 10,
  lambda: 5,
  sqs: 1,
  sns: 1,
  s3: 5,
  cloudwatch: 5,
  cognito: 5,
  secrets: 1,
  eventbridge: 1,
};

const num = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function nodeMonthlyCost(node: Pick<DocNode, 'kind' | 'config'>): number {
  if (isContainerKind(node.kind)) return 0;
  const c: Config = { ...defaultConfig(node.kind), ...node.config };
  switch (node.kind) {
    case 'ec2':
      return EC2[str(c.instanceType)] ?? 0;
    case 'asg':
      return (EC2[str(c.instanceType)] ?? 0) * num(c.desired);
    case 'ecs':
      return Math.round(Number(c.cpu) * FARGATE_PER_VCPU * num(c.desiredCount));
    case 'rds':
      return (RDS[str(c.instanceClass)] ?? 0) * ((c.multiAz ? 2 : 1) + num(c.readReplicas));
    case 'aurora':
      return (RDS[str(c.instanceClass)] ?? 0) * (1 + num(c.readers));
    case 'elasticache':
      return (CACHE[str(c.nodeType)] ?? 0) * (1 + num(c.replicas));
    case 'dynamodb':
      return c.capacityMode === 'provisioned'
        ? Math.round(num(c.rcu) * 0.11 + num(c.wcu) * 0.55)
        : 5;
    case 'vpce':
      return c.endpointType === 'interface'
        ? 10 * Math.max(1, (c.subnetIds as string[]).length)
        : 0;
    default:
      return FLAT[node.kind] ?? 0;
  }
}

export type CostLine = { nodeId: string; name: string; kind: NodeKind; usd: number };

export function monthlyCost(doc: ArchDocument): { total: number; lines: CostLine[] } {
  const lines = doc.nodes
    .map((n) => ({ nodeId: n.id, name: n.name, kind: n.kind, usd: nodeMonthlyCost(n) }))
    .filter((l) => l.usd > 0)
    .sort((a, b) => b.usd - a.usd);
  return { total: lines.reduce((s, l) => s + l.usd, 0), lines };
}
