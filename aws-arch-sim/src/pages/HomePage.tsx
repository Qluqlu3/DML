import { Link } from 'react-router';
import styles from './HomePage.module.css';

const MODES = [
  {
    to: '/sandbox',
    title: 'サンドボックス',
    body: 'AWS サービスを自由に配置・接続して構成図を作る。',
    ready: true,
  },
  {
    to: '/learn',
    title: '学習モード',
    body: '指示とチェックポイントに沿って構成を作りながら、サービスの役割と組み合わせ方を学ぶ。',
    ready: true,
  },
  {
    to: '/guide',
    title: 'サービス図鑑',
    body: '各サービスの役割・たとえ・よくある勘違いをいつでも見返せる。',
    ready: true,
  },
  {
    to: '/challenges',
    title: '問題モード',
    body: '要件に合う構成を組み立て、ルール判定で採点する。',
    ready: false,
  },
  {
    to: '/incidents',
    title: 'インシデントモード',
    body: '障害が起きている本番構成を調査し、構成変更で解決する。',
    ready: false,
  },
];

export function HomePage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>AWS Arch Sim</h1>
      <p className={styles.lead}>AWS 構成図を作って学ぶシミュレーター</p>
      <div className={styles.cards}>
        {MODES.map((m) =>
          m.ready ? (
            <Link key={m.to} to={m.to} className={styles.card}>
              <h2>{m.title}</h2>
              <p>{m.body}</p>
            </Link>
          ) : (
            <div key={m.to} className={`${styles.card} ${styles.disabled}`}>
              <h2>{m.title}</h2>
              <p>{m.body}</p>
              <span className={styles.soon}>準備中</span>
            </div>
          ),
        )}
      </div>
    </main>
  );
}
