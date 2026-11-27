import {
  Background,
  type Connection,
  ConnectionMode,
  Controls,
  type Edge,
  type EdgeChangeset,
  type FitViewOptions,
  MiniMap,
  type OnConnectEnd,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type DragEvent, useCallback, useEffect, useMemo } from 'react';
import {
  CATEGORIES,
  canConnect,
  connectionHint,
  isContainerKind,
  isNodeKind,
  SERVICES,
} from '../engine/catalog';
import { type AppEdge, type AppNode, useCanvasStore } from '../store/canvasStore';
import styles from './Canvas.module.css';
import { CONTAINER_DRAG_HANDLE, ContainerNode } from './ContainerNode';
import { AttachmentEdge, TrafficEdge } from './edges';
import { ServiceNode } from './ServiceNode';

export const DND_MIME = 'application/x-aws-arch-kind';

const nodeTypes = { service: ServiceNode, container: ContainerNode };
const edgeTypes = { traffic: TrafficEdge, attachment: AttachmentEdge };
const ATTACH_PREFIX = 'attach:';
/** 入れ子は親 + 1 ずつ重なるので、VPC > AZ > サブネット > サービス（4 段）より上にする */
const TOP_LEVEL_SERVICE_Z = 10;

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

type Box = {
  internals: { positionAbsolute: { x: number; y: number } };
  measured: { width?: number; height?: number };
};

/** to ノードの、from ノードに向いている辺の接続点 ID */
function facingSide(from: Box | undefined, to: Box | undefined): string {
  if (!from || !to) return 'l';
  const c = (b: Box) => ({
    x: b.internals.positionAbsolute.x + (b.measured.width ?? 0) / 2,
    y: b.internals.positionAbsolute.y + (b.measured.height ?? 0) / 2,
  });
  const a = c(from);
  const b = c(to);
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'l' : 'r';
  return dy < 0 ? 't' : 'b';
}

function miniMapColor(node: AppNode): string {
  const kind = node.data.kind;
  if (isContainerKind(kind)) return 'transparent';
  return CATEGORIES[SERVICES[kind].category].color;
}

type CanvasProps = {
  /** 光らせるノード（学習モードの置き場所など） */
  highlightIds?: ReadonlySet<string>;
  /** 問題があるノード */
  problemIds?: ReadonlySet<string>;
  /** ノードごとに足す class（シミュレーション結果の状態など） */
  nodeClasses?: ReadonlyMap<string, string>;
  /** 「全体を表示」の余白（キャンバスに重ねたパネルを避けるため） */
  fitViewOptions?: FitViewOptions;
};

