import { Link } from 'react-router';
import { COURSES, UPCOMING_COURSES } from '../content/courses';
import { NEW_PROGRESS, useProgressStore } from '../learning/progressStore';
import type { Lesson } from '../learning/types';
import styles from './LearnPage.module.css';

const LEVEL = { 1: '入門', 2: '中級', 3: '応用' };

function LessonCard({ lesson, number }: { lesson: Lesson; number: string }) {
  const progress = useProgressStore((s) => s.lessons[lesson.id] ?? NEW_PROGRESS);
  const status = progress.completed
    ? progress.assisted
      ? { label: '完了', className: styles.statusDone }
      : { label: '自力でクリア', className: styles.statusSelf }
    : progress.phase !== 'intro'
      ? {
          label: `途中（${Math.min(progress.stepIndex + 1, lesson.steps.length)}/${lesson.steps.length}）`,
          className: styles.statusDoing,
        }
      : null;
  return (
    <Link to={`/learn/${lesson.id}`} className={styles.lesson}>
      <div className={styles.lessonTop}>
        <span className={styles.number}>{number}</span>
        <span className={styles.level}>{LEVEL[lesson.level]}</span>
        {status && <span className={`${styles.status} ${status.className}`}>{status.label}</span>}
      </div>
      <h3 className={styles.lessonTitle}>{lesson.title}</h3>
      <p className={styles.lessonSummary}>{lesson.summary}</p>
    </Link>
  );
}

export function LearnPage() {
  const lessons = useProgressStore((s) => s.lessons);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to='/' className={styles.back}>
          ← トップ
        </Link>
        <h1 className={styles.title}>学習モード</h1>
        <p className={styles.lead}>
          指示とチェックポイントに沿って構成を組み立てながら、AWS
          のサービスと組み合わせ方を学びます。 分からない言葉は{' '}
          <Link to='/guide'>サービス図鑑</Link> でいつでも確認できます。
        </p>
      </header>

      {COURSES.map((course, ci) => {
        const done = course.lessons.filter((l) => lessons[l.id]?.completed).length;
        return (
          <section key={course.id} className={styles.course}>
            <div className={styles.courseHeader}>
              <h2 className={styles.courseTitle}>
                コース {ci}. {course.title}
              </h2>
              <span className={styles.courseProgress}>
                {done} / {course.lessons.length} 完了
              </span>
            </div>
            <p className={styles.courseDescription}>{course.description}</p>
            <div className={styles.lessons}>
              {course.lessons.map((lesson, li) => (
                <LessonCard key={lesson.id} lesson={lesson} number={`${ci}-${li + 1}`} />
              ))}
            </div>
          </section>
        );
      })}

      {UPCOMING_COURSES.length > 0 && (
        <section className={styles.course}>
          <h2 className={styles.courseTitle}>準備中のコース</h2>
          <div className={styles.upcoming}>
            {UPCOMING_COURSES.map((c, i) => (
              <div key={c.title} className={styles.upcomingItem}>
                <strong>
                  コース {COURSES.length + i}. {c.title}
                </strong>
                <span>{c.topics}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
