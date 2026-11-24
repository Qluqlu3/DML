import { describe, expect, it } from 'vitest';
import { type AnswerOp, applyAnswer } from '../answers';
import type { ArchDocument } from '../document';
import { buildModel } from '../model';
import { vpcTemplate } from '../templates';
import { cidrContains } from './cidr';
import {
  all,
  any,
  configIs,
  connected,
  distinctValues,
  exists,
  hasSg,
  noDirect,
  none,
  not,
  placedIn,
  type Rule,
  reachable,
  sgAllows,
  sgHasRule,
  spansAzs,
  subnetRoute,
  withMessage,
} from './predicates';
import { type Selector, select } from './selector';

let seq = 0;
const makeId = (p: string) => `${p}-${++seq}`;

const base = (): ArchDocument => ({
  version: 1,
  nodes: vpcTemplate({ x: 0, y: 0 }, makeId),
  edges: [],
  securityGroups: [],
});

const VPC: Selector = { kind: 'vpc' };
const ALB: Selector = { kind: 'alb' };
const EC2: Selector = { kind: 'ec2' };
const RDS: Selector = { kind: 'rds' };
const USER: Selector = { kind: 'client' };
const PUBLIC: Selector = { kind: 'subnet', where: { subnetType: 'public' } };
const pub = (az: 'first' | 'second'): Selector => ({
  kind: 'subnet',
  where: { subnetType: 'public', az },
});
const pri = (az: 'first' | 'second'): Selector => ({
  kind: 'subnet',
  where: { subnetType: 'private', az },
});

/** 冗長化した Web 3 層構成を組み立てる操作 */
const WEB_3_TIER: AnswerOp[] = [
  { op: 'add', kind: 'client', name: 'ユーザー' },
  { op: 'add', kind: 'alb', in: VPC },
  { op: 'attachSubnets', target: ALB, subnets: PUBLIC },
  { op: 'add', kind: 'ec2', in: pub('first') },
  { op: 'add', kind: 'ec2', in: pub('second') },
  { op: 'add', kind: 'rds', in: pri('first'), config: { multiAz: true } },
  { op: 'connect', from: USER, to: ALB },
  { op: 'connect', from: ALB, to: EC2 },
  { op: 'connect', from: EC2, to: RDS },
  { op: 'createSg', for: ALB, name: 'alb-sg' },
  { op: 'createSg', for: EC2, name: 'web-sg' },
  { op: 'createSg', for: RDS, name: 'db-sg' },
  { op: 'allow', to: ALB, from: { cidr: '0.0.0.0/0' }, port: 443 },
  { op: 'allow', to: EC2, from: ALB, port: 80 },
  { op: 'allow', to: RDS, from: EC2, port: 3306 },
];

const built = () => {
  const result = applyAnswer(base(), WEB_3_TIER, makeId);
  expect(result.errors).toEqual([]);
  return buildModel(result.doc);
};

const check = (rule: Rule, doc: ArchDocument) => rule(buildModel(doc));

describe('applyAnswer', () => {
  it('セレクターで対象を解決して構成を組み立てる', () => {
    const m = built();
    const ec2s = select(m, EC2);
    expect(ec2s).toHaveLength(2);
    expect(new Set(ec2s.flatMap((n) => n.azIds)).size).toBe(2);
    expect(select(m, ALB)[0]?.subnetIds).toHaveLength(2);
    expect(m.edges).toHaveLength(5); // User→ALB, ALB→EC2×2, EC2×2→RDS
    expect(m.edges.find((e) => m.byId.get(e.target)?.kind === 'rds')?.port).toBe(3306);
    expect(m.securityGroups.map((g) => g.name)).toEqual(['alb-sg', 'web-sg', 'db-sg']);
    // 接続点は相手の方向を向く（ALB は EC2 より上にある）
    const albToEc2 = m.edges.find(
      (e) => m.byId.get(e.source)?.kind === 'alb' && m.byId.get(e.target)?.kind === 'ec2',
    );
    expect(albToEc2?.sourceHandle).toBe('b');
    expect(albToEc2?.targetHandle).toBe('t');
  });

  it('同じサブネットに追加したノードは重ならない', () => {
    const { doc } = applyAnswer(
      base(),
      [
        { op: 'add', kind: 'ec2', in: pub('first') },
        { op: 'add', kind: 'ec2', in: pub('first') },
      ],
      makeId,
    );
    const [a, b] = doc.nodes.filter((n) => n.kind === 'ec2');
    expect(a && b && Math.abs(a.position.x - b.position.x) >= 132).toBe(true);
  });

  it('適用できない操作は理由を返して飛ばす', () => {
    const { errors, doc } = applyAnswer(
      base(),
      [
        { op: 'add', kind: 'ec2' },
        { op: 'add', kind: 'ec2', in: VPC },
        { op: 'add', kind: 's3' },
        { op: 'add', kind: 'rds', in: pri('first') },
        { op: 'connect', from: { kind: 's3' }, to: RDS },
        { op: 'allow', to: RDS, from: { cidr: '10.0.0.0/16' }, port: 3306 },
      ],
      makeId,
    );
    expect(errors).toHaveLength(4);
    expect(doc.nodes.filter((n) => n.kind === 's3' || n.kind === 'rds')).toHaveLength(2);
  });
});

