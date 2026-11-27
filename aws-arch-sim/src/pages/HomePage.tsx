import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { useChallengeStore } from '../challenges/progressStore';
import { useIncidentStore } from '../incidents/progressStore';
import { useProgressStore } from '../learning/progressStore';
import styles from './HomePage.module.css';

/** 各モードの進み具合（保存してある記録の数だけを数え、問題データは読み込まない） */
function useProgressLabels(): Record<string, string | null> {
  const lessons = useProgressStore(
    (s) => Object.values(s.lessons).filter((l) => l.completed).length,
  );
  const learned = useProgressStore((s) => s.learned.length);
  const cleared = useChallengeStore(
    (s) => Object.values(s.challenges).filter((c) => c.cleared).length,
  );
  const solved = useIncidentStore(
    (s) => Object.values(s.incidents).filter((i) => i.everSolved).length,
  );
  return {
    '/learn': lessons ? `${lessons} レッスン完了` : null,
    '/guide': learned ? `${learned} 件を学習済み` : null,
    '/challenges': cleared ? `${cleared} 問クリア` : null,
    '/incidents': solved ? `${solved} 件解決` : null,
  };
}

/** step: おすすめの順番（学習 → 問題 → インシデント）。color: カード上端の帯とラベルの色 */
const MODES = [
  {
    to: '/learn',
    title: '学習モード',
    step: 1,
    color: '#4ea3ff',
    body: '指示とチェックポイントに沿って構成を作りながら、サービスの役割と組み合わせ方を学ぶ。',
  },
  {
    to: '/challenges',
    title: '問題モード',
    step: 2,
    color: '#ff9900',
    body: '依頼に合う構成を自分で考えて組み立て、ルール判定で採点する。',
  },
  {
    to: '/incidents',
    title: 'インシデントモード',
    step: 3,
    color: '#ff6b5a',
    body: '障害が起きている本番構成をメトリクスとログで調べ、ターン制で構成を直して解決する。',
  },
  {
    to: '/sandbox',
    title: 'サンドボックス',
    color: '#6fd36f',
    body: 'AWS サービスを自由に配置・接続して構成図を作る。ベストプラクティスのチェックと、負荷・障害のシミュレーションつき。',
  },
  {
    to: '/guide',
    title: 'サービス図鑑',
    color: '#b18cff',
    body: '各サービスの役割・たとえ・よくある勘違いをいつでも見返せる。',
  },
];

function ModeCard({ mode, progress }: { mode: (typeof MODES)[number]; progress: string | null }) {
  return (
    <Link
      to={mode.to}
      className={styles.card}
      style={{ '--mode-color': mode.color } as CSSProperties}
    >
      <span className={styles.step}>{mode.step ? `STEP ${mode.step}` : 'いつでも'}</span>
      <h2>{mode.title}</h2>
      <p>{mode.body}</p>
      {progress && <span className={styles.progress}>{progress}</span>}
      <span className={styles.go} aria-hidden>
        →
      </span>
    </Link>
  );
}

export function HomePage() {
  const progress = useProgressLabels();
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>
          AWS <span className={styles.titleAccent}>Arch</span> Sim
        </h1>
        <p className={styles.lead}>
          AWS のサービスをボックスとして置き、線でつないで構成図を作りながら学ぶシミュレーター
        </p>
      </header>

      <h2 className={styles.sectionTitle}>おすすめの順番</h2>
      <div className={styles.path}>
        {MODES.filter((m) => m.step).map((m) => (
          <ModeCard key={m.to} mode={m} progress={progress[m.to] ?? null} />
        ))}
      </div>

      <h2 className={styles.sectionTitle}>自由に使う</h2>
      <div className={styles.cards}>
        {MODES.filter((m) => !m.step).map((m) => (
          <ModeCard key={m.to} mode={m} progress={progress[m.to] ?? null} />
        ))}
      </div>

      <p className={styles.note}>数値は学習用の目安で、実際の AWS の性能・料金とは一致しません。</p>
    </main>
  );
}
