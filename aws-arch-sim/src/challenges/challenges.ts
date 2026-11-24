import { CHALLENGES } from '../content/challenges';
import { applyAnswer } from '../engine/answers';
import { monthlyCost } from '../engine/cost';
import { type ArchDocument, emptyDocument } from '../engine/document';
import type { ArchModel } from '../engine/model';
import type { RuleResult } from '../engine/rules/predicates';
import type { Challenge, ChallengeRule } from './types';

export { CHALLENGES };

export function findChallenge(id: string): Challenge | null {
  return CHALLENGES.find((c) => c.id === id) ?? null;
}

export function initialDoc(challenge: Challenge): ArchDocument {
  return challenge.initial ?? emptyDocument();
}

const modelCache = new Map<string, ArchDocument>();

/** 模範解答の構成（初期構成に modelAnswer を適用したもの。ID は毎回同じ） */
export function modelDoc(challenge: Challenge): ArchDocument {
  const cached = modelCache.get(challenge.id);
  if (cached) return cached;
  let n = 0;
  const tag = challenge.id.replace(/[^a-z0-9]/gi, '');
  const { doc } = applyAnswer(
    initialDoc(challenge),
    challenge.modelAnswer,
    (p) => `${p}-${tag}-${++n}`,
  );
  modelCache.set(challenge.id, doc);
  return doc;
}

export type RuleOutcome = { rule: ChallengeRule; result: RuleResult };

export type Evaluation = {
  required: RuleOutcome[];
  recommended: RuleOutcome[];
  cleared: boolean;
  costUsd: number;
  withinBudget: boolean | null;
};

export function evaluate(challenge: Challenge, model: ArchModel): Evaluation {
  const outcomes = challenge.rules.map((rule) => ({ rule, result: rule.rule(model) }));
  const required = outcomes.filter((o) => o.rule.severity === 'required');
  const recommended = outcomes.filter((o) => o.rule.severity === 'recommended');
  const costUsd = monthlyCost(model.doc).total;
  return {
    required,
    recommended,
    cleared: required.every((o) => o.result.pass),
    costUsd,
    withinBudget: challenge.budgetUsd === undefined ? null : costUsd <= challenge.budgetUsd,
  };
}

export type Score = {
  total: number;
  /** 内訳（画面に出す） */
  parts: { label: string; points: number }[];
};

export const HINT_PENALTY = 5;

/**
 * 100 点満点。クリアで 60 点、推奨ルールの達成率で最大 30 点（予算がない問題は 40 点）、
 * 予算内で 10 点、ヒント 1 つにつき 5 点引く。クリアしていなければ 0 点。
 */
export function scoreOf(challenge: Challenge, ev: Evaluation, hintsUsed: number): Score {
  if (!ev.cleared) return { total: 0, parts: [] };
  const hasBudget = challenge.budgetUsd !== undefined;
  const recMax = hasBudget ? 30 : 40;
  const recPassed = ev.recommended.filter((o) => o.result.pass).length;
  const recPoints = ev.recommended.length
    ? Math.round((recMax * recPassed) / ev.recommended.length)
    : recMax;
  const parts = [
    { label: '必須要件をすべて達成', points: 60 },
    { label: `推奨 ${recPassed} / ${ev.recommended.length}`, points: recPoints },
  ];
  if (hasBudget) {
    parts.push({
      label: ev.withinBudget ? '予算内' : '予算超過',
      points: ev.withinBudget ? 10 : 0,
    });
  }
  if (hintsUsed > 0) {
    parts.push({ label: `ヒント ${hintsUsed} つ`, points: -HINT_PENALTY * hintsUsed });
  }
  const total = Math.max(
    0,
    parts.reduce((s, p) => s + p.points, 0),
  );
  return { total, parts };
}
