import { Link } from 'react-router';
import { GUIDES } from '../content/guides';
import styles from './GuideView.module.css';
import { TopicIcon } from './TopicIcon';
import { lessonsFor, topicColor, topicDescription, topicTitle } from './topics';
import type { GuideTopic } from './types';

type Props = {
  topic: GuideTopic;
  /** compact: 学習中に出すカード（主要項目のみ）/ full: 図鑑の詳細 */
  variant: 'compact' | 'full';
};

export function GuideView({ topic, variant }: Props) {
  const guide = GUIDES[topic];
  const full = variant === 'full';
  return (
    <article
      className={`${styles.guide} ${full ? styles.full : ''}`}
      style={{ '--topic-color': topicColor(topic) } as React.CSSProperties}
    >
      <header className={styles.header}>
        <TopicIcon topic={topic} size={full ? 48 : 36} />
        <div>
          <h3 className={styles.title}>{topicTitle(topic)}</h3>
          <p className={styles.tagline}>{guide?.tagline ?? topicDescription(topic)}</p>
        </div>
      </header>

      {guide ? (
        <>
          <p className={styles.analogy}>
            <span className={styles.analogyLabel}>たとえるなら</span>
            {guide.analogy}
          </p>
          <Section title='できること' items={guide.whatItDoes} />
          {full && <Section title='こんなときに使う' items={guide.whenToUse} />}
          <Section title='よくある勘違い・落とし穴' items={guide.pitfalls} tone='warn' />
          {full && (
            <section>
              <h4 className={styles.sectionTitle}>料金の考え方</h4>
              <p className={styles.text}>{guide.pricing}</p>
            </section>
          )}
          {full && guide.related.length > 0 && (
            <section>
              <h4 className={styles.sectionTitle}>一緒に使うことが多いもの</h4>
              <div className={styles.chips}>
                {guide.related.map((r) => (
                  <Link key={r} to={`/guide/${r}`} className={styles.chip}>
                    <TopicIcon topic={r} size={18} />
                    {topicTitle(r)}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <p className={styles.text}>詳しい解説は準備中です。</p>
      )}

      {full && lessonsFor(topic).length > 0 && (
        <section>
          <h4 className={styles.sectionTitle}>このテーマを学べるレッスン</h4>
          <ul className={styles.list}>
            {lessonsFor(topic).map((l) => (
              <li key={l.id}>
                <Link to={`/learn/${l.id}`}>{l.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone?: 'warn' }) {
  return (
    <section>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <ul className={`${styles.list} ${tone === 'warn' ? styles.warn : ''}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
