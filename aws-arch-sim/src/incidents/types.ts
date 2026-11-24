import type { AnswerOp } from '../engine/answers';
import type { ArchDocument } from '../engine/document';
import type { ArchModel } from '../engine/model';
import type { RuleResult } from '../engine/rules/predicates';
import type { Fault, SimResult, TrafficProfile } from '../engine/simulator/types';
import type { GuideTopic } from '../learning/types';

export type CheckContext = { model: ArchModel; sim: SimResult };

/** 解決条件。メトリクスの条件と構成の条件を組み合わせる */
export type IncidentCheck = {
  id: string;
  label: string;
  check: (ctx: CheckContext) => RuleResult;
};

export type Incident = {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  /** 一覧に出す一言 */
  summary: string;
  /** 障害が起きている本番構成 */
  initial: ArchDocument;
  traffic: TrafficProfile;
  /** 構成を変えても消えない外的要因（AZ 障害、アクセス急増など） */
  faults: Fault[];
  /** 発報したアラーム（CloudWatch 風） */
  alert: { name: string; condition: string };
  /** 利用者や他チームからの報告など、状況の説明（RichText 記法） */
  report: string;
  resolved: IncidentCheck[];
  /** 解決後に明かす根本原因（RichText 記法） */
  rootCause: string;
  hints: string[];
  /** 根本原因と、別解を含む対策の解説（RichText 記法） */
  explanation: string;
  /** 模範的な対策（テストで「解決する」ことを確かめ、過剰な増強の目安にも使う） */
  fix: AnswerOp[];
  /** 解決しない（または解決扱いにしない）対策。テストで確かめる */
  wrongFixes?: { label: string; ops: AnswerOp[] }[];
  topics: GuideTopic[];
};
