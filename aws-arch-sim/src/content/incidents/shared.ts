import { type AnswerOp, applyAnswer } from '../../engine/answers';
import type { ArchDocument } from '../../engine/document';
import { any, configIs } from '../../engine/rules/predicates';
import type { Selector } from '../../engine/rules/selector';
import { latencyBelow, structural, successAtLeast } from '../../incidents/checks';
import type { IncidentCheck } from '../../incidents/types';
import { ALB, AURORA, PUB, RDS, USER, VPC, webBase } from '../courses/shared';

export const DB: Selector = { kind: ['rds', 'aurora'] };
export const APP: Selector = { kind: ['asg', 'ecs', 'ec2'] };

/** 本番構成を、2 AZ の VPC 雛形に ops を適用して作る（ID は毎回同じ） */
export function production(tag: string, ops: AnswerOp[], base = webBase()): ArchDocument {
  let n = 0;
  const { doc, errors } = applyAnswer(base, ops, (p) => `${p}-${tag}-${++n}`);
  if (errors.length) throw new Error(`${tag}: ${errors.join(' / ')}`);
  return doc;
}

/** ユーザー → ALB（2 AZ の Public サブネット） */
export const ENTRANCE: AnswerOp[] = [
  { op: 'add', kind: 'alb', in: VPC, name: 'ALB' },
  { op: 'attachSubnets', target: ALB, subnets: PUB },
  { op: 'connect', from: USER, to: ALB },
];

export const recovered = (ratio = 0.999): IncidentCheck => ({
  id: 'success',
  label: `成功率が ${ratio * 100}% 以上に戻っている`,
  check: successAtLeast(ratio),
});

export const fastEnough = (ms: number): IncidentCheck => ({
  id: 'latency',
  label: `応答時間（p95 相当）が ${ms}ms 未満`,
  check: latencyBelow(ms),
});

export const dbHighlyAvailable: IncidentCheck = {
  id: 'db-ha',
  label: 'DB が AZ 障害に備えている（RDS の Multi-AZ / Aurora のリーダー）',
  check: structural(
    any(configIs(RDS, 'multiAz', '==', true), configIs(AURORA, 'readers', '>=', 1)),
  ),
};
