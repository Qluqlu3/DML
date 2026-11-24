import { type ConfigValue, defaultPort } from '../catalog';
import { monthlyCost } from '../cost';
import type { SecurityGroup } from '../document';
import type { ArchModel, ModelNode } from '../model';
import { cidrContains } from './cidr';
import { describe, type Selector, select } from './selector';

export type RuleResult = {
  pass: boolean;
  /** 満たしていないときの理由 */
  message?: string;
  /** 問題のあるノード（キャンバスで強調する） */
  nodeIds?: string[];
};

/** 構成（ArchModel）を受け取って合否を返す。述語を組み合わせて作る */
export type Rule = (model: ArchModel) => RuleResult;

const ok: RuleResult = { pass: true };
const fail = (message: string, nodeIds?: string[]): RuleResult => ({
  pass: false,
  message,
  nodeIds,
});

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

// ---- 存在・配置 ----

/** sel に合うノードが n 個以上ある */
export function exists(sel: Selector, n = 1): Rule {
  return (m) => {
    const found = select(m, sel);
    if (found.length >= n) return ok;
    return fail(
      n === 1
        ? `${describe(sel)} がありません`
        : `${describe(sel)} が ${n} つ必要です（現在 ${found.length} つ）`,
    );
  };
}

/** sel に合うノードが 1 つもない */
export function none(sel: Selector): Rule {
  return (m) => {
    const found = select(m, sel);
    return found.length === 0
      ? ok
      : fail(
          `${describe(sel)} があります`,
          found.map((n) => n.id),
        );
  };
}

/** sel に合うノードがすべて、指定種別のサブネットにある（1 つ以上あることも条件） */
export function placedIn(sel: Selector, subnetType: 'public' | 'private'): Rule {
  const label = subnetType === 'public' ? 'Public' : 'Private';
  return (m) => {
    const found = select(m, sel);
    if (!found.length) return fail(`${describe(sel)} がありません`);
    const wrong = found.filter(
      (n) =>
        !n.subnetIds.length ||
        !n.subnetIds.every((s) => m.byId.get(s)?.config.subnetType === subnetType),
    );
    return wrong.length
      ? fail(
          `${describe(sel)} が ${label} サブネットにありません`,
          wrong.map((n) => n.id),
        )
      : ok;
  };
}

/** sel に合うノード全体で、n 個以上の AZ にまたがる */
export function spansAzs(sel: Selector, n: number): Rule {
  return (m) => {
    const found = select(m, sel);
    if (!found.length) return fail(`${describe(sel)} がありません`);
    const azs = new Set(found.flatMap((x) => x.azIds));
    return azs.size >= n
      ? ok
      : fail(
          `${describe(sel)} が ${n} つ以上の AZ にまたがっていません（現在 ${azs.size}）`,
          found.map((x) => x.id),
        );
  };
}

// ---- 設定 ----

type Op = '==' | '!=' | '>=' | '<=' | 'includes';

function compare(actual: ConfigValue | undefined, op: Op, expected: ConfigValue): boolean {
  switch (op) {
    case '==':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '>=':
      return Number(actual) >= Number(expected);
    case '<=':
      return Number(actual) <= Number(expected);
    case 'includes':
      return Array.isArray(actual) && actual.includes(String(expected));
  }
}

/** sel に合うノードがすべて、設定 key が条件を満たす（1 つ以上あることも条件） */
export function configIs(
  sel: Selector,
  key: string,
  op: Op,
  value: ConfigValue,
  label?: string,
): Rule {
  return (m) => {
    const found = select(m, sel);
    if (!found.length) return fail(`${describe(sel)} がありません`);
    const wrong = found.filter((n) => !compare(n.config[key], op, value));
    return wrong.length
      ? fail(
          `${describe(sel)} の設定が条件を満たしていません${label ? `: ${label}` : ''}`,
          wrong.map((n) => n.id),
        )
      : ok;
  };
}

/** 指定種別のサブネットがすべて、IGW / NAT Gateway / なし にルートしている */
export function subnetRoute(
  subnetType: 'public' | 'private',
  target: 'igw' | 'nat' | 'none',
): Rule {
  const label = subnetType === 'public' ? 'Public' : 'Private';
  const targetLabel = { igw: 'Internet Gateway', nat: 'NAT Gateway', none: 'なし' }[target];
  return (m) => {
    const subnets = m.nodes.filter(
      (n) => n.kind === 'subnet' && n.config.subnetType === subnetType,
    );
    if (!subnets.length) return fail(`${label} サブネットがありません`);
    const wrong = subnets.filter((s) => {
      const route = String(s.config.route);
      if (target === 'none') return route !== 'none';
      const kind = m.byId.get(route)?.kind;
      return kind !== (target === 'igw' ? 'igw' : 'natgw');
    });
    return wrong.length
      ? fail(
          `${label} サブネットのデフォルトルートが ${targetLabel} になっていません`,
          wrong.map((s) => s.id),
        )
      : ok;
  };
}

