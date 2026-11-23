import { isContainerKind, type NodeKind, SERVICES } from './catalog';
import type { ArchDocument, DocEdge, DocNode, SecurityGroup } from './document';
import { enclosingAzId, enclosingVpcId, indexById } from './placement';

/**
 * 判定エンジンの入力。ArchDocument に、所属（VPC / AZ / サブネット）などの
 * 判定でよく使う情報を前計算して持たせる。
 */
export type ModelNode = DocNode & {
  /** 所属する VPC（Lambda はサブネット指定から決まる） */
  vpcId: string | null;
  /** 置かれている・配置先に選ばれているサブネット */
  subnetIds: string[];
  /** 上のサブネットが属する AZ（重複なし） */
  azIds: string[];
};

export type ArchModel = {
  doc: ArchDocument;
  nodes: ModelNode[];
  byId: Map<string, ModelNode>;
  edges: DocEdge[];
  outgoing: Map<string, DocEdge[]>;
  securityGroups: SecurityGroup[];
  sgById: Map<string, SecurityGroup>;
};

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** サービスが「どのサブネットにいるか」 */
function placementSubnets(node: DocNode, byId: Map<string, DocNode>): string[] {
  if (node.kind === 'subnet') return [node.id];
  if (isContainerKind(node.kind)) return [];
  const placement = SERVICES[node.kind].placement;
  if (placement === 'subnet') {
    return node.parentId && byId.get(node.parentId)?.kind === 'subnet' ? [node.parentId] : [];
  }
  // vpc 配置のサービスと、VPC 接続した Lambda は設定で選んだサブネット
  return strList(node.config.subnetIds).filter((id) => byId.get(id)?.kind === 'subnet');
}

export function buildModel(doc: ArchDocument): ArchModel {
  const docById = indexById(doc.nodes);
  const nodes: ModelNode[] = doc.nodes.map((n) => {
    const subnetIds = placementSubnets(n, docById);
    const azIds = [
      ...new Set(
        (n.kind === 'az' ? [n.id] : subnetIds.map((s) => enclosingAzId(s, docById))).filter(
          (x): x is string => x !== null,
        ),
      ),
    ];
    const ownVpc = enclosingVpcId(n.id, docById);
    const firstSubnet = subnetIds[0];
    const vpcId = ownVpc ?? (firstSubnet ? enclosingVpcId(firstSubnet, docById) : null);
    return { ...n, vpcId, subnetIds, azIds };
  });

  const outgoing = new Map<string, DocEdge[]>();
  for (const e of doc.edges) {
    const list = outgoing.get(e.source);
    if (list) list.push(e);
    else outgoing.set(e.source, [e]);
  }

  return {
    doc,
    nodes,
    byId: indexById(nodes),
    edges: doc.edges,
    outgoing,
    securityGroups: doc.securityGroups,
    sgById: new Map(doc.securityGroups.map((g) => [g.id, g])),
  };
}

/** サブネットの種別（public / private） */
export function subnetTypeOf(model: ArchModel, subnetId: string): string | undefined {
  const s = model.byId.get(subnetId);
  return s?.kind === 'subnet' ? String(s.config.subnetType) : undefined;
}

/** VPC 内の AZ を AZ 名順に並べたもの（セレクターの 'first' / 'second' に使う） */
export function orderedAzIds(model: ArchModel, vpcId: string): string[] {
  return model.nodes
    .filter((n) => n.kind === 'az' && n.parentId === vpcId)
    .sort((a, b) => String(a.config.azName).localeCompare(String(b.config.azName)))
    .map((n) => n.id);
}

export function kindOf(model: ArchModel, id: string): NodeKind | undefined {
  return model.byId.get(id)?.kind;
}
