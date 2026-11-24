import { create } from 'zustand';

const KEY = 'aws-arch-sim:progress';

export type ChallengeProgress = {
  /** 今の挑戦で開いたヒントの数 */
  hintsUsed: number;
  /** 今の挑戦で、クリア前に模範解答を見た */
  answerViewed: boolean;
  submissions: number;
  cleared: boolean;
  /** クリア前に模範解答を見ていない挑戦での最高点 */
  bestScore?: number;
};

export const NEW_CHALLENGE: ChallengeProgress = {
  hintsUsed: 0,
  answerViewed: false,
  submissions: 0,
  cleared: false,
};

type Saved = { challenges: Record<string, ChallengeProgress> };

type Store = Saved & {
  update: (id: string, patch: Partial<ChallengeProgress>) => void;
  /** 提出結果を記録する。点数は模範解答を見ていなければベストを更新する */
  recordSubmission: (id: string, cleared: boolean, score: number) => void;
  /** やり直し。クリア済みとベストスコアは残す */
  restart: (id: string) => void;
};

function load(): Saved {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Saved>;
      return { challenges: parsed.challenges ?? {} };
    }
  } catch {
    // 読めない場合は初期状態から
  }
  return { challenges: {} };
}

const current = (s: Saved, id: string) => ({ ...NEW_CHALLENGE, ...s.challenges[id] });

export const useChallengeStore = create<Store>()((set, get) => ({
  ...load(),
  update: (id, patch) =>
    set({ challenges: { ...get().challenges, [id]: { ...current(get(), id), ...patch } } }),
  recordSubmission: (id, cleared, score) => {
    const p = current(get(), id);
    const counts = cleared && !p.answerViewed;
    get().update(id, {
      submissions: p.submissions + 1,
      cleared: p.cleared || cleared,
      bestScore: counts ? Math.max(p.bestScore ?? 0, score) : p.bestScore,
    });
  },
  restart: (id) => {
    const p = current(get(), id);
    get().update(id, { ...NEW_CHALLENGE, cleared: p.cleared, bestScore: p.bestScore });
  },
}));

useChallengeStore.subscribe((s) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ challenges: s.challenges }));
  } catch {
    // 保存できない環境では、その場限りの記録になる
  }
});

export const challengeAttemptKey = (id: string) => `aws-arch-sim:attempt:challenge:${id}`;

export function useChallengeProgress(id: string): ChallengeProgress {
  return useChallengeStore((s) => s.challenges[id] ?? NEW_CHALLENGE);
}
