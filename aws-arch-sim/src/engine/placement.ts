import { allowedParent, CONTAINERS, isContainerKind, type NodeKind } from './catalog';

/** 配置計算に必要な最小限のノード情報 */
export type PlacedNode = {
  id: string;
  kind: NodeKind;
  parentId?: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
};

type Point = { x: number; y: number };

export const SERVICE_NODE_SIZE = { width: 112, height: 84 };

export function nodeSize(node: PlacedNode): { width: number; height: number } {
  if (node.width !== undefined && node.height !== undefined) {
    return { width: node.width, height: node.height };
  }
  return isContainerKind(node.kind) ? CONTAINERS[node.kind].defaultSize : SERVICE_NODE_SIZE;
}

export function indexById<T extends PlacedNode>(nodes: T[]): Map<string, T> {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function absolutePosition(id: string, byId: Map<string, PlacedNode>): Point {
  let x = 0;
  let y = 0;
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    x += current.position.x;
    y += current.position.y;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return { x, y };
}

export function depth(id: string, byId: Map<string, PlacedNode>): number {
  let d = 0;
  let current = byId.get(id);
  while (current?.parentId) {
    d++;
    current = byId.get(current.parentId);
    if (d > 100) break;
  }
  return d;
}

export function descendantIds(id: string, nodes: PlacedNode[]): Set<string> {
  const result = new Set<string>();
  let frontier = [id];
  while (frontier.length) {
    const next: string[] = [];
    for (const n of nodes) {
      if (n.parentId && frontier.includes(n.parentId) && !result.has(n.id)) {
        result.add(n.id);
        next.push(n.id);
      }
    }
    frontier = next;
  }
  return result;
}

/** React Flow は親が子より前にある必要があるため、深さ順に並べ替える（同じ深さは元の順を保つ） */
export function sortParentsFirst<T extends PlacedNode>(nodes: T[]): T[] {
  const byId = indexById(nodes);
  return nodes
    .map((n, i) => ({ n, i, d: depth(n.id, byId) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.n);
}

const PARENT_LABEL: Record<string, string> = {
  vpc: 'VPC',
  az: 'Availability Zone',
  subnet: 'サブネット',
};

export type DropResult = { ok: true; parentId: string | null } | { ok: false; reason: string };

/**
 * 絶対座標 point に kind のノードを置くとき、どのコンテナを親にするかを決める。
 * excludeId を渡すと、そのノード自身と子孫は候補から外す（移動時用）。
 */
export function resolveDropParent(
  kind: NodeKind,
  point: Point,
  nodes: PlacedNode[],
  excludeId?: string,
): DropResult {
  const byId = indexById(nodes);
  const excluded = excludeId ? descendantIds(excludeId, nodes) : new Set<string>();
  if (excludeId) excluded.add(excludeId);

  const containing = nodes
    .filter((n) => isContainerKind(n.kind) && !excluded.has(n.id))
    .filter((n) => {
      const p = absolutePosition(n.id, byId);
      const s = nodeSize(n);
      return (
        point.x >= p.x && point.x <= p.x + s.width && point.y >= p.y && point.y <= p.y + s.height
      );
    })
    .sort((a, b) => depth(b.id, byId) - depth(a.id, byId));

  const required = allowedParent(kind);
  if (required === null) {
    if (containing.some((n) => n.kind === 'vpc')) {
      return {
        ok: false,
        reason: isContainerKind(kind)
          ? 'VPC は他の VPC の外に置いてください'
          : 'このサービスは VPC の外に置きます',
      };
    }
    return { ok: true, parentId: null };
  }

  const parent = containing.find((n) => n.kind === required);
  if (!parent) {
    return { ok: false, reason: `${PARENT_LABEL[required]}の中に置いてください` };
  }
  return { ok: true, parentId: parent.id };
}

/** 絶対座標を、親コンテナからの相対座標に変換する */
export function toRelative(point: Point, parentId: string | null, nodes: PlacedNode[]): Point {
  if (!parentId) return point;
  const p = absolutePosition(parentId, indexById(nodes));
  return { x: point.x - p.x, y: point.y - p.y };
}

/** あるノードを含む VPC の ID（自身が VPC ならその ID） */
export function enclosingVpcId(id: string, byId: Map<string, PlacedNode>): string | null {
  let current = byId.get(id);
  while (current) {
    if (current.kind === 'vpc') return current.id;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return null;
}

/** あるノードを含む AZ の ID */
export function enclosingAzId(id: string, byId: Map<string, PlacedNode>): string | null {
  let current = byId.get(id);
  while (current) {
    if (current.kind === 'az') return current.id;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return null;
}
