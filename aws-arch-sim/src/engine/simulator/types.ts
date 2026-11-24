import type { Selector } from '../rules/selector';

/** 利用者からの負荷 */
export type TrafficProfile = {
  /** 利用者からの総リクエスト / 秒 */
  rps: number;
  /** 読み取りの比率（0〜1） */
  readRatio: number;
  /** CloudFront / ElastiCache で返せる比率（0〜1） */
  cacheableRatio: number;
};

/** 構成を変えても消えない外的要因。対象は ID ではなくセレクターで指す */
export type Fault =
  | { type: 'az-down'; az: string }
  | { type: 'instance-fail'; target: Selector }
  | { type: 'traffic-spike'; multiplier: number }
  | { type: 'dependency-slow'; target: Selector; addLatencyMs: number };

export type LogLine = { level: 'INFO' | 'WARN' | 'ERROR'; text: string };

/** idle: リクエストが来ていない / down: 停止中 */
export type NodeStatus = 'idle' | 'ok' | 'warn' | 'crit' | 'down';

export type NodeMetrics = {
  nodeId: string;
  /** 届いたリクエスト / 秒 */
  load: number;
  /** 処理能力（リクエスト / 秒）。上限なしは null */
  capacity: number | null;
  /** 利用率（0〜） */
  utilization: number;
  /** このノードで失敗した割合（0〜1） */
  errorRate: number;
  /** このノードから先を含めた応答時間（ms） */
  latencyMs: number;
  status: NodeStatus;
  /** SQS に溜まっていくメッセージ / 秒 */
  backlog?: number;
  logs: LogLine[];
};

export type SimResult = {
  rps: number;
  /** 利用者から見た成功率（0〜1） */
  successRate: number;
  /** 利用者から見た応答時間（p95 相当, ms） */
  latencyMs: number;
  costUsd: number;
  /** SQS に溜まっていくメッセージ / 秒の合計 */
  backlog: number;
  nodes: Record<string, NodeMetrics>;
};
