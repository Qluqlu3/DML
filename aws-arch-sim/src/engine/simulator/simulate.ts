import { defaultPort, isContainerKind, type ServiceKind } from '../catalog';
import { monthlyCost } from '../cost';
import type { DocEdge } from '../document';
import type { ArchModel, ModelNode } from '../model';
import { sgPermits } from '../rules/predicates';
import { select } from '../rules/selector';
import {
  BASE_LATENCY,
  baseCapacity,
  COMPUTE,
  DATABASES,
  FANOUT,
  FORWARDERS,
  SIDE,
  TIMEOUT_MS,
  withDefaults,
} from './capacity';
import type { Fault, LogLine, NodeMetrics, NodeStatus, SimResult, TrafficProfile } from './types';

/**
 * 疑似メトリクスの計算（DESIGN.md 6 章）。
 * ターン制なので時間変化は追わず、ある負荷と障害条件での定常状態を 1 回計算する。
 *
 * 1. 利用者から接続をたどり、各ノードに届く負荷を求める（振り分け・キャッシュ・読み書き分離・キュー）
 * 2. 利用率 = 負荷 / 処理能力。超えた分は失敗する
 * 3. 末端から逆にたどり、成功率と応答時間（待ち行列で伸びる）を合成する
 */

type State = {
  node: ModelNode;
  kind: ServiceKind;
  config: Record<string, unknown>;
  down: boolean;
  capacity: number | null;
  /** RDS / Aurora の読み取り分散先の数（本体を含まない） */
  readers: number;
  slowMs: number;
  load: number;
  reads: number;
  served: number;
  ownErr: number;
  util: number;
  backlog: number;
  fail: number;
  latency: number;
  logs: LogLine[];
};

type Link = { edge: DocEdge; target: State; pass: number; port: number };

const round = (n: number) => Math.round(n);
const pct = (r: number) => `${Math.round(r * 100)}%`;
const fmt = (n: number) => Math.round(n).toLocaleString();

/** ログ用のそれらしい IP アドレス */
function ipOf(m: ArchModel, n: ModelNode): string {
  const hash = [...n.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 200, 7) + 20;
  const subnet = n.subnetIds[0] ? m.byId.get(n.subnetIds[0]) : undefined;
  const cidr = typeof subnet?.config.cidr === 'string' ? subnet.config.cidr : '';
  const prefix = cidr.split('.').slice(0, 3).join('.');
  return prefix.split('.').length === 3 ? `${prefix}.${hash}` : `203.0.113.${hash}`;
}

