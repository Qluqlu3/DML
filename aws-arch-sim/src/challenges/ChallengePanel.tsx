import { useState } from 'react';
import { Link } from 'react-router';
import base from '../learning/GuidePanel.module.css';
import { RichText } from '../learning/RichText';
import { TopicIcon } from '../learning/TopicIcon';
import { topicTitle } from '../learning/topics';
import styles from './ChallengePanel.module.css';
import { type Evaluation, HINT_PENALTY, type RuleOutcome, type Score } from './challenges';
import type { ChallengeProgress } from './progressStore';
import type { Challenge } from './types';

export type Submission = { evaluation: Evaluation; score: Score; stale: boolean };

type ChallengePanelProps = {
  challenge: Challenge;
  number: number;
  next: Challenge | null;
  progress: ChallengeProgress;
  /** 今の構成の月額概算（常に更新） */
  costUsd: number;
  /** 直近の提出結果。結果を閉じているときは null */
  result: Submission | null;
  viewingAnswer: boolean;
  onSubmit: () => void;
  onCloseResult: () => void;
  onHint: () => void;
  onViewAnswer: () => void;
  onBackToMine: () => void;
};

export function Stars({ n }: { n: 1 | 2 | 3 }) {
  return (
    <span className={styles.stars} role='img' aria-label={`難易度 ${n} / 3`}>
      {'★'.repeat(n)}
      <span className={styles.starsOff}>{'★'.repeat(3 - n)}</span>
    </span>
  );
}

function CostMeter({ cost, budget }: { cost: number; budget?: number }) {
  if (budget === undefined) {
    return (
      <div className={styles.cost}>
        <span>月額の概算</span>
        <strong>${cost.toLocaleString()}</strong>
      </div>
    );
  }
  const over = cost > budget;
  const ratio = Math.min(cost / budget, 1);
  return (
    <div className={styles.cost}>
      <span>月額の概算</span>
      <strong className={over ? styles.over : undefined}>
        ${cost.toLocaleString()} / 予算 ${budget.toLocaleString()}
      </strong>
      <span className={styles.meter} aria-hidden>
        <span
          className={over ? styles.meterOver : styles.meterFill}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
    </div>
  );
}

function Hints({
  challenge,
  used,
  onHint,
}: {
  challenge: Challenge;
  used: number;
  onHint: () => void;
}) {
  const shown = challenge.hints.slice(0, used);
  return (
    <div className={base.help}>
      {shown.map((h, i) => (
        <p key={h} className={base.hint}>
          <span className={base.hintLabel}>ヒント {i + 1}</span>
          {h}
        </p>
      ))}
      {used < challenge.hints.length && (
        <div className={base.helpButtons}>
          <button type='button' className={base.secondary} onClick={onHint}>
            ヒントを見る（−{HINT_PENALTY} 点）
          </button>
        </div>
      )}
    </div>
  );
}

