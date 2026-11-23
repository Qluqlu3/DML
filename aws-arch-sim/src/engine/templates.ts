import { defaultConfig } from './catalog';
import type { DocNode } from './document';

/**
 * 2 AZ × (Public / Private) サブネットと IGW を持つ VPC の雛形。
 * origin は VPC 左上のキャンバス座標。makeId で ID を採番する。
 */
export function vpcTemplate(origin: { x: number; y: number }, makeId: (prefix: string) => string) {
  const vpc = makeId('vpc');
  const igw = makeId('igw');
  const nodes: DocNode[] = [
    {
      id: vpc,
      kind: 'vpc',
      name: 'VPC',
      config: { cidr: '10.0.0.0/16' },
      position: origin,
      width: 820,
      height: 540,
    },
    {
      id: igw,
      kind: 'igw',
      name: 'IGW',
      config: defaultConfig('igw'),
      parentId: vpc,
      position: { x: 354, y: 28 },
    },
  ];

  const azs = [
    { name: 'ap-northeast-1a', x: 40, n: 1 },
    { name: 'ap-northeast-1c', x: 420, n: 2 },
  ];
  for (const az of azs) {
    const azId = makeId('az');
    const suffix = az.name.slice(-1);
    nodes.push(
      {
        id: azId,
        kind: 'az',
        name: `AZ ${suffix}`,
        config: { azName: az.name },
        parentId: vpc,
        position: { x: az.x, y: 124 },
        width: 360,
        height: 390,
      },
      {
        id: makeId('subnet'),
        kind: 'subnet',
        name: `Public ${suffix}`,
        config: { subnetType: 'public', cidr: `10.0.${az.n}.0/24`, route: igw },
        parentId: azId,
        position: { x: 20, y: 40 },
        width: 320,
        height: 160,
      },
      {
        id: makeId('subnet'),
        kind: 'subnet',
        name: `Private ${suffix}`,
        config: { subnetType: 'private', cidr: `10.0.${az.n + 10}.0/24`, route: 'none' },
        parentId: azId,
        position: { x: 20, y: 214 },
        width: 320,
        height: 160,
      },
    );
  }
  return nodes;
}
