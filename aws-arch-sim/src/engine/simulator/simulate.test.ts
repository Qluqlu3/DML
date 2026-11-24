import { describe, expect, it } from 'vitest';
import {
  ALB,
  ASG,
  CACHE,
  CF,
  EC2,
  NAT,
  PRI,
  PUB,
  pri,
  pub,
  RDS,
  SQS,
  USER,
  userOnly,
  VPC,
  webBase,
} from '../../content/courses/shared';
import { type AnswerOp, applyAnswer } from '../answers';
import type { ArchDocument } from '../document';
import { buildModel } from '../model';
import { select } from '../rules/selector';
import { simulate } from './simulate';
import type { Fault, TrafficProfile } from './types';

let seq = 0;
const build = (base: ArchDocument, ops: AnswerOp[]) => {
  const { doc, errors } = applyAnswer(base, ops, (p) => `${p}-s${++seq}`);
  expect(errors).toEqual([]);
  return doc;
};

const TRAFFIC: TrafficProfile = { rps: 100, readRatio: 0.9, cacheableRatio: 0.75 };

/** ユーザー → ALB → ASG（2 AZ, t3.small × 2 台固定）→ RDS */
const WEB: AnswerOp[] = [
  { op: 'add', kind: 'alb', in: VPC, name: 'ALB' },
  { op: 'attachSubnets', target: ALB, subnets: PUB },
  {
    op: 'add',
    kind: 'asg',
    in: VPC,
    name: 'アプリ',
    config: { instanceType: 't3.small', desired: 2, scalingPolicy: 'none' },
  },
  { op: 'attachSubnets', target: ASG, subnets: PRI },
  { op: 'add', kind: 'rds', in: pri('first'), name: 'DB' },
  { op: 'connect', from: USER, to: ALB },
  { op: 'connect', from: ALB, to: ASG },
  { op: 'connect', from: ASG, to: RDS },
];

const run = (doc: ArchDocument, traffic = TRAFFIC, faults: Fault[] = []) => {
  const m = buildModel(doc);
  const r = simulate(m, traffic, faults);
  const of = (sel: Parameters<typeof select>[1]) => {
    const n = select(m, sel)[0];
    if (!n) throw new Error('no node');
    const metrics = r.nodes[n.id];
    if (!metrics) throw new Error('no metrics');
    return metrics;
  };
  return { r, of };
};

