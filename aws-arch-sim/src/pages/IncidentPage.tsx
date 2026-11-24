import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { isContainerKind } from '../engine/catalog';
import type { ArchDocument } from '../engine/document';
import { IncidentPanel, type SelectedNode } from '../incidents/IncidentPanel';
import { diffDocuments, INCIDENTS, runIncident, scoreIncident } from '../incidents/incidents';
import {
  incidentAppliedKey,
  incidentAttemptKey,
  useIncidentProgress,
  useIncidentStore,
} from '../incidents/progressStore';
import type { Incident } from '../incidents/types';
import { toDocument, useCanvasStore } from '../store/canvasStore';
import { loadStored, saveStored } from '../store/persistence';
import { useDocumentAutosave } from '../workspace/useDocumentAutosave';
import { useThrottledDocument } from '../workspace/useThrottledDocument';
import { ToolbarSeparator, UndoRedoButtons, Workspace } from '../workspace/Workspace';
import styles from './LessonPage.module.css';

/** インシデントパネル（左上・幅 380px）に隠れないよう、全体表示の左側の余白を広げる */
const INCIDENT_FIT = {
  padding: { top: '32px', right: '32px', bottom: '32px', left: '416px' },
  maxZoom: 1,
} as const;

function IncidentWorkspace({ incident, index }: { incident: Incident; index: number }) {
  const attemptKey = incidentAttemptKey(incident.id);
  const appliedKey = incidentAppliedKey(incident.id);
  const progress = useIncidentProgress(incident.id);
  const update = useIncidentStore((s) => s.update);
  const recordTurn = useIncidentStore((s) => s.recordTurn);
  const restart = useIncidentStore((s) => s.restart);
  const loadDocument = useCanvasStore((s) => s.loadDocument);
  const { fitView } = useReactFlow();

  useDocumentAutosave(attemptKey, () => loadStored(attemptKey) ?? incident.initial, INCIDENT_FIT);

  // 最後に「変更を適用」した構成。メトリクスと変更一覧の基準になる
  const [applied, setApplied] = useState<ArchDocument>(
    () => (progress.turns.length && loadStored(appliedKey)) || incident.initial,
  );
  const run = useMemo(() => runIncident(incident, applied), [incident, applied]);
  const initialRun = useMemo(() => runIncident(incident, incident.initial), [incident]);

  const doc = useThrottledDocument();
  const pendingChanges = useMemo(() => diffDocuments(applied, doc), [applied, doc]);

  const turns = progress.turns;
  const previous =
    turns.length >= 2
      ? (turns[turns.length - 2] ?? null)
      : turns.length === 1
        ? initialRun.sim
        : null;
  const last = turns[turns.length - 1];
  const score =
    progress.solved && last
      ? scoreIncident(incident, turns.length, progress.hintsUsed, last.costUsd)
      : null;

  // 適用済みの構成のメトリクスで、キャンバスのノードに状態の色を付ける
  const nodeClasses = useMemo(
    () =>
      new Map(
        Object.values(run.sim.nodes)
          .filter((m) => m.status !== 'idle')
          .map((m) => [m.nodeId, `sim-${m.status}`]),
      ),
    [run],
  );

  const selectedNode = useCanvasStore((s) => s.nodes.find((n) => n.selected));
  const selected: SelectedNode | null =
    selectedNode && !isContainerKind(selectedNode.data.kind)
      ? {
          id: selectedNode.id,
          name: selectedNode.data.name,
          kind: selectedNode.data.kind,
          metrics: run.sim.nodes[selectedNode.id],
        }
      : null;

  const apply = () => {
    const current = toDocument(useCanvasStore.getState());
    const changes = diffDocuments(applied, current);
    if (!changes.length) return;
    const result = runIncident(incident, current);
    const turn = turns.length + 1;
    const turnScore = result.resolved
      ? scoreIncident(incident, turn, progress.hintsUsed, result.sim.costUsd).total
      : null;
    recordTurn(
      incident.id,
      {
        turn,
        changes,
        successRate: result.sim.successRate,
        latencyMs: result.sim.latencyMs,
        costUsd: result.sim.costUsd,
        passed: result.outcomes.filter((o) => o.result.pass).length,
        total: result.outcomes.length,
        resolved: result.resolved,
      },
      turnScore,
    );
    saveStored(appliedKey, current);
    setApplied(current);
  };

  const giveUp = () => {
    if (window.confirm('根本原因と解説を表示しますか？（この挑戦の点数は記録されなくなります）')) {
      update(incident.id, { gaveUp: true });
    }
  };

  const restartIncident = () => {
    if (!window.confirm('障害発生直後の構成からやり直しますか？')) return;
    restart(incident.id);
    saveStored(appliedKey, incident.initial);
    setApplied(incident.initial);
    loadDocument(incident.initial);
    requestAnimationFrame(() => fitView(INCIDENT_FIT));
  };

  const toolbar = (
    <>
      <UndoRedoButtons />
      <ToolbarSeparator />
      <button type='button' onClick={restartIncident}>
        最初から
      </button>
      <Link to='/guide' className={styles.toolbarLink}>
        図鑑
      </Link>
    </>
  );

  return (
    <Workspace
      mode='インシデント'
      title={
        <>
          <Link to='/incidents'>インシデント</Link> / <strong>{incident.title}</strong>
        </>
      }
      toolbar={toolbar}
      nodeClasses={nodeClasses}
      fitViewOptions={INCIDENT_FIT}
      overlay={
        <IncidentPanel
          incident={incident}
          number={index + 1}
          next={INCIDENTS[index + 1] ?? null}
          progress={progress}
          run={run}
          previous={previous}
          pendingChanges={pendingChanges}
          selected={selected}
          score={score}
          onApply={apply}
          onHint={() => update(incident.id, { hintsUsed: progress.hintsUsed + 1 })}
          onGiveUp={giveUp}
          onRestart={restartIncident}
        />
      }
    />
  );
}

export function IncidentPage() {
  const { incidentId = '' } = useParams();
  const index = INCIDENTS.findIndex((i) => i.id === incidentId);
  const incident = INCIDENTS[index];
  if (!incident) {
    return (
      <main className={styles.notFound}>
        <p>インシデントが見つかりません。</p>
        <Link to='/incidents'>インシデント一覧へ</Link>
      </main>
    );
  }
  return (
    <ReactFlowProvider key={incidentId}>
      <IncidentWorkspace incident={incident} index={index} />
    </ReactFlowProvider>
  );
}