export function Canvas({
  highlightIds,
  problemIds,
  nodeClasses,
  fitViewOptions,
}: CanvasProps = {}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const storeEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const connect = useCanvasStore((s) => s.connect);
  const addNode = useCanvasStore((s) => s.addNode);
  const dragStart = useCanvasStore((s) => s.dragStart);
  const dragStop = useCanvasStore((s) => s.dragStop);
  const notify = useCanvasStore((s) => s.notify);
  const { screenToFlowPosition, getInternalNode } = useReactFlow<AppNode, AppEdge>();

  // コンテナはヘッダーでだけ掴めるようにする（中のサービスを動かしやすくするため）
  const flowNodes = useMemo(
    () =>
      nodes.map((n) => {
        const classes = [
          highlightIds?.has(n.id) ? 'is-highlight' : '',
          problemIds?.has(n.id) ? 'is-problem' : '',
          nodeClasses?.get(n.id) ?? '',
        ]
          .filter(Boolean)
          .join(' ');
        const dragHandle = n.type === 'container' ? `.${CONTAINER_DRAG_HANDLE}` : undefined;
        // VPC の外のサービスは、後から置いた VPC の枠に隠れないよう常に手前に描く
        const zIndex = n.type === 'service' && !n.parentId ? TOP_LEVEL_SERVICE_Z : undefined;
        if (n.dragHandle === dragHandle && (n.className ?? '') === classes && n.zIndex === zIndex) {
          return n;
        }
        return { ...n, dragHandle, zIndex, className: classes || undefined };
      }),
    [nodes, highlightIds, problemIds, nodeClasses],
  );

  // vpc 配置のサービス → 配置サブネットの点線を、設定から導出して重ねる
  const flowEdges = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    const attachments: Edge[] = [];
    for (const n of nodes) {
      const kind = n.data.kind;
      if (isContainerKind(kind) || SERVICES[kind].placement !== 'vpc') continue;
      const subnetIds = n.data.config.subnetIds;
      if (!Array.isArray(subnetIds)) continue;
      for (const subnetId of subnetIds) {
        if (!ids.has(subnetId)) continue;
        attachments.push({
          id: `${ATTACH_PREFIX}${n.id}:${subnetId}`,
          source: n.id,
          sourceHandle: 'b',
          target: subnetId,
          targetHandle: 'attach',
          type: 'attachment',
          selectable: false,
          focusable: false,
          deletable: false,
          markerEnd: undefined,
        });
      }
    }
    return [...edges, ...attachments] as AppEdge[];
  }, [nodes, edges]);

  const onEdgesChange = useCallback(
    (changes: EdgeChangeset<AppEdge>) => {
      for (const c of changes.toArray()) {
        if (c.id.startsWith(ATTACH_PREFIX)) changes.remove(c);
      }
      if (!changes.isEmpty()) storeEdgesChange(changes);
    },
    [storeEdgesChange],
  );

  const isValidConnection = useCallback((c: AppEdge | Connection) => {
    if (c.source === c.target) return false;
    const { nodes } = useCanvasStore.getState();
    const from = nodes.find((n) => n.id === c.source);
    const to = nodes.find((n) => n.id === c.target);
    return !!from && !!to && canConnect(from.data.kind, to.data.kind);
  }, []);

  // 接続点の近くでなく、ノード本体の上で離したときも接続する
  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (state.isValid === true || !state.fromNode) return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      const toId =
        state.toNode?.id ??
        (point
          ? document
              .elementsFromPoint(point.clientX, point.clientY)
              .map((el) => el.closest('.react-flow__node-service'))
              .find((el) => el !== null)
              ?.getAttribute('data-id')
          : undefined);
      if (!toId || toId === state.fromNode.id) return;

      const { nodes } = useCanvasStore.getState();
      const from = nodes.find((n) => n.id === state.fromNode?.id);
      const to = nodes.find((n) => n.id === toId);
      if (!from || !to) return;
      if (!canConnect(from.data.kind, to.data.kind)) {
        notify(connectionHint(from.data.kind, to.data.kind), 'error');
        return;
      }
      connect({
        source: from.id,
        sourceHandle: state.fromHandle?.id ?? null,
        target: to.id,
        targetHandle: facingSide(getInternalNode(from.id), getInternalNode(to.id)),
      });
    },
    [connect, notify, getInternalNode],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      const kind = e.dataTransfer.getData(DND_MIME);
      if (!isNodeKind(kind)) return;
      e.preventDefault();
      addNode(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [addNode, screenToFlowPosition],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const s = useCanvasStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const nodeIds = s.nodes.filter((n) => n.selected).map((n) => n.id);
        const edgeIds = s.edges.filter((ed) => ed.selected).map((ed) => ed.id);
        if (nodeIds.length || edgeIds.length) {
          e.preventDefault();
          s.removeElements(nodeIds, edgeIds);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      className={styles.canvas}
      role='application'
      aria-label='構成図キャンバス'
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow<AppNode, AppEdge>
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={connect}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        onNodeDragStart={(_e, _node, dragged) => dragStart(dragged)}
        onNodeDragStop={(_e, _node, dragged) => dragStop(dragged)}
        onSelectionDragStart={(_e, dragged) => dragStart(dragged)}
        onSelectionDragStop={(_e, dragged) => dragStop(dragged)}
        deleteKeyCode={null}
        elevateNodesOnSelect={false}
        snapToGrid
        snapGrid={[8, 8]}
        minZoom={0.2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background gap={16} />
        <Controls position='top-right' showInteractive={false} fitViewOptions={fitViewOptions} />
        <MiniMap<AppNode> nodeColor={miniMapColor} pannable zoomable className={styles.minimap} />
      </ReactFlow>
    </div>
  );
}
