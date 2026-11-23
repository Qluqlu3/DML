import { create } from 'zustand';
import type { GuideTopic } from './types';

const KEY = 'aws-arch-sim:learning';

export type LessonPhase = 'intro' | 'steps' | 'quiz' | 'done';

export type LessonProgress = {
  phase: LessonPhase;
  stepIndex: number;
  /** 答えを見た・自動で配置した（「自力でクリア」の判定に使う） */
  assisted: boolean;
  completed: boolean;
  quizCorrect?: number;
  quizTotal?: number;
};

export const NEW_PROGRESS: LessonProgress = {
  phase: 'intro',
  stepIndex: 0,
  assisted: false,
  completed: false,
};

type Saved = { lessons: Record<string, LessonProgress>; learned: GuideTopic[] };

type ProgressStore = Saved & {
  update: (lessonId: string, patch: Partial<LessonProgress>) => void;
  /** やり直し。完了済みの記録は残す */
  restart: (lessonId: string) => void;
  markLearned: (topics: GuideTopic[]) => void;
};

function load(): Saved {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Saved>;
      return { lessons: parsed.lessons ?? {}, learned: parsed.learned ?? [] };
    }
  } catch {
    // 読めない場合は初期状態から
  }
  return { lessons: {}, learned: [] };
}

export const useProgressStore = create<ProgressStore>()((set, get) => ({
  ...load(),
  update: (lessonId, patch) =>
    set({
      lessons: {
        ...get().lessons,
        [lessonId]: { ...NEW_PROGRESS, ...get().lessons[lessonId], ...patch },
      },
    }),
  restart: (lessonId) => {
    const prev = get().lessons[lessonId];
    get().update(lessonId, {
      ...NEW_PROGRESS,
      phase: 'steps',
      completed: prev?.completed ?? false,
    });
  },
  markLearned: (topics) => {
    const learned = new Set(get().learned);
    if (topics.every((t) => learned.has(t))) return;
    for (const t of topics) learned.add(t);
    set({ learned: [...learned] });
  },
}));

useProgressStore.subscribe((s) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ lessons: s.lessons, learned: s.learned }));
  } catch {
    // 保存できない環境では、その場限りの進捗になる
  }
});

export const attemptKey = (lessonId: string) => `aws-arch-sim:attempt:lesson:${lessonId}`;

export function useLessonProgress(lessonId: string): LessonProgress {
  return useProgressStore((s) => s.lessons[lessonId] ?? NEW_PROGRESS);
}
