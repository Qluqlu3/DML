import { type Config, defaultConfig, type ServiceKind } from '../catalog';

/**
 * 処理能力（リクエスト / 秒）と基本の応答時間の目安。学習用の値で、実際の性能とは一致しない。
 */

/** EC2 1 台あたり */
const EC2: Record<string, number> = {
  't3.micro': 50,
  't3.small': 100,
  't3.medium': 200,
  'm6i.large': 400,
  'm6i.xlarge': 800,
  'c6i.large': 500,
  'c6i.xlarge': 1000,
  'c6i.2xlarge': 2000,
};

/** DB インスタンス 1 台あたり */
const DB: Record<string, number> = {
  'db.t3.micro': 100,
  'db.t3.medium': 300,
  'db.m6g.large': 800,
  'db.r6g.large': 1000,
  'db.r6g.xlarge': 2000,
  'db.r6g.2xlarge': 4000,
};

const CACHE: Record<string, number> = {
  'cache.t3.micro': 5000,
  'cache.t3.medium': 20000,
  'cache.m6g.large': 50000,
  'cache.r6g.large': 60000,
};

/** Fargate の 1 vCPU あたり */
const FARGATE_PER_VCPU = 400;
/** Lambda の同時実行 1 つあたり（1 回 100ms 程度の処理を想定） */
const LAMBDA_PER_CONCURRENCY = 10;
const LAMBDA_ACCOUNT_LIMIT = 1000;

const num = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function withDefaults(kind: ServiceKind, config: Config): Config {
  return { ...defaultConfig(kind), ...config };
}

/** EC2 1 台の処理能力 */
export function ec2Capacity(instanceType: unknown): number {
  return EC2[str(instanceType)] ?? 100;
}

/** DB インスタンス 1 台の処理能力 */
export function dbInstanceCapacity(instanceClass: unknown): number {
  return DB[str(instanceClass)] ?? 300;
}

/** ASG の稼働台数。スケーリングポリシーがあれば最大まで増える */
export function asgInstances(c: Config): number {
  return c.scalingPolicy === 'none' ? num(c.desired) : Math.max(num(c.desired), num(c.max));
}

export function ecsTasks(c: Config): number {
  return c.autoScaling ? Math.max(num(c.desiredCount), num(c.maxCount)) : num(c.desiredCount);
}

/**
 * 障害がないときの処理能力。null は上限なし。
 * RDS / Aurora は 1 台あたり（読み取りの分散はシミュレーター側で扱う）
 */
export function baseCapacity(kind: ServiceKind, config: Config): number | null {
  const c = withDefaults(kind, config);
  switch (kind) {
    case 'ec2':
      return ec2Capacity(c.instanceType);
    case 'asg':
      return ec2Capacity(c.instanceType) * asgInstances(c);
    case 'ecs':
      return Number(c.cpu) * FARGATE_PER_VCPU * ecsTasks(c);
    case 'lambda':
      return (num(c.reservedConcurrency) || LAMBDA_ACCOUNT_LIMIT) * LAMBDA_PER_CONCURRENCY;
    case 'apigw':
      return num(c.throttleRps, 10000);
    case 'rds':
    case 'aurora':
      return dbInstanceCapacity(c.instanceClass);
    case 'elasticache':
      return CACHE[str(c.nodeType)] ?? 20000;
    case 'dynamodb':
      return c.capacityMode === 'provisioned' ? num(c.rcu) + num(c.wcu) : 40000;
    case 's3':
      return 5500;
    default:
      return null;
  }
}

/** 基本の応答時間（ms, p95 相当）。利用率が上がると待ち行列で伸びる */
export const BASE_LATENCY: Record<ServiceKind, number> = {
  client: 0,
  external: 120,
  route53: 0,
  cloudfront: 15,
  waf: 1,
  igw: 0,
  natgw: 2,
  alb: 5,
  nlb: 2,
  ec2: 40,
  asg: 40,
  ecs: 40,
  lambda: 60,
  apigw: 15,
  sqs: 10,
  sns: 10,
  rds: 8,
  aurora: 6,
  dynamodb: 6,
  elasticache: 1,
  s3: 20,
  vpce: 1,
  cloudwatch: 0,
  acm: 0,
  cognito: 0,
  secrets: 0,
  eventbridge: 10,
};

/** 応答がないときに待つ時間（ms） */
export const TIMEOUT_MS = 3000;

/** 振り分け役: 受けたリクエストを、つながっている先に分けて渡す */
export const FORWARDERS = new Set<ServiceKind>([
  'client',
  'external',
  'route53',
  'waf',
  'cloudfront',
  'alb',
  'nlb',
  'apigw',
  'igw',
  'natgw',
  'vpce',
]);
/** 処理役: 1 リクエストごとに、つながっている先（DB など）をすべて呼ぶ */
export const COMPUTE = new Set<ServiceKind>(['ec2', 'asg', 'ecs', 'lambda']);
/** 配信役: 受けたメッセージを、つながっている先すべてに配る（非同期） */
export const FANOUT = new Set<ServiceKind>(['sns', 'eventbridge']);
/** リクエストの流れに乗らない（認証・証明書・監視・秘密情報） */
export const SIDE = new Set<ServiceKind>(['cognito', 'acm', 'cloudwatch', 'secrets']);
export const DATABASES = new Set<ServiceKind>(['rds', 'aurora', 'dynamodb']);
