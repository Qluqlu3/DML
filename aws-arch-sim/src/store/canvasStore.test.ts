import { describe, expect, it } from 'vitest';
import type { ArchDocument } from '../engine/document';
import { vpcTemplate } from '../engine/templates';
import { fromDocument, toDocument, useCanvasStore } from './canvasStore';

let seq = 0;
const makeId = (p: string) => `${p}-${++seq}`;

const doc = (): ArchDocument => ({
  version: 1,
  nodes: vpcTemplate({ x: 0, y: 0 }, makeId),
  edges: [],
  securityGroups: [],
});

describe('canvasStore', () => {
  it('ドキュメントとの相互変換で内容が変わらない', () => {
    const d = doc();
    const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
    const round = toDocument(fromDocument(d));
    // 親が先に来るよう並べ替えられるので、順序以外を比べる
    expect([...round.nodes].sort(byId)).toEqual([...d.nodes].sort(byId));
    expect({ ...round, nodes: [] }).toEqual({ ...d, nodes: [] });
  });

  it('配置・接続・undo/redo', () => {
    const s = useCanvasStore.getState();
    s.replaceDocument(doc());
    const before = useCanvasStore.getState().nodes.length;

    // VPC 外にユーザー、Public サブネット内に EC2
    const user = s.addNode('client', { x: -300, y: 100 });
    const ec2 = s.addNode('ec2', { x: 200, y: 340 });
    expect(user).not.toBeNull();
    expect(ec2).not.toBeNull();
    const ec2Node = useCanvasStore.getState().nodes.find((n) => n.id === ec2);
    expect(useCanvasStore.getState().nodes.find((n) => n.id === ec2Node?.parentId)?.data.kind).toBe(
      'subnet',
    );

    // サブネット外への EC2 は拒否
    expect(s.addNode('ec2', { x: 2000, y: 2000 })).toBeNull();
    expect(useCanvasStore.getState().notice?.tone).toBe('error');

    s.connect({
      source: user as string,
      target: ec2 as string,
      sourceHandle: 'r',
      targetHandle: 'l',
    });
    expect(useCanvasStore.getState().edges).toHaveLength(1);
    expect(useCanvasStore.getState().edges[0]?.data?.port).toBe(80);

    s.undo();
    expect(useCanvasStore.getState().edges).toHaveLength(0);
    s.redo();
    expect(useCanvasStore.getState().edges).toHaveLength(1);

    // VPC を消すと中身・接続・SG もまとめて消える
    const vpcId = useCanvasStore.getState().nodes.find((n) => n.data.kind === 'vpc')?.id as string;
    s.addSecurityGroup(vpcId);
    s.removeElements([vpcId], []);
    const after = useCanvasStore.getState();
    expect(after.nodes.map((n) => n.data.kind)).toEqual(['client']);
    expect(after.edges).toHaveLength(0);
    expect(after.securityGroups).toHaveLength(0);
    expect(before).toBe(8);
  });
});
