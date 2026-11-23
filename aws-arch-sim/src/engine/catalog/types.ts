export type Category =
  | 'actor'
  | 'edge'
  | 'network'
  | 'loadbalancing'
  | 'compute'
  | 'integration'
  | 'database'
  | 'storage';

export type ContainerKind = 'vpc' | 'az' | 'subnet';

export type ServiceKind =
  | 'client'
  | 'external'
  | 'route53'
  | 'cloudfront'
  | 'waf'
  | 'igw'
  | 'natgw'
  | 'alb'
  | 'nlb'
  | 'ec2'
  | 'asg'
  | 'ecs'
  | 'lambda'
  | 'apigw'
  | 'sqs'
  | 'sns'
  | 'rds'
  | 'aurora'
  | 'dynamodb'
  | 'elasticache'
  | 's3';

export type NodeKind = ContainerKind | ServiceKind;

/**
 * サービスを置ける場所。
 * - global: VPC の外
 * - vpc: VPC 枠の中（サブネットの外）。設定で複数サブネットを選ぶ
 * - subnet: サブネット枠の中
 */
export type Placement = 'global' | 'vpc' | 'subnet';

export type SubnetType = 'public' | 'private';

export type ConfigValue = string | number | boolean | string[];
export type Config = Record<string, ConfigValue>;

type FieldBase = { key: string; label: string; help?: string };

export type ConfigField = FieldBase &
  (
    | { type: 'select'; options: { value: string; label: string }[]; default: string }
    | { type: 'number'; min: number; max: number; step?: number; unit?: string; default: number }
    | { type: 'boolean'; default: boolean }
    | { type: 'text'; default: string }
    /** 同じ VPC 内のサブネットを複数選ぶ */
    | { type: 'subnets'; subnetType?: SubnetType; min: number; default: string[] }
    /** 同じ VPC 内のセキュリティグループを複数選ぶ */
    | { type: 'securityGroups'; default: string[] }
    /** サブネットのデフォルトルート（none / igw / NAT GW のノード ID） */
    | { type: 'route'; default: string }
  );

export type ServiceDef = {
  kind: ServiceKind;
  label: string;
  /** アイコンが無いときに表示する略称 */
  short: string;
  category: Category;
  placement: Placement;
  description: string;
  config: ConfigField[];
  /** 接続時の既定ポート */
  defaultPort: number;
  /** この種類から送信できる先 */
  canConnectTo: ServiceKind[];
};

export type ContainerDef = {
  kind: ContainerKind;
  label: string;
  description: string;
  /** 入れられる親。null はキャンバス直下 */
  parent: ContainerKind | null;
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  config: ConfigField[];
};
