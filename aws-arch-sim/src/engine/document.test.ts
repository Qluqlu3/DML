import { describe, expect, it } from 'vitest';
import { type ArchDocument, parseDocument } from './document';

const valid: ArchDocument = {
  version: 1,
  nodes: [
    {
      id: 'v',
      kind: 'vpc',
      name: 'VPC',
      config: { cidr: '10.0.0.0/16' },
      position: { x: 0, y: 0 },
    },
    {
      id: 'a',
      kind: 'alb',
      name: 'ALB',
      config: { subnetIds: [], scheme: 'internal' },
      parentId: 'v',
      position: { x: 10, y: 10 },
    },
    { id: 'u', kind: 'client', name: 'User', config: {}, position: { x: -200, y: 0 } },
  ],
  edges: [{ id: 'e', source: 'u', target: 'a', port: 443 }],
  securityGroups: [
    {
      id: 'sg',
      name: 'alb-sg',
      vpcId: 'v',
      inbound: [{ id: 'r', port: 443, source: { type: 'cidr', cidr: '0.0.0.0/0' } }],
    },
  ],
};

describe('parseDocument', () => {
  it('正しい JSON を受け付ける（JSON を往復しても同じ）', () => {
    const result = parseDocument(JSON.parse(JSON.stringify(valid)));
    expect(result).toEqual({ ok: true, value: valid });
  });

  it.each([
    ['バージョン違い', { ...valid, version: 2 }],
    ['未知の種類', { ...valid, nodes: [{ ...valid.nodes[0], kind: 'mainframe' }] }],
    ['存在しない親', { ...valid, nodes: [{ ...valid.nodes[1], parentId: 'zzz' }] }],
    ['ID 重複', { ...valid, nodes: [valid.nodes[0], valid.nodes[0]] }],
    [
      '存在しないノードへの接続',
      { ...valid, edges: [{ id: 'e', source: 'u', target: 'x', port: 1 }] },
    ],
    [
      'SG ルールの形式不正',
      { ...valid, securityGroups: [{ ...valid.securityGroups[0], inbound: [{ id: 'r' }] }] },
    ],
  ])('%s は拒否する', (_, input) => {
    expect(parseDocument(input).ok).toBe(false);
  });
});