describe('述語（組み立て前は不合格・組み立て後は合格）', () => {
  const cases: [string, Rule][] = [
    ['exists', exists(ALB)],
    ['exists n', exists(EC2, 2)],
    ['placedIn private', placedIn(RDS, 'private')],
    ['placedIn public', placedIn(EC2, 'public')],
    ['spansAzs', spansAzs(EC2, 2)],
    ['spansAzs (vpc 配置)', spansAzs(ALB, 2)],
    ['connected', connected(ALB, EC2)],
    ['connected every to', connected(ALB, EC2, { every: 'to' })],
    ['reachable via', reachable(USER, RDS, { via: ALB })],
    ['configIs', configIs(RDS, 'multiAz', '==', true)],
    ['hasSg', hasSg({ kind: ['alb', 'ec2', 'rds'] })],
    ['sgAllows cidr', sgAllows(USER, ALB)],
    ['sgAllows sg 参照', sgAllows(EC2, RDS, { sgOnly: true })],
    ['all', all(exists(ALB), connected(EC2, RDS))],
  ];
  it.each(cases)('%s', (_, rule) => {
    expect(check(rule, base()).pass).toBe(false);
    const after = rule(built());
    expect(after, after.message).toEqual({ pass: true });
  });
});

describe('不合格の理由と対象ノード', () => {
  it('置き場所が違うノードを返す', () => {
    const { doc } = applyAnswer(base(), [{ op: 'add', kind: 'rds', in: pub('first') }], makeId);
    const r = check(placedIn(RDS, 'private'), doc);
    expect(r.pass).toBe(false);
    expect(r.message).toBe('RDS が Private サブネットにありません');
    expect(r.nodeIds).toHaveLength(1);
  });

  it('1 AZ だけなら spansAzs は不合格', () => {
    const { doc } = applyAnswer(
      base(),
      [
        { op: 'add', kind: 'ec2', in: pub('first') },
        { op: 'add', kind: 'ec2', in: pub('first') },
      ],
      makeId,
    );
    expect(check(spansAzs(EC2, 2), doc).message).toContain('現在 1');
  });

  it('SG で許可していないポートは通さない', () => {
    const m = built();
    expect(sgAllows(EC2, RDS, { port: 5432 })(m).pass).toBe(false);
    expect(sgAllows(USER, EC2)(m).pass).toBe(false); // EC2 は ALB からだけ許可
  });

  it('VPC の CIDR を許可するルールは VPC 内からの通信を通し、外からは通さない', () => {
    const { doc } = applyAnswer(
      base(),
      [
        { op: 'add', kind: 'client' },
        { op: 'add', kind: 'ec2', in: pub('first') },
        { op: 'add', kind: 'rds', in: pri('first') },
        { op: 'createSg', for: RDS, name: 'db' },
        { op: 'allow', to: RDS, from: { cidr: '10.0.0.0/16' }, port: 3306 },
      ],
      makeId,
    );
    expect(check(sgAllows(EC2, RDS), doc).pass).toBe(true);
    expect(check(sgAllows(EC2, RDS, { sgOnly: true }), doc).pass).toBe(false);
    expect(check(sgAllows(USER, RDS), doc).pass).toBe(false);
  });

  it('noDirect / none / not / any / withMessage', () => {
    const m = built();
    expect(noDirect(USER, RDS)(m).pass).toBe(true);
    const { doc } = applyAnswer(
      base(),
      [...WEB_3_TIER, { op: 'connect', from: USER, to: { kind: 'ec2' } }],
      makeId,
    );
    expect(check(noDirect(USER, EC2), doc).pass).toBe(false);
    expect(none({ kind: 'natgw' })(m).pass).toBe(true);
    expect(not(exists(ALB), 'ALB は不要です')(m)).toEqual({
      pass: false,
      message: 'ALB は不要です',
      nodeIds: undefined,
    });
    expect(any(exists({ kind: 'elasticache' }), exists(ALB))(m).pass).toBe(true);
    expect(
      any(exists({ kind: 'elasticache' }), exists({ kind: 'cloudfront' }))(m).message,
    ).toContain('いずれか');
    expect(withMessage(exists({ kind: 's3' }), 'S3 を置こう')(m).message).toBe('S3 を置こう');
  });

  it('subnetRoute: 雛形の Public は IGW、Private はルートなし', () => {
    const m = buildModel(base());
    expect(subnetRoute('public', 'igw')(m).pass).toBe(true);
    expect(subnetRoute('private', 'none')(m).pass).toBe(true);
    const r = subnetRoute('private', 'nat')(m);
    expect(r.pass).toBe(false);
    expect(r.nodeIds).toHaveLength(2);
  });
});

