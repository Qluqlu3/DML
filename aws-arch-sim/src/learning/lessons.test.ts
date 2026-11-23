import { describe, expect, it } from 'vitest';
import { COURSES } from '../content/courses';
import { GUIDES } from '../content/guides';
import { applyAnswer } from '../engine/answers';
import { buildModel } from '../engine/model';
import { ALL_LESSONS, docBeforeStep, evaluateStep, findLesson, initialDoc } from './lessons';

describe('レッスンの構成', () => {
  it('レッスン ID とステップ ID が重複しない', () => {
    const ids = ALL_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lesson of ALL_LESSONS) {
      const stepIds = lesson.steps.map((s) => s.id);
      expect(new Set(stepIds).size, lesson.id).toBe(stepIds.length);
    }
  });

  it('前のレッスンから始める場合、そのレッスンは先にある', () => {
    for (const [i, lesson] of ALL_LESSONS.entries()) {
      if (lesson.start.from !== 'lesson') continue;
      const from = lesson.start.lessonId;
      expect(
        ALL_LESSONS.findIndex((l) => l.id === from),
        lesson.id,
      ).toBeGreaterThanOrEqual(0);
      expect(
        ALL_LESSONS.findIndex((l) => l.id === from),
        lesson.id,
      ).toBeLessThan(i);
    }
  });

  it('クイズは各問ちょうど 1 つの正解を持つ', () => {
    for (const lesson of ALL_LESSONS) {
      expect(lesson.quiz.length, lesson.id).toBeGreaterThan(0);
      for (const q of lesson.quiz) {
        expect(
          q.choices.filter((c) => c.correct),
          `${lesson.id}: ${q.question}`,
        ).toHaveLength(1);
      }
    }
  });

  it('ステップで紹介するトピックには解説がある', () => {
    for (const lesson of ALL_LESSONS) {
      for (const step of lesson.steps) {
        for (const topic of step.introduces ?? []) {
          expect(GUIDES[topic], `${lesson.id}/${step.id}: ${topic}`).toBeDefined();
        }
      }
    }
  });

  it('コースから引ける', () => {
    expect(findLesson(COURSES[0]?.lessons[1]?.id ?? '')?.index).toBe(1);
    expect(findLesson('missing')).toBeNull();
  });
});

describe.each(ALL_LESSONS.map((l) => [l.id, l] as const))('レッスン %s', (_, lesson) => {
  it('初期構成は読み込める', () => {
    expect(() => initialDoc(lesson)).not.toThrow();
  });

  it.each(lesson.steps.map((s, i) => [s.id, i] as const))(
    'ステップ %s: 開始時は未達、答えを適用するとそれまでの全チェックポイントを満たす',
    (_, i) => {
      const before = evaluateStep(lesson, i, buildModel(docBeforeStep(lesson, i)));
      expect(before.cleared, '開始時点でクリアしている').toBe(false);
      expect(before.regressions, '前のステップの条件が崩れている').toEqual([]);

      const step = lesson.steps[i];
      if (!step) throw new Error('step');
      const { doc, errors } = applyAnswer(
        docBeforeStep(lesson, i),
        step.answer,
        (p) => `${p}-t-${Math.random()}`,
      );
      expect(errors).toEqual([]);
      const after = evaluateStep(lesson, i, buildModel(doc));
      const failed = after.current
        .filter((r) => !r.result.pass)
        .map((r) => `${r.checkpoint.label}: ${r.result.message}`);
      expect(failed).toEqual([]);
      expect(after.regressions).toEqual([]);
    },
  );
});
