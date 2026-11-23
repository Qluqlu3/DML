import { describe, expect, it } from 'vitest';
import type { SecurityGroup } from './document';
import { routeOptions, type ScopedNode, sanitizeReferences, subnetOptions } from './scope';

const node = (n: Partial<ScopedNode> & Pick<ScopedNode, 'id' | 'kind'>): ScopedNode => ({
  name: n.id,
  config: {},
  position: { x: 0, y: 0 },
  ...n,
});

const base: ScopedNode[] = [
  node({ id: 'vpc1', kind: 'vpc' }),
  node({ id: 'vpc2', kind: 'vpc' }),
  node({ id: 'az1', kind: 'az', parentId: 'vpc1', config: { azName: 'ap-northeast-1a' } }),
  node({ id: 'az2', kind: 'az', parentId: 'vpc2', config: { azName: 'ap-northeast-1c' } }),
  node({
    id: 'pub1',
    kind: 'subnet',
    parentId: 'az1',
    config: { subnetType: 'public', route: 'igw1' },
  }),
  node({
    id: 'pri1',
    kind: 'subnet',
    parentId: 'az1',
    config: { subnetType: 'private', route: 'none' },
  }),
  node({
    id: 'pub2',
    kind: 'subnet',
    parentId: 'az2',
    config: { subnetType: 'public', route: 'none' },
  }),
  node({ id: 'igw1', kind: 'igw', parentId: 'vpc1' }),
];
const sgs: SecurityGroup[] = [
  { id: 'sgA', name: 'a', vpcId: 'vpc1', inbound: [] },
  { id: 'sgB', name: 'b', vpcId: 'vpc2', inbound: [] },
];
const subnetTypeOf = (kind: string) => (kind === 'lambda' ? 'private' : undefined);

describe('subnetOptions / routeOptions', () => {
  it('同じ VPC のサブネットだけを AZ 名付きで返す', () => {
    expect(subnetOptions(base, 'vpc1').map((o) => o.label)).toEqual([
      'pub1 (ap-northeast-1a)',
      'pri1 (ap-northeast-1a)',
    ]);
    expect(subnetOptions(base, null, 'private').map((o) => o.id)).toEqual(['pri1']);
  });

  it('ルートの行き先は同じ VPC の IGW / NAT', () => {
    expect(routeOptions('pub1', base).map((o) => o.value)).toEqual(['none', 'igw1']);
    expect(routeOptions('pub2', base).map((o) => o.value)).toEqual(['none']);
  });
});

describe('sanitizeReferences', () => {
  it('別 VPC のサブネット・SG を外す', () => {
    const alb = node({
      id: 'alb',
      kind: 'alb',
      parentId: 'vpc1',
      config: { subnetIds: ['pub1', 'pub2', 'gone'], securityGroupIds: ['sgA', 'sgB'] },
    });
    const { configs } = sanitizeReferences([...base, alb], sgs, subnetTypeOf);
    expect(configs.get('alb')).toMatchObject({ subnetIds: ['pub1'], securityGroupIds: ['sgA'] });
  });

  it('Lambda は選んだサブネットの VPC と種別で判定する', () => {
    const fn = node({
      id: 'fn',
      kind: 'lambda',
      config: { subnetIds: ['pri1', 'pub1'], securityGroupIds: ['sgA', 'sgB'] },
    });
    const { configs } = sanitizeReferences([...base, fn], sgs, subnetTypeOf);
    expect(configs.get('fn')).toMatchObject({ subnetIds: ['pri1'], securityGroupIds: ['sgA'] });
  });

  it('IGW が消えたらルートを none に戻す', () => {
    const nodes = base.filter((n) => n.id !== 'igw1');
    const { configs } = sanitizeReferences(nodes, sgs, subnetTypeOf);
    expect(configs.get('pub1')?.route).toBe('none');
  });

  it('VPC が消えたら SG を削除し、その SG を参照するルールも外す', () => {
    const withRule: SecurityGroup[] = [
      sgs[0] as SecurityGroup,
      {
        id: 'sgC',
        name: 'c',
        vpcId: 'vpc1',
        inbound: [
          { id: 'r1', port: 3306, source: { type: 'sg', sgId: 'sgB' } },
          { id: 'r2', port: 443, source: { type: 'cidr', cidr: '0.0.0.0/0' } },
        ],
      },
      sgs[1] as SecurityGroup,
    ];
    const nodes = base.filter((n) => n.id !== 'vpc2' && n.parentId !== 'vpc2');
    const result = sanitizeReferences(nodes, withRule, subnetTypeOf);
    expect(result.securityGroups.map((s) => s.id)).toEqual(['sgA', 'sgC']);
    expect(result.securityGroups[1]?.inbound.map((r) => r.id)).toEqual(['r2']);
  });

  it('変更が無ければ何も返さない', () => {
    expect(sanitizeReferences(base, sgs, subnetTypeOf).configs.size).toBe(0);
  });
});
