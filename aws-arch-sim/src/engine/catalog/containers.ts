import { AZ_NAMES } from './options';
import type { ContainerDef, ContainerKind } from './types';

export const CONTAINERS: Record<ContainerKind, ContainerDef> = {
  vpc: {
    kind: 'vpc',
    label: 'VPC',
    description: 'AWS 上の論理的に分離されたネットワーク。中に AZ を置く。',
    parent: null,
    defaultSize: { width: 820, height: 520 },
    minSize: { width: 360, height: 240 },
    config: [{ key: 'cidr', label: 'CIDR', type: 'text', default: '10.0.0.0/16' }],
  },
  az: {
    kind: 'az',
    label: 'Availability Zone',
    description: '独立した電源・ネットワークを持つデータセンター群。中にサブネットを置く。',
    parent: 'vpc',
    defaultSize: { width: 360, height: 420 },
    minSize: { width: 220, height: 200 },
    config: [
      {
        key: 'azName',
        label: 'AZ',
        type: 'select',
        options: AZ_NAMES,
        default: 'ap-northeast-1a',
      },
    ],
  },
  subnet: {
    kind: 'subnet',
    label: 'Subnet',
    description: 'AZ 内の IP アドレス範囲。ルートテーブルで public / private が決まる。',
    parent: 'az',
    defaultSize: { width: 320, height: 170 },
    minSize: { width: 180, height: 110 },
    config: [
      {
        key: 'subnetType',
        label: '種別',
        type: 'select',
        options: [
          { value: 'public', label: 'Public' },
          { value: 'private', label: 'Private' },
        ],
        default: 'public',
      },
      { key: 'cidr', label: 'CIDR', type: 'text', default: '10.0.1.0/24' },
      {
        key: 'route',
        label: 'デフォルトルート (0.0.0.0/0)',
        type: 'route',
        default: 'none',
        help: 'Public サブネットは IGW、Private サブネットは NAT Gateway へ向けるのが一般的',
      },
    ],
  },
};
