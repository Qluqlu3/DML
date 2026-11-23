import type { SecurityGroup, SgRule } from '../engine/document';
import { useCanvasStore } from '../store/canvasStore';
import styles from './Inspector.module.css';

const COMMON_PORTS = [22, 80, 443, 3306, 5432, 6379, 11211];

function RuleRow({ sg, rule, peers }: { sg: SecurityGroup; rule: SgRule; peers: SecurityGroup[] }) {
  const updateSgRule = useCanvasStore((s) => s.updateSgRule);
  const removeSgRule = useCanvasStore((s) => s.removeSgRule);
  const sourceValue = rule.source.type === 'sg' ? `sg:${rule.source.sgId}` : 'cidr';
  return (
    <div className={styles.ruleRow}>
      <input
        type='number'
        list='common-ports'
        min={1}
        max={65535}
        value={rule.port}
        aria-label='ポート'
        onChange={(e) => {
          const port = Number(e.target.value);
          if (Number.isInteger(port) && port >= 1 && port <= 65535) {
            updateSgRule(sg.id, rule.id, { port });
          }
        }}
      />
      <select
        value={sourceValue}
        aria-label='送信元'
        onChange={(e) => {
          const v = e.target.value;
          updateSgRule(sg.id, rule.id, {
            source:
              v === 'cidr' ? { type: 'cidr', cidr: '0.0.0.0/0' } : { type: 'sg', sgId: v.slice(3) },
          });
        }}
      >
        <option value='cidr'>CIDR</option>
        {peers.map((p) => (
          <option key={p.id} value={`sg:${p.id}`}>
            SG: {p.name}
          </option>
        ))}
      </select>
      {rule.source.type === 'cidr' ? (
        <input
          type='text'
          value={rule.source.cidr}
          aria-label='CIDR'
          onChange={(e) =>
            updateSgRule(sg.id, rule.id, { source: { type: 'cidr', cidr: e.target.value } })
          }
        />
      ) : (
        <span />
      )}
      <button
        type='button'
        className={styles.iconButton}
        aria-label='ルールを削除'
        onClick={() => removeSgRule(sg.id, rule.id)}
      >
        ×
      </button>
    </div>
  );
}

function SecurityGroupCard({ sg, peers }: { sg: SecurityGroup; peers: SecurityGroup[] }) {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateSecurityGroup = useCanvasStore((s) => s.updateSecurityGroup);
  const removeSecurityGroup = useCanvasStore((s) => s.removeSecurityGroup);
  const addSgRule = useCanvasStore((s) => s.addSgRule);
  const users = nodes.filter(
    (n) =>
      Array.isArray(n.data.config.securityGroupIds) &&
      n.data.config.securityGroupIds.includes(sg.id),
  );
  return (
    <div className={styles.sgCard}>
      <div className={styles.sgHeader}>
        <input
          type='text'
          value={sg.name}
          aria-label='SG 名'
          onChange={(e) => updateSecurityGroup(sg.id, { name: e.target.value })}
        />
        <button
          type='button'
          className={styles.iconButton}
          aria-label='SG を削除'
          onClick={() => removeSecurityGroup(sg.id)}
        >
          ×
        </button>
      </div>
      <p className={styles.help}>
        割り当て先: {users.length ? users.map((n) => n.data.name).join(', ') : 'なし'}
      </p>
      <span className={styles.label}>インバウンドルール</span>
      {sg.inbound.length === 0 && <p className={styles.empty}>すべて拒否（ルールなし）</p>}
      {sg.inbound.map((rule) => (
        <RuleRow key={rule.id} sg={sg} rule={rule} peers={peers} />
      ))}
      <button
        type='button'
        className={styles.linkButton}
        onClick={() => addSgRule(sg.id, { port: 443, source: { type: 'cidr', cidr: '0.0.0.0/0' } })}
      >
        + ルールを追加
      </button>
    </div>
  );
}

export function SecurityGroupPanel() {
  const nodes = useCanvasStore((s) => s.nodes);
  const securityGroups = useCanvasStore((s) => s.securityGroups);
  const addSecurityGroup = useCanvasStore((s) => s.addSecurityGroup);
  const vpcs = nodes.filter((n) => n.data.kind === 'vpc');

  if (!vpcs.length) {
    return (
      <div className={styles.section}>
        <p className={styles.empty}>VPC を配置すると、セキュリティグループを作成できます。</p>
      </div>
    );
  }
  return (
    <div className={styles.section}>
      <datalist id='common-ports'>
        {COMMON_PORTS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <p className={styles.help}>
        アウトバウンドはすべて許可として扱います。インバウンドで許可した通信だけが届きます。
      </p>
      {vpcs.map((vpc) => {
        const groups = securityGroups.filter((g) => g.vpcId === vpc.id);
        return (
          <section key={vpc.id} className={styles.sgVpc}>
            <h3 className={styles.kind}>{vpc.data.name}</h3>
            {groups.map((sg) => (
              <SecurityGroupCard key={sg.id} sg={sg} peers={groups} />
            ))}
            <button
              type='button'
              className={styles.secondary}
              onClick={() => addSecurityGroup(vpc.id)}
            >
              + SG を追加
            </button>
          </section>
        );
      })}
    </div>
  );
}
