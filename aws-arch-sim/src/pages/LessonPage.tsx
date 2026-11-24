import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { applyAnswer } from '../engine/answers';
import { buildModel } from '../engine/model';
import { select } from '../engine/rules/selector';
import { GuidePanel } from '../learning/GuidePanel';
import { GuideCard, LessonIntro } from '../learning/LessonOverlays';
import { docBeforeStep, evaluateStep, findLesson, initialDoc } from '../learning/lessons';
import { attemptKey, useLessonProgress, useProgressStore } from '../learning/progressStore';
import type { Course, GuideTopic, Lesson } from '../learning/types';
import { toDocument, useCanvasStore } from '../store/canvasStore';
import { newId } from '../store/id';
import { loadStored } from '../store/persistence';
import { confirmDialog } from '../ui/confirm';
import { useDocumentAutosave } from '../workspace/useDocumentAutosave';
import { useThrottledDocument } from '../workspace/useThrottledDocument';
import { ToolbarSeparator, UndoRedoButtons, Workspace } from '../workspace/Workspace';
import styles from './LessonPage.module.css';

/** ガイドパネル（左上・幅 360px）に隠れないよう、全体表示の左側の余白を広げる */
const LESSON_FIT = {
  padding: { top: '32px', right: '32px', bottom: '32px', left: '396px' },
  /** ノードが少ないときに拡大しすぎない */
  maxZoom: 1,
} as const;

function LessonWorkspace({ course, lesson }: { course: Course; lesson: Lesson }) {
  const progress = useLessonProgress(lesson.id);
  const update = useProgressStore((s) => s.update);
  const restart = useProgressStore((s) => s.restart);
  const markLearned = useProgressStore((s) => s.markLearned);
  const loadDocument = useCanvasStore((s) => s.loadDocument);
  const notify = useCanvasStore((s) => s.notify);
  const [cards, setCards] = useState<GuideTopic[]>([]);

  // 途中のレッスンは保存した構成から、それ以外は初期構成から始める
  useDocumentAutosave(
    attemptKey(lesson.id),
    () => (progress.phase !== 'intro' && loadStored(attemptKey(lesson.id))) || initialDoc(lesson),
  );

  const doc = useThrottledDocument();
  const model = useMemo(() => buildModel(doc), [doc]);
  const step = progress.phase === 'steps' ? lesson.steps[progress.stepIndex] : undefined;
  const evaluation = useMemo(
    () => evaluateStep(lesson, progress.stepIndex, model),
    [lesson, progress.stepIndex, model],
  );

  // ステップに入ったら、まだ学んでいないトピックの解説カードを開く
  useEffect(() => {
    const fresh = (step?.introduces ?? []).filter(
      (t) => !useProgressStore.getState().learned.includes(t),
    );
    setCards(fresh);
  }, [step]);

  // ハイライト: レベル 1 は置き場所まで、レベル 2 はパレットだけ、レベル 3 はなし
  const highlightKinds = lesson.level <= 2 ? step?.highlight?.palette : undefined;
  const highlightIds = useMemo(() => {
    if (lesson.level !== 1 || !step?.highlight?.nodes) return undefined;
    return new Set(step.highlight.nodes.flatMap((sel) => select(model, sel).map((n) => n.id)));
  }, [lesson.level, step, model]);
  const problemIds = useMemo(
    () =>
      new Set(
        [...evaluation.current, ...evaluation.regressions]
          .filter((r) => !r.result.pass)
          .flatMap((r) => r.result.nodeIds ?? []),
      ),
    [evaluation],
  );

  const goNext = () => {
    if (progress.stepIndex + 1 < lesson.steps.length) {
      update(lesson.id, { stepIndex: progress.stepIndex + 1 });
    } else {
      update(lesson.id, { phase: 'quiz' });
    }
  };

  const applyStepAnswer = () => {
    if (!step) return;
    const { doc: next, errors } = applyAnswer(
      toDocument(useCanvasStore.getState()),
      step.answer,
      newId,
    );
    loadDocument(next);
    update(lesson.id, { assisted: true });
    notify(
      errors.length
        ? `一部を配置できませんでした: ${errors.join(' / ')}`
        : '答えを配置しました（元に戻すで取り消せます）',
      errors.length ? 'error' : 'info',
    );
  };

  const resetStep = async () => {
    const ok = await confirmDialog({
      title: 'このステップの開始時点に戻しますか？',
      message: '「元に戻す」で取り消せます。',
      confirmLabel: '戻す',
    });
    if (ok) loadDocument(docBeforeStep(lesson, progress.stepIndex));
  };

  const restartLesson = () => {
    restart(lesson.id);
    loadDocument(initialDoc(lesson));
  };

  const total = lesson.steps.length;
  const title = (
    <>
      <Link to='/learn'>学習</Link> / {course.title} / <strong>{lesson.title}</strong>
      {progress.phase === 'steps' && (
        <span
          className={styles.dots}
          role='img'
          aria-label={`ステップ ${progress.stepIndex + 1} / ${total}`}
        >
          {lesson.steps.map((s, i) => (
            <span
              key={s.id}
              className={
                i < progress.stepIndex
                  ? styles.dotDone
                  : i === progress.stepIndex
                    ? styles.dotNow
                    : styles.dot
              }
            />
          ))}
        </span>
      )}
    </>
  );

  const toolbar = (
    <>
      <UndoRedoButtons />
      <ToolbarSeparator />
      {progress.phase === 'steps' && (
        <button type='button' onClick={resetStep}>
          このステップをやり直す
        </button>
      )}
      <button
        type='button'
        onClick={async () => {
          if (
            await confirmDialog({
              title: 'レッスンを最初からやり直しますか？',
              confirmLabel: 'やり直す',
            })
          ) {
            restartLesson();
          }
        }}
      >
        最初から
      </button>
      <Link to='/guide' className={styles.toolbarLink}>
        図鑑
      </Link>
    </>
  );

  const overlay = (
    <>
      {progress.phase === 'intro' ? (
        <LessonIntro
          course={course}
          lesson={lesson}
          onStart={() => update(lesson.id, { phase: 'steps' })}
        />
      ) : (
        <GuidePanel
          lesson={lesson}
          progress={progress}
          evaluation={evaluation}
          onNext={goNext}
          onShowGuide={(t) => setCards([t])}
          onRevealAnswer={() => update(lesson.id, { assisted: true })}
          onApplyAnswer={applyStepAnswer}
          onQuizFinish={(correct) =>
            update(lesson.id, {
              phase: 'done',
              completed: true,
              quizCorrect: correct,
              quizTotal: lesson.quiz.length,
            })
          }
          onRestart={restartLesson}
        />
      )}
      {progress.phase === 'steps' && (
        <GuideCard
          topics={cards}
          onClose={() => {
            const [first, ...rest] = cards;
            if (first) markLearned([first]);
            setCards(rest);
          }}
        />
      )}
    </>
  );

  return (
    <Workspace
      mode='学習'
      title={title}
      toolbar={toolbar}
      highlightKinds={highlightKinds}
      highlightIds={highlightIds}
      problemIds={problemIds}
      overlay={overlay}
      fitViewOptions={LESSON_FIT}
    />
  );
}

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const found = findLesson(lessonId);
  if (!found) {
    return (
      <main className={styles.notFound}>
        <p>レッスンが見つかりません。</p>
        <Link to='/learn'>コース一覧へ</Link>
      </main>
    );
  }
  return (
    <ReactFlowProvider key={lessonId}>
      <LessonWorkspace course={found.course} lesson={found.lesson} />
    </ReactFlowProvider>
  );
}
