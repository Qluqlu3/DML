import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getStraightPath,
} from '@xyflow/react';
import type { AppEdge } from '../store/canvasStore';
import styles from './edges.module.css';

export function TrafficEdge(props: EdgeProps<AppEdge>) {
  const [path, labelX, labelY] = getBezierPath(props);
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        className={props.selected ? styles.selectedPath : styles.path}
        interactionWidth={16}
      />
      <EdgeLabelRenderer>
        <div
          className={`${styles.label} ${props.selected ? styles.labelSelected : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          :{props.data?.port}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

/** vpc 配置のサービスと配置サブネットを結ぶ点線（操作不可・表示専用） */
export function AttachmentEdge(props: EdgeProps) {
  const [path] = getStraightPath(props);
  return <BaseEdge id={props.id} path={path} className={styles.attachment} interactionWidth={0} />;
}
