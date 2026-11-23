import type { Config } from './catalog';
import type { SecurityGroup } from './document';
import { enclosingAzId, enclosingVpcId, indexById, type PlacedNode } from './placement';

export type ScopedNode = PlacedNode & { name: string; config: Config };

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];

/**
 * 設定の選択肢（サブネット・SG）を決める基準になる VPC。
 * VPC 内に置かれたノードはその VPC。Lambda のように VPC 外に置くノードは選択済みサブネットの VPC。
 */
export function scopeVpcId(node: ScopedNode, byId: Map<string, ScopedNode>): string | null {
  const own = enclosingVpcId(node.id, byId);
  if (own) return own;
  const first = strList(node.config.subnetIds)[0];
  return first ? enclosingVpcId(first, byId) : null;
}

export type SubnetOption = { id: string; label: string; subnetType: string; azId: string | null };

/** ノードの設定で選べるサブネット。vpcId が null なら全 VPC が対象 */
export function subnetOptions(
  nodes: ScopedNode[],
  vpcId: string | null,
  subnetType?: string,
): SubnetOption[] {
  const byId = indexById(nodes);
  return nodes
    .filter((n) => n.kind === 'subnet')
    .filter((n) => vpcId === null || enclosingVpcId(n.id, byId) === vpcId)
    .filter((n) => !subnetType || n.config.subnetType === subnetType)
    .map((n) => {
      const azId = enclosingAzId(n.id, byId);
      const az = azId ? byId.get(azId) : undefined;
      return {
        id: n.id,
        label: `${n.name} (${az ? String(az.config.azName) : 'AZ 不明'})`,
        subnetType: String(n.config.subnetType),
        azId,
      };
    });
}

/** サブネットのデフォルトルートで選べる行き先 */
export function routeOptions(
  subnetId: string,
  nodes: ScopedNode[],
): { value: string; label: string }[] {
  const byId = indexById(nodes);
  const vpcId = enclosingVpcId(subnetId, byId);
  const options = [{ value: 'none', label: 'なし（VPC 内のみ）' }];
  for (const n of nodes) {
    if (enclosingVpcId(n.id, byId) !== vpcId) continue;
    if (n.kind === 'igw') options.push({ value: n.id, label: `IGW: ${n.name}` });
    if (n.kind === 'natgw') options.push({ value: n.id, label: `NAT: ${n.name}` });
  }
  return options;
}

export type SanitizeResult = {
  /** 変更が必要なノードの新しい設定 */
  configs: Map<string, Config>;
  securityGroups: SecurityGroup[];
};

/**
 * 構造の変更（移動・削除）で無効になった参照を取り除く。
 * - サブネット指定: 存在しないもの・別 VPC のもの・種別違いのものを外す
 * - SG 指定: 存在しないもの・別 VPC のものを外す
 * - サブネットのルート: 同じ VPC にない IGW / NAT を指していたら none に戻す
 * - SG: VPC が無くなったものを削除し、削除された SG を参照するルールを外す
 */
export function sanitizeReferences(
  nodes: ScopedNode[],
  securityGroups: SecurityGroup[],
  subnetTypeOf: (kind: ScopedNode['kind']) => string | undefined,
): SanitizeResult {
  const byId = indexById(nodes);
  const vpcIds = new Set(nodes.filter((n) => n.kind === 'vpc').map((n) => n.id));

  const sgs = securityGroups.filter((sg) => vpcIds.has(sg.vpcId));
  const sgIds = new Set(sgs.map((sg) => sg.id));
  const cleanedSgs = sgs.map((sg) => {
    const inbound = sg.inbound.filter((r) => r.source.type !== 'sg' || sgIds.has(r.source.sgId));
    return inbound.length === sg.inbound.length ? sg : { ...sg, inbound };
  });
  const sgVpc = new Map(cleanedSgs.map((sg) => [sg.id, sg.vpcId]));

  const configs = new Map<string, Config>();
  for (const node of nodes) {
    const next: Config = { ...node.config };
    let changed = false;

    if ('subnetIds' in node.config) {
      const current = strList(node.config.subnetIds);
      const ownVpc = enclosingVpcId(node.id, byId);
      const firstValid = current.find((id) => byId.get(id)?.kind === 'subnet');
      const vpc = ownVpc ?? (firstValid ? enclosingVpcId(firstValid, byId) : null);
      const requiredType = subnetTypeOf(node.kind);
      const kept = current.filter((id) => {
        const s = byId.get(id);
        return (
          s?.kind === 'subnet' &&
          enclosingVpcId(id, byId) === vpc &&
          (!requiredType || s.config.subnetType === requiredType)
        );
      });
      if (kept.length !== current.length) {
        next.subnetIds = kept;
        changed = true;
      }
    }

    if ('securityGroupIds' in node.config) {
      const current = strList(node.config.securityGroupIds);
      const vpc = scopeVpcId({ ...node, config: next }, byId);
      const kept = current.filter((id) => vpc !== null && sgVpc.get(id) === vpc);
      if (kept.length !== current.length) {
        next.securityGroupIds = kept;
        changed = true;
      }
    }

    if (node.kind === 'subnet' && node.config.route !== 'none') {
      const target = byId.get(String(node.config.route));
      const sameVpc =
        target &&
        (target.kind === 'igw' || target.kind === 'natgw') &&
        enclosingVpcId(target.id, byId) === enclosingVpcId(node.id, byId);
      if (!sameVpc) {
        next.route = 'none';
        changed = true;
      }
    }

    if (changed) configs.set(node.id, next);
  }

  return { configs, securityGroups: cleanedSgs };
}
