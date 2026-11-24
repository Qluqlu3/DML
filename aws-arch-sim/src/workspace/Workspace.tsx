import { type FitViewOptions, useReactFlow } from '@xyflow/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Canvas } from '../canvas/Canvas';
import type { NodeKind } from '../engine/catalog';
import { Inspector } from '../panels/Inspector';
import { Palette } from '../panels/Palette';
import { useCanvasStore } from '../store/canvasStore';
import { ToolbarButton } from '../ui/buttons';
import styles from './Workspace.module.css';

/** キャンバス表示範囲の中心（フロー座標） */
export function useViewportCenter() {
  const { screenToFlowPosition } = useReactFlow();
  return () => {
    const rect = document.querySelector('.react-flow')?.getBoundingClientRect();
    return rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
  };
}

export function UndoRedoButtons() {
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  return (
    <>
      <ToolbarButton onClick={undo} disabled={!canUndo} title='元に戻す (⌘Z)'>
        元に戻す
      </ToolbarButton>
      <ToolbarButton onClick={redo} disabled={!canRedo} title='やり直す (⇧⌘Z)'>
        やり直す
      </ToolbarButton>
    </>
  );
}

export function ToolbarSeparator() {
  return <span className={styles.separator} />;
}

type WorkspaceProps = {
  mode: string;
  /** モード名の右に出すパンくずなど */
  title?: ReactNode;
  toolbar?: ReactNode;
  /** パレットで光らせる項目 */
  highlightKinds?: NodeKind[];
  /** パレットに出す項目の制限 */
  paletteKinds?: NodeKind[];
  /** キャンバスで光らせるノード（置き場所など） */
  highlightIds?: ReadonlySet<string>;
  /** キャンバスで問題を示すノード */
  problemIds?: ReadonlySet<string>;
  /** ノードごとに足す class（シミュレーション結果の状態など） */
  nodeClasses?: ReadonlyMap<string, string>;
  /** キャンバスの上に重ねる要素（学習ガイドなど） */
  overlay?: ReactNode;
  /** 「全体を表示」の余白 */
  fitViewOptions?: FitViewOptions;
};

/** パレット・キャンバス・インスペクターからなる編集画面。各モードで共通 */
export function Workspace({
  mode,
  title,
  toolbar,
  highlightKinds,
  paletteKinds,
  highlightIds,
  problemIds,
  nodeClasses,
  overlay,
  fitViewOptions,
}: WorkspaceProps) {
  const addNode = useCanvasStore((s) => s.addNode);
  const viewportCenter = useViewportCenter();
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link to='/' className={styles.brand}>
          AWS Arch Sim
        </Link>
        <span className={styles.mode}>{mode}</span>
        {title && <span className={styles.title}>{title}</span>}
        <div className={styles.toolbar}>{toolbar}</div>
      </header>
      <Palette
        onAdd={(kind) => addNode(kind, viewportCenter())}
        highlightKinds={highlightKinds}
        allowedKinds={paletteKinds}
      />
      <main className={styles.main}>
        <Canvas
          highlightIds={highlightIds}
          problemIds={problemIds}
          nodeClasses={nodeClasses}
          fitViewOptions={fitViewOptions}
        />
        {overlay}
      </main>
      <aside className={styles.inspector}>
        <Inspector />
      </aside>
    </div>
  );
}
