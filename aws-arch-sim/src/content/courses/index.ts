import type { Course } from '../../learning/types';
import { course0 } from './course0';
import { course1 } from './course1';
import { course2 } from './course2';
import { course3 } from './course3';
import { course4 } from './course4';
import { course5 } from './course5';
import { course6 } from './course6';
import { course7 } from './course7';

/** 公開中のコース（推奨順） */
export const COURSES: Course[] = [
  course0,
  course1,
  course2,
  course3,
  course4,
  course5,
  course6,
  course7,
];

/** 準備中のコース（コース一覧に予告として表示する。docs/LEARNING.md 7 章） */
export const UPCOMING_COURSES: { title: string; topics: string }[] = [];
