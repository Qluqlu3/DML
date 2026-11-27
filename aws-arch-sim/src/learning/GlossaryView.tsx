import { useEffect } from 'react';
import { Link } from 'react-router';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '../content/glossary';
import styles from './GlossaryView.module.css';
import { TopicIcon } from './TopicIcon';
import { topicTitle } from './topics';
import type { GlossaryTerm } from './types';

/** 検索語に当てはまる用語（用語・別名・説明のどれかに含まれる） */
export function matchTerms(query: string): GlossaryTerm[] {
  const q = query.trim().toLowerCase();
  if (!q) return GLOSSARY;
  return GLOSSARY.filter((t) =>
    [t.term, t.aka ?? '', t.description].some((s) => s.toLowerCase().includes(q)),
  );
}

/** 用語集。focusId の用語までスクロールして目立たせる */
export function GlossaryView({ query, focusId }: { query: string; focusId?: string | null }) {
  const terms = matchTerms(query);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`term-${focusId}`)?.scrollIntoView({ block: 'center' });
  }, [focusId]);

  return (
    <article className={styles.glossary}>
      <header>
        <h3 className={styles.title}>用語集</h3>
        <p className={styles.lead}>
          レッスンや問題に出てくる用語を、分野ごとに短く説明しています。サービスそのものの説明は、左の一覧から各サービスのページを見てください。
        </p>
      </header>
      {terms.length === 0 && (
        <p className={styles.empty}>「{query}」に当てはまる用語はありません。</p>
      )}
      {GLOSSARY_CATEGORIES.map((cat) => {
        const items = terms.filter((t) => t.category === cat.id);
        if (!items.length) return null;
        return (
          <section key={cat.id} className={styles.group}>
            <h4 className={styles.groupTitle}>{cat.label}</h4>
            <dl className={styles.list}>
              {items.map((t) => (
                <div
                  key={t.id}
                  id={`term-${t.id}`}
                  className={`${styles.item} ${t.id === focusId ? styles.focused : ''}`}
                >
                  <dt className={styles.term}>
                    {t.term}
                    {t.aka && <span className={styles.aka}>{t.aka}</span>}
                  </dt>
                  <dd className={styles.description}>
                    {t.description}
                    {t.topics && t.topics.length > 0 && (
                      <span className={styles.topics}>
                        {t.topics.map((topic) => (
                          <Link key={topic} to={`/guide/${topic}`} className={styles.topic}>
                            <TopicIcon topic={topic} size={16} />
                            {topicTitle(topic)}
                          </Link>
                        ))}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </article>
  );
}
