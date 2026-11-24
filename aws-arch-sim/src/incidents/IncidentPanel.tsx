import { useState } from 'react';
import { Link } from 'react-router';
import { Stars } from '../challenges/ChallengePanel';
import extra from '../challenges/ChallengePanel.module.css';
import { kindLabel, type NodeKind } from '../engine/catalog';
import type { NodeMetrics, NodeStatus, SimResult } from '../engine/simulator/types';
import base from '../learning/GuidePanel.module.css';
import { RichText } from '../learning/RichText';
import { TopicIcon } from '../learning/TopicIcon';
import { topicTitle } from '../learning/topics';
import styles from './IncidentPanel.module.css';
import { formatPct, type IncidentRun, type IncidentScore } from './incidents';
import type { IncidentProgress, TurnRecord } from './progressStore';
import type { Incident } from './types';

export type SelectedNode = {
  id: string;
  name: string;
  kind: NodeKind;
  /** 最後に適用した構成でのメトリクス（未適用のノードは undefined） */
  metrics?: NodeMetrics;
};

type IncidentPanelProps = {
  incident: Incident;
  number: number;
  next: Incident | null;
  progress: IncidentProgress;
  /** 最後に適用した構成の実行結果 */
  run: IncidentRun;
  /** 1 つ前のターン（なければ初期状態）の実行結果 */
  previous: Pick<SimResult, 'successRate' | 'latencyMs' | 'costUsd'> | null;
  pendingChanges: string[];
  selected: SelectedNode | null;
  score: IncidentScore | null;
  onApply: () => void;
  onHint: () => void;
  onGiveUp: () => void;
  onRestart: () => void;
};

const STATUS: Record<NodeStatus, { label: string; className?: string }> = {
  ok: { label: '正常', className: styles.ok },
  warn: { label: '注意', className: styles.warn },
  crit: { label: '異常', className: styles.crit },
  down: { label: '停止', className: styles.down },
  idle: { label: 'リクエストなし', className: styles.idle },
};

const fmt = (n: number) => Math.round(n).toLocaleString();

function Delta({ now, before, better }: { now: number; before?: number; better: 'up' | 'down' }) {
  if (before === undefined || Math.abs(now - before) < 1e-6) return null;
  const improved = better === 'up' ? now > before : now < before;
  return (
    <span className={improved ? styles.better : styles.worse}>{now > before ? '▲' : '▼'}</span>
  );
}

export function Overview({
  sim,
  previous,
}: {
  sim: SimResult;
  previous?: IncidentPanelProps['previous'];
}) {
  return (
    <div className={styles.overview}>
      <div className={styles.stat}>
        <span>成功率</span>
        <strong className={sim.successRate < 0.999 ? styles.bad : undefined}>
          {formatPct(sim.successRate)}
          <Delta now={sim.successRate} before={previous?.successRate} better='up' />
        </strong>
      </div>
      <div className={styles.stat}>
        <span>応答時間 p95</span>
        <strong>
          {sim.successRate === 0 ? '—' : `${fmt(sim.latencyMs)}ms`}
          <Delta now={sim.latencyMs} before={previous?.latencyMs} better='down' />
        </strong>
      </div>
      <div className={styles.stat}>
        <span>月額の概算</span>
        <strong>
          ${fmt(sim.costUsd)}
          <Delta now={sim.costUsd} before={previous?.costUsd} better='down' />
        </strong>
      </div>
      <div className={styles.stat}>
        <span>リクエスト</span>
        <strong>{fmt(sim.rps)}/秒</strong>
      </div>
      {sim.backlog > 0 && (
        <div className={styles.stat}>
          <span>キューの滞留</span>
          <strong className={styles.bad}>+{fmt(sim.backlog)}/秒</strong>
        </div>
      )}
    </div>
  );
}

