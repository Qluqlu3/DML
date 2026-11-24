import type { Course } from '../../learning/types';
import { course0 } from './course0';
import { course1 } from './course1';
import { course2 } from './course2';
import { course3 } from './course3';
import { course4 } from './course4';

/** 公開中のコース（推奨順） */
export const COURSES: Course[] = [course0, course1, course2, course3, course4];

/** 準備中のコース（コース一覧に予告として表示する。docs/LEARNING.md 7 章） */
export const UPCOMING_COURSES: { title: string; topics: string }[] = [
  { title: 'コンテナ', topics: 'ECS Fargate・Aurora' },
  { title: 'キャッシュと性能', topics: 'ElastiCache・Aurora リーダー' },
  { title: '総まとめ', topics: 'EC サイト・サーバーレスな通知システム' },
];
