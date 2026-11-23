import type { ServiceKind } from './types';

/** ノードを描く立体シェイプ（canvas/shapes.tsx で描画） */
export type Shape =
  | 'cube'
  | 'stack'
  | 'chip'
  | 'cylinder'
  | 'cylinder-short'
  | 'bucket'
  | 'tube'
  | 'broadcast'
  | 'hexagon'
  | 'gate'
  | 'globe'
  | 'shield'
  | 'card'
  | 'panel'
  | 'safe'
  | 'person'
  | 'cloud';

export const SERVICE_SHAPES: Record<ServiceKind, Shape> = {
  client: 'person',
  external: 'cloud',
  route53: 'globe',
  cloudfront: 'globe',
  waf: 'shield',
  igw: 'gate',
  natgw: 'gate',
  vpce: 'gate',
  alb: 'hexagon',
  nlb: 'hexagon',
  ec2: 'cube',
  asg: 'stack',
  ecs: 'cube',
  lambda: 'chip',
  apigw: 'gate',
  sqs: 'tube',
  sns: 'broadcast',
  eventbridge: 'tube',
  rds: 'cylinder',
  aurora: 'cylinder',
  dynamodb: 'cylinder',
  elasticache: 'cylinder-short',
  s3: 'bucket',
  acm: 'card',
  cognito: 'card',
  secrets: 'safe',
  cloudwatch: 'panel',
};

/**
 * public/icons/aws/ に置く公式アイコン（scripts/import-icons.mjs で取り込む）。
 * service: 色付き背景の付いたサービスアイコン / resource: 背景なしの線画アイコン
 */
export const SERVICE_ICON_STYLE: Record<ServiceKind, 'service' | 'resource'> = {
  client: 'resource',
  external: 'resource',
  route53: 'service',
  cloudfront: 'service',
  waf: 'service',
  igw: 'resource',
  natgw: 'resource',
  vpce: 'resource',
  alb: 'resource',
  nlb: 'resource',
  ec2: 'service',
  asg: 'service',
  ecs: 'service',
  lambda: 'service',
  apigw: 'service',
  sqs: 'service',
  sns: 'service',
  eventbridge: 'service',
  rds: 'service',
  aurora: 'service',
  dynamodb: 'service',
  elasticache: 'service',
  s3: 'service',
  acm: 'service',
  cognito: 'service',
  secrets: 'service',
  cloudwatch: 'service',
};

export const iconUrl = (kind: string) => `${import.meta.env.BASE_URL}icons/aws/${kind}.svg`;
