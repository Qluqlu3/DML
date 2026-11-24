import { create } from 'zustand';

const KEY = 'aws-arch-sim:incidents';

/** 「変更を適用」1 回分の記録 */
export type TurnRecord = {
  turn: number;
  changes: string[];
  successRate: number;
  latencyMs: number;
  costUsd: number;
  passed: number;
  total: number;
  resolved: boolean;
};

export type IncidentProgress = {
  turns: TurnRecord[];
  hintsUsed: number;
  solved: boolean;
  /** 解決前に解説を見た */
  gaveUp: boolean;
  /** 一度でも解決したか（やり直しても残る） */
  everSolved: boolean;
  bestScore?: number;
};

export const NEW_INCIDENT: IncidentProgress = {
  turns: [],
  hintsUsed: 0,
  solved: false,
  gaveUp: false,
  everSolved: false,
};

type Saved = { incidents: Record<string, IncidentProgress> };

type Store = Saved & {
  update: (id: string, patch: Partial<IncidentProgress>) => void;
  /** ターンを記録する。解決したら点数を残す（解説を見た挑戦は残さない） */
  recordTurn: (id: string, turn: TurnRecord, score: number | null) => void;
  /** やり直し。解決済みとベストスコアは残す */
  restart: (id: string) => void;
};

function load(): Saved {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Saved>;
      return { incidents: parsed.incidents ?? {} };
    }
  } catch {
    // 読めない場合は初期状態から
  }
  return { incidents: {} };
}

const current = (s: Saved, id: string) => ({ ...NEW_INCIDENT, ...s.incidents[id] });

export const useIncidentStore = create<Store>()((set, get) => ({
  ...load(),
  update: (id, patch) =>
    set({ incidents: { ...get().incidents, [id]: { ...current(get(), id), ...patch } } }),
  recordTurn: (id, turn, score) => {
    const p = current(get(), id);
    get().update(id, {
      turns: [...p.turns, turn],
      solved: turn.resolved,
      everSolved: p.everSolved || turn.resolved,
      bestScore:
        turn.resolved && score !== null && !p.gaveUp
          ? Math.max(p.bestScore ?? 0, score)
          : p.bestScore,
    });
  },
  restart: (id) => {
    const p = current(get(), id);
    get().update(id, { ...NEW_INCIDENT, everSolved: p.everSolved, bestScore: p.bestScore });
  },
}));

useIncidentStore.subscribe((s) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ incidents: s.incidents }));
  } catch {
    // 保存できない環境では、その場限りの記録になる
  }
});

/** 編集中の構成 */
export const incidentAttemptKey = (id: string) => `aws-arch-sim:attempt:incident:${id}`;
/** 最後に適用した構成（変更の一覧とメトリクスの基準） */
export const incidentAppliedKey = (id: string) => `aws-arch-sim:attempt:incident:${id}:applied`;

export function useIncidentProgress(id: string): IncidentProgress {
  return useIncidentStore((s) => s.incidents[id] ?? NEW_INCIDENT);
}
