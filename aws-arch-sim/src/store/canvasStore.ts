import type { Connection, Edge, EdgeChangeset, Node, NodeChangeset } from '@xyflow/react';
import { create } from 'zustand';
import {
  CONTAINERS,
  type Config,
  configFields,
  defaultConfig,
  isContainerKind,
  type NodeKind,
  SERVICES,
} from '../engine/catalog';
import {
  type ArchDocument,
  DOCUMENT_VERSION,
  type DocNode,
  type SecurityGroup,
  type SgRule,
} from '../engine/document';
import {
  absolutePosition,
  descendantIds,
  enclosingVpcId,
  indexById,
  nodeSize,
  resolveDropParent,
  sortParentsFirst,
  toRelative,
} from '../engine/placement';
import { type ScopedNode, sanitizeReferences } from '../engine/scope';
import { newId } from './id';

export type NodeData = { kind: NodeKind; name: string; config: Config };
export type AppNode = Node<NodeData, 'service' | 'container'>;
export type EdgeData = { port: number };
export type AppEdge = Edge<EdgeData, 'traffic'>;

type Snapshot = { nodes: AppNode[]; edges: AppEdge[]; securityGroups: SecurityGroup[] };

export type Notice = { id: number; text: string; tone: 'error' | 'info' };

type DragOrigin = { position: { x: number; y: number }; parentId?: string };

type State = Snapshot & {
  past: Snapshot[];
  future: Snapshot[];
  notice: Notice | null;
  /** ドラッグ開始時の位置（不正な場所に落としたときに戻すため） */
  dragOrigins: Record<string, DragOrigin>;
  /** 直前の履歴記録のキー（連続する同じ編集を 1 つにまとめるため） */
  lastCheckpoint: { key: string; at: number } | null;
};

type Actions = {
  onNodesChange: (changes: NodeChangeset<AppNode>) => void;
  onEdgesChange: (changes: EdgeChangeset<AppEdge>) => void;
  addNode: (kind: NodeKind, center: { x: number; y: number }) => string | null;
  connect: (connection: Connection) => void;
  dragStart: (nodes: AppNode[]) => void;
  dragStop: (nodes: AppNode[]) => void;
  resizeStart: () => void;
  updateNode: (id: string, patch: { name?: string; config?: Partial<Config> }) => void;
  updateEdgePort: (id: string, port: number) => void;
  removeElements: (nodeIds: string[], edgeIds: string[]) => void;
  addSecurityGroup: (vpcId: string, name?: string) => string;
  updateSecurityGroup: (id: string, patch: Partial<Omit<SecurityGroup, 'id' | 'inbound'>>) => void;
  removeSecurityGroup: (id: string) => void;
  addSgRule: (sgId: string, rule: Omit<SgRule, 'id'>) => void;
  updateSgRule: (sgId: string, ruleId: string, patch: Partial<Omit<SgRule, 'id'>>) => void;
  removeSgRule: (sgId: string, ruleId: string) => void;
  undo: () => void;
  redo: () => void;
  loadDocument: (doc: ArchDocument) => void;
  /** 雛形などのノードを今の構成に追加する */
  insertNodes: (docNodes: DocNode[]) => void;
  notify: (text: string, tone?: Notice['tone']) => void;
  dismissNotice: () => void;
};

export type CanvasStore = State & Actions;

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1000;

// ---- 変換 ----

export const toPlaced = (n: AppNode): ScopedNode => ({
  id: n.id,
  kind: n.data.kind,
  name: n.data.name,
  config: n.data.config,
  parentId: n.parentId,
  position: n.position,
  width: n.width,
  height: n.height,
});

export function toDocument(s: Snapshot): ArchDocument {
  return {
    version: DOCUMENT_VERSION,
    nodes: s.nodes.map((n): DocNode => {
      const doc: DocNode = {
        id: n.id,
        kind: n.data.kind,
        name: n.data.name,
        config: n.data.config,
        position: n.position,
      };
      if (n.parentId) doc.parentId = n.parentId;
      if (n.width !== undefined) doc.width = n.width;
      if (n.height !== undefined) doc.height = n.height;
      return doc;
    }),
    edges: s.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      port: e.data?.port ?? 443,
    })),
    securityGroups: s.securityGroups,
  };
}

function fromDocNode(d: DocNode): AppNode {
  const container = isContainerKind(d.kind);
  const size = container ? CONTAINERS[d.kind as keyof typeof CONTAINERS].defaultSize : undefined;
  return {
    id: d.id,
    type: container ? 'container' : 'service',
    position: d.position,
    parentId: d.parentId,
    width: d.width ?? size?.width,
    height: d.height ?? size?.height,
    data: { kind: d.kind, name: d.name, config: d.config },
  };
}