describe('シミュレーター', () => {
  it('何にもつながっていなければ成功率 0', () => {
    expect(run(userOnly()).r.successRate).toBe(0);
  });

  it('余裕のある構成は成功率 100%、応答時間は経路の合計', () => {
    const { r, of } = run(build(webBase(), WEB));
    expect(r.successRate).toBeCloseTo(1);
    expect(of(ALB).load).toBeCloseTo(100);
    expect(of(ASG).utilization).toBeCloseTo(0.5);
    expect(of(ASG).status).toBe('ok');
    expect(r.latencyMs).toBeGreaterThan(40);
    expect(r.latencyMs).toBeLessThan(200);
  });

  it('処理能力を超えると、超えた分が失敗する', () => {
    const { r, of } = run(build(webBase(), WEB), { ...TRAFFIC, rps: 400 });
    expect(r.successRate).toBeCloseTo(0.5);
    expect(of(ASG).status).toBe('crit');
    expect(of(ASG).logs.some((l) => l.level === 'ERROR')).toBe(true);
  });

  it('スケーリングポリシーがあれば最大台数まで処理できる', () => {
    const doc = build(build(webBase(), WEB), [
      { op: 'config', target: ASG, set: { scalingPolicy: 'target-cpu', max: 4 } },
    ]);
    // 2 台固定だと 300 req/s の 1/3 が失敗するが、最大 4 台まで増えれば処理できる
    expect(run(build(webBase(), WEB), { ...TRAFFIC, rps: 300 }).r.successRate).toBeCloseTo(2 / 3);
    expect(run(doc, { ...TRAFFIC, rps: 300 }).r.successRate).toBeCloseTo(1);
  });

  it('AZ 障害: Multi-AZ でない DB は止まり、Multi-AZ ならフェイルオーバーする', () => {
    const fault: Fault[] = [{ type: 'az-down', az: 'ap-northeast-1a' }];
    const single = run(build(webBase(), WEB), TRAFFIC, fault);
    expect(single.of(RDS).status).toBe('down');
    expect(single.r.successRate).toBe(0);
    expect(single.of(ASG).status).not.toBe('down');

    const multi = build(build(webBase(), WEB), [
      { op: 'config', target: RDS, set: { multiAz: true } },
    ]);
    const after = run(multi, TRAFFIC, fault);
    expect(after.r.successRate).toBeCloseTo(1);
    expect(after.of(RDS).logs[0]?.text).toContain('フェイルオーバー');
  });

  it('AZ 障害: 単一 AZ の EC2 は止まり、ALB は 503 を返す', () => {
    const doc = build(webBase(), [
      { op: 'add', kind: 'alb', in: VPC, name: 'ALB' },
      { op: 'attachSubnets', target: ALB, subnets: PUB },
      { op: 'add', kind: 'ec2', in: pub('first'), name: 'Web' },
      { op: 'connect', from: USER, to: ALB },
      { op: 'connect', from: ALB, to: EC2 },
    ]);
    const { r, of } = run(doc, TRAFFIC, [{ type: 'az-down', az: 'ap-northeast-1a' }]);
    expect(of(EC2).status).toBe('down');
    expect(of(ALB).logs.some((l) => l.text.includes('503'))).toBe(true);
    expect(r.successRate).toBe(0);
  });

  it('SG で許可されていない接続はタイムアウトする', () => {
    const doc = build(build(webBase(), WEB), [{ op: 'createSg', for: RDS, name: 'db-sg' }]);
    const { r, of } = run(doc);
    expect(r.successRate).toBe(0);
    expect(of(ASG).logs.some((l) => l.text.includes('ETIMEDOUT'))).toBe(true);
    expect(of(RDS).load).toBe(0);

    const fixed = build(doc, [
      { op: 'createSg', for: ASG, name: 'app-sg' },
      { op: 'allow', to: RDS, from: ASG, port: 3306 },
    ]);
    // アプリに SG を付けると、今度は ALB からの通信も許可が必要になる
    expect(run(fixed).r.successRate).toBe(0);
    const fixed2 = build(fixed, [
      { op: 'allow', to: ASG, from: { cidr: '10.0.0.0/16' }, port: 80 },
    ]);
    expect(run(fixed2).r.successRate).toBeCloseTo(1);
  });

  it('Private サブネットから外部サービスへは NAT Gateway がないと届かない', () => {
    const doc = build(build(webBase(), WEB), [
      { op: 'add', kind: 'external', name: '決済 API' },
      { op: 'connect', from: ASG, to: { kind: 'external' } },
    ]);
    expect(run(doc).r.successRate).toBe(0);

    const fixed = build(doc, [
      { op: 'add', kind: 'natgw', in: pub('first'), name: 'NAT' },
      { op: 'route', subnets: PRI, to: NAT },
    ]);
    expect(run(fixed).r.successRate).toBeCloseTo(1);
  });

  it('Private サブネットの ALB にはインターネットから届かない', () => {
    const ops = WEB.map((op) =>
      op.op === 'attachSubnets' && op.target === ALB ? { ...op, subnets: PRI } : op,
    );
    expect(run(build(webBase(), ops)).r.successRate).toBe(0);
  });

  it('ElastiCache とリードレプリカは DB の読み取り負荷を減らす', () => {
    const traffic = { ...TRAFFIC, rps: 150 };
    const heavy = build(build(webBase(), WEB), [
      { op: 'config', target: ASG, set: { instanceType: 'm6i.large' } },
      { op: 'config', target: RDS, set: { instanceClass: 'db.t3.micro' } },
    ]);
    const before = run(heavy, traffic).of(RDS).utilization;
    expect(before).toBeGreaterThan(1);

    const cached = build(heavy, [
      { op: 'add', kind: 'elasticache', in: pri('second'), name: 'キャッシュ' },
      { op: 'connect', from: ASG, to: CACHE },
    ]);
    const withCache = run(cached, traffic);
    expect(withCache.of(RDS).utilization).toBeLessThan(before / 2);
    expect(withCache.of(CACHE).load).toBeCloseTo(135);

    const replicas = build(heavy, [{ op: 'config', target: RDS, set: { readReplicas: 2 } }]);
    expect(run(replicas, traffic).of(RDS).utilization).toBeLessThan(before / 2);
  });

  it('CloudFront はキャッシュできる分を自分で返す', () => {
    const doc = build(build(webBase(), WEB), [
      { op: 'add', kind: 'cloudfront', name: 'CDN' },
      { op: 'disconnect', from: USER, to: ALB },
      { op: 'connect', from: USER, to: CF },
      { op: 'connect', from: CF, to: ALB },
    ]);
    const { r, of } = run(doc, { ...TRAFFIC, rps: 400 });
    expect(of(ALB).load).toBeCloseTo(100);
    expect(r.successRate).toBeCloseTo(1);
  });

  it('SQS は処理側の能力を超えた分を溜める（利用者へのエラーにはしない）', () => {
    const doc = build(userOnly(), [
      { op: 'add', kind: 'apigw', name: 'API' },
      { op: 'add', kind: 'sqs', name: 'キュー' },
      { op: 'add', kind: 'lambda', name: 'ワーカー', config: { reservedConcurrency: 5 } },
      { op: 'connect', from: USER, to: { kind: 'apigw' } },
      { op: 'connect', from: { kind: 'apigw' }, to: SQS },
      { op: 'connect', from: SQS, to: { kind: 'lambda' } },
    ]);
    const { r, of } = run(doc, { ...TRAFFIC, rps: 80 });
    expect(r.successRate).toBeCloseTo(1);
    expect(of(SQS).backlog).toBeCloseTo(30);
    expect(r.backlog).toBeCloseTo(30);
  });

  it('依存先の遅延は応答時間に足される', () => {
    const doc = build(webBase(), WEB);
    const base = run(doc).r.latencyMs;
    const slowed = run(doc, TRAFFIC, [{ type: 'dependency-slow', target: RDS, addLatencyMs: 500 }]);
    expect(slowed.r.latencyMs).toBeGreaterThanOrEqual(base + 499);
  });

  it('アクセス急増は負荷を倍にする', () => {
    const { r } = run(build(webBase(), WEB), TRAFFIC, [{ type: 'traffic-spike', multiplier: 3 }]);
    expect(r.rps).toBe(300);
  });
});