export function simulate(m: ArchModel, traffic: TrafficProfile, faults: Fault[] = []): SimResult {
  // ---- 障害の前処理 ----
  const downAzNames = new Set(faults.flatMap((f) => (f.type === 'az-down' ? [f.az] : [])));
  const downAzIds = new Set(
    m.nodes
      .filter((n) => n.kind === 'az' && downAzNames.has(String(n.config.azName)))
      .map((n) => n.id),
  );
  const failedIds = new Set(
    faults.flatMap((f) => (f.type === 'instance-fail' ? select(m, f.target).map((n) => n.id) : [])),
  );
  const slow = new Map<string, number>();
  for (const f of faults) {
    if (f.type !== 'dependency-slow') continue;
    for (const n of select(m, f.target)) slow.set(n.id, (slow.get(n.id) ?? 0) + f.addLatencyMs);
  }
  const rps = faults.reduce(
    (r, f) => (f.type === 'traffic-spike' ? r * f.multiplier : r),
    traffic.rps,
  );
  const azName = (azId: string) => String(m.byId.get(azId)?.config.azName ?? azId);

  // ---- ノードごとの状態 ----
  const states = new Map<string, State>();
  for (const node of m.nodes) {
    if (isContainerKind(node.kind)) continue;
    const kind = node.kind;
    const config = withDefaults(kind, node.config);
    const s: State = {
      node,
      kind,
      config,
      down: false,
      capacity: baseCapacity(kind, node.config),
      readers: kind === 'rds' ? Number(config.readReplicas) || 0 : 0,
      slowMs: slow.get(node.id) ?? 0,
      load: 0,
      reads: 0,
      served: 0,
      ownErr: 0,
      util: 0,
      backlog: 0,
      fail: 0,
      latency: 0,
      logs: [],
    };
    if (kind === 'aurora') s.readers = Number(config.readers) || 0;
    applyFaults(s);
    if (s.slowMs > 0) {
      s.logs.push({ level: 'WARN', text: `応答時間が通常より ${s.slowMs}ms 長くなっています` });
    }
    states.set(node.id, s);
  }

  function applyFaults(s: State) {
    const { node, kind, config } = s;
    if (failedIds.has(node.id)) {
      if (kind === 'rds' && config.multiAz) {
        s.logs.push({
          level: 'INFO',
          text: 'インスタンス障害: スタンバイへフェイルオーバーしました',
        });
      } else {
        s.down = true;
        s.logs.push({
          level: 'ERROR',
          text: 'インスタンス障害: ステータスチェックに失敗しています',
        });
      }
      return;
    }
    const lostAzs = node.azIds.filter((id) => downAzIds.has(id));
    if (!lostAzs.length) return;
    const lost = lostAzs.map(azName).join(', ');
    const allLost = lostAzs.length === node.azIds.length;
    switch (kind) {
      case 'rds':
        if (config.multiAz) {
          s.logs.push({
            level: 'INFO',
            text: `AZ 障害（${lost}）: Multi-AZ のスタンバイへフェイルオーバーしました`,
          });
          return;
        }
        break;
      case 'aurora':
        if (s.readers >= 1) {
          s.readers -= 1;
          s.logs.push({
            level: 'INFO',
            text: `AZ 障害（${lost}）: リーダーをライターに昇格しました`,
          });
          return;
        }
        break;
      case 'elasticache':
        if (Number(config.replicas) >= 1 && config.multiAz) {
          s.logs.push({ level: 'INFO', text: `AZ 障害（${lost}）: レプリカを昇格しました` });
          return;
        }
        break;
      case 'asg':
      case 'ecs':
      case 'alb':
      case 'nlb':
      case 'lambda':
      case 'vpce':
        // 複数の AZ にまたがっていれば、残った AZ で台数を保つ
        if (!allLost) {
          s.logs.push({
            level: 'WARN',
            text: `AZ 障害（${lost}）: 残りの AZ で処理を続けています`,
          });
          return;
        }
        break;
    }
    s.down = true;
    s.logs.push({ level: 'ERROR', text: `AZ 障害（${lost}）: 応答がありません` });
  }

  // 配置サブネットを選んでいない VPC 内のサービスは動いていない
  for (const s of states.values()) {
    if (['alb', 'nlb', 'asg', 'ecs'].includes(s.kind) && !s.node.subnetIds.length && !s.down) {
      s.down = true;
      s.logs.push({ level: 'ERROR', text: '配置サブネットが選ばれていないため起動していません' });
    }
  }

  // ---- 経路の可否 ----
  const routeTarget = (subnetId: string) => {
    const route = m.byId.get(subnetId)?.config.route;
    return typeof route === 'string' ? m.byId.get(route) : undefined;
  };
  /** VPC 内のノードがインターネットに出られる割合（配置サブネットごと） */
  function egressFraction(n: ModelNode): number {
    if (!n.vpcId || !n.subnetIds.length) return 1;
    const ok = n.subnetIds.filter((sid) => {
      const target = routeTarget(sid);
      if (target?.kind === 'igw') return true;
      if (target?.kind !== 'natgw' || states.get(target.id)?.down) return false;
      return target.subnetIds.some((ns) => routeTarget(ns)?.kind === 'igw');
    });
    return ok.length / n.subnetIds.length;
  }
  /** VPC 外からそのノードに届く割合（Public サブネット = IGW へのルートがあるか） */
  function inboundFraction(n: ModelNode): number {
    if (n.kind === 'igw') return 1;
    if (!n.subnetIds.length) return 0;
    return (
      n.subnetIds.filter((sid) => routeTarget(sid)?.kind === 'igw').length / n.subnetIds.length
    );
  }

  function linksOf(s: State): Link[] {
    return (m.outgoing.get(s.node.id) ?? []).flatMap((edge): Link[] => {
      const target = states.get(edge.target);
      if (!target || SIDE.has(target.kind)) return [];
      const port = edge.port ?? defaultPort(target.kind, target.node.config);
      let pass = target.down ? 0 : 1;
      if (pass && sgPermits(m, s.node, target.node, port) === false) pass = 0;
      if (pass && !s.node.vpcId && target.node.vpcId) pass *= inboundFraction(target.node);
      if (pass && target.kind === 'external') pass *= egressFraction(s.node);
      return [{ edge, target, pass, port }];
    });
  }

  // ---- 処理順（利用者から、戻る接続は無視） ----
  const order: string[] = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const e of m.outgoing.get(id) ?? []) {
      const t = states.get(e.target);
      if (t && !SIDE.has(t.kind)) visit(e.target);
    }
    order.push(id);
  };
  const clients = [...states.values()].filter((s) => s.kind === 'client');
  for (const c of clients) visit(c.node.id);
  order.reverse();
  const pos = new Map(order.map((id, i) => [id, i]));
  const links = new Map<string, Link[]>();
  for (const id of order) {
    const s = states.get(id);
    if (!s) continue;
    const myPos = pos.get(id) ?? 0;
    links.set(
      id,
      linksOf(s).filter((l) => (pos.get(l.target.node.id) ?? -1) > myPos),
    );
  }

  const send = (t: State, amount: number, readFraction: number) => {
    t.load += amount;
    t.reads += amount * readFraction;
  };

  // ---- 1. 負荷を流す ----
  for (const c of clients) {
    c.load = rps / clients.length;
    c.reads = c.load * traffic.readRatio;
  }
  const cacheable = traffic.cacheableRatio;
  for (const id of order) {
    const s = states.get(id);
    if (!s) continue;
    const out = links.get(id) ?? [];
    const readFraction = s.load > 0 ? s.reads / s.load : traffic.readRatio;

    // 処理できる量
    if (s.down) {
      s.served = 0;
    } else if (s.kind === 'rds' || s.kind === 'aurora') {
      const writes = s.load - s.reads;
      const effective = writes + s.reads / (1 + s.readers);
      const cap = s.capacity ?? Number.POSITIVE_INFINITY;
      s.util = effective / cap;
      s.served = effective > 0 ? s.load * Math.min(1, cap / effective) : 0;
    } else {
      s.util = s.capacity ? s.load / s.capacity : 0;
      s.served = s.capacity === null ? s.load : Math.min(s.load, s.capacity);
    }
    s.ownErr = s.load > 0 ? 1 - s.served / s.load : 0;
    const S = s.served;
    if (S <= 0) continue;

    if (FORWARDERS.has(s.kind)) {
      const healthy = out.filter((l) => l.pass > 0);
      const factor = s.kind === 'cloudfront' ? 1 - cacheable : 1;
      for (const l of healthy) send(l.target, (S * factor * l.pass) / healthy.length, readFraction);
    } else if (COMPUTE.has(s.kind)) {
      const cacheAvail = Math.max(
        0,
        ...out.filter((l) => l.target.kind === 'elasticache').map((l) => l.pass),
      );
      const hit = readFraction * cacheable * cacheAvail;
      for (const l of out) {
        if (DATABASES.has(l.target.kind)) {
          const miss = 1 - hit;
          send(l.target, S * miss * l.pass, miss > 0 ? (readFraction - hit) / miss : 0);
        } else if (l.target.kind === 'elasticache') {
          send(l.target, S * readFraction * l.pass, 1);
        } else {
          send(l.target, S * l.pass, readFraction);
        }
      }
    } else if (FANOUT.has(s.kind)) {
      for (const l of out) send(l.target, S * l.pass, readFraction);
    } else if (s.kind === 'sqs') {
      const consumers = out.filter((l) => l.pass > 0);
      const caps = consumers.map((l) => l.target.capacity ?? Number.POSITIVE_INFINITY);
      const total = caps.reduce((a, b) => a + b, 0);
      const deliver = Math.min(S, total);
      s.backlog = S - deliver;
      consumers.forEach((l, i) => {
        const share = Number.isFinite(total) ? (caps[i] ?? 0) / total : 1 / consumers.length;
        send(l.target, deliver * share, readFraction);
      });
    }
  }

  // ---- 2. 成功率と応答時間（末端から） ----
  const queue = (util: number) => 1 / (1 - Math.min(util, 0.95));
  for (const id of [...order].reverse()) {
    const s = states.get(id);
    if (!s) continue;
    const out = links.get(id) ?? [];
    const own = s.down ? 0 : BASE_LATENCY[s.kind] * queue(s.util) + s.slowMs;
    if (s.down) {
      s.fail = 1;
      s.latency = TIMEOUT_MS;
      continue;
    }
    const keep = 1 - s.ownErr;
    if (FORWARDERS.has(s.kind)) {
      const healthy = out.filter((l) => l.pass > 0);
      const needsTarget = [
        'client',
        'route53',
        'waf',
        'cloudfront',
        'alb',
        'nlb',
        'apigw',
      ].includes(s.kind);
      if (!healthy.length) {
        s.fail = needsTarget ? 1 : s.ownErr;
        s.latency = own;
        continue;
      }
      const c = s.kind === 'cloudfront' ? cacheable : 0;
      let ok = 0;
      let lat = 0;
      for (const l of healthy) {
        ok += (l.pass * (1 - l.target.fail)) / healthy.length;
        lat += (l.pass * l.target.latency + (1 - l.pass) * TIMEOUT_MS) / healthy.length;
      }
      s.fail = 1 - keep * (c + (1 - c) * ok);
      s.latency = own + (1 - c) * lat;
    } else if (COMPUTE.has(s.kind)) {
      const readFraction = s.load > 0 ? s.reads / s.load : traffic.readRatio;
      const cacheAvail = Math.max(
        0,
        ...out.filter((l) => l.target.kind === 'elasticache').map((l) => l.pass),
      );
      const hit = readFraction * cacheable * cacheAvail;
      let ok = keep;
      let lat = own;
      for (const l of out) {
        const weight = DATABASES.has(l.target.kind)
          ? 1 - hit
          : l.target.kind === 'elasticache'
            ? readFraction
            : 1;
        const depFail = 1 - l.pass * (1 - l.target.fail);
        ok *= 1 - weight * depFail;
        lat += weight * (l.pass * l.target.latency + (1 - l.pass) * TIMEOUT_MS);
      }
      s.fail = 1 - ok;
      s.latency = lat;
    } else {
      // キュー・配信・データストアなど: 自分の分だけ（非同期の先の失敗は利用者に返らない）
      s.fail = s.ownErr;
      s.latency = own;
    }
  }

  // ---- ログと状態 ----
  for (const id of order) {
    const s = states.get(id);
    if (s) writeLogs(s, links.get(id) ?? []);
  }

  function writeLogs(s: State, out: Link[]) {
    if (s.down || s.load <= 0) return;
    const { logs } = s;
    if (s.ownErr > 0.001) {
      const detail = `処理能力を超えています（${fmt(s.load)} / ${fmt(s.capacity ?? 0)} req/s）`;
      if (s.kind === 'lambda') {
        logs.push({ level: 'ERROR', text: `Throttles: 同時実行数の上限に達しています。${detail}` });
      } else if (s.kind === 'apigw') {
        logs.push({ level: 'ERROR', text: `429 Too Many Requests: ${detail}` });
      } else {
        logs.push({
          level: 'ERROR',
          text: `${pct(s.ownErr)} のリクエストが失敗（503）。${detail}`,
        });
      }
    }
    if (s.util >= 0.7) {
      logs.push({ level: 'WARN', text: `CPUUtilization ${pct(Math.min(s.util, 1))}` });
      if ((s.kind === 'rds' || s.kind === 'aurora') && s.reads / s.load > 0.5) {
        logs.push({
          level: 'WARN',
          text: `ReadIOPS が高い状態です（クエリの ${pct(s.reads / s.load)} が読み取り）`,
        });
      }
    }
    for (const l of out) {
      if (l.pass >= 1) continue;
      const addr = `${ipOf(m, l.target.node)}:${l.port}`;
      if (FORWARDERS.has(s.kind) && s.kind !== 'natgw') {
        logs.push({
          level: 'WARN',
          text: `ターゲット ${l.target.node.name}（${addr}）がヘルスチェックに失敗しています`,
        });
      } else {
        logs.push({
          level: 'ERROR',
          text: `connect ETIMEDOUT ${addr}（${l.target.node.name}）`,
        });
      }
    }
    if (FORWARDERS.has(s.kind) && out.length && !out.some((l) => l.pass > 0)) {
      logs.push({ level: 'ERROR', text: '503 Service Unavailable: 正常な転送先がありません' });
    } else if (['alb', 'nlb', 'apigw'].includes(s.kind) && s.fail - s.ownErr > 0.01) {
      logs.push({
        level: 'WARN',
        text: `HTTPCode_Target_5XX_Count が増加しています（${pct(s.fail)}）`,
      });
    }
    if (s.kind === 'sqs') {
      if (!out.length) {
        logs.push({ level: 'WARN', text: 'メッセージを取り出す処理がつながっていません' });
      } else if (s.backlog > 0) {
        logs.push({
          level: 'WARN',
          text: `ApproximateNumberOfMessagesVisible が増え続けています（+${fmt(s.backlog)} 件/秒）`,
        });
      }
    }
    if (!logs.some((l) => l.level !== 'INFO')) {
      logs.push({
        level: 'INFO',
        text: `正常（${fmt(s.load)} req/s${s.capacity ? `、利用率 ${pct(s.util)}` : ''}）`,
      });
    }
  }

  const statusOf = (s: State): NodeStatus => {
    if (s.down) return 'down';
    if (s.load <= 0 && s.kind !== 'client') return 'idle';
    const computeFail = COMPUTE.has(s.kind) && s.fail > 0.01;
    if (s.ownErr > 0.01 || s.util >= 0.9 || computeFail || s.backlog > 0) return 'crit';
    if (s.logs.some((l) => l.level === 'ERROR')) return 'crit';
    if (s.util >= 0.7 || s.slowMs > 0 || s.fail > 0.01) return 'warn';
    return 'ok';
  };

  const nodes: Record<string, NodeMetrics> = {};
  for (const s of states.values()) {
    nodes[s.node.id] = {
      nodeId: s.node.id,
      load: s.load,
      capacity: s.capacity,
      utilization: s.util,
      errorRate: s.ownErr,
      latencyMs: round(s.latency),
      status: statusOf(s),
      backlog: s.kind === 'sqs' ? s.backlog : undefined,
      logs: s.logs,
    };
  }

  const successRate = clients.length
    ? clients.reduce((a, c) => a + (1 - c.fail), 0) / clients.length
    : 1;
  const latencyMs = clients.length
    ? round(clients.reduce((a, c) => a + c.latency, 0) / clients.length)
    : 0;
  return {
    rps,
    successRate: Math.max(0, Math.min(1, successRate)),
    latencyMs,
    costUsd: monthlyCost(m.doc).total,
    backlog: [...states.values()].reduce((a, s) => a + s.backlog, 0),
    nodes,
  };
}
