import { type Config, isNodeKind, type NodeKind } from './catalog';

/**
 * キャンバスの内容を UI から切り離して表す。保存・読み込み・判定エンジンの入力に使う。
 * position は親コンテナからの相対座標（親が無ければキャンバス座標）。
 */
export type DocNode = {
  id: string;
  kind: NodeKind;
  name: string;
  config: Config;
  parentId?: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
};

export type DocEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  port: number;
};

export type SgSource = { type: 'sg'; sgId: string } | { type: 'cidr'; cidr: string };

export type SgRule = { id: string; port: number; source: SgSource; description?: string };

export type SecurityGroup = {
  id: string;
  name: string;
  vpcId: string;
  inbound: SgRule[];
};

export const DOCUMENT_VERSION = 1;

export type ArchDocument = {
  version: typeof DOCUMENT_VERSION;
  nodes: DocNode[];
  edges: DocEdge[];
  securityGroups: SecurityGroup[];
};

export function emptyDocument(): ArchDocument {
  return { version: DOCUMENT_VERSION, nodes: [], edges: [], securityGroups: [] };
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isConfig(v: unknown): v is Config {
  if (!isObj(v)) return false;
  return Object.values(v).every(
    (x) => isStr(x) || isNum(x) || typeof x === 'boolean' || (Array.isArray(x) && x.every(isStr)),
  );
}

/** 外部から読み込んだ JSON を検証して ArchDocument にする */
export function parseDocument(input: unknown): Result<ArchDocument> {
  if (!isObj(input)) return { ok: false, error: 'JSON のルートがオブジェクトではありません' };
  if (input.version !== DOCUMENT_VERSION) {
    return { ok: false, error: `未対応のバージョンです: ${String(input.version)}` };
  }
  const { nodes, edges, securityGroups } = input;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(securityGroups)) {
    return { ok: false, error: 'nodes / edges / securityGroups が配列ではありません' };
  }

  const ids = new Set<string>();
  for (const [i, n] of nodes.entries()) {
    if (
      !isObj(n) ||
      !isStr(n.id) ||
      !isStr(n.kind) ||
      !isNodeKind(n.kind) ||
      !isStr(n.name) ||
      !isConfig(n.config) ||
      !isObj(n.position) ||
      !isNum(n.position.x) ||
      !isNum(n.position.y) ||
      (n.parentId !== undefined && !isStr(n.parentId)) ||
      (n.width !== undefined && !isNum(n.width)) ||
      (n.height !== undefined && !isNum(n.height))
    ) {
      return { ok: false, error: `nodes[${i}] の形式が不正です` };
    }
    if (ids.has(n.id)) return { ok: false, error: `ノード ID が重複しています: ${n.id}` };
    ids.add(n.id);
  }
  for (const n of nodes as DocNode[]) {
    if (n.parentId !== undefined && !ids.has(n.parentId)) {
      return { ok: false, error: `存在しない親を参照しています: ${n.id} → ${n.parentId}` };
    }
  }

  for (const [i, e] of edges.entries()) {
    if (!isObj(e) || !isStr(e.id) || !isStr(e.source) || !isStr(e.target) || !isNum(e.port)) {
      return { ok: false, error: `edges[${i}] の形式が不正です` };
    }
    if (!ids.has(e.source) || !ids.has(e.target)) {
      return { ok: false, error: `edges[${i}] が存在しないノードを参照しています` };
    }
  }

  for (const [i, sg] of securityGroups.entries()) {
    if (
      !isObj(sg) ||
      !isStr(sg.id) ||
      !isStr(sg.name) ||
      !isStr(sg.vpcId) ||
      !Array.isArray(sg.inbound) ||
      !sg.inbound.every(
        (r) =>
          isObj(r) &&
          isStr(r.id) &&
          isNum(r.port) &&
          isObj(r.source) &&
          ((r.source.type === 'sg' && isStr(r.source.sgId)) ||
            (r.source.type === 'cidr' && isStr(r.source.cidr))),
      )
    ) {
      return { ok: false, error: `securityGroups[${i}] の形式が不正です` };
    }
  }

  return { ok: true, value: input as ArchDocument };
}
