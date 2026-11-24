import type { Course } from '../../learning/types';
import { course0 } from './course0';
import { course1 } from './course1';
import { course2 } from './course2';

/** 公開中のコース（推奨順） */
export const COURSES: Course[] = [course0, course1, course2];

/** 準備中のコース（コース一覧に予告として表示する。docs/LEARNING.md 7 章） */
export const UPCOMING_COURSES: { title: string; topics: string }[] = [
  { title: 'サーバーレス', topics: 'API Gateway・Lambda・DynamoDB・Cognito・EventBridge' },
  { title: '疎結合・非同期', topics: 'SQS・SNS・デッドレターキュー' },
  { title: 'コンテナ', topics: 'ECS Fargate・Aurora' },
  { title: 'キャッシュと性能', topics: 'ElastiCache・Aurora リーダー' },
  { title: '総まとめ', topics: 'EC サイト・サーバーレスな通知システム' },
];
