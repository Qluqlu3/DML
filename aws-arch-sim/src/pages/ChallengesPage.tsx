import { Link } from 'react-router';
import { Stars } from '../challenges/ChallengePanel';
import { CHALLENGES } from '../challenges/challenges';
import { NEW_CHALLENGE, useChallengeStore } from '../challenges/progressStore';
import type { Challenge } from '../challenges/types';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './LearnPage.module.css';

function ChallengeCard({ challenge, number }: { challenge: Challenge; number: number }) {
  const progress = useChallengeStore((s) => s.challenges[challenge.id] ?? NEW_CHALLENGE);
  const status = progress.cleared
    ? progress.bestScore !== undefined
      ? { label: `クリア・${progress.bestScore} 点`, tone: 'self' as const }
      : { label: 'クリア', tone: 'done' as const }
    : progress.submissions > 0 || progress.hintsUsed > 0
      ? { label: '挑戦中', tone: 'doing' as const }
      : null;
  return (
    <Link
      to={`/challenges/${challenge.id}`}
      className={`${styles.lesson} ${progress.cleared ? styles.cleared : ''}`}
    >
      <div className={styles.lessonTop}>
        <span className={styles.number}>問題 {number}</span>
        <Stars n={challenge.difficulty} />
        {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      </div>
      <h3 className={styles.lessonTitle}>{challenge.title}</h3>
      <p className={styles.lessonSummary}>{challenge.summary}</p>
      {challenge.budgetUsd !== undefined && (
        <p className={styles.lessonSummary}>予算: 月 ${challenge.budgetUsd}</p>
      )}
    </Link>
  );
}

export function ChallengesPage() {
  const cleared = useChallengeStore(
    (s) => CHALLENGES.filter((c) => s.challenges[c.id]?.cleared).length,
  );
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to='/' className={styles.back}>
          ← トップ
        </Link>
        <h1 className={styles.title}>問題モード</h1>
        <p className={styles.lead}>
          依頼に合う構成を自分で考えて組み立て、「提出」で判定します。正解は 1
          つではありません。必須要件をすべて満たせばクリアで、推奨要件・予算・ヒントの使用数で点数が決まります。
          学習モードで学んだことを試す場として使ってください。
        </p>
      </header>
      <section className={styles.course}>
        <div className={styles.courseHeader}>
          <h2 className={styles.courseTitle}>問題一覧</h2>
          <ProgressBar done={cleared} total={CHALLENGES.length} />
          <span className={styles.courseProgress}>
            {cleared} / {CHALLENGES.length} クリア
          </span>
        </div>
        <div className={styles.lessons}>
          {CHALLENGES.map((c, i) => (
            <ChallengeCard key={c.id} challenge={c} number={i + 1} />
          ))}
        </div>
      </section>
    </main>
  );
}