export function NodeView({ selected }: { selected: SelectedNode | null }) {
  if (!selected) {
    return (
      <p className={styles.placeholder}>
        キャンバスのノードを選ぶと、そのノードのメトリクスとログが見られます（調査はターンを消費しません）。
      </p>
    );
  }
  const m = selected.metrics;
  return (
    <div className={styles.node}>
      <div className={styles.nodeHead}>
        <strong>{selected.name}</strong>
        <span className={styles.kind}>{kindLabel(selected.kind)}</span>
        {m && (
          <span className={`${styles.chip} ${STATUS[m.status].className}`}>
            {STATUS[m.status].label}
          </span>
        )}
      </div>
      {!m ? (
        <p className={styles.placeholder}>
          まだ適用していないノードです。「変更を適用」すると計測されます。
        </p>
      ) : (
        <>
          <dl className={styles.metrics}>
            <dt>負荷</dt>
            <dd>{fmt(m.load)} req/s</dd>
            <dt>処理能力</dt>
            <dd>{m.capacity === null ? '上限なし' : `${fmt(m.capacity)} req/s`}</dd>
            {m.capacity !== null && (
              <>
                <dt>利用率</dt>
                <dd>
                  <span className={styles.util}>
                    <span
                      className={
                        m.utilization >= 0.9
                          ? styles.utilCrit
                          : m.utilization >= 0.7
                            ? styles.utilWarn
                            : styles.utilOk
                      }
                      style={{ width: `${Math.min(m.utilization, 1) * 100}%` }}
                    />
                  </span>
                  {Math.round(m.utilization * 100)}%
                </dd>
              </>
            )}
            <dt>エラー率</dt>
            <dd className={m.errorRate > 0.001 ? styles.bad : undefined}>
              {formatPct(m.errorRate)}
            </dd>
            <dt>応答時間</dt>
            <dd>{m.status === 'down' ? '—' : `${fmt(m.latencyMs)}ms（この先を含む）`}</dd>
            {m.backlog !== undefined && (
              <>
                <dt>滞留</dt>
                <dd className={m.backlog > 0 ? styles.bad : undefined}>+{fmt(m.backlog)} 件/秒</dd>
              </>
            )}
          </dl>
          <ol className={styles.logs} aria-label='ログ'>
            {m.logs.length === 0 && <li className={styles.logInfo}>ログはありません</li>}
            {m.logs.map((l) => (
              <li
                key={`${l.level}:${l.text}`}
                className={
                  l.level === 'ERROR'
                    ? styles.logError
                    : l.level === 'WARN'
                      ? styles.logWarn
                      : styles.logInfo
                }
              >
                <span>{l.level}</span> {l.text}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function Hints({
  incident,
  used,
  onHint,
}: {
  incident: Incident;
  used: number;
  onHint: () => void;
}) {
  return (
    <div className={base.help}>
      {incident.hints.slice(0, used).map((h, i) => (
        <p key={h} className={base.hint}>
          <span className={base.hintLabel}>ヒント {i + 1}</span>
          {h}
        </p>
      ))}
      {used < incident.hints.length && (
        <div className={base.helpButtons}>
          <button type='button' className={base.secondary} onClick={onHint}>
            ヒントを見る（−5 点）
          </button>
        </div>
      )}
    </div>
  );
}

function History({ turns }: { turns: TurnRecord[] }) {
  if (!turns.length) return null;
  return (
    <div>
      <div className={extra.listTitle}>ターンの振り返り</div>
      <ol className={styles.history}>
        {turns.map((t) => (
          <li key={t.turn}>
            <div className={styles.historyHead}>
              <strong>ターン {t.turn}</strong>
              <span>
                成功率 {formatPct(t.successRate)}・{t.successRate === 0 ? '—' : `${t.latencyMs}ms`}
                ・$
                {fmt(t.costUsd)}
              </span>
              {t.resolved && <span className={`${styles.chip} ${styles.ok}`}>解決</span>}
            </div>
            <ul>
              {t.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Topics({ incident }: { incident: Incident }) {
  return (
    <div className={base.topics}>
      {incident.topics.map((t) => (
        <Link key={t} to={`/guide/${t}`} className={`${base.topic} ${extra.topicLink}`}>
          <TopicIcon topic={t} size={18} />
          {topicTitle(t)}
        </Link>
      ))}
    </div>
  );
}

function Explanation({ incident }: { incident: Incident }) {
  return (
    <>
      <div className={base.badLabel}>根本原因</div>
      <RichText text={incident.rootCause} className={base.why} />
      <div className={base.whyLabel}>解説</div>
      <RichText text={incident.explanation} className={base.why} />
      <Topics incident={incident} />
    </>
  );
}

function SolvedView(props: IncidentPanelProps) {
  const { incident, progress, score, next } = props;
  return (
    <div className={base.body}>
      <div className={base.cleared}>
        <div className={base.clearedTitle}>解決！</div>
        {score && !progress.gaveUp ? (
          <>
            <div className={extra.score}>
              <strong>{score.total}</strong> 点
              {progress.bestScore !== undefined && (
                <span className={extra.best}>ベスト {progress.bestScore} 点</span>
              )}
            </div>
            <ul className={extra.parts}>
              {score.parts.map((p) => (
                <li key={p.label}>
                  <span>{p.label}</span>
                  <span>{p.points > 0 ? `+${p.points}` : p.points}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <span className={extra.note}>解説を見たあとの解決なので、点数は記録されません。</span>
        )}
      </div>
      <Overview sim={props.run.sim} previous={props.previous} />
      <Explanation incident={incident} />
      <History turns={progress.turns} />
      {next ? (
        <Link to={`/incidents/${next.id}`} className={base.primaryLink}>
          次のインシデントへ: {next.title}
        </Link>
      ) : (
        <Link to='/incidents' className={base.primaryLink}>
          インシデント一覧へ
        </Link>
      )}
      <button type='button' className={base.secondary} onClick={props.onRestart}>
        最初からやり直す
      </button>
    </div>
  );
}

function WorkingView(props: IncidentPanelProps) {
  const { incident, progress, run, pendingChanges, number } = props;
  const turn = progress.turns.length;
  const alarm = run.outcomes.some(
    (o) => ['success', 'latency'].includes(o.check.id) && !o.result.pass,
  );
  // メトリクスが回復しても解決にならないときだけ、構成の条件を明かす
  const unmet = alarm ? [] : run.outcomes.filter((o) => !o.result.pass);
  return (
    <div className={base.body}>
      <div className={extra.meta}>
        <span className={base.stepLabel}>インシデント {number}</span>
        <Stars n={incident.difficulty} />
        <span className={styles.turn}>{turn === 0 ? '発生直後' : `ターン ${turn} 適用後`}</span>
      </div>

      <div className={alarm ? styles.alarm : styles.alarmOk}>
        <div className={styles.alarmHead}>
          <span className={styles.alarmState}>{alarm ? 'ALARM' : 'OK'}</span>
          <strong>{incident.alert.name}</strong>
        </div>
        <span>{incident.alert.condition}</span>
      </div>

      <details className={styles.report} open={turn === 0}>
        <summary>状況の報告</summary>
        <RichText text={incident.report} className={base.instruction} />
      </details>

      <Overview sim={run.sim} previous={props.previous} />

      {unmet.length > 0 && (
        <div className={styles.unmet}>
          <strong>利用者への影響は収まりましたが、まだ解決とは言えません</strong>
          <ul>
            {unmet.map((o) => (
              <li key={o.check.id}>{o.check.label}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className={extra.listTitle}>調査</div>
        <NodeView selected={props.selected} />
      </div>

      <div>
        <div className={extra.listTitle}>
          未適用の変更<span>{pendingChanges.length} 件</span>
        </div>
        {pendingChanges.length ? (
          <ul className={styles.changes}>
            {pendingChanges.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.placeholder}>キャンバスで構成を変更すると、ここに一覧が出ます。</p>
        )}
        <button
          type='button'
          className={base.primary}
          onClick={props.onApply}
          disabled={!pendingChanges.length}
        >
          変更を適用（ターン {turn + 1}）
        </button>
      </div>

      <Hints incident={incident} used={progress.hintsUsed} onHint={props.onHint} />

      {progress.gaveUp ? (
        <Explanation incident={incident} />
      ) : (
        <button type='button' className={styles.giveUp} onClick={props.onGiveUp}>
          あきらめて解説を見る
        </button>
      )}
      <History turns={progress.turns} />
    </div>
  );
}

/** インシデントモードの左上パネル */
export function IncidentPanel(props: IncidentPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section
      className={`${base.panel} ${styles.panel} ${collapsed ? base.collapsed : ''}`}
      aria-label='インシデント'
    >
      <header className={base.panelHeader}>
        <span className={base.panelTitle}>{props.incident.title}</span>
        <button
          type='button'
          className={base.collapse}
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
        >
          {collapsed ? '開く' : 'たたむ'}
        </button>
      </header>
      {!collapsed &&
        (props.progress.solved ? <SolvedView {...props} /> : <WorkingView {...props} />)}
    </section>
  );
}
