import { Link } from 'react-router';
import { comparisonsFor } from '../content/comparisons';
import { GLOSSARY } from '../content/glossary';
import { GUIDES } from '../content/guides';
import styles from './GuideView.module.css';
import { TopicIcon } from './TopicIcon';
import {
  connectionsOf,
  lessonsFor,
  placementText,
  topicColor,
  topicDescription,
  topicTitle,
} from './topics';
import type { GuideTopic } from './types';

type Props = {
  topic: GuideTopic;
  /** compact: 学習中に出すカード（主要項目のみ）/ full: 図鑑の詳細 */
  variant: 'compact' | 'full';
};

export function GuideView({ topic, variant }: Props) {
  const guide = GUIDES[topic];
  const full = variant === 'full';
  const placement = placementText(topic);
  const { to, from } = connectionsOf(topic);
  const comparisons = comparisonsFor(topic);
  const terms = GLOSSARY.filter((t) => t.topics?.includes(topic));
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

      {full && placement && (
        <section>
          <h4 className={styles.sectionTitle}>キャンバスでの置き場所</h4>
          <p className={styles.text}>{placement}</p>
        </section>
      )}
      {full && to.length > 0 && <TopicChips title='線でつなげる先' topics={to} />}
      {full && from.length > 0 && <TopicChips title='線でつながってくる元' topics={from} />}

      {comparisons.length > 0 && (
        <section>
          <h4 className={styles.sectionTitle}>比べて覚える</h4>
          <ul className={styles.list}>
            {comparisons.map((c) => (
              <li key={c.id}>
                <Link to={`/guide/compare/${c.id}`}>{c.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {full && terms.length > 0 && (
        <section>
          <h4 className={styles.sectionTitle}>関係する用語</h4>
          <div className={styles.chips}>
            {terms.map((t) => (
              <Link
                key={t.id}
                to={`/guide/terms?term=${t.id}`}
                className={`${styles.chip} ${styles.termChip}`}
              >
                {t.term}
              </Link>
            ))}
          </div>
        </section>
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

function TopicChips({ title, topics }: { title: string; topics: GuideTopic[] }) {
  return (
    <section>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <div className={styles.chips}>
        {topics.map((t) => (
          <Link key={t} to={`/guide/${t}`} className={styles.chip}>
            <TopicIcon topic={t} size={18} />
            {topicTitle(t)}
          </Link>
        ))}
      </div>
    </section>
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
