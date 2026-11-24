import type { Rule, RuleResult } from '../engine/rules/predicates';
import type { CheckContext } from './types';

/** 解決条件の部品（問題データから使うので、問題データを読み込まないファイルに置く） */

export const structural = (rule: Rule) => (ctx: CheckContext) => rule(ctx.model);

/** 利用者から見た成功率が ratio 以上 */
export const successAtLeast =
  (ratio: number) =>
  ({ sim }: CheckContext): RuleResult =>
    sim.successRate >= ratio
      ? { pass: true }
      : {
          pass: false,
          message: `成功率 ${formatPct(sim.successRate)}（目標 ${formatPct(ratio)} 以上）`,
        };

/** 利用者から見た応答時間が ms 未満 */
export const latencyBelow =
  (ms: number) =>
  ({ sim }: CheckContext): RuleResult =>
    sim.latencyMs < ms
      ? { pass: true }
      : { pass: false, message: `応答時間 ${sim.latencyMs}ms（目標 ${ms}ms 未満）` };

export function formatPct(r: number): string {
  const p = r * 100;
  return `${p >= 99.95 || p === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
}
