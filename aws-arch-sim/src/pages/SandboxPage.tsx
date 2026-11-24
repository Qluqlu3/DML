import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { isContainerKind } from '../engine/catalog';
import { emptyDocument } from '../engine/document';
import { buildModel } from '../engine/model';
import { lint } from '../engine/rules/linter';
import { simulate } from '../engine/simulator/simulate';
import type { Fault } from '../engine/simulator/types';
import { vpcTemplate } from '../engine/templates';
import type { SelectedNode } from '../incidents/IncidentPanel';
import {
  DEFAULT_SIM,
  SandboxPanel,
  type SandboxTab,
  type SimSettings,
} from '../panels/SandboxPanel';
import { toDocument, useCanvasStore } from '../store/canvasStore';
import { newId } from '../store/id';
import { downloadJson, loadStored, readJsonFile, SANDBOX_KEY } from '../store/persistence';
import { confirmDialog } from '../ui/confirm';
import { useDocumentAutosave } from '../workspace/useDocumentAutosave';
import { useExportPng } from '../workspace/useExportPng';
import { useThrottledDocument } from '../workspace/useThrottledDocument';
import {
  ToolbarSeparator,
  UndoRedoButtons,
  useViewportCenter,
  Workspace,
} from '../workspace/Workspace';

function Toolbar() {
  const insertNodes = useCanvasStore((s) => s.insertNodes);
  const loadDocument = useCanvasStore((s) => s.loadDocument);
  const notify = useCanvasStore((s) => s.notify);
  const isEmpty = useCanvasStore((s) => s.nodes.length === 0);
  const viewportCenter = useViewportCenter();
  const { fitView } = useReactFlow();
  const fileInput = useRef<HTMLInputElement>(null);
  const exportPng = useExportPng();

  const exportJson = () => {
    const date = new Date().toLocaleDateString('sv-SE'); // ローカル日付の YYYY-MM-DD
    downloadJson(toDocument(useCanvasStore.getState()), `aws-arch-${date}.json`);
  };

  const exportImage = async () => {
    const date = new Date().toLocaleDateString('sv-SE');
    try {
      await exportPng(`aws-arch-${date}.png`);
    } catch (err) {
      notify(
        `PNG の書き出しに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
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

  const clearAll = async () => {
    const ok = await confirmDialog({
      title: 'キャンバスをすべて消去しますか？',
      message: '「元に戻す」で取り消せます。',
      confirmLabel: '消去する',
      danger: true,
    });
    if (ok) loadDocument(emptyDocument());
  };

  const addVpcTemplate = () => {
    const center = viewportCenter();
    insertNodes(vpcTemplate({ x: center.x - 440, y: center.y - 340 }, newId));
  };

  return (
    <>
      <UndoRedoButtons />
      <ToolbarSeparator />
      <button type='button' onClick={addVpcTemplate}>
        VPC 雛形を追加
      </button>
      <ToolbarSeparator />
      <button type='button' onClick={exportJson} disabled={isEmpty}>
        書き出し
      </button>
      <button type='button' onClick={exportImage} disabled={isEmpty}>
        PNG
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
    </>
  );
}

/** 左上パネル（幅 380px）に隠れないよう、全体表示の左側の余白を広げる */
const SANDBOX_FIT = {
  padding: { top: '32px', right: '32px', bottom: '32px', left: '416px' },
  maxZoom: 1,
} as const;

function SandboxLayout() {
  useDocumentAutosave(SANDBOX_KEY, () => loadStored(SANDBOX_KEY) ?? emptyDocument(), SANDBOX_FIT);
  const doc = useThrottledDocument();
  const model = useMemo(() => buildModel(doc), [doc]);
  const [tab, setTab] = useState<SandboxTab>('check');
  const [focusedIssue, setFocusedIssue] = useState<string | null>(null);
  const [settings, setSettings] = useState<SimSettings>(DEFAULT_SIM);

  const issues = useMemo(() => lint(model), [model]);
  const sim = useMemo(() => {
    if (tab !== 'simulate') return null;
    const faults: Fault[] = [
      ...(settings.azDown ? [{ type: 'az-down' as const, az: settings.azDown }] : []),
      ...settings.failed.map((f) => ({
        type: 'instance-fail' as const,
        target: { kind: model.byId.get(f.id)?.kind ?? 'client', where: { id: f.id } },
      })),
    ];
    return simulate(model, settings.traffic, faults);
  }, [tab, model, settings]);
  const azNames = useMemo(
    () =>
      [
        ...new Set(model.nodes.filter((n) => n.kind === 'az').map((n) => String(n.config.azName))),
      ].sort(),
    [model],
  );

  const problemIds = useMemo(
    () =>
      new Set(tab === 'check' ? (issues.find((i) => i.id === focusedIssue)?.nodeIds ?? []) : []),
    [tab, issues, focusedIssue],
  );
  const nodeClasses = useMemo(
    () =>
      new Map(
        Object.values(sim?.nodes ?? {})
          .filter((m) => m.status !== 'idle')
          .map((m) => [m.nodeId, `sim-${m.status}`]),
      ),
    [sim],
  );

  const selectedNode = useCanvasStore((s) => s.nodes.find((n) => n.selected));
  const selected: SelectedNode | null =
    selectedNode && !isContainerKind(selectedNode.data.kind)
      ? {
          id: selectedNode.id,
          name: selectedNode.data.name,
          kind: selectedNode.data.kind,
          metrics: sim?.nodes[selectedNode.id],
        }
      : null;

  return (
    <Workspace
      mode='サンドボックス'
      toolbar={<Toolbar />}
      problemIds={problemIds}
      nodeClasses={nodeClasses}
      fitViewOptions={SANDBOX_FIT}
      overlay={
        <SandboxPanel
          tab={tab}
          onTab={setTab}
          issues={issues}
          focusedIssue={focusedIssue}
          onFocusIssue={setFocusedIssue}
          settings={settings}
          onSettings={setSettings}
          azNames={azNames}
          sim={sim}
          selected={selected}
        />
      }
    />
  );
}

export function SandboxPage() {
  return (
    <ReactFlowProvider>
      <SandboxLayout />
    </ReactFlowProvider>
  );
}