function Checklist({ title, outcomes }: { title: string; outcomes: RuleOutcome[] }) {
  const passed = outcomes.filter((o) => o.result.pass).length;
  return (
    <div>
      <div className={styles.listTitle}>
        {title}
        <span>
          {passed} / {outcomes.length}
        </span>
      </div>
      <ul className={base.checklist}>
        {outcomes.map(({ rule, result }) => (
          <li key={rule.id} className={result.pass ? base.done : undefined}>
            <span className={base.mark} aria-hidden>
              {result.pass ? '✓' : ''}
            </span>
            <span>
              {rule.label}
              {/* 「〜がありません」は答えを教えてしまうので出さない */}
              {!result.pass && result.message && !result.message.endsWith('がありません') && (
                <span className={base.reason}>{result.message}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Topics({ challenge }: { challenge: Challenge }) {
  return (
    <div className={base.topics}>
      {challenge.topics.map((t) => (
        <Link key={t} to={`/guide/${t}`} className={`${base.topic} ${styles.topicLink}`}>
          <TopicIcon topic={t} size={18} />
          {topicTitle(t)}
        </Link>
      ))}
    </div>
  );
}

function ResultView(props: ChallengePanelProps & { result: Submission }) {
  const { challenge, result, progress, next } = props;
  const { evaluation, score } = result;
  const counted = evaluation.cleared && !progress.answerViewed;
  return (
    <div className={base.body}>
      {evaluation.cleared ? (
        <div className={base.cleared}>
          <div className={base.clearedTitle}>クリア！</div>
          {counted ? (
            <>
              <div className={styles.score}>
                <strong>{score.total}</strong> 点
                {progress.bestScore !== undefined && (
                  <span className={styles.best}>ベスト {progress.bestScore} 点</span>
                )}
              </div>
              <ul className={styles.parts}>
                {score.parts.map((p) => (
                  <li key={p.label}>
                    <span>{p.label}</span>
                    <span>{p.points > 0 ? `+${p.points}` : p.points}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <span className={styles.note}>
              模範解答を見たあとの挑戦なので、点数は記録されません。
            </span>
          )}
        </div>
      ) : (
        <div className={styles.failed}>
          <strong>まだ要件を満たしていません</strong>
          <span>赤く光っているノードを確認して、構成を直してから再提出しましょう。</span>
        </div>
      )}
      {result.stale && (
        <p className={styles.stale}>提出後に構成を変更しました。結果は提出時点のものです。</p>
      )}

      <Checklist title='必須要件' outcomes={evaluation.required} />
      <Checklist title='推奨（加点）' outcomes={evaluation.recommended} />
      <CostMeter cost={evaluation.costUsd} budget={challenge.budgetUsd} />

      {evaluation.cleared ? (
        <>
          <div className={base.whyLabel}>解説</div>
          <RichText text={challenge.explanation} className={base.why} />
          <Topics challenge={challenge} />
          <div className={base.helpButtons}>
            <button type='button' className={base.secondary} onClick={props.onViewAnswer}>
              模範解答を見る
            </button>
            <button type='button' className={base.secondary} onClick={props.onCloseResult}>
              構成に戻る
            </button>
          </div>
          {next ? (
            <Link to={`/challenges/${next.id}`} className={base.primaryLink}>
              次の問題へ: {next.title}
            </Link>
          ) : (
            <Link to='/challenges' className={base.primaryLink}>
              問題一覧へ
            </Link>
          )}
        </>
      ) : (
        <>
          <Hints challenge={challenge} used={progress.hintsUsed} onHint={props.onHint} />
          <button type='button' className={base.primary} onClick={props.onCloseResult}>
            構成を直す
          </button>
        </>
      )}
    </div>
  );
}

function BriefView(props: ChallengePanelProps) {
  const { challenge, progress, number } = props;
  return (
    <div className={base.body}>
      <div className={styles.meta}>
        <span className={base.stepLabel}>問題 {number}</span>
        <Stars n={challenge.difficulty} />
        {progress.cleared && (
          <span className={styles.clearedBadge}>
            クリア済み{progress.bestScore !== undefined ? `・ベスト ${progress.bestScore} 点` : ''}
          </span>
        )}
      </div>
      <h2 className={base.stepTitle}>{challenge.title}</h2>
      <RichText text={challenge.brief} className={base.instruction} />
      <CostMeter cost={props.costUsd} budget={challenge.budgetUsd} />
      <Hints challenge={challenge} used={progress.hintsUsed} onHint={props.onHint} />
      <div className={styles.actions}>
        <button type='button' className={base.primary} onClick={props.onSubmit}>
          提出する
        </button>
        <button type='button' className={base.secondary} onClick={props.onViewAnswer}>
          模範解答を見る
        </button>
      </div>
      {progress.answerViewed && !progress.cleared && (
        <p className={styles.note}>模範解答を見たため、この挑戦の点数は記録されません。</p>
      )}
    </div>
  );
}

function AnswerView(props: ChallengePanelProps) {
  return (
    <div className={base.body}>
      <div className={styles.answerBanner}>
        <strong>模範解答を表示しています</strong>
        <span>この表示で編集した内容は保存されません。自分の構成は保存してあります。</span>
      </div>
      <button type='button' className={base.primary} onClick={props.onBackToMine}>
        自分の構成に戻る
      </button>
      <div className={base.whyLabel}>解説</div>
      <RichText text={props.challenge.explanation} className={base.why} />
      <Topics challenge={props.challenge} />
    </div>
  );
}

/** 問題モードの左上パネル。依頼文・提出結果・模範解答の表示を切り替える */
export function ChallengePanel(props: ChallengePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section className={`${base.panel} ${collapsed ? base.collapsed : ''}`} aria-label='問題'>
      <header className={base.panelHeader}>
        <span className={base.panelTitle}>{props.challenge.title}</span>
        <button
          type='button'
          className={base.collapse}
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
        >
          {collapsed ? '開く' : 'たたむ'}
        </button>
      </header>
      {!collapsed &&
        (props.viewingAnswer ? (
          <AnswerView {...props} />
        ) : props.result ? (
          <ResultView {...props} result={props.result} />
        ) : (
          <BriefView {...props} />
        ))}
    </section>
  );
}
