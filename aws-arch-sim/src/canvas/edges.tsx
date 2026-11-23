import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getStraightPath,
} from '@xyflow/react';
import { type AppEdge, useCanvasStore } from '../store/canvasStore';
import styles from './edges.module.css';

export function TrafficEdge(props: EdgeProps<AppEdge>) {
  const [path, labelX, labelY] = getBezierPath(props);
  // 選択中の接続、または選択中のノードにつながる接続は、流れる点線で向きを見せる
  const active = useCanvasStore(
    (s) =>
      props.selected ||
      s.nodes.some((n) => n.selected && (n.id === props.source || n.id === props.target)),
  );
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        className={`${props.selected ? styles.selectedPath : styles.path} ${active ? styles.flow : ''}`}
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
