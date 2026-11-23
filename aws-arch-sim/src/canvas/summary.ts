import type { Config, NodeKind } from '../engine/catalog';

export type Badge = { text: string; tone?: 'ok' | 'warn' | 'muted' };

const list = (v: unknown): string[] => (Array.isArray(v) ? v : []);

/** サービスノードに表示する設定の要約 */
export function serviceBadges(kind: NodeKind, c: Config): Badge[] {
  const badges: Badge[] = [];
  const needsSubnets = ['alb', 'nlb', 'asg', 'ecs'].includes(kind);
  if (needsSubnets) {
    const n = list(c.subnetIds).length;
    badges.push(
      n ? { text: `${n} サブネット`, tone: 'muted' } : { text: 'サブネット未設定', tone: 'warn' },
    );
  }
  switch (kind) {
    case 'ec2':
      badges.push({ text: String(c.instanceType), tone: 'muted' });
      break;
    case 'asg':
      badges.push({ text: `${c.min}〜${c.max} 台`, tone: 'muted' });
      break;
    case 'ecs':
      badges.push({ text: `${c.desiredCount} タスク`, tone: 'muted' });
      break;
    case 'lambda':
      if (list(c.subnetIds).length) badges.push({ text: 'VPC', tone: 'muted' });
      break;
    case 'rds':
      if (c.multiAz) badges.push({ text: 'Multi-AZ', tone: 'ok' });
      if (Number(c.readReplicas) > 0) badges.push({ text: `RR×${c.readReplicas}`, tone: 'ok' });
      break;
    case 'aurora':
      badges.push({ text: `リーダー×${c.readers}`, tone: Number(c.readers) > 0 ? 'ok' : 'muted' });
      break;
    case 'elasticache':
      if (c.multiAz) badges.push({ text: 'Multi-AZ', tone: 'ok' });
      break;
    case 's3':
      if (!c.blockPublicAccess) badges.push({ text: '公開', tone: 'warn' });
      break;
    case 'cloudfront':
      if (c.oac) badges.push({ text: 'OAC', tone: 'ok' });
      break;
    case 'sqs':
      if (c.queueType === 'fifo') badges.push({ text: 'FIFO', tone: 'muted' });
      if (c.dlq) badges.push({ text: 'DLQ', tone: 'ok' });
      break;
  }
  if ('securityGroupIds' in c && kind !== 'lambda' && list(c.securityGroupIds).length === 0) {
    badges.push({ text: 'SG なし', tone: 'warn' });
  }
  return badges;
}
