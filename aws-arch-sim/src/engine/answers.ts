import {
  allowedParent,
  CONTAINERS,
  type Config,
  canConnect,
  defaultConfig,
  defaultPort,
  isContainerKind,
  type NodeKind,
  SERVICES,
} from './catalog';
import type { ArchDocument, DocEdge, DocNode, SgSource } from './document';
import { buildModel, type ModelNode } from './model';
import { absolutePosition, indexById, nodeSize } from './placement';
import { describe, type Selector, select } from './rules/selector';

/** 学習モードの「自動で配置」で適用する操作。対象はセレクターで解決する */
export type AnswerOp =
  | { op: 'add'; kind: NodeKind; in?: Selector; name?: string; config?: Partial<Config> }
  | { op: 'connect'; from: Selector; to: Selector }
  | { op: 'config'; target: Selector; set: Partial<Config> }
  | { op: 'attachSubnets'; target: Selector; subnets: Selector }
  | { op: 'createSg'; for: Selector; name: string }
  | { op: 'allow'; to: Selector; from: Selector | { cidr: string }; port: number };

export type ApplyResult = { doc: ArchDocument; errors: string[] };

type Rect = { x: number; y: number; width: number; height: number };

const GAP = 16;
const HEADER = 36;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + GAP &&
  b.x < a.x + a.width + GAP &&
  a.y < b.y + b.height + GAP &&
  b.y < a.y + a.height + GAP;

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** 親コンテナの中（親がなければキャンバス上の既存ノードの左側）で空いている位置を探す */
function freeSlot(
  doc: ArchDocument,
  kind: NodeKind,
  parentId: string | null,
): { x: number; y: number } {
  const size = nodeSize({ id: '', kind, position: { x: 0, y: 0 } });
  const siblings = doc.nodes
    .filter((n) => (n.parentId ?? null) === parentId)
    .map((n) => ({ ...n.position, ...nodeSize(n) }));
  const free = (r: Rect) => !siblings.some((s) => overlaps(r, s));

  if (parentId) {
    const parent = doc.nodes.find((n) => n.id === parentId);
    const area = parent ? nodeSize(parent) : { width: 400, height: 300 };
    for (let y = HEADER; y + size.height <= area.height - 4; y += 12) {
      for (let x = GAP; x + size.width <= area.width - 4; x += 12) {
        if (free({ x, y, ...size })) return { x, y };
      }
    }
    return { x: GAP, y: HEADER };
  }

  if (!siblings.length) return { x: 0, y: 0 };
  const minX = Math.min(...siblings.map((s) => s.x));
  const minY = Math.min(...siblings.map((s) => s.y));
  if (isContainerKind(kind)) {
    const maxX = Math.max(...siblings.map((s) => s.x + s.width));
    return { x: maxX + 80, y: minY };
  }
  for (let c = 1; c <= 20; c++) {
    for (let r = 0; r < 8; r++) {
      const rect = { x: minX - (size.width + 48) * c, y: minY + (size.height + 24) * r, ...size };
      if (free(rect)) return { x: rect.x, y: rect.y };
    }
  }
  return { x: minX - 400, y: minY };
}

function uniqueName(doc: ArchDocument, kind: NodeKind): string {
  const base = isContainerKind(kind)
    ? CONTAINERS[kind].label
    : SERVICES[kind].short === 'λ'
      ? 'Lambda'
      : SERVICES[kind].short;
  const used = new Set(doc.nodes.map((n) => n.name));
  for (let i = 1; ; i++) {
    if (!used.has(`${base} ${i}`)) return `${base} ${i}`;
  }
}

/** b から見て a がある方向の辺（接続点 ID） */
function facing(doc: ArchDocument, a: DocNode, b: DocNode): string {
  const byId = indexById(doc.nodes);
  const center = (n: DocNode) => {
    const p = absolutePosition(n.id, byId);
    const s = nodeSize(n);
    return { x: p.x + s.width / 2, y: p.y + s.height / 2 };
  };
  const ca = center(a);
  const cb = center(b);
  const dx = ca.x - cb.x;
  const dy = ca.y - cb.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'l' : 'r';
  return dy < 0 ? 't' : 'b';
}