// ---- 接続 ----

type ConnectedOptions = {
  /** 'from': a 側のすべてが接続している / 'to': b 側のすべてが接続を受けている */
  every?: 'from' | 'to';
};

/** a から b への接続線がある */
export function connected(a: Selector, b: Selector, opts: ConnectedOptions = {}): Rule {
  return (m) => {
    const from = select(m, a);
    const to = select(m, b);
    if (!from.length) return fail(`${describe(a)} がありません`);
    if (!to.length) return fail(`${describe(b)} がありません`);
    const toIds = new Set(to.map((n) => n.id));
    const fromIds = new Set(from.map((n) => n.id));
    const edges = m.edges.filter((e) => fromIds.has(e.source) && toIds.has(e.target));
    const message = `${describe(a)} から ${describe(b)} への接続がありません`;
    if (opts.every === 'from') {
      const missing = from.filter((n) => !edges.some((e) => e.source === n.id));
      return missing.length
        ? fail(
            message,
            missing.map((n) => n.id),
          )
        : ok;
    }
    if (opts.every === 'to') {
      const missing = to.filter((n) => !edges.some((e) => e.target === n.id));
      return missing.length
        ? fail(
            message,
            missing.map((n) => n.id),
          )
        : ok;
    }
    return edges.length ? ok : fail(message);
  };
}

/** a から b への直接の接続線がない */
export function noDirect(a: Selector, b: Selector): Rule {
  return (m) => {
    const fromIds = new Set(select(m, a).map((n) => n.id));
    const toIds = new Set(select(m, b).map((n) => n.id));
    const direct = m.edges.filter((e) => fromIds.has(e.source) && toIds.has(e.target));
    return direct.length
      ? fail(
          `${describe(a)} から ${describe(b)} へ直接つながっています`,
          direct.flatMap((e) => [e.source, e.target]),
        )
      : ok;
  };
}

function reachableIds(m: ArchModel, start: Iterable<string>): Set<string> {
  const seen = new Set<string>(start);
  const queue = [...seen];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const e of m.outgoing.get(id) ?? []) {
      if (!seen.has(e.target)) {
        seen.add(e.target);
        queue.push(e.target);
      }
    }
  }
  return seen;
}

/** 接続線をたどって a から b へ届く。via を指定すると、その経由が必須 */
export function reachable(a: Selector, b: Selector, opts: { via?: Selector } = {}): Rule {
  return (m) => {
    const from = select(m, a);
    const to = select(m, b);
    if (!from.length) return fail(`${describe(a)} がありません`);
    if (!to.length) return fail(`${describe(b)} がありません`);
    const toIds = new Set(to.map((n) => n.id));
    const hits = (ids: Set<string>) => [...ids].some((id) => toIds.has(id));

    if (!opts.via) {
      return hits(
        reachableIds(
          m,
          from.map((n) => n.id),
        ),
      )
        ? ok
        : fail(`${describe(a)} から ${describe(b)} まで接続がつながっていません`);
    }
    const via = select(m, opts.via);
    const fromReach = reachableIds(
      m,
      from.map((n) => n.id),
    );
    const passes = via.some((v) => fromReach.has(v.id) && hits(reachableIds(m, [v.id])));
    return passes
      ? ok
      : fail(
          `${describe(a)} から ${describe(opts.via)} を経由して ${describe(b)} まで接続がつながっていません`,
        );
  };
}

// ---- セキュリティグループ ----

const sgIdsOf = (n: ModelNode) => strList(n.config.securityGroupIds);

/** sel に合うノードがすべて、SG を 1 つ以上持つ */
export function hasSg(sel: Selector): Rule {
  return (m) => {
    const found = select(m, sel);
    if (!found.length) return fail(`${describe(sel)} がありません`);
    const wrong = found.filter((n) => sgIdsOf(n).length === 0);
    return wrong.length
      ? fail(
          `${describe(sel)} にセキュリティグループが割り当てられていません`,
          wrong.map((n) => n.id),
        )
      : ok;
  };
}

/** 送信元ノードのアドレス範囲。VPC 外のノードはインターネットからとみなす */
function sourceRanges(m: ArchModel, n: ModelNode): string[] {
  if (!n.vpcId) return ['0.0.0.0/0'];
  return n.subnetIds.map((s) => String(m.byId.get(s)?.config.cidr ?? ''));
}

function ruleAllows(
  m: ArchModel,
  sg: SecurityGroup,
  source: ModelNode,
  port: number,
  sgOnly: boolean,
): boolean {
  const sourceSgs = sgIdsOf(source);
  const ranges = sourceRanges(m, source);
  return sg.inbound.some((r) => {
    if (r.port !== port) return false;
    if (r.source.type === 'sg') return sourceSgs.includes(r.source.sgId);
    if (sgOnly) return false;
    const cidr = r.source.cidr;
    return ranges.length > 0 && ranges.every((range) => cidrContains(cidr, range));
  });
}

