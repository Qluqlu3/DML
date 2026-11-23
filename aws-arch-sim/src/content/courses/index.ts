import type { Course } from '../../learning/types';
import { course0 } from './course0';

/** 公開中のコース（推奨順） */
export const COURSES: Course[] = [course0];

/** 準備中のコース（コース一覧に予告として表示する。docs/LEARNING.md 7 章） */
export const UPCOMING_COURSES: { title: string; topics: string }[] = [
  {
    title: 'Web アプリの定番構成',
    topics: 'ALB・複数 AZ・Auto Scaling・RDS・NAT Gateway・VPC エンドポイント・CloudWatch',
  },
  { title: '配信と DNS', topics: 'Route 53・S3 静的サイト・CloudFront・WAF・ACM' },
  { title: 'サーバーレス', topics: 'API Gateway・Lambda・DynamoDB・Cognito・EventBridge' },
  { title: '疎結合・非同期', topics: 'SQS・SNS・デッドレターキュー' },
  { title: 'コンテナ', topics: 'ECS Fargate・Aurora' },
  { title: 'キャッシュと性能', topics: 'ElastiCache・Aurora リーダー' },
  { title: '総まとめ', topics: 'EC サイト・サーバーレスな通知システム' },
];