export function fromDocument(doc: ArchDocument): Snapshot {
  return {
    nodes: sortParentsFirst(doc.nodes.map(fromDocNode)),
    edges: doc.edges.map((e) => makeEdge(e.id, e.source, e.target, e.port, e)),
    securityGroups: doc.securityGroups,
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  port: number,
  handles: { sourceHandle?: string | null; targetHandle?: string | null } = {},
): AppEdge {
  return {
    id,
    source,
    target,
    sourceHandle: handles.sourceHandle ?? undefined,
    targetHandle: handles.targetHandle ?? undefined,
    type: 'traffic',
    data: { port },
  };
}

// ---- ヘルパー ----

const subnetTypeOf = (kind: NodeKind) => {
  const field = configFields(kind).find((f) => f.type === 'subnets');
  return field?.type === 'subnets' ? field.subnetType : undefined;
};

/** 構造変更後に、無効な参照と孤立した接続を取り除く */
function normalize(s: Snapshot): Snapshot {
  const { configs, securityGroups } = sanitizeReferences(
    s.nodes.map(toPlaced),
    s.securityGroups,
    subnetTypeOf,
  );
  const nodes = configs.size
    ? s.nodes.map((n) => {
        const config = configs.get(n.id);
        return config ? { ...n, data: { ...n.data, config } } : n;
      })
    : s.nodes;
  const ids = new Set(nodes.map((n) => n.id));
  const edges = s.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return { nodes, edges, securityGroups };
}

function snapshotOf(s: Snapshot): Snapshot {
  return { nodes: s.nodes, edges: s.edges, securityGroups: s.securityGroups };
}

function defaultPortFor(target: AppNode | undefined): number {
  if (!target || isContainerKind(target.data.kind)) return 443;
  if (target.data.kind === 'rds' || target.data.kind === 'aurora') {
    return String(target.data.config.engine).includes('postg') ? 5432 : 3306;
  }
  if (target.data.kind === 'elasticache' && target.data.config.engine === 'memcached') {
    return 11211;
  }
  if (target.data.kind === 'alb' && target.data.config.listener === 'http') return 80;
  return SERVICES[target.data.kind].defaultPort;
}

function nextName(kind: NodeKind, nodes: AppNode[], config: Config): string {
  const base =
    kind === 'subnet'
      ? config.subnetType === 'private'
        ? 'Private Subnet'
        : 'Public Subnet'
      : isContainerKind(kind)
        ? CONTAINERS[kind].label
        : SERVICES[kind].short === 'λ'
          ? 'Lambda'
          : SERVICES[kind].short;
  const used = new Set(nodes.map((n) => n.data.name));
  for (let i = 1; ; i++) {
    const name = `${base} ${i}`;
    if (!used.has(name)) return name;
  }
}

/** 置く場所に合わせた既定値（AZ 名・CIDR・サブネット種別）を決める */
function contextualConfig(
  kind: NodeKind,
  parentId: string | null,
  nodes: AppNode[],
  center: { x: number; y: number },
): Config {
  const config = defaultConfig(kind);
  const byId = indexById(nodes.map(toPlaced));
  if (kind === 'az' && parentId) {
    const used = new Set(
      nodes
        .filter((n) => n.parentId === parentId && n.data.kind === 'az')
        .map((n) => n.data.config.azName),
    );
    const field = CONTAINERS.az.config[0];
    const free =
      field?.type === 'select' ? field.options.find((o) => !used.has(o.value)) : undefined;
    if (free) config.azName = free.value;
  }
  if (kind === 'subnet' && parentId) {
    const vpcId = enclosingVpcId(parentId, byId);
    const count = nodes.filter(
      (n) => n.data.kind === 'subnet' && enclosingVpcId(n.id, byId) === vpcId,
    ).length;
    config.cidr = `10.0.${count + 1}.0/24`;
    // AZ の上半分なら public、下半分なら private
    const az = nodes.find((n) => n.id === parentId);
    if (az) {
      const p = absolutePosition(az.id, byId);
      const s = nodeSize(toPlaced(az));
      config.subnetType = center.y > p.y + s.height / 2 ? 'private' : 'public';
    }
  }
  return config;
}

// ---- ストア ----

let noticeSeq = 0;

export const useCanvasStore = create<CanvasStore>()((set, get) => {
  /** 変更の直前に呼び、現在の状態を undo 履歴に積む。同じ key が続く間は 1 つにまとめる */
  const checkpoint = (key?: string) => {
    const s = get();
    const now = Date.now();
    if (key && s.lastCheckpoint?.key === key && now - s.lastCheckpoint.at < COALESCE_MS) {
      set({ lastCheckpoint: { key, at: now } });
      return;
    }
    set({
      past: [...s.past, snapshotOf(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastCheckpoint: key ? { key, at: now } : null,
    });
  };

  const commit = (next: Snapshot, opts: { normalize?: boolean } = {}) => {
    set(opts.normalize ? normalize(next) : next);
  };

  return {
    nodes: [],
    edges: [],
    securityGroups: [],
    past: [],
    future: [],
    notice: null,
    dragOrigins: {},
    lastCheckpoint: null,

    // 削除はキャンバス側のキー操作から removeElements で行う（deleteKeyCode を無効化している）ため、
    // ここに届くのは選択・位置・サイズの変更だけ
    onNodesChange: (changes) => set({ nodes: changes.applyTo(get().nodes) }),
    onEdgesChange: (changes) => set({ edges: changes.applyTo(get().edges) }),

    addNode: (kind, center) => {
      const s = get();
      const placed = s.nodes.map(toPlaced);
      const drop = resolveDropParent(kind, center, placed);
      if (!drop.ok) {
        get().notify(drop.reason, 'error');
        return null;
      }
      const container = isContainerKind(kind);
      const size = container
        ? CONTAINERS[kind].defaultSize
        : nodeSize({ id: '', kind, position: center });
      const topLeft = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
      const config = contextualConfig(kind, drop.parentId, s.nodes, center);
      const node: AppNode = {
        id: newId(kind),
        type: container ? 'container' : 'service',
        position: toRelative(topLeft, drop.parentId, placed),
        parentId: drop.parentId ?? undefined,
        width: container ? size.width : undefined,
        height: container ? size.height : undefined,
        data: { kind, name: nextName(kind, s.nodes, config), config },
        selected: true,
      };
      checkpoint();
      commit({
        ...snapshotOf(s),
        nodes: sortParentsFirst([...s.nodes.map((n) => ({ ...n, selected: false })), node]),
        edges: s.edges.map((e) => ({ ...e, selected: false })),
      });
      return node.id;
    },

    connect: (connection) => {
      const s = get();
      const source = s.nodes.find((n) => n.id === connection.source);
      const target = s.nodes.find((n) => n.id === connection.target);
      if (!source || !target || source.id === target.id) return;
      if (s.edges.some((e) => e.source === source.id && e.target === target.id)) {
        get().notify('同じ向きの接続はすでにあります', 'info');
        return;
      }
      checkpoint();
      const edge = makeEdge(
        newId('edge'),
        source.id,
        target.id,
        defaultPortFor(target),
        connection,
      );
      set({ edges: [...s.edges, edge] });
    },

    dragStart: (nodes) => {
      checkpoint();
      const origins: Record<string, DragOrigin> = {};
      for (const n of nodes) origins[n.id] = { position: n.position, parentId: n.parentId };
      set({ dragOrigins: origins });
    },

    dragStop: (dragged) => {
      const s = get();
      const draggedIds = new Set(dragged.map((n) => n.id));
      let nodes = s.nodes;
      const errors: string[] = [];

      for (const d of dragged) {
        // 親ごと動かしている子は、親に任せる
        if (d.parentId && draggedIds.has(d.parentId)) continue;
        const placed = nodes.map(toPlaced);
        const byId = indexById(placed);
        const current = byId.get(d.id);
        if (!current) continue;
        const topLeft = absolutePosition(d.id, byId);
        const size = nodeSize(current);
        const center = { x: topLeft.x + size.width / 2, y: topLeft.y + size.height / 2 };
        const drop = resolveDropParent(current.kind, center, placed, d.id);

        if (!drop.ok) {
          errors.push(drop.reason);
          const origin = s.dragOrigins[d.id];
          if (origin) {
            nodes = nodes.map((n) =>
              n.id === d.id ? { ...n, position: origin.position, parentId: origin.parentId } : n,
            );
          }
          continue;
        }
        if ((drop.parentId ?? undefined) === current.parentId) continue;
        const position = toRelative(topLeft, drop.parentId, placed);
        nodes = nodes.map((n) =>
          n.id === d.id ? { ...n, position, parentId: drop.parentId ?? undefined } : n,
        );
      }

      if (errors[0]) get().notify(errors[0], 'error');
      commit({ ...snapshotOf(s), nodes: sortParentsFirst(nodes) }, { normalize: true });

      // 結果的に何も動いていなければ、dragStart で積んだ履歴を取り消す
      const after = indexById(get().nodes);
      const unchanged = Object.entries(s.dragOrigins).every(([id, o]) => {
        const n = after.get(id);
        return (
          n &&
          n.parentId === o.parentId &&
          n.position.x === o.position.x &&
          n.position.y === o.position.y
        );
      });
      set({ dragOrigins: {}, ...(unchanged ? { past: get().past.slice(0, -1) } : {}) });
    },

    resizeStart: () => checkpoint(),

    updateNode: (id, patch) => {
      const s = get();
      checkpoint(
        `node:${id}:${Object.keys(patch.config ?? {}).join(',')}:${patch.name !== undefined}`,
      );
      const nodes = s.nodes.map((n): AppNode => {
        if (n.id !== id) return n;
        const config = patch.config
          ? ({ ...n.data.config, ...patch.config } as Config)
          : n.data.config;
        return { ...n, data: { ...n.data, name: patch.name ?? n.data.name, config } };
      });
      // サブネット種別の変更などで他ノードの参照が無効になり得るので正規化する
      commit({ ...snapshotOf(s), nodes }, { normalize: true });
    },

    updateEdgePort: (id, port) => {
      const s = get();
      checkpoint(`edge:${id}`);
      set({
        edges: s.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, port } } : e)),
      });
    },

    removeElements: (nodeIds, edgeIds) => {
      const s = get();
      if (!nodeIds.length && !edgeIds.length) return;
      checkpoint();
      const removed = new Set(nodeIds);
      const placed = s.nodes.map(toPlaced);
      for (const id of nodeIds) for (const d of descendantIds(id, placed)) removed.add(d);
      const edgeRemoved = new Set(edgeIds);
      commit(
        {
          nodes: s.nodes.filter((n) => !removed.has(n.id)),
          edges: s.edges.filter(
            (e) => !edgeRemoved.has(e.id) && !removed.has(e.source) && !removed.has(e.target),
          ),
          securityGroups: s.securityGroups,
        },
        { normalize: true },
      );
    },

    addSecurityGroup: (vpcId, name) => {
      const s = get();
      checkpoint();
      const id = newId('sg');
      const count = s.securityGroups.filter((g) => g.vpcId === vpcId).length;
      set({
        securityGroups: [
          ...s.securityGroups,
          { id, name: name ?? `sg-${count + 1}`, vpcId, inbound: [] },
        ],
      });
      return id;
    },

    updateSecurityGroup: (id, patch) => {
      const s = get();
      checkpoint(`sg:${id}`);
      commit(
        {
          ...snapshotOf(s),
          securityGroups: s.securityGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        },
        { normalize: true },
      );
    },

    removeSecurityGroup: (id) => {
      const s = get();
      checkpoint();
      commit(
        { ...snapshotOf(s), securityGroups: s.securityGroups.filter((g) => g.id !== id) },
        { normalize: true },
      );
    },

    addSgRule: (sgId, rule) => {
      const s = get();
      checkpoint();
      set({
        securityGroups: s.securityGroups.map((g) =>
          g.id === sgId ? { ...g, inbound: [...g.inbound, { ...rule, id: newId('rule') }] } : g,
        ),
      });
    },

    updateSgRule: (sgId, ruleId, patch) => {
      const s = get();
      checkpoint(`rule:${ruleId}`);
      set({
        securityGroups: s.securityGroups.map((g) =>
          g.id === sgId
            ? { ...g, inbound: g.inbound.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)) }
            : g,
        ),
      });
    },

    removeSgRule: (sgId, ruleId) => {
      const s = get();
      checkpoint();
      set({
        securityGroups: s.securityGroups.map((g) =>
          g.id === sgId ? { ...g, inbound: g.inbound.filter((r) => r.id !== ruleId) } : g,
        ),
      });
    },

    undo: () => {
      const s = get();
      const prev = s.past.at(-1);
      if (!prev) return;
      set({
        ...prev,
        past: s.past.slice(0, -1),
        future: [snapshotOf(s), ...s.future],
        lastCheckpoint: null,
      });
    },

    redo: () => {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      set({
        ...next,
        past: [...s.past, snapshotOf(s)],
        future: s.future.slice(1),
        lastCheckpoint: null,
      });
    },

    loadDocument: (doc) => {
      const s = get();
      if (s.nodes.length || s.edges.length) checkpoint();
      commit(fromDocument(doc), { normalize: true });
    },

    insertNodes: (docNodes) => {
      const s = get();
      checkpoint();
      const added = docNodes.map((d) => ({ ...fromDocNode(d), selected: false }));
      commit(
        { ...snapshotOf(s), nodes: sortParentsFirst([...s.nodes, ...added]) },
        { normalize: true },
      );
    },

    notify: (text, tone = 'info') => set({ notice: { id: ++noticeSeq, text, tone } }),
    dismissNotice: () => set({ notice: null }),
  };
});
