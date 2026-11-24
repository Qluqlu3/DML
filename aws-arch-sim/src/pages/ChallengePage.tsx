import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChallengePanel } from '../challenges/ChallengePanel';
import {
  CHALLENGES,
  type Evaluation,
  evaluate,
  initialDoc,
  modelDoc,
  type Score,
  scoreOf,
} from '../challenges/challenges';
import {
  challengeAttemptKey,
  useChallengeProgress,
  useChallengeStore,
} from '../challenges/progressStore';
import type { Challenge } from '../challenges/types';
import { monthlyCost } from '../engine/cost';
import type { ArchDocument } from '../engine/document';
import { buildModel } from '../engine/model';
import { vpcTemplate } from '../engine/templates';
import { toDocument, useCanvasStore } from '../store/canvasStore';
import { newId } from '../store/id';
import { loadStored, saveStored } from '../store/persistence';
import { confirmDialog } from '../ui/confirm';
import { useDocumentAutosave } from '../workspace/useDocumentAutosave';
import { useThrottledDocument } from '../workspace/useThrottledDocument';
import {
  ToolbarSeparator,
  UndoRedoButtons,
  useViewportCenter,
  Workspace,
} from '../workspace/Workspace';
import styles from './LessonPage.module.css';

/** 問題パネル（左上・幅 360px）に隠れないよう、全体表示の左側の余白を広げる */
const CHALLENGE_FIT = {
  padding: { top: '32px', right: '32px', bottom: '32px', left: '396px' },
  /** ノードが少ないときに拡大しすぎない */
  maxZoom: 1,
} as const;

type Submitted = { evaluation: Evaluation; score: Score; signature: string };

const signatureOf = (doc: ArchDocument) => JSON.stringify(doc);

function ChallengeWorkspace({ challenge, index }: { challenge: Challenge; index: number }) {
  const key = challengeAttemptKey(challenge.id);
  const progress = useChallengeProgress(challenge.id);
  const update = useChallengeStore((s) => s.update);
  const recordSubmission = useChallengeStore((s) => s.recordSubmission);
  const restart = useChallengeStore((s) => s.restart);
  const loadDocument = useCanvasStore((s) => s.loadDocument);
  const replaceDocument = useCanvasStore((s) => s.replaceDocument);
  const insertNodes = useCanvasStore((s) => s.insertNodes);
  const viewportCenter = useViewportCenter();
  const { fitView } = useReactFlow();

  // 模範解答の表示中は自動保存を止め、自分の構成を退避しておく
  const paused = useRef(false);
  const mine = useRef<ArchDocument | null>(null);
  const [viewingAnswer, setViewingAnswer] = useState(false);
  useDocumentAutosave(key, () => loadStored(key) ?? initialDoc(challenge), CHALLENGE_FIT, paused);

  const doc = useThrottledDocument();
  const costUsd = useMemo(() => monthlyCost(doc).total, [doc]);
  const signature = useMemo(() => signatureOf(doc), [doc]);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const result = useMemo(
    () =>
      submitted && resultOpen ? { ...submitted, stale: submitted.signature !== signature } : null,
    [submitted, resultOpen, signature],
  );
  const problemIds = useMemo(
    () =>
      new Set(
        result && !result.stale && !viewingAnswer
          ? [...result.evaluation.required, ...result.evaluation.recommended]
              .filter((o) => !o.result.pass)
              .flatMap((o) => o.result.nodeIds ?? [])
          : [],
      ),
    [result, viewingAnswer],
  );

  const submit = () => {
    const current = toDocument(useCanvasStore.getState());
    const evaluation = evaluate(challenge, buildModel(current));
    const score = scoreOf(challenge, evaluation, progress.hintsUsed);
    recordSubmission(challenge.id, evaluation.cleared, score.total);
    setSubmitted({ evaluation, score, signature: signatureOf(current) });
    setResultOpen(true);
  };

  const fitLater = () => requestAnimationFrame(() => fitView(CHALLENGE_FIT));

  const viewAnswer = async () => {
    if (!progress.cleared && !progress.answerViewed) {
      const ok = await confirmDialog({
        title: '模範解答を見ますか？',
        message:
          'クリア前に模範解答を見ると、この挑戦の点数は記録されません（最初からやり直すと記録できます）。',
        confirmLabel: '模範解答を見る',
        danger: true,
      });
      if (!ok) return;
      update(challenge.id, { answerViewed: true });
    }
    mine.current = toDocument(useCanvasStore.getState());
    saveStored(key, mine.current);
    paused.current = true;
    replaceDocument(modelDoc(challenge));
    setViewingAnswer(true);
    fitLater();
  };

  const backToMine = () => {
    replaceDocument(mine.current ?? loadStored(key) ?? initialDoc(challenge));
    paused.current = false;
    setViewingAnswer(false);
    fitLater();
  };

  const restartChallenge = async () => {
    const ok = await confirmDialog({
      title: '最初の構成からやり直しますか？',
      message: 'ヒントの使用数もリセットされます。',
      confirmLabel: 'やり直す',
    });
    if (!ok) return;
    paused.current = false;
    setViewingAnswer(false);
    setSubmitted(null);
    setResultOpen(false);
    restart(challenge.id);
    loadDocument(initialDoc(challenge));
    fitLater();
  };

  const canAddVpc = !challenge.palette || challenge.palette.includes('vpc');
  const addVpcTemplate = () => {
    const center = viewportCenter();
    insertNodes(vpcTemplate({ x: center.x - 440, y: center.y - 340 }, newId));
  };

  const toolbar = (
    <>
      <UndoRedoButtons />
      <ToolbarSeparator />
      {canAddVpc && (
        <button type='button' onClick={addVpcTemplate} disabled={viewingAnswer}>
          VPC 雛形を追加
        </button>
      )}
      <button type='button' onClick={restartChallenge}>
        最初から
      </button>
      <Link to='/guide' className={styles.toolbarLink}>
        図鑑
      </Link>
    </>
  );

  return (
    <Workspace
      mode='問題'
      title={
        <>
          <Link to='/challenges'>問題</Link> / <strong>{challenge.title}</strong>
          {viewingAnswer && <span> （模範解答を表示中）</span>}
        </>
      }
      toolbar={toolbar}
      paletteKinds={challenge.palette}
      problemIds={problemIds}
      fitViewOptions={CHALLENGE_FIT}
      overlay={
        <ChallengePanel
          challenge={challenge}
          number={index + 1}
          next={CHALLENGES[index + 1] ?? null}
          progress={progress}
          costUsd={costUsd}
          result={result}
          viewingAnswer={viewingAnswer}
          onSubmit={submit}
          onCloseResult={() => setResultOpen(false)}
          onHint={() => update(challenge.id, { hintsUsed: progress.hintsUsed + 1 })}
          onViewAnswer={viewAnswer}
          onBackToMine={backToMine}
        />
      }
    />
  );
}

export function ChallengePage() {
  const { challengeId = '' } = useParams();
  const index = CHALLENGES.findIndex((c) => c.id === challengeId);
  const challenge = CHALLENGES[index];
  if (!challenge) {
    return (
      <main className={styles.notFound}>
        <p>問題が見つかりません。</p>
        <Link to='/challenges'>問題一覧へ</Link>
      </main>
    );
  }
  return (
    <ReactFlowProvider key={challengeId}>
      <ChallengeWorkspace challenge={challenge} index={index} />
    </ReactFlowProvider>
  );
}
