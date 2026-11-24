import { INCIDENTS } from '../content/incidents';
import { applyAnswer } from '../engine/answers';
import { type ConfigValue, configFields, isContainerKind, kindLabel } from '../engine/catalog';
import type { ArchDocument, SgRule } from '../engine/document';
import { buildModel } from '../engine/model';
import type { RuleResult } from '../engine/rules/predicates';
import { simulate } from '../engine/simulator/simulate';
import type { SimResult } from '../engine/simulator/types';
import type { Incident, IncidentCheck } from './types';

export { formatPct, latencyBelow, structural, successAtLeast } from './checks';
export { INCIDENTS };

export function findIncident(id: string): Incident | null {
  return INCIDENTS.find((i) => i.id === id) ?? null;
}

// ---- 実行と判定 ----

export type CheckOutcome = { check: IncidentCheck; result: RuleResult };

export type IncidentRun = {
  sim: SimResult;
  outcomes: CheckOutcome[];
  resolved: boolean;
};

export function runIncident(incident: Incident, doc: ArchDocument): IncidentRun {
  const model = buildModel(doc);
  const sim = simulate(model, incident.traffic, incident.faults);
  const outcomes = incident.resolved.map((check) => ({
    check,
    result: check.check({ model, sim }),
  }));
  return { sim, outcomes, resolved: outcomes.every((o) => o.result.pass) };
}

const fixCache = new Map<string, ArchDocument>();

/** 模範的な対策を適用した構成 */
export function fixedDoc(incident: Incident): ArchDocument {
  const cached = fixCache.get(incident.id);
  if (cached) return cached;
  let n = 0;
  const { doc } = applyAnswer(incident.initial, incident.fix, (p) => `${p}-fix-${++n}`);
  fixCache.set(incident.id, doc);
  return doc;
}

// ---- 採点 ----

export type IncidentScore = { total: number; parts: { label: string; points: number }[] };

/**
 * 100 点満点から引く。ターン 2 以降 1 ターンにつき −10 点、ヒント 1 つにつき −5 点、
 * 模範的な対策より月額が 2 割以上高ければ超過の割合に応じて最大 −20 点（過剰な増強）。
 */
export function scoreIncident(
  incident: Incident,
  turns: number,
  hintsUsed: number,
  finalCostUsd: number,
): IncidentScore {
  const parts = [{ label: '解決', points: 100 }];
  if (turns > 1) parts.push({ label: `${turns} ターンで解決`, points: -10 * (turns - 1) });
  if (hintsUsed > 0) parts.push({ label: `ヒント ${hintsUsed} つ`, points: -5 * hintsUsed });
  const reference = runIncident(incident, fixedDoc(incident)).sim.costUsd;
  if (reference > 0 && finalCostUsd > reference * 1.2) {
    const over = (finalCostUsd - reference) / reference;
    parts.push({
      label: `コストが模範解答より ${Math.round(over * 100)}% 高い`,
      points: -Math.min(20, Math.round(over * 20)),
    });
  }
  return {
    total: Math.max(
      0,
      parts.reduce((s, p) => s + p.points, 0),
    ),
    parts,
  };
}

// ---- 変更の一覧 ----

function valueLabel(doc: ArchDocument, value: ConfigValue | undefined): string {
  const nameOf = (id: string) =>
    doc.nodes.find((n) => n.id === id)?.name ??
    doc.securityGroups.find((g) => g.id === id)?.name ??
    id;
  if (value === undefined) return '（なし）';
  if (Array.isArray(value)) return value.length ? value.map(nameOf).join('・') : '（なし）';
  if (typeof value === 'boolean') return value ? '有効' : '無効';
  if (typeof value === 'string' && value !== 'none') return nameOf(value);
  return value === 'none' ? 'なし' : String(value);
}

function ruleLabel(doc: ArchDocument, r: SgRule): string {
  const from =
    r.source.type === 'cidr'
      ? r.source.cidr
      : (() => {
          const sgId = r.source.sgId;
          return doc.securityGroups.find((g) => g.id === sgId)?.name ?? sgId;
        })();
  return `ポート ${r.port} ← ${from}`;
}

/** 前のターンからの変更を、人が読める形で列挙する（位置だけの変更は含めない） */
export function diffDocuments(before: ArchDocument, after: ArchDocument): string[] {
  const changes: string[] = [];
  const label = (n: { kind: ArchDocument['nodes'][number]['kind']; name: string }) =>
    `${kindLabel(n.kind)}「${n.name}」`;
  const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodes = new Map(after.nodes.map((n) => [n.id, n]));

  for (const n of after.nodes) {
    const old = beforeNodes.get(n.id);
    if (!old) {
      changes.push(`追加: ${label(n)}`);
      continue;
    }
    if (old.name !== n.name) changes.push(`名前: ${label(old)} → 「${n.name}」`);
    if ((old.parentId ?? null) !== (n.parentId ?? null)) {
      const parent = n.parentId ? afterNodes.get(n.parentId)?.name : 'VPC の外';
      changes.push(`移動: ${label(n)} → ${parent ?? '?'}`);
    }
    if (isContainerKind(n.kind) && n.kind !== 'subnet') continue;
    const fields = configFields(n.kind);
    for (const field of fields) {
      const a = old.config[field.key];
      const b = n.config[field.key];
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
      changes.push(
        `設定: ${label(n)}の${field.label} ${valueLabel(before, a)} → ${valueLabel(after, b)}`,
      );
    }
  }
  for (const n of before.nodes) {
    if (!afterNodes.has(n.id)) changes.push(`削除: ${label(n)}`);
  }

  const edgeKey = (e: { source: string; target: string }) => `${e.source}>${e.target}`;
  const nameIn = (doc: ArchDocument, id: string) => doc.nodes.find((n) => n.id === id)?.name ?? id;
  const beforeEdges = new Set(before.edges.map(edgeKey));
  const afterEdges = new Set(after.edges.map(edgeKey));
  for (const e of after.edges) {
    if (!beforeEdges.has(edgeKey(e))) {
      changes.push(`接続: ${nameIn(after, e.source)} → ${nameIn(after, e.target)}`);
    }
  }
  for (const e of before.edges) {
    if (!afterEdges.has(edgeKey(e))) {
      changes.push(`接続を削除: ${nameIn(before, e.source)} → ${nameIn(before, e.target)}`);
    }
  }

  const beforeSgs = new Map(before.securityGroups.map((g) => [g.id, g]));
  const afterSgIds = new Set(after.securityGroups.map((g) => g.id));
  for (const g of after.securityGroups) {
    const old = beforeSgs.get(g.id);
    if (!old) changes.push(`SG 作成: ${g.name}`);
    const oldRules = new Set((old?.inbound ?? []).map((r) => ruleLabel(before, r)));
    const newRules = new Set(g.inbound.map((r) => ruleLabel(after, r)));
    for (const r of newRules) if (!oldRules.has(r)) changes.push(`SG「${g.name}」に追加: ${r}`);
    for (const r of oldRules) if (!newRules.has(r)) changes.push(`SG「${g.name}」から削除: ${r}`);
  }
  for (const g of before.securityGroups) {
    if (!afterSgIds.has(g.id)) changes.push(`SG 削除: ${g.name}`);
  }
  return changes;
}
