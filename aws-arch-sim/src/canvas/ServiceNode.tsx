import { Handle, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { CATEGORIES, SERVICE_SHAPES, SERVICES, type ServiceKind } from '../engine/catalog';
import type { AppNode } from '../store/canvasStore';
import { ServiceIcon } from './ServiceIcon';
import styles from './ServiceNode.module.css';
import { ServiceShape } from './shapes';
import { serviceBadges } from './summary';

const SIDES = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left },
];

function ServiceNodeImpl({ id, data, selected }: NodeProps<AppNode>) {
  const kind = data.kind as ServiceKind;
  const c = data.config;
  const color = CATEGORIES[SERVICES[kind].category].color;
  const badges = serviceBadges(kind, c);
  const ghost =
    (kind === 'rds' && Boolean(c.multiAz)) ||
    (kind === 'aurora' && Number(c.readers) > 0) ||
    (kind === 'elasticache' && Boolean(c.multiAz));

  return (
    <div
      className={`${styles.node} ${selected ? styles.selected : ''}`}
      style={{ '--service-color': color } as React.CSSProperties}
    >
      {/* ConnectionMode.Loose で使うので全辺 source。ドラッグを始めた側が送信元になる */}
      {SIDES.map((s) => (
        <Handle
          key={s.id}
          id={s.id}
          type='source'
          position={s.position}
          className={styles.handle}
        />
      ))}
      <div className={styles.shape}>
        <ServiceShape
          shape={SERVICE_SHAPES[kind]}
          color={color}
          uid={`shape-${id}`}
          layers={kind === 'asg' ? Number(c.desired) : undefined}
          ghost={ghost}
          icon={<ServiceIcon kind={kind} size={46} />}
        />
      </div>
      <div className={styles.name} title={data.name}>
        {data.name}
      </div>
      {badges.length > 0 && (
        <div className={styles.badges}>
          {badges.map((b) => (
            <span key={b.text} className={`${styles.badge} ${styles[b.tone ?? 'muted']}`}>
              {b.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const ServiceNode = memo(ServiceNodeImpl);
