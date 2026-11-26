import { useState } from 'react';
import { Link } from 'react-router';
import {
  ChipButton,
  ChoiceButton,
  CollapseButton,
  PrimaryButton,
  SecondaryButton,
} from '../ui/buttons';
import styles from './GuidePanel.module.css';
import { describeOp, nextLesson, type StepEvaluation } from './lessons';
import type { LessonProgress } from './progressStore';
import { RichText } from './RichText';
import { TopicIcon } from './TopicIcon';
import { topicTitle } from './topics';
import type { GuideTopic, Lesson, QuizQuestion, Step } from './types';

/** 同じ文が並んでも重ならないキーを付ける（静的な一覧用） */
function uniqueKeys(texts: string[]): { key: string; text: string }[] {
  const seen = new Map<string, number>();
  return texts.map((text) => {
    const n = (seen.get(text) ?? 0) + 1;
    seen.set(text, n);
    return { key: `${text}#${n}`, text };
  });
}

type StepViewProps = {
  lesson: Lesson;
  step: Step;
  index: number;
  evaluation: StepEvaluation;
  onNext: () => void;
  onShowGuide: (topic: GuideTopic) => void;
  onRevealAnswer: () => void;
  onApplyAnswer: () => void;
};

function StepView({
  lesson,
  step,
  index,
  evaluation,
  onNext,
  onShowGuide,
  onRevealAnswer,
  onApplyAnswer,
}: StepViewProps) {
  const hintsOpen = lesson.level === 1;
  const [hintCount, setHintCount] = useState(hintsOpen ? step.hints.length : 0);
  const [answerShown, setAnswerShown] = useState(false);
  const last = index === lesson.steps.length - 1;

  return (
    <div className={styles.body}>
      <div className={styles.stepLabel}>
        ステップ {index + 1} / {lesson.steps.length}
      </div>
      <h2 className={styles.stepTitle}>{step.title}</h2>
      <RichText text={step.instruction} className={styles.instruction} />

      {step.introduces && step.introduces.length > 0 && (
        <div className={styles.topics}>
          {step.introduces.map((t) => (
            <ChipButton key={t} onClick={() => onShowGuide(t)}>
              <TopicIcon topic={t} size={18} />
              {topicTitle(t)} とは？
            </ChipButton>
          ))}
        </div>
      )}

      <ul className={styles.checklist}>
        {evaluation.current.map(({ checkpoint, result }) => (
          <li key={checkpoint.id} className={result.pass ? styles.done : styles.todo}>
            <span className={styles.mark} aria-hidden>
              {result.pass ? '✓' : ''}
            </span>
            <span>
              {checkpoint.label}
              {/* 置き場所違いなど「直すべきノードがある」ときだけ理由を出す */}
              {!result.pass && result.nodeIds?.length ? (
                <span className={styles.reason}>{result.message}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {evaluation.regressions.length > 0 && (
        <div className={styles.regression} role='alert'>
          <strong>前のステップの条件が崩れています</strong>
          <ul>
            {evaluation.regressions.map(({ checkpoint, result }) => (
              <li key={checkpoint.id}>
                {checkpoint.label}
                {result.message && <span className={styles.reason}>{result.message}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.cleared && evaluation.regressions.length === 0 ? (
        <div className={styles.cleared}>
          <div className={styles.clearedTitle}>クリア！</div>
          <div className={styles.whyLabel}>なぜこうするの？</div>
          <RichText text={step.why} className={styles.why} />
          {step.badExample && (
            <>
              <div className={styles.badLabel}>こうしないと…</div>
              <RichText text={step.badExample} className={styles.why} />
            </>
          )}
          <PrimaryButton onClick={onNext}>
            {last ? '理解チェックへ' : '次のステップへ'}
          </PrimaryButton>
        </div>
      ) : (
        <div className={styles.help}>
          {step.hints.slice(0, hintCount).map((h) => (
            <p key={h} className={styles.hint}>
              <span className={styles.hintLabel}>ヒント</span>
              {h}
            </p>
          ))}
          <div className={styles.helpButtons}>
            {hintCount < step.hints.length && (
              <SecondaryButton onClick={() => setHintCount(hintCount + 1)}>
                ヒントを見る（{hintCount + 1}/{step.hints.length}）
              </SecondaryButton>
            )}
            {!answerShown && (
              <SecondaryButton
                onClick={() => {
                  setAnswerShown(true);
                  onRevealAnswer();
                }}
              >
                答えを見る
              </SecondaryButton>
            )}
          </div>
          {answerShown && (
            <div className={styles.answer}>
              <div className={styles.hintLabel}>答え</div>
              <ol>
                {uniqueKeys(step.answer.map(describeOp)).map(({ key, text }) => (
                  <li key={key}>{text}</li>
                ))}
              </ol>
              <SecondaryButton onClick={onApplyAnswer}>自動で配置する</SecondaryButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Quiz({
  questions,
  onFinish,
}: {
  questions: QuizQuestion[];
  onFinish: (correct: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const q = questions[index];
  if (!q) return null;
  const last = index === questions.length - 1;

  return (
    <div className={styles.body}>
      <div className={styles.stepLabel}>
        理解チェック {index + 1} / {questions.length}
      </div>
      <h2 className={styles.stepTitle}>{q.question}</h2>
      <div className={styles.choices}>
        {q.choices.map((c, i) => {
          const result =
            chosen === null
              ? undefined
              : c.correct
                ? 'correct'
                : chosen === i
                  ? 'wrong'
                  : undefined;
          return (
            <ChoiceButton
              key={c.text}
              result={result}
              disabled={chosen !== null}
              onClick={() => {
                setChosen(i);
                if (c.correct) setCorrect(correct + 1);
              }}
            >
              {c.text}
              {chosen !== null && (chosen === i || c.correct) && (
                <span className={styles.explanation}>{c.explanation}</span>
              )}
            </ChoiceButton>
          );
        })}
      </div>
      {chosen !== null && (
        <PrimaryButton
          onClick={() => {
            if (last) {
              onFinish(correct);
            } else {
              setIndex(index + 1);
              setChosen(null);
            }
          }}
        >
          {last ? '結果を見る' : '次の問題へ'}
        </PrimaryButton>
      )}
    </div>
  );
}

function Done({
  lesson,
  progress,
  onRestart,
}: {
  lesson: Lesson;
  progress: LessonProgress;
  onRestart: () => void;
}) {
  const next = nextLesson(lesson.id);
  return (
    <div className={styles.body}>
      <div className={styles.clearedTitle}>レッスン完了！</div>
      <div className={styles.badges}>
        {!progress.assisted && <span className={styles.selfBadge}>自力でクリア</span>}
        {progress.quizTotal !== undefined && (
          <span className={styles.scoreBadge}>
            理解チェック {progress.quizCorrect} / {progress.quizTotal} 問正解
          </span>
        )}
      </div>
      <RichText text={lesson.wrapUp} className={styles.instruction} />
      <div className={styles.helpButtons}>
        {next && (
          <PrimaryButton asChild>
            <Link to={`/learn/${next.id}`}>次のレッスン: {next.title}</Link>
          </PrimaryButton>
        )}
        <SecondaryButton asChild>
          <Link to='/learn'>コース一覧へ</Link>
        </SecondaryButton>
        <SecondaryButton onClick={onRestart}>もう一度やる</SecondaryButton>
      </div>
    </div>
  );
}

type GuidePanelProps = {
  lesson: Lesson;
  progress: LessonProgress;
  evaluation: StepEvaluation;
  onNext: () => void;
  onShowGuide: (topic: GuideTopic) => void;
  onRevealAnswer: () => void;
  onApplyAnswer: () => void;
  onQuizFinish: (correct: number) => void;
  onRestart: () => void;
};

/** キャンバス左上に重ねる学習ガイド */
export function GuidePanel(props: GuidePanelProps) {
  const { lesson, progress } = props;
  const [collapsed, setCollapsed] = useState(false);
  const step = lesson.steps[progress.stepIndex];

  return (
    <section
      className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`}
      aria-label='学習ガイド'
    >
      <header className={styles.panelHeader}>
        <span className={styles.panelTitle}>{lesson.title}</span>
        <CollapseButton onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
          {collapsed ? '開く' : 'たたむ'}
        </CollapseButton>
      </header>
      {!collapsed && progress.phase === 'steps' && step && (
        <StepView
          key={step.id}
          lesson={lesson}
          step={step}
          index={progress.stepIndex}
          evaluation={props.evaluation}
          onNext={props.onNext}
          onShowGuide={props.onShowGuide}
          onRevealAnswer={props.onRevealAnswer}
          onApplyAnswer={props.onApplyAnswer}
        />
      )}
      {!collapsed && progress.phase === 'quiz' && (
        <Quiz questions={lesson.quiz} onFinish={props.onQuizFinish} />
      )}
      {!collapsed && progress.phase === 'done' && (
        <Done lesson={lesson} progress={progress} onRestart={props.onRestart} />
      )}
    </section>
  );
}
