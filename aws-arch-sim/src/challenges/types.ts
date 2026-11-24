import type { AnswerOp } from '../engine/answers';
import type { NodeKind } from '../engine/catalog';
import type { ArchDocument } from '../engine/document';
import type { Rule } from '../engine/rules/predicates';
import type { GuideTopic } from '../learning/types';

/** required: 満たさないとクリアにならない / recommended: 満たすと加点 */
export type Severity = 'required' | 'recommended';

export type ChallengeRule = {
  id: string;
  /** 提出結果のチェックリストに出す文。「DB が Private サブネットにある」など */
  label: string;
  severity: Severity;
  rule: Rule;
};

export type Challenge = {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  /** 一覧に出す一言 */
  summary: string;
  /** 依頼文（RichText 記法）。背景と要件を書く */
  brief: string;
  /** 開始時の構成。省略時は空のキャンバス */
  initial?: ArchDocument;
  /** 使えるサービスの制限（省略時はすべて） */
  palette?: NodeKind[];
  rules: ChallengeRule[];
  /** 予算（USD / 月）。収まれば加点。必須にしたい場合は rules に costBelow を書く */
  budgetUsd?: number;
  /** 段階的に開示する */
  hints: string[];
  /** クリア後に読む解説（RichText 記法） */
  explanation: string;
  /** 模範解答。initial に適用して作る（判定のテストにも使う） */
  modelAnswer: AnswerOp[];
  /** 関連する図鑑の項目 */
  topics: GuideTopic[];
};
