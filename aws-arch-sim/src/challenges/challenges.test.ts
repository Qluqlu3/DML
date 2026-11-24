import { describe, expect, it } from 'vitest';
import { GUIDES } from '../content/guides';
import { applyAnswer } from '../engine/answers';
import { buildModel } from '../engine/model';
import { nodeSize } from '../engine/placement';
import { CHALLENGES, evaluate, findChallenge, initialDoc, modelDoc, scoreOf } from './challenges';

describe('問題の一覧', () => {
  it('ID とルール ID が重複しない', () => {
    const ids = CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHALLENGES) {
      const ruleIds = c.rules.map((r) => r.id);
      expect(new Set(ruleIds).size, c.id).toBe(ruleIds.length);
    }
  });

  it('ID で引ける', () => {
    expect(findChallenge('c1-web3tier')?.title).toBe('冗長化した Web 3 層');
    expect(findChallenge('missing')).toBeNull();
  });
});

describe.each(CHALLENGES.map((c) => [c.id, c] as const))('問題 %s', (_, challenge) => {
  it('必須ルールと推奨ルールがあり、ヒントと解説がある', () => {
    expect(challenge.rules.some((r) => r.severity === 'required')).toBe(true);
    expect(challenge.rules.some((r) => r.severity === 'recommended')).toBe(true);
    expect(challenge.hints.length).toBeGreaterThan(0);
    expect(challenge.explanation.length).toBeGreaterThan(0);
  });

  it('関連トピックには図鑑の解説がある', () => {
    for (const t of challenge.topics) expect(GUIDES[t], t).toBeDefined();
  });

  it('初期構成ではクリアにならない', () => {
    expect(evaluate(challenge, buildModel(initialDoc(challenge))).cleared).toBe(false);
  });

  it('模範解答はエラーなく適用でき、必須・推奨・予算をすべて満たす', () => {
    const { errors } = applyAnswer(initialDoc(challenge), challenge.modelAnswer, (p) => `${p}-t`);
    expect(errors).toEqual([]);
    const ev = evaluate(challenge, buildModel(modelDoc(challenge)));
    const failed = [...ev.required, ...ev.recommended]
      .filter((o) => !o.result.pass)
      .map((o) => `${o.rule.label}: ${o.result.message}`);
    expect(failed).toEqual([]);
    expect(ev.withinBudget).not.toBe(false);
    expect(scoreOf(challenge, ev, 0).total).toBe(100);
  });

  it('模範解答で使うサービスはパレットにある', () => {
    if (!challenge.palette) return;
    const initialIds = new Set(initialDoc(challenge).nodes.map((n) => n.id));
    for (const n of modelDoc(challenge).nodes) {
      if (initialIds.has(n.id)) continue;
      expect(challenge.palette, n.kind).toContain(n.kind);
    }
  });

  it('模範解答で同じ親の中のノードが重ならない', () => {
    const nodes = modelDoc(challenge).nodes;
    for (const a of nodes) {
      for (const b of nodes) {
        if (a.id >= b.id || (a.parentId ?? null) !== (b.parentId ?? null)) continue;
        const sa = nodeSize(a);
        const sb = nodeSize(b);
        const overlap =
          a.position.x < b.position.x + sb.width &&
          b.position.x < a.position.x + sa.width &&
          a.position.y < b.position.y + sb.height &&
          b.position.y < a.position.y + sa.height;
        expect(overlap, `${a.name} と ${b.name} が重なっている`).toBe(false);
      }
    }
  });
});

describe('採点', () => {
  const challenge = findChallenge('c5-read-heavy');
  if (!challenge) throw new Error('c5');

  it('クリアしていなければ 0 点', () => {
    const ev = evaluate(challenge, buildModel(initialDoc(challenge)));
    expect(scoreOf(challenge, ev, 0)).toEqual({ total: 0, parts: [] });
  });

  it('ヒント 1 つで 5 点引く', () => {
    const ev = evaluate(challenge, buildModel(modelDoc(challenge)));
    expect(scoreOf(challenge, ev, 2).total).toBe(90);
  });

  it('推奨を満たさないと、その割合だけ減る', () => {
    const { doc } = applyAnswer(
      initialDoc(challenge),
      challenge.modelAnswer.slice(0, 3),
      (p) => `${p}-t`,
    );
    const ev = evaluate(challenge, buildModel(doc));
    expect(ev.cleared).toBe(true);
    // 推奨 2 つとも未達 → 60 + 0 + 予算内 10
    expect(scoreOf(challenge, ev, 0).total).toBe(70);
  });
});
