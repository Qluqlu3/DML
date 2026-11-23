import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { type ChangeEvent, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Canvas } from '../canvas/Canvas';
import { emptyDocument } from '../engine/document';
import { vpcTemplate } from '../engine/templates';
import { Inspector } from '../panels/Inspector';
import { NoticeToast } from '../panels/NoticeToast';
import { Palette } from '../panels/Palette';
import { toDocument, useCanvasStore } from '../store/canvasStore';
import { newId } from '../store/id';
import {
  downloadJson,
  loadStored,
  readJsonFile,
  SANDBOX_KEY,
  saveStored,
} from '../store/persistence';
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

const AUTOSAVE_DELAY_MS = 500;

/** 画面を開いたら前回の構成を復元し、以降の変更を自動保存する */
function useSandboxAutosave() {
  const replaceDocument = useCanvasStore((s) => s.replaceDocument);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const stored = loadStored(SANDBOX_KEY);
    replaceDocument(stored ?? emptyDocument());
    if (stored?.nodes.length) requestAnimationFrame(() => fitView({ padding: 0.1 }));

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useCanvasStore.subscribe((state, prev) => {
      if (
        state.nodes === prev.nodes &&
        state.edges === prev.edges &&
        state.securityGroups === prev.securityGroups
      ) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => saveStored(SANDBOX_KEY, toDocument(state)), AUTOSAVE_DELAY_MS);
    });
    return () => {
      // 画面を離れるときは保留中の保存をすぐ行う
      clearTimeout(timer);
      saveStored(SANDBOX_KEY, toDocument(useCanvasStore.getState()));
      unsubscribe();
    };
  }, [replaceDocument, fitView]);
}

function Toolbar() {
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const insertNodes = useCanvasStore((s) => s.insertNodes);
  const loadDocument = useCanvasStore((s) => s.loadDocument);
  const notify = useCanvasStore((s) => s.notify);
  const isEmpty = useCanvasStore((s) => s.nodes.length === 0);
  const viewportCenter = useViewportCenter();
  const { fitView } = useReactFlow();
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const date = new Date().toLocaleDateString('sv-SE'); // ローカル日付の YYYY-MM-DD
    downloadJson(toDocument(useCanvasStore.getState()), `aws-arch-${date}.json`);
  };

  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      loadDocument(await readJsonFile(file));
      requestAnimationFrame(() => fitView({ padding: 0.1 }));
      notify(`${file.name} を読み込みました（元に戻すで取り消せます）`);
    } catch (err) {
      notify(
        `読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  };

  const clearAll = () => {
    if (window.confirm('キャンバスをすべて消去しますか？（元に戻すで取り消せます）')) {
      loadDocument(emptyDocument());
    }
  };

  const addVpcTemplate = () => {
    const center = viewportCenter();
    insertNodes(vpcTemplate({ x: center.x - 440, y: center.y - 340 }, newId));
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
      <span className={styles.separator} />
      <button type='button' onClick={exportJson} disabled={isEmpty}>
        書き出し
      </button>
      <button type='button' onClick={() => fileInput.current?.click()}>
        読み込み
      </button>
      <input
        ref={fileInput}
        type='file'
        accept='application/json,.json'
        hidden
        onChange={importJson}
      />
      <button type='button' onClick={clearAll} disabled={isEmpty}>
        全消去
      </button>
    </div>
  );
}

function SandboxLayout() {
  useSandboxAutosave();
  return (
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
        <Inspector />
      </aside>
    </div>
  );
}

export function SandboxPage() {
  return (
    <ReactFlowProvider>
      <SandboxLayout />
    </ReactFlowProvider>
  );
}
