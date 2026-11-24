import { Link } from 'react-router';
import { PrimaryButton, SecondaryButton } from '../ui/buttons';
import { GuideView } from './GuideView';
import styles from './LessonOverlays.module.css';
import { TopicIcon } from './TopicIcon';
import { topicTitle } from './topics';
import type { Course, GuideTopic, Lesson } from './types';

const LEVEL_LABEL = { 1: '入門（手順どおり）', 2: '中級（ヒントあり）', 3: '応用（目標のみ）' };

export function LessonIntro({
  course,
  lesson,
  onStart,
}: {
  course: Course;
  lesson: Lesson;
  onStart: () => void;
}) {
  const topics = [...new Set(lesson.steps.flatMap((s) => s.introduces ?? []))];
  return (
    <div className={styles.backdrop}>
      <div className={styles.intro} role='dialog' aria-label={lesson.title}>
        <div className={styles.course}>{course.title}</div>
        <h2 className={styles.title}>{lesson.title}</h2>
        <div className={styles.meta}>
          {LEVEL_LABEL[lesson.level]}・{lesson.steps.length} ステップ
        </div>
        <p className={styles.summary}>{lesson.summary}</p>
        <h3 className={styles.heading}>このレッスンで分かること</h3>
        <ul className={styles.goals}>
          {lesson.goals.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        {topics.length > 0 && (
          <>
            <h3 className={styles.heading}>登場するもの</h3>
            <div className={styles.topics}>
              {topics.map((t) => (
                <span key={t} className={styles.topic}>
                  <TopicIcon topic={t} size={20} />
                  {topicTitle(t)}
                </span>
              ))}
            </div>
          </>
        )}
        <PrimaryButton onClick={onStart}>はじめる</PrimaryButton>
      </div>
    </div>
  );
}

/** 初めて登場したサービスの解説カード（キャンバス右下） */
export function GuideCard({ topics, onClose }: { topics: GuideTopic[]; onClose: () => void }) {
  const topic = topics[0];
  if (!topic) return null;
  return (
    <aside className={styles.card} aria-label={`${topicTitle(topic)} の解説`}>
      <div className={styles.cardLabel}>
        新しく登場: {topicTitle(topic)}
        {topics.length > 1 && <span>（ほか {topics.length - 1} 件）</span>}
      </div>
      <div className={styles.cardBody}>
        <GuideView topic={topic} variant='compact' />
      </div>
      <div className={styles.cardFooter}>
        <Link to={`/guide/${topic}`} className={styles.more}>
          図鑑で詳しく見る
        </Link>
        <SecondaryButton onClick={onClose}>{topics.length > 1 ? '次へ' : '閉じる'}</SecondaryButton>
      </div>
    </aside>
  );
}
