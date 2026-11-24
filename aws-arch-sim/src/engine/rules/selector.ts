import { type ConfigValue, kindLabel, type NodeKind } from '../catalog';
import { type ArchModel, type ModelNode, orderedAzIds, subnetTypeOf } from '../model';

/** ノードを ID ではなく条件で指す。利用者が置いたノードも自動配置したノードも同じように扱える */
export type Selector = {
  kind: NodeKind | NodeKind[];
  where?: {
    /** そのサブネット（の中）にある。vpc 配置のサービスは、選んだ全サブネットがこの種別 */
    subnetType?: 'public' | 'private';
    /** VPC 内で AZ 名順に何番目の AZ か、または AZ 名 */
    az?: 'first' | 'second' | string;
    /** 名前の部分一致 */
    name?: string;
    /** ノード ID（サンドボックスで選んだノードを指すとき） */
    id?: string;
    /** 設定値の一致 */
    config?: Record<string, ConfigValue>;
  };
};

const kinds = (sel: Selector): NodeKind[] => (Array.isArray(sel.kind) ? sel.kind : [sel.kind]);

function sameValue(a: ConfigValue | undefined, b: ConfigValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return a === b;
}

function matchesAz(model: ArchModel, node: ModelNode, az: string): boolean {
  if (!node.azIds.length) return false;
  if (az === 'first' || az === 'second') {
    if (!node.vpcId) return false;
    const target = orderedAzIds(model, node.vpcId)[az === 'first' ? 0 : 1];
    return target !== undefined && node.azIds.includes(target);
  }
  return node.azIds.some((id) => model.byId.get(id)?.config.azName === az);
}

export function select(model: ArchModel, sel: Selector): ModelNode[] {
  const allowed = kinds(sel);
  const w = sel.where ?? {};
  return model.nodes.filter((n) => {
    if (!allowed.includes(n.kind)) return false;
    if (w.name && !n.name.includes(w.name)) return false;
    if (w.id && n.id !== w.id) return false;
    if (w.subnetType) {
      if (!n.subnetIds.length) return false;
      if (!n.subnetIds.every((s) => subnetTypeOf(model, s) === w.subnetType)) return false;
    }
    if (w.az && !matchesAz(model, n, w.az)) return false;
    if (w.config) {
      for (const [key, value] of Object.entries(w.config)) {
        if (!sameValue(n.config[key], value)) return false;
      }
    }
    return true;
  });
}

/** メッセージ用の呼び名: 'ALB'、'Public サブネットの EC2' など */
export function describe(sel: Selector): string {
  const names = kinds(sel).map(kindLabel).join(' / ');
  const w = sel.where ?? {};
  const parts: string[] = [];
  if (w.az === 'first') parts.push('1 つ目の AZ');
  else if (w.az === 'second') parts.push('2 つ目の AZ');
  else if (w.az) parts.push(w.az);
  if (w.subnetType)
    parts.push(w.subnetType === 'public' ? 'Public サブネット' : 'Private サブネット');
  if (w.name) parts.push(`「${w.name}」`);
  return parts.length ? `${parts.join('の')}の ${names}` : names;
}
