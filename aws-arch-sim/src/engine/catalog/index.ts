import { CONTAINERS } from './containers';
import { SERVICES } from './services';
import type {
  Category,
  Config,
  ConfigField,
  ContainerKind,
  NodeKind,
  Placement,
  ServiceKind,
} from './types';

export { CONTAINERS } from './containers';
export { SERVICE_KINDS, SERVICES } from './services';
export * from './types';

/** カテゴリの表示名と色（AWS Architecture Icons のカテゴリ色に準拠） */
export const CATEGORIES: Record<Category, { label: string; color: string }> = {
  actor: { label: 'ユーザー・外部', color: '#5a6b86' },
  edge: { label: 'エッジ・DNS', color: '#8c4fff' },
  security: { label: 'セキュリティ', color: '#dd344c' },
  management: { label: '監視・運用', color: '#e7157b' },
  network: { label: 'ネットワーク', color: '#8c4fff' },
  loadbalancing: { label: 'ロードバランサー', color: '#8c4fff' },
  compute: { label: 'コンピュート', color: '#ed7100' },
  integration: { label: 'アプリケーション統合', color: '#e7157b' },
  database: { label: 'データベース', color: '#c925d1' },
  storage: { label: 'ストレージ', color: '#7aa116' },
};

export const CATEGORY_ORDER: Category[] = [
  'actor',
  'edge',
  'network',
  'loadbalancing',
  'compute',
  'integration',
  'database',
  'storage',
  'security',
  'management',
];

export function isContainerKind(kind: NodeKind): kind is ContainerKind {
  return kind in CONTAINERS;
}

export function isServiceKind(kind: string): kind is ServiceKind {
  return kind in SERVICES;
}

export function isNodeKind(kind: string): kind is NodeKind {
  return kind in SERVICES || kind in CONTAINERS;
}

export function configFields(kind: NodeKind): ConfigField[] {
  return isContainerKind(kind) ? CONTAINERS[kind].config : SERVICES[kind].config;
}

export function kindLabel(kind: NodeKind): string {
  return isContainerKind(kind) ? CONTAINERS[kind].label : SERVICES[kind].label;
}

export function defaultConfig(kind: NodeKind): Config {
  const config: Config = {};
  for (const field of configFields(kind)) {
    config[field.key] = Array.isArray(field.default) ? [...field.default] : field.default;
  }
  return config;
}

/** 種類ごとに、置ける親コンテナの種類。null はキャンバス直下 */
export function allowedParent(kind: NodeKind): ContainerKind | null {
  if (isContainerKind(kind)) return CONTAINERS[kind].parent;
  const placement: Placement = SERVICES[kind].placement;
  if (placement === 'global') return null;
  return placement;
}

export function canConnect(from: NodeKind, to: NodeKind): boolean {
  if (isContainerKind(from) || isContainerKind(to)) return false;
  return SERVICES[from].canConnectTo.includes(to);
}

export function connectionHint(from: NodeKind, to: NodeKind): string {
  if (isContainerKind(from) || isContainerKind(to))
    return '枠（VPC / AZ / サブネット）は接続できません';
  if (canConnect(from, to)) return '';
  const allowed = SERVICES[from].canConnectTo.map((k) => SERVICES[k].label);
  return allowed.length
    ? `${SERVICES[from].label} から ${SERVICES[to].label} へは接続できません（接続先: ${allowed.join(', ')}）`
    : `${SERVICES[from].label} から他へリクエストを送る接続はありません`;
}
/** その種類・設定のノードへ接続するときの既定ポート */
export function defaultPort(kind: NodeKind, config: Config): number {
  if (isContainerKind(kind)) return 443;
  if (kind === 'rds' || kind === 'aurora') {
    return String(config.engine).includes('postg') ? 5432 : 3306;
  }
  if (kind === 'elasticache' && config.engine === 'memcached') return 11211;
  if (kind === 'alb' && config.listener === 'http') return 80;
  return SERVICES[kind].defaultPort;
}

export * from './visuals';