function applyOne(
  doc: ArchDocument,
  op: AnswerOp,
  makeId: (prefix: string) => string,
): { doc: ArchDocument; error?: string } {
  const model = buildModel(doc);
  const pick = (sel: Selector): ModelNode[] => select(model, sel);
  const updateNodes = (ids: Set<string>, fn: (n: DocNode) => DocNode) => ({
    ...doc,
    nodes: doc.nodes.map((n) => (ids.has(n.id) ? fn(n) : n)),
  });

  switch (op.op) {
    case 'add': {
      const required = allowedParent(op.kind);
      let parentId: string | null = null;
      if (op.in) {
        const parent = pick(op.in)[0];
        if (!parent) return { doc, error: `${describe(op.in)} が見つかりません` };
        parentId = parent.id;
        if (parent.kind !== required) {
          return {
            doc,
            error: `${SERVICES[op.kind as keyof typeof SERVICES]?.label ?? op.kind} は ${describe(op.in)} の中に置けません`,
          };
        }
      } else if (required) {
        return { doc, error: `${op.kind} を置く場所（in）が指定されていません` };
      }
      const node: DocNode = {
        id: makeId(op.kind),
        kind: op.kind,
        name: op.name ?? uniqueName(doc, op.kind),
        config: { ...defaultConfig(op.kind), ...(op.config as Config | undefined) },
        position: freeSlot(doc, op.kind, parentId),
      };
      if (parentId) node.parentId = parentId;
      if (isContainerKind(op.kind)) {
        node.width = CONTAINERS[op.kind].defaultSize.width;
        node.height = CONTAINERS[op.kind].defaultSize.height;
      }
      return { doc: { ...doc, nodes: [...doc.nodes, node] } };
    }

    case 'connect': {
      const from = pick(op.from);
      const to = pick(op.to);
      if (!from.length) return { doc, error: `${describe(op.from)} が見つかりません` };
      if (!to.length) return { doc, error: `${describe(op.to)} が見つかりません` };
      const edges: DocEdge[] = [];
      for (const a of from) {
        for (const b of to) {
          if (a.id === b.id || !canConnect(a.kind, b.kind)) continue;
          if (doc.edges.some((e) => e.source === a.id && e.target === b.id)) continue;
          edges.push({
            id: makeId('edge'),
            source: a.id,
            target: b.id,
            sourceHandle: facing(doc, b, a),
            targetHandle: facing(doc, a, b),
            port: defaultPort(b.kind, b.config),
          });
        }
      }
      const possible = from.some((a) =>
        to.some((b) => a.id !== b.id && canConnect(a.kind, b.kind)),
      );
      if (!possible)
        return { doc, error: `${describe(op.from)} から ${describe(op.to)} へは接続できません` };
      return { doc: { ...doc, edges: [...doc.edges, ...edges] } };
    }

    case 'config': {
      const targets = pick(op.target);
      if (!targets.length) return { doc, error: `${describe(op.target)} が見つかりません` };
      return {
        doc: updateNodes(new Set(targets.map((n) => n.id)), (n) => ({
          ...n,
          config: { ...n.config, ...(op.set as Config) },
        })),
      };
    }

    case 'attachSubnets': {
      const targets = pick(op.target);
      if (!targets.length) return { doc, error: `${describe(op.target)} が見つかりません` };
      const subnets = pick(op.subnets).filter((s) => s.kind === 'subnet');
      if (!subnets.length) return { doc, error: `${describe(op.subnets)} が見つかりません` };
      const next = new Map<string, string[]>();
      for (const t of targets) {
        const vpc = t.vpcId ?? subnets[0]?.vpcId;
        const ids = subnets.filter((s) => s.vpcId === vpc).map((s) => s.id);
        next.set(t.id, [...new Set([...strList(t.config.subnetIds), ...ids])]);
      }
      return {
        doc: updateNodes(new Set(next.keys()), (n) => ({
          ...n,
          config: { ...n.config, subnetIds: next.get(n.id) ?? [] },
        })),
      };
    }

    case 'createSg': {
      const targets = pick(op.for);
      const vpcId = targets.find((t) => t.vpcId)?.vpcId;
      if (!targets.length || !vpcId)
        return { doc, error: `${describe(op.for)}（VPC 内）が見つかりません` };
      const sgId = makeId('sg');
      return {
        doc: {
          ...updateNodes(new Set(targets.map((t) => t.id)), (n) => ({
            ...n,
            config: {
              ...n.config,
              securityGroupIds: [...strList(n.config.securityGroupIds), sgId],
            },
          })),
          securityGroups: [...doc.securityGroups, { id: sgId, name: op.name, vpcId, inbound: [] }],
        },
      };
    }

    case 'allow': {
      const targets = pick(op.to);
      if (!targets.length) return { doc, error: `${describe(op.to)} が見つかりません` };
      let source: SgSource;
      if ('cidr' in op.from) {
        source = { type: 'cidr', cidr: op.from.cidr };
      } else {
        const fromSg = pick(op.from).flatMap((n) => strList(n.config.securityGroupIds))[0];
        if (!fromSg) return { doc, error: `${describe(op.from)} に SG がありません` };
        source = { type: 'sg', sgId: fromSg };
      }
      const sgIds = new Set(targets.map((t) => strList(t.config.securityGroupIds)[0]));
      if (sgIds.has(undefined)) return { doc, error: `${describe(op.to)} に SG がありません` };
      const same = (a: SgSource, b: SgSource) =>
        a.type === b.type &&
        (a.type === 'sg' ? a.sgId === (b as typeof a).sgId : a.cidr === (b as typeof a).cidr);
      return {
        doc: {
          ...doc,
          securityGroups: doc.securityGroups.map((g) =>
            !sgIds.has(g.id) || g.inbound.some((r) => r.port === op.port && same(r.source, source))
              ? g
              : { ...g, inbound: [...g.inbound, { id: makeId('rule'), port: op.port, source }] },
          ),
        },
      };
    }
  }
}

/** 操作を順に適用する。失敗した操作は飛ばして理由を errors に積む */
export function applyAnswer(
  doc: ArchDocument,
  ops: AnswerOp[],
  makeId: (prefix: string) => string,
): ApplyResult {
  const errors: string[] = [];
  let current = doc;
  for (const op of ops) {
    const result = applyOne(current, op, makeId);
    current = result.doc;
    if (result.error) errors.push(result.error);
  }
  return { doc: current, errors };
}
