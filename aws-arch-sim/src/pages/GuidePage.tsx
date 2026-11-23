import { Link, useParams } from 'react-router';
import { GUIDES } from '../content/guides';
import { GuideView } from '../learning/GuideView';
import { useProgressStore } from '../learning/progressStore';
import { TopicIcon } from '../learning/TopicIcon';
import { ALL_TOPICS, topicTitle } from '../learning/topics';
import type { GuideTopic } from '../learning/types';
import styles from './GuidePage.module.css';

export function GuidePage() {
  const { topic } = useParams();
  const learned = useProgressStore((s) => s.learned);
  const selected = ALL_TOPICS.includes(topic as GuideTopic) ? (topic as GuideTopic) : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.nav}>
          <Link to='/'>トップ</Link>
          <Link to='/learn'>学習モード</Link>
        </div>
        <h1 className={styles.title}>サービス図鑑</h1>
        <p className={styles.lead}>
          学習モードで出てきたサービスには「学習済み」の印が付きます。
          {GUIDES &&
            `解説がそろっているのは ${Object.keys(GUIDES).length} 件で、順次追加していきます。`}
        </p>
      </header>
      <div className={styles.columns}>
        <nav className={styles.list} aria-label='サービス一覧'>
          {ALL_TOPICS.map((t) => (
            <Link
              key={t}
              to={`/guide/${t}`}
              className={`${styles.item} ${t === selected ? styles.active : ''}`}
            >
              <TopicIcon topic={t} size={24} />
              <span className={styles.itemTitle}>{topicTitle(t)}</span>
              {learned.includes(t) && <span className={styles.learned}>学習済み</span>}
              {!GUIDES[t] && <span className={styles.pending}>準備中</span>}
            </Link>
          ))}
        </nav>
        <section className={styles.detail}>
          {selected ? (
            <GuideView topic={selected} variant='full' />
          ) : (
            <p className={styles.placeholder}>左の一覧からサービスを選んでください。</p>
          )}
        </section>
      </div>
    </main>
  );
}
