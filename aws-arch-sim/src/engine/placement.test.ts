import { describe, expect, it } from 'vitest';
import { type PlacedNode, resolveDropParent, sortParentsFirst, toRelative } from './placement';

// VPC(0,0 800x500) > AZ(20,40 360x420) > Subnet(20,40 320x170)
const nodes: PlacedNode[] = [
  { id: 'vpc', kind: 'vpc', position: { x: 0, y: 0 }, width: 800, height: 500 },
  { id: 'az', kind: 'az', parentId: 'vpc', position: { x: 20, y: 40 }, width: 360, height: 420 },
  {
    id: 'sub',
    kind: 'subnet',
    parentId: 'az',
    position: { x: 20, y: 40 },
    width: 320,
    height: 170,
  },
];

describe('resolveDropParent', () => {
  it('subnet 配置のサービスはサブネットの中にだけ置ける', () => {
    expect(resolveDropParent('ec2', { x: 100, y: 120 }, nodes)).toEqual({
      ok: true,
      parentId: 'sub',
    });
    expect(resolveDropParent('ec2', { x: 600, y: 300 }, nodes).ok).toBe(false);
    expect(resolveDropParent('ec2', { x: 1000, y: 1000 }, nodes).ok).toBe(false);
  });

  it('vpc 配置のサービスはサブネットの上に落としても VPC の子になる', () => {
    expect(resolveDropParent('alb', { x: 100, y: 120 }, nodes)).toEqual({
      ok: true,
      parentId: 'vpc',
    });
    expect(resolveDropParent('alb', { x: 1000, y: 1000 }, nodes).ok).toBe(false);
  });

  it('global 配置のサービスは VPC の中に置けない', () => {
    expect(resolveDropParent('s3', { x: 1000, y: 1000 }, nodes)).toEqual({
      ok: true,
      parentId: null,
    });
    expect(resolveDropParent('s3', { x: 100, y: 100 }, nodes).ok).toBe(false);
  });

  it('コンテナの入れ子規則', () => {
    expect(resolveDropParent('az', { x: 600, y: 300 }, nodes)).toEqual({
      ok: true,
      parentId: 'vpc',
    });
    expect(resolveDropParent('subnet', { x: 100, y: 300 }, nodes)).toEqual({
      ok: true,
      parentId: 'az',
    });
    expect(resolveDropParent('subnet', { x: 600, y: 300 }, nodes).ok).toBe(false);
    expect(resolveDropParent('vpc', { x: 100, y: 100 }, nodes).ok).toBe(false);
  });

  it('移動時は自分自身と子孫を親候補から外す', () => {
    // AZ を自分の中に移動しても、自分や子のサブネットは親にならない
    expect(resolveDropParent('az', { x: 100, y: 120 }, nodes, 'az')).toEqual({
      ok: true,
      parentId: 'vpc',
    });
  });
});

describe('座標・並び順', () => {
  it('絶対座標を親からの相対座標に変換する', () => {
    expect(toRelative({ x: 100, y: 120 }, 'sub', nodes)).toEqual({ x: 60, y: 40 });
    expect(toRelative({ x: 5, y: 6 }, null, nodes)).toEqual({ x: 5, y: 6 });
  });

  it('親が子より前に来るよう並べ替える', () => {
    const reversed = [...nodes].reverse();
    expect(sortParentsFirst(reversed).map((n) => n.id)).toEqual(['vpc', 'az', 'sub']);
  });
});