describe('追加の述語と操作', () => {
  it('route: サブネットのルートを IGW / 同じ AZ の NAT に向ける', () => {
    const { doc, errors } = applyAnswer(
      base(),
      [
        { op: 'add', kind: 'natgw', in: pub('first'), name: 'nat-a' },
        { op: 'add', kind: 'natgw', in: pub('second'), name: 'nat-c' },
        {
          op: 'route',
          subnets: { kind: 'subnet', where: { subnetType: 'private' } },
          to: { kind: 'natgw' },
        },
      ],
      makeId,
    );
    expect(errors).toEqual([]);
    const m = buildModel(doc);
    expect(subnetRoute('private', 'nat')(m).pass).toBe(true);
    for (const s of select(m, { kind: 'subnet', where: { subnetType: 'private' } })) {
      expect(m.byId.get(String(s.config.route))?.azIds).toEqual(s.azIds);
    }
  });

  it('sgHasRule: インターネット全体からか、限定した送信元からかを区別する', () => {
    const { doc } = applyAnswer(
      base(),
      [
        { op: 'add', kind: 'ec2', in: pub('first') },
        { op: 'createSg', for: EC2, name: 'web' },
        { op: 'allow', to: EC2, from: { cidr: '0.0.0.0/0' }, port: 443 },
        { op: 'allow', to: EC2, from: { cidr: '203.0.113.0/24' }, port: 22 },
      ],
      makeId,
    );
    const m = buildModel(doc);
    expect(sgHasRule(EC2, 443, 'internet')(m).pass).toBe(true);
    expect(sgHasRule(EC2, 22, 'internet')(m).pass).toBe(false);
    expect(sgHasRule(EC2, 22, 'restricted')(m).pass).toBe(true);
    expect(sgHasRule(EC2, 3306)(m).pass).toBe(false);
  });

  it('remove / disconnect', () => {
    const { doc, errors } = applyAnswer(
      built().doc,
      [
        { op: 'disconnect', from: ALB, to: { kind: 'ec2', where: { az: 'first' } } },
        { op: 'remove', target: RDS },
        { op: 'disconnect', from: USER, to: RDS },
      ],
      makeId,
    );
    expect(errors).toHaveLength(1); // 存在しない接続の削除
    const m = buildModel(doc);
    expect(select(m, RDS)).toHaveLength(0);
    expect(m.edges.filter((e) => m.byId.get(e.target)?.kind === 'rds')).toHaveLength(0);
    expect(connected(ALB, EC2, { every: 'to' })(m).pass).toBe(false);
    expect(connected(ALB, EC2)(m).pass).toBe(true);
  });

  it('distinctValues: 異なる値の数', () => {
    const m = buildModel(base());
    expect(distinctValues({ kind: 'az' }, 'azName', 2)(m).pass).toBe(true);
    expect(distinctValues({ kind: 'az' }, 'azName', 3, 'AZ 名')(m).message).toBe(
      'Availability Zone のAZ 名が 3 種類必要です（現在 2）',
    );
  });
});

describe('セレクター', () => {
  it('AZ の順番・名前・設定で絞り込める', () => {
    const m = built();
    expect(select(m, { kind: 'ec2', where: { az: 'first' } })).toHaveLength(1);
    expect(select(m, { kind: 'ec2', where: { az: 'ap-northeast-1c' } })).toHaveLength(1);
    expect(select(m, { kind: 'rds', where: { config: { multiAz: true } } })).toHaveLength(1);
    expect(select(m, { kind: 'subnet', where: { name: 'Private' } })).toHaveLength(2);
    expect(select(m, { kind: 'alb', where: { subnetType: 'private' } })).toHaveLength(0);
  });
});

describe('cidrContains', () => {
  it.each([
    ['0.0.0.0/0', '10.0.1.0/24', true],
    ['10.0.0.0/16', '10.0.1.0/24', true],
    ['10.0.1.0/24', '10.0.0.0/16', false],
    ['10.0.2.0/24', '10.0.1.0/24', false],
    ['10.0.0.0/16', '0.0.0.0/0', false],
    ['bad', '10.0.1.0/24', false],
  ])('%s ⊇ %s = %s', (outer, inner, expected) => {
    expect(cidrContains(outer, inner)).toBe(expected);
  });
});
