import { describe, expect, it } from 'vitest';
import { monthlyCost, nodeMonthlyCost } from './cost';
import type { ArchDocument, DocNode } from './document';
import { buildModel } from './model';
import { costBelow } from './rules/predicates';

const node = (kind: DocNode['kind'], config: DocNode['config'] = {}, id = kind): DocNode => ({
  id,
  kind,
  name: id,
  config,
  position: { x: 0, y: 0 },
});

describe('月額コストの概算', () => {
  it('枠と無料のサービスは 0', () => {
    expect(nodeMonthlyCost(node('vpc'))).toBe(0);
    expect(nodeMonthlyCost(node('igw'))).toBe(0);
    expect(nodeMonthlyCost(node('client'))).toBe(0);
    expect(nodeMonthlyCost(node('vpce'))).toBe(0);
  });

  it('台数・Multi-AZ・レプリカで増える', () => {
    const single = nodeMonthlyCost(node('rds', { instanceClass: 'db.t3.medium' }));
    expect(nodeMonthlyCost(node('rds', { instanceClass: 'db.t3.medium', multiAz: true }))).toBe(
      single * 2,
    );
    expect(nodeMonthlyCost(node('asg', { instanceType: 't3.small', desired: 4 }))).toBe(
      nodeMonthlyCost(node('ec2', { instanceType: 't3.small' })) * 4,
    );
    expect(nodeMonthlyCost(node('aurora', { readers: 2 }))).toBeGreaterThan(
      nodeMonthlyCost(node('aurora', { readers: 0 })),
    );
  });

  it('未設定の値は既定値で計算する', () => {
    expect(nodeMonthlyCost(node('ec2'))).toBe(
      nodeMonthlyCost(node('ec2', { instanceType: 't3.small' })),
    );
  });

  it('合計と内訳（高い順）を返し、予算判定に使える', () => {
    const doc: ArchDocument = {
      version: 1,
      nodes: [node('alb'), node('natgw'), node('vpc')],
      edges: [],
      securityGroups: [],
    };
    const { total, lines } = monthlyCost(doc);
    expect(total).toBe(70);
    expect(lines.map((l) => l.kind)).toEqual(['natgw', 'alb']);
    expect(costBelow(70)(buildModel(doc)).pass).toBe(true);
    const over = costBelow(50)(buildModel(doc));
    expect(over.pass).toBe(false);
    expect(over.nodeIds).toEqual(['natgw', 'alb']);
  });
});
