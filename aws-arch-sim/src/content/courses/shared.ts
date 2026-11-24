import type { ArchDocument, DocNode } from '../../engine/document';
import type { Selector } from '../../engine/rules/selector';
import { vpcTemplate } from '../../engine/templates';

/** コンテンツで共通に使うセレクター */
export const USER: Selector = { kind: 'client' };
export const VPC: Selector = { kind: 'vpc' };
export const IGW: Selector = { kind: 'igw' };
export const ALB: Selector = { kind: 'alb' };
export const EC2: Selector = { kind: 'ec2' };
export const ASG: Selector = { kind: 'asg' };
export const ECS: Selector = { kind: 'ecs' };
export const RDS: Selector = { kind: 'rds' };
export const AURORA: Selector = { kind: 'aurora' };
export const CACHE: Selector = { kind: 'elasticache' };
export const NAT: Selector = { kind: 'natgw' };
export const S3: Selector = { kind: 's3' };
export const R53: Selector = { kind: 'route53' };
export const CF: Selector = { kind: 'cloudfront' };
export const WAF: Selector = { kind: 'waf' };
export const ACM: Selector = { kind: 'acm' };
export const APIGW: Selector = { kind: 'apigw' };
export const LAMBDA: Selector = { kind: 'lambda' };
export const DDB: Selector = { kind: 'dynamodb' };
export const SQS: Selector = { kind: 'sqs' };
export const SNS: Selector = { kind: 'sns' };
export const EB: Selector = { kind: 'eventbridge' };
export const CW: Selector = { kind: 'cloudwatch' };
export const COGNITO: Selector = { kind: 'cognito' };
export const SECRETS: Selector = { kind: 'secrets' };
export const PUB: Selector = { kind: 'subnet', where: { subnetType: 'public' } };
export const PRI: Selector = { kind: 'subnet', where: { subnetType: 'private' } };
export const pub = (az: 'first' | 'second'): Selector => ({
  kind: 'subnet',
  where: { subnetType: 'public', az },
});
export const pri = (az: 'first' | 'second'): Selector => ({
  kind: 'subnet',
  where: { subnetType: 'private', az },
});
export const named = (kind: Selector['kind'], name: string): Selector => ({
  kind,
  where: { name },
});

const user = (x: number, y: number): DocNode => ({
  id: 'client-base',
  kind: 'client',
  name: 'ユーザー',
  config: {},
  position: { x, y },
});

/** ユーザーだけがいる構成 */
export function userOnly(): ArchDocument {
  return { version: 1, nodes: [user(0, 0)], edges: [], securityGroups: [] };
}

/**
 * 2 AZ × Public / Private サブネット・IGW（Public のルートは IGW）を持つ VPC と、ユーザー。
 * コース 1 以降の多くのレッスンの出発点。
 */
export function webBase(): ArchDocument {
  let n = 0;
  return {
    version: 1,
    nodes: [...vpcTemplate({ x: 0, y: 0 }, (p) => `${p}-base-${++n}`), user(-200, 40)],
    edges: [],
    securityGroups: [],
  };
}
