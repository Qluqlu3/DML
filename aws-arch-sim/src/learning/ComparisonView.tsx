import { Link } from 'react-router';
import styles from './ComparisonView.module.css';
import { TopicIcon } from './TopicIcon';
import { topicTitle } from './topics';
import type { Comparison } from './types';

/** 図鑑の「比べて覚える」1 件ぶん（表と選び方） */
export function ComparisonView({ comparison }: { comparison: Comparison }) {
  const { title, summary, topics, columns, rows, choose } = comparison;
  return (
    <article className={styles.comparison}>
      <header>
        <span className={styles.kicker}>比べて覚える</span>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.summary}>{summary}</p>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th aria-label='項目' />
              {columns.map((c) => (
                <th key={c} scope='col'>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope='row'>{row.label}</th>
                {row.cells.map((cell, i) => (
                  <td key={columns[i]}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h4 className={styles.sectionTitle}>選び方の目安</h4>
        <ul className={styles.choose}>
          {choose.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className={styles.sectionTitle}>それぞれの解説</h4>
        <div className={styles.chips}>
          {topics.map((t) => (
            <Link key={t} to={`/guide/${t}`} className={styles.chip}>
              <TopicIcon topic={t} size={20} />
              {topicTitle(t)}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
