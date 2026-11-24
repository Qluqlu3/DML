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

const MODES = [
  {
    to: '/learn',
    title: '学習モード',
    body: '指示とチェックポイントに沿って構成を作りながら、サービスの役割と組み合わせ方を学ぶ。',
  },
  {
    to: '/challenges',
    title: '問題モード',
    body: '依頼に合う構成を自分で考えて組み立て、ルール判定で採点する。',
  },
  {
    to: '/incidents',
    title: 'インシデントモード',
    body: '障害が起きている本番構成をメトリクスとログで調べ、ターン制で構成を直して解決する。',
  },
  {
    to: '/sandbox',
    title: 'サンドボックス',
    body: 'AWS サービスを自由に配置・接続して構成図を作る。ベストプラクティスのチェックと、負荷・障害のシミュレーションつき。',
  },
  {
    to: '/guide',
    title: 'サービス図鑑',
    body: '各サービスの役割・たとえ・よくある勘違いをいつでも見返せる。',
  },
];

export function HomePage() {
  const progress = useProgressLabels();
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>AWS Arch Sim</h1>
      <p className={styles.lead}>AWS 構成図を作って学ぶシミュレーター</p>
      <div className={styles.cards}>
        {MODES.map((m) => (
          <Link key={m.to} to={m.to} className={styles.card}>
            <h2>{m.title}</h2>
            <p>{m.body}</p>
            {progress[m.to] && <span className={styles.progress}>{progress[m.to]}</span>}
          </Link>
        ))}
      </div>
      <p className={styles.note}>
        おすすめの順番: 学習モードで基本を身につけ → 問題モードで自分で組み立て →
        インシデントモードで障害対応を練習。数値は学習用の目安で、実際の AWS
        の性能・料金とは一致しません。
      </p>
    </main>
  );
}
