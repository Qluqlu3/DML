import { describe, expect, it } from 'vitest';
import { GUIDES } from '../content/guides';
import { applyAnswer } from '../engine/answers';
import { nodeSize } from '../engine/placement';
import {
  diffDocuments,
  findIncident,
  fixedDoc,
  INCIDENTS,
  runIncident,
  scoreIncident,
} from './incidents';

const failures = (run: ReturnType<typeof runIncident>) =>
  run.outcomes.filter((o) => !o.result.pass).map((o) => `${o.check.label}: ${o.result.message}`);

describe('インシデントの一覧', () => {
  it('ID と解決条件の ID が重複しない', () => {
    const ids = INCIDENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of INCIDENTS) {
      const checkIds = i.resolved.map((c) => c.id);
      expect(new Set(checkIds).size, i.id).toBe(checkIds.length);
    }
    expect(findIncident('missing')).toBeNull();
  });
});

describe.each(INCIDENTS.map((i) => [i.id, i] as const))('インシデント %s', (_, incident) => {
  it('関連トピックには図鑑の解説がある', () => {
    for (const t of incident.topics) expect(GUIDES[t], t).toBeDefined();
  });

  it('初期構成では障害が起きていて、解決していない', () => {
    const run = runIncident(incident, incident.initial);
    expect(run.resolved).toBe(false);
    // 利用者から見て何かがおかしい（メトリクスの条件を満たしていない）
    const metricFails = run.outcomes.filter(
      (o) => ['success', 'latency'].includes(o.check.id) && !o.result.pass,
    );
    expect(metricFails.length).toBeGreaterThan(0);
  });

  it('模範的な対策で解決する', () => {
    const { errors } = applyAnswer(incident.initial, incident.fix, (p) => `${p}-t`);
    expect(errors).toEqual([]);
    const run = runIncident(incident, fixedDoc(incident));
    expect(failures(run)).toEqual([]);
    expect(scoreIncident(incident, 1, 0, run.sim.costUsd).total).toBe(100);
    expect(diffDocuments(incident.initial, fixedDoc(incident)).length).toBeGreaterThan(0);
  });

  it.each((incident.wrongFixes ?? []).map((w) => [w.label, w] as const))(
    '誤った対策「%s」では解決しない',
    (_, wrong) => {
      const { doc, errors } = applyAnswer(incident.initial, wrong.ops, (p) => `${p}-w`);
      expect(errors).toEqual([]);
      expect(runIncident(incident, doc).resolved).toBe(false);
    },
  );

  it('対策後の構成で同じ親の中のノードが重ならない', () => {
    const nodes = fixedDoc(incident).nodes;
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
  const incident = INCIDENTS[0];
  if (!incident) throw new Error('incident');
  const cost = runIncident(incident, fixedDoc(incident)).sim.costUsd;

  it('ターンとヒントで減点する', () => {
    expect(scoreIncident(incident, 3, 1, cost).total).toBe(75);
  });

  it('模範的な対策より大幅に高いと減点する（最大 20 点）', () => {
    expect(scoreIncident(incident, 1, 0, cost * 1.1).total).toBe(100);
    expect(scoreIncident(incident, 1, 0, cost * 1.5).total).toBe(90);
    expect(scoreIncident(incident, 1, 0, cost * 10).total).toBe(80);
  });
});

describe('変更の一覧', () => {
  it('追加・設定・接続・SG の変更を列挙し、位置だけの変更は含めない', () => {
    const i4 = findIncident('i4-sg-deploy');
    if (!i4) throw new Error('i4');
    expect(diffDocuments(i4.initial, fixedDoc(i4))).toEqual([
      'SG「db-sg」に追加: ポート 3306 ← app-v2-sg',
    ]);

    const moved = {
      ...i4.initial,
      nodes: i4.initial.nodes.map((n) => ({ ...n, position: { x: n.position.x + 8, y: 0 } })),
    };
    expect(diffDocuments(i4.initial, moved)).toEqual([]);

    const i2 = findIncident('i2-az-outage');
    if (!i2) throw new Error('i2');
    expect(diffDocuments(i2.initial, fixedDoc(i2))).toEqual([
      '設定: EC2 Auto Scaling「アプリ」の配置サブネット Private a → Private a・Private c',
      '設定: RDS「会員 DB」のMulti-AZ 無効 → 有効',
    ]);
  });
});
