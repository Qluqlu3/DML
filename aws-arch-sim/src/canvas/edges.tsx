import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getStraightPath,
} from '@xyflow/react';
import { type AppEdge, useCanvasStore } from '../store/canvasStore';
import styles from './edges.module.css';

/** 流れる玉の速さ（px/秒） */
const DOT_SPEED = 140;
/** 1 本の接続に流す玉の、周期の中での開始位置（0〜1） */
const DOT_PHASES = [0, 1 / 3, 2 / 3];

export function TrafficEdge(props: EdgeProps<AppEdge>) {
  const [path, labelX, labelY] = getBezierPath(props);
  // 選択中の接続、または選択中のノードにつながる接続は、流れる点線で向きを見せる
  const active = useCanvasStore(
    (s) =>
      props.selected ||
      s.nodes.some((n) => n.selected && (n.id === props.source || n.id === props.target)),
  );
  const tone = props.selected ? styles.selected : active ? styles.active : '';
  const markerId = `edge-arrow-${props.id}`;
  // ベジェ曲線の長さは直線距離より少し長いので、その分を見込んで速さをそろえる
  const length = Math.hypot(props.targetX - props.sourceX, props.targetY - props.sourceY) * 1.15;
  const duration = Math.max(length / DOT_SPEED, 0.8);

  return (
    <g className={tone}>
      <defs>
        <marker
          id={markerId}
          viewBox='0 0 10 10'
          refX='9'
          refY='5'
          markerWidth='5'
          markerHeight='5'
          orient='auto-start-reverse'
        >
          <path d='M0,0 L10,5 L0,10 z' className={styles.arrow} />
        </marker>
      </defs>
      {/* 背景色の縁取り。コンテナの塗りや格子の上でも線が埋もれないようにする */}
      <path d={path} className={styles.halo} fill='none' />
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={`url(#${markerId})`}
        className={`${styles.path} ${active ? styles.flow : ''}`}
        interactionWidth={16}
      />
      {/* 送信元から送信先へ流れる玉（データの流れ） */}
      <g className={styles.dots} aria-hidden>
        {DOT_PHASES.map((phase) => (
          <circle key={phase} r={4} className={styles.dot}>
            <animateMotion
              dur={`${duration}s`}
              begin={`${-duration * phase}s`}
              repeatCount='indefinite'
              path={path}
            />
          </circle>
        ))}
      </g>
      <EdgeLabelRenderer>
        <div
          className={`${styles.label} ${props.selected ? styles.labelSelected : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          :{props.data?.port}
        </div>
      </EdgeLabelRenderer>
    </g>
  );
}

/** vpc 配置のサービスと配置サブネットを結ぶ点線（操作不可・表示専用） */
export function AttachmentEdge(props: EdgeProps) {
  const [path] = getStraightPath(props);
  return <BaseEdge id={props.id} path={path} className={styles.attachment} interactionWidth={0} />;
}
