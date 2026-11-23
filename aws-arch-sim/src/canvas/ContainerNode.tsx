import { Handle, type NodeProps, NodeResizer, Position } from '@xyflow/react';
import { memo } from 'react';
import { CONTAINERS, type ContainerKind } from '../engine/catalog';
import { type AppNode, useCanvasStore } from '../store/canvasStore';
import styles from './ContainerNode.module.css';

export const CONTAINER_DRAG_HANDLE = 'container-drag-handle';

function RouteLabel({ route }: { route: string }) {
  const target = useCanvasStore((s) => s.nodes.find((n) => n.id === route)?.data.kind);
  if (target === 'igw') return <span className={styles.route}>→ IGW</span>;
  if (target === 'natgw') return <span className={styles.route}>→ NAT</span>;
  return <span className={`${styles.route} ${styles.routeNone}`}>外部ルートなし</span>;
}

function ContainerNodeImpl({ data, selected }: NodeProps<AppNode>) {
  const kind = data.kind as ContainerKind;
  const def = CONTAINERS[kind];
  const resizeStart = useCanvasStore((s) => s.resizeStart);
  const c = data.config;
  const variant =
    kind === 'subnet'
      ? c.subnetType === 'private'
        ? styles.private
        : styles.public
      : styles[kind];

  return (
    <div className={`${styles.container} ${variant} ${selected ? styles.selected : ''}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={def.minSize.width}
        minHeight={def.minSize.height}
        onResizeStart={resizeStart}
        color='#0972d3'
      />
      {/* vpc 配置のサービス（ALB 等）から配置サブネットへ点線を引くための受け口 */}
      {kind === 'subnet' && (
        <Handle
          id='attach'
          type='target'
          position={Position.Top}
          isConnectable={false}
          className={styles.attachHandle}
        />
      )}
      <div className={`${styles.header} ${CONTAINER_DRAG_HANDLE}`}>
        <span className={styles.kind}>
          {kind === 'subnet' ? (c.subnetType === 'private' ? 'Private' : 'Public') : def.label}
        </span>
        <span className={styles.name}>{data.name}</span>
        <span className={styles.meta}>
          {kind === 'az' ? String(c.azName) : String(c.cidr ?? '')}
        </span>
        {kind === 'subnet' && <RouteLabel route={String(c.route)} />}
      </div>
    </div>
  );
}

export const ContainerNode = memo(ContainerNodeImpl);
