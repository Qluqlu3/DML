import { Link } from 'react-router';
import { Stars } from '../challenges/ChallengePanel';
import { INCIDENTS } from '../incidents/incidents';
import { NEW_INCIDENT, useIncidentStore } from '../incidents/progressStore';
import type { Incident } from '../incidents/types';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './LearnPage.module.css';

function IncidentCard({ incident, number }: { incident: Incident; number: number }) {
  const progress = useIncidentStore((s) => s.incidents[incident.id] ?? NEW_INCIDENT);
  const status = progress.everSolved
    ? progress.bestScore !== undefined
      ? { label: `解決・${progress.bestScore} 点`, tone: 'self' as const }
      : { label: '解決', tone: 'done' as const }
    : progress.turns.length > 0 || progress.hintsUsed > 0
      ? { label: `対応中（${progress.turns.length} ターン）`, tone: 'doing' as const }
      : null;
  return (
    <Link
      to={`/incidents/${incident.id}`}
      className={`${styles.lesson} ${progress.everSolved ? styles.cleared : ''}`}
    >
      <div className={styles.lessonTop}>
        <span className={styles.number}>インシデント {number}</span>
        <Stars n={incident.difficulty} />
        {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      </div>
      <h3 className={styles.lessonTitle}>{incident.title}</h3>
      <p className={styles.lessonSummary}>{incident.summary}</p>
    </Link>
  );
}

export function IncidentsPage() {
  const solved = useIncidentStore(
    (s) => INCIDENTS.filter((i) => s.incidents[i.id]?.everSolved).length,
  );
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to='/' className={styles.back}>
          ← トップ
        </Link>
        <h1 className={styles.title}>インシデントモード</h1>
        <p className={styles.lead}>
          障害が起きている本番構成を調べて、構成の変更で直します。ノードを選んでメトリクスとログを調べ（何度でも）、構成を変えて「変更を適用」するとターンを
          1 つ使って結果が出ます。少ないターン・ヒントで、過剰な増強をせずに解決するほど高得点です。
        </p>
        <p className={styles.lead}>
          ※ 数値は学習用の目安で、実際の AWS の性能や料金とは一致しません。
        </p>
      </header>
      <section className={styles.course}>
        <div className={styles.courseHeader}>
          <h2 className={styles.courseTitle}>インシデント一覧</h2>
          <ProgressBar done={solved} total={INCIDENTS.length} />
          <span className={styles.courseProgress}>
            {solved} / {INCIDENTS.length} 解決
          </span>
        </div>
        <div className={styles.lessons}>
          {INCIDENTS.map((incident, i) => (
            <IncidentCard key={incident.id} incident={incident} number={i + 1} />
          ))}
        </div>
      </section>
    </main>
  );
}