type SgAllowsOptions = {
  /** 省略時は a → b の接続のポート、接続がなければ b の既定ポート */
  port?: number;
  /** true なら CIDR ではなく SG 参照で許可していることを求める */
  sgOnly?: boolean;
};

/** b 側のノードすべてについて、b の SG が a のいずれかからの通信を許可している */
export function sgAllows(a: Selector, b: Selector, opts: SgAllowsOptions = {}): Rule {
  return (m) => {
    const from = select(m, a);
    const to = select(m, b);
    if (!from.length) return fail(`${describe(a)} がありません`);
    if (!to.length) return fail(`${describe(b)} がありません`);

    const blocked = to.filter((target) => {
      const sgs = sgIdsOf(target)
        .map((id) => m.sgById.get(id))
        .filter((g): g is SecurityGroup => g !== undefined);
      return !from.some((source) => {
        const edge = m.edges.find((e) => e.source === source.id && e.target === target.id);
        const port = opts.port ?? edge?.port ?? defaultPort(target.kind, target.config);
        return sgs.some((g) => ruleAllows(m, g, source, port, opts.sgOnly ?? false));
      });
    });
    if (!blocked.length) return ok;
    const how = opts.sgOnly ? '（SG 参照で）' : '';
    return fail(
      `${blocked.map((n) => n.name).join(', ')} の SG が ${describe(a)} からの通信を${how}許可していません`,
      blocked.map((n) => n.id),
    );
  };
}

type RuleSource = 'internet' | 'restricted' | 'any';

/**
 * sel に合うノードのいずれかの SG に、port へのインバウンドルールがある。
 * source: 'internet' = 0.0.0.0/0 から / 'restricted' = それ以外（特定の CIDR や SG）から / 'any' = どちらでも
 */
export function sgHasRule(sel: Selector, port: number, source: RuleSource = 'any'): Rule {
  const label = { internet: 'インターネット全体', restricted: '限定した送信元', any: 'いずれか' }[
    source
  ];
  return (m) => {
    const found = select(m, sel);
    if (!found.length) return fail(`${describe(sel)} がありません`);
    const has = found.some((n) =>
      sgIdsOf(n).some((id) =>
        m.sgById.get(id)?.inbound.some((r) => {
          if (r.port !== port) return false;
          const internet = r.source.type === 'cidr' && cidrContains(r.source.cidr, '0.0.0.0/0');
          return source === 'any' || (source === 'internet') === internet;
        }),
      ),
    );
    return has
      ? ok
      : fail(
          `${describe(sel)} の SG に、${label}からのポート ${port} を許可するルールがありません`,
          found.map((n) => n.id),
        );
  };
}

/** sel に合うノードの設定 key が、n 種類以上の異なる値を持つ */
export function distinctValues(sel: Selector, key: string, n: number, label?: string): Rule {
  return (m) => {
    const found = select(m, sel);
    const values = new Set(found.map((x) => String(x.config[key])));
    return values.size >= n
      ? ok
      : fail(
          `${describe(sel)} の${label ?? key}が ${n} 種類必要です（現在 ${values.size}）`,
          found.map((x) => x.id),
        );
  };
}

// ---- コスト ----

/** 月額コストの概算が usd 以下 */
export function costBelow(usd: number): Rule {
  return (m) => {
    const { total, lines } = monthlyCost(m.doc);
    return total <= usd
      ? ok
      : fail(
          `月額の概算 $${total} が予算 $${usd} を超えています`,
          lines.slice(0, 3).map((l) => l.nodeId),
        );
  };
}

// ---- 組み合わせ ----

/** すべて満たす。最初に満たさなかったルールの理由を返す */
export function all(...rules: Rule[]): Rule {
  return (m) => {
    for (const rule of rules) {
      const r = rule(m);
      if (!r.pass) return r;
    }
    return ok;
  };
}

/** どれか 1 つ満たす（別解を許す）。すべて満たさなければ理由をまとめて返す */
export function any(...rules: Rule[]): Rule {
  return (m) => {
    const results = rules.map((rule) => rule(m));
    if (results.some((r) => r.pass)) return ok;
    return fail(
      results
        .map((r) => r.message)
        .filter(Boolean)
        .join(' / いずれか: '),
      results.flatMap((r) => r.nodeIds ?? []),
    );
  };
}

/** 満たさないこと。理由は呼び出し側で指定する */
export function not(rule: Rule, message: string): Rule {
  return (m) => (rule(m).pass ? fail(message) : ok);
}

/** 理由の文言をレッスン向けに差し替える */
export function withMessage(rule: Rule, message: string): Rule {
  return (m) => {
    const r = rule(m);
    return r.pass ? r : { ...r, message };
  };
}
