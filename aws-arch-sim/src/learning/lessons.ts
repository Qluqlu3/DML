import { COURSES } from '../content/courses';
import { type AnswerOp, applyAnswer } from '../engine/answers';
import { configFields, kindLabel } from '../engine/catalog';
import { type ArchDocument, emptyDocument } from '../engine/document';
import type { ArchModel } from '../engine/model';
import type { RuleResult } from '../engine/rules/predicates';
import { describe } from '../engine/rules/selector';
import type { Checkpoint, Course, Lesson } from './types';

export const ALL_LESSONS: Lesson[] = COURSES.flatMap((c) => c.lessons);

export function findLesson(id: string): { course: Course; lesson: Lesson; index: number } | null {
  for (const course of COURSES) {
    const index = course.lessons.findIndex((l) => l.id === id);
    const lesson = course.lessons[index];
    if (lesson) return { course, lesson, index };
  }
  return null;
}

export function nextLesson(id: string): Lesson | null {
  const i = ALL_LESSONS.findIndex((l) => l.id === id);
  return ALL_LESSONS[i + 1] ?? null;
}

/** レッスンごとに決まった ID を振る（同じレッスンの完成形はいつも同じ ID になる） */
function idMaker(lessonId: string) {
  let n = 0;
  const tag = lessonId.replace(/[^a-z0-9]/gi, '');
  return (prefix: string) => `${prefix}-${tag}-${++n}`;
}

const cache = new Map<string, ArchDocument>();

export function initialDoc(lesson: Lesson): ArchDocument {
  switch (lesson.start.from) {
    case 'empty':
      return emptyDocument();
    case 'document':
      return lesson.start.doc;
    case 'lesson': {
      const from = findLesson(lesson.start.lessonId);
      if (!from) throw new Error(`開始元のレッスンがありません: ${lesson.start.lessonId}`);
      return finalDoc(from.lesson);
    }
  }
}

/** ステップ index の開始時点の構成（それより前のステップの答えを適用したもの） */
export function docBeforeStep(lesson: Lesson, index: number): ArchDocument {
  const key = `${lesson.id}#${index}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const ops = lesson.steps.slice(0, index).flatMap((s) => s.answer);
  const { doc } = applyAnswer(initialDoc(lesson), ops, idMaker(lesson.id));
  cache.set(key, doc);
  return doc;
}

export function finalDoc(lesson: Lesson): ArchDocument {
  return docBeforeStep(lesson, lesson.steps.length);
}

export type CheckpointResult = { checkpoint: Checkpoint; result: RuleResult };

export type StepEvaluation = {
  /** 今のステップのチェックポイント */
  current: CheckpointResult[];
  /** 前のステップで満たしたはずなのに崩れているもの */
  regressions: CheckpointResult[];
  cleared: boolean;
};

export function evaluateStep(lesson: Lesson, stepIndex: number, model: ArchModel): StepEvaluation {
  const run = (cp: Checkpoint): CheckpointResult => ({ checkpoint: cp, result: cp.rule(model) });
  const current = (lesson.steps[stepIndex]?.checkpoints ?? []).map(run);
  const regressions = lesson.steps
    .slice(0, stepIndex)
    .flatMap((s) => s.checkpoints.map(run))
    .filter((r) => !r.result.pass);
  return { current, regressions, cleared: current.every((r) => r.result.pass) };
}

function describeValue(op: Extract<AnswerOp, { op: 'config' }>, key: string, value: unknown) {
  const kinds = Array.isArray(op.target.kind) ? op.target.kind : [op.target.kind];
  const field = kinds.flatMap((k) => configFields(k)).find((f) => f.key === key);
  const label = field?.label ?? key;
  if (field?.type === 'select') {
    return `${label}: ${field.options.find((o) => o.value === value)?.label ?? String(value)}`;
  }
  if (field?.type === 'boolean') return `${label}: ${value ? '有効' : '無効'}`;
  return `${label}: ${String(value)}`;
}

/** 「答えを見る」で表示する、操作の日本語説明 */
export function describeOp(op: AnswerOp): string {
  switch (op.op) {
    case 'add':
      return op.in
        ? `${describe(op.in)} の中に ${kindLabel(op.kind)} を追加${op.name ? `（名前: ${op.name}）` : ''}`
        : `キャンバス（VPC の外）に ${kindLabel(op.kind)} を追加`;
    case 'connect':
      return `${describe(op.from)} から ${describe(op.to)} へ接続`;
    case 'config':
      return `${describe(op.target)} の設定を変更（${Object.entries(op.set)
        .map(([k, v]) => describeValue(op, k, v))
        .join('、')}）`;
    case 'attachSubnets':
      return `${describe(op.target)} の配置サブネットに ${describe(op.subnets)} を選ぶ`;
    case 'createSg':
      return `${describe(op.for)} にセキュリティグループ「${op.name}」を作って割り当て`;
    case 'allow': {
      const from = 'cidr' in op.from ? `${op.from.cidr}` : `${describe(op.from)} の SG`;
      return `${describe(op.to)} の SG に、${from} からのポート ${op.port} を許可するルールを追加`;
    }
    case 'route':
      return `${describe(op.subnets)} のデフォルトルートを ${describe(op.to)} に向ける`;
    case 'remove':
      return `${describe(op.target)} を削除`;
    case 'disconnect':
      return `${describe(op.from)} から ${describe(op.to)} への接続を削除`;
  }
}
