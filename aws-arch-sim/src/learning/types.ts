import type { AnswerOp } from '../engine/answers';
import type { NodeKind } from '../engine/catalog';
import type { ArchDocument } from '../engine/document';
import type { Rule } from '../engine/rules/predicates';
import type { Selector } from '../engine/rules/selector';

/** 解説カードの対象。サービス・枠に加えて、ノードではない概念（SG）も扱う */
export type GuideTopic = NodeKind | 'sg';

export type ServiceGuide = {
  topic: GuideTopic;
  title: string;
  /** 一言で */
  tagline: string;
  /** 身近な例え */
  analogy: string;
  whatItDoes: string[];
  whenToUse: string[];
  /** 何に対して課金されるか */
  pricing: string;
  pitfalls: string[];
  related: GuideTopic[];
};

export type Course = {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
};

/** 1 = 具体的に指示しハイライト / 2 = パレットだけハイライト / 3 = 目標のみ */
export type LessonLevel = 1 | 2 | 3;

export type Lesson = {
  id: string;
  title: string;
  level: LessonLevel;
  summary: string;
  goals: string[];
  start: LessonStart;
  steps: Step[];
  quiz: QuizQuestion[];
  wrapUp: string;
};

export type LessonStart =
  | { from: 'empty' }
  | { from: 'document'; doc: ArchDocument }
  /** そのレッスンの完成形から始める */
  | { from: 'lesson'; lessonId: string };

export type Highlight = {
  /** 光らせるパレット項目 */
  palette?: NodeKind[];
  /** 光らせるキャンバス上のノード（置き場所など） */
  nodes?: Selector[];
};

export type Checkpoint = {
  id: string;
  label: string;
  rule: Rule;
};

export type Step = {
  id: string;
  title: string;
  /** 指示文。**太字**、`コード`、- 箇条書き、空行での段落分けが使える */
  instruction: string;
  introduces?: GuideTopic[];
  highlight?: Highlight;
  checkpoints: Checkpoint[];
  hints: string[];
  answer: AnswerOp[];
  why: string;
  badExample?: string;
};

export type QuizQuestion = {
  question: string;
  choices: { text: string; correct: boolean; explanation: string }[];
};
