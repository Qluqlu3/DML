import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { Link } from 'react-router';
import { Canvas } from '../canvas/Canvas';
import { vpcTemplate } from '../engine/templates';
import { NoticeToast } from '../panels/NoticeToast';
import { Palette } from '../panels/Palette';
import { useCanvasStore } from '../store/canvasStore';
import { newId } from '../store/id';
import styles from './SandboxPage.module.css';

/** キャンバス表示範囲の中心（フロー座標） */
function useViewportCenter() {
  const { screenToFlowPosition } = useReactFlow();
  return () => {
    const rect = document.querySelector('.react-flow')?.getBoundingClientRect();
    return rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
  };
}

function SandboxPalette() {
  const addNode = useCanvasStore((s) => s.addNode);
  const viewportCenter = useViewportCenter();
  return <Palette onAdd={(kind) => addNode(kind, viewportCenter())} />;
}

function Toolbar() {
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const insertNodes = useCanvasStore((s) => s.insertNodes);
  const { screenToFlowPosition } = useReactFlow();

  const addVpcTemplate = () => {
    const canvas = document.querySelector('.react-flow')?.getBoundingClientRect();
    const center = canvas
      ? screenToFlowPosition({
          x: canvas.left + canvas.width / 2,
          y: canvas.top + canvas.height / 2,
        })
      : { x: 0, y: 0 };
    insertNodes(vpcTemplate({ x: center.x - 410, y: center.y - 270 }, newId));
  };

  return (
    <div className={styles.toolbar}>
      <button type='button' onClick={undo} disabled={!canUndo} title='元に戻す (⌘Z)'>
        元に戻す
      </button>
      <button type='button' onClick={redo} disabled={!canRedo} title='やり直す (⇧⌘Z)'>
        やり直す
      </button>
      <span className={styles.separator} />
      <button type='button' onClick={addVpcTemplate}>
        VPC 雛形を追加
      </button>
    </div>
  );
}

export function SandboxPage() {
  return (
    <ReactFlowProvider>
      <div className={styles.layout}>
        <header className={styles.header}>
          <Link to='/' className={styles.brand}>
            AWS Arch Sim
          </Link>
          <span className={styles.mode}>サンドボックス</span>
          <Toolbar />
        </header>
        <SandboxPalette />
        <main className={styles.main}>
          <Canvas />
          <NoticeToast />
        </main>
        <aside className={styles.inspector}>
          <p className={styles.placeholder}>ノードや接続を選択すると、ここに設定が表示されます。</p>
        </aside>
      </div>
    </ReactFlowProvider>
  );
}
