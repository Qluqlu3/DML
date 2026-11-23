import { useMemo, useState } from 'react';
import { ServiceIcon } from '../canvas/ServiceIcon';
import {
  CONTAINERS,
  configFields,
  isContainerKind,
  kindLabel,
  SERVICES,
  type ServiceKind,
} from '../engine/catalog';
import { type AppEdge, type AppNode, toPlaced, useCanvasStore } from '../store/canvasStore';
import { ConfigFieldInput } from './fields';
import styles from './Inspector.module.css';
import { SecurityGroupPanel } from './SecurityGroupPanel';

function NodeInspector({ node }: { node: AppNode }) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const removeElements = useCanvasStore((s) => s.removeElements);
  const scoped = useMemo(() => nodes.map(toPlaced), [nodes]);
  const self = scoped.find((n) => n.id === node.id);
  const kind = node.data.kind;
  const container = isContainerKind(kind);
  const description = container ? CONTAINERS[kind].description : SERVICES[kind].description;
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.data.name ?? '?';
  const outgoing = edges.filter((e) => e.source === node.id);
  const incoming = edges.filter((e) => e.target === node.id);

  if (!self) return null;
  return (
    <div className={styles.section}>
      <div className={styles.title}>
        {!container && <ServiceIcon kind={kind as ServiceKind} size={32} />}
        <div>
          <div className={styles.kind}>{kindLabel(kind)}</div>
          <div className={styles.description}>{description}</div>
        </div>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>名前</span>
        <input
          type='text'
          value={node.data.name}
          onChange={(e) => updateNode(node.id, { name: e.target.value })}
        />
      </label>

      {configFields(kind).map((field) => (
        <div key={field.key} className={styles.field}>
          <span className={styles.label}>{field.label}</span>
          <ConfigFieldInput
            field={field}
            value={node.data.config[field.key]}
            node={self}
            nodes={scoped}
            onChange={(value) => updateNode(node.id, { config: { [field.key]: value } })}
          />
          {field.help && <span className={styles.help}>{field.help}</span>}
        </div>
      ))}

      {!container && (
        <div className={styles.field}>
          <span className={styles.label}>接続</span>
          {outgoing.length + incoming.length === 0 && <p className={styles.empty}>接続なし</p>}
          <ul className={styles.connections}>
            {incoming.map((e) => (
              <li key={e.id}>
                ← {nameOf(e.source)} <span className={styles.port}>:{e.data?.port}</span>
              </li>
            ))}
            {outgoing.map((e) => (
              <li key={e.id}>
                → {nameOf(e.target)} <span className={styles.port}>:{e.data?.port}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type='button' className={styles.danger} onClick={() => removeElements([node.id], [])}>
        {container ? '枠と中身を削除' : '削除'}
      </button>
    </div>
  );
}

function EdgeInspector({ edge }: { edge: AppEdge }) {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateEdgePort = useCanvasStore((s) => s.updateEdgePort);
  const removeElements = useCanvasStore((s) => s.removeElements);
  const from = nodes.find((n) => n.id === edge.source);
  const to = nodes.find((n) => n.id === edge.target);
  return (
    <div className={styles.section}>
      <div className={styles.kind}>接続</div>
      <p className={styles.edgeRoute}>
        {from?.data.name} → {to?.data.name}
      </p>
      <p className={styles.help}>矢印の向きはリクエスト（メッセージ）を送る方向です。</p>
      <label className={styles.field}>
        <span className={styles.label}>宛先ポート</span>
        <input
          type='number'
          min={1}
          max={65535}
          value={edge.data?.port ?? 443}
          onChange={(e) => {
            const port = Number(e.target.value);
            if (Number.isInteger(port) && port >= 1 && port <= 65535) updateEdgePort(edge.id, port);
          }}
        />
      </label>
      <button type='button' className={styles.danger} onClick={() => removeElements([], [edge.id])}>
        接続を削除
      </button>
    </div>
  );
}

function SelectionInspector() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const removeElements = useCanvasStore((s) => s.removeElements);
  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedEdges = edges.filter((e) => e.selected);
  const total = selectedNodes.length + selectedEdges.length;

  if (total === 0) {
    return (
      <div className={styles.section}>
        <p className={styles.empty}>ノードや接続を選択すると、ここに設定が表示されます。</p>
        <ul className={styles.tips}>
          <li>
            パレットからドラッグして配置（EC2・RDS などはサブネットの中、ALB などは VPC の中）
          </li>
          <li>ノードの縁の点からドラッグして、別のノードの上で離すと接続</li>
          <li>VPC / AZ / サブネットは見出し部分を掴んで移動、選択して四隅でリサイズ</li>
          <li>Delete で削除、⌘Z / ⇧⌘Z で元に戻す・やり直す</li>
        </ul>
      </div>
    );
  }
  if (selectedNodes.length === 1 && selectedEdges.length === 0 && selectedNodes[0]) {
    return <NodeInspector node={selectedNodes[0]} />;
  }
  if (selectedEdges.length === 1 && selectedNodes.length === 0 && selectedEdges[0]) {
    return <EdgeInspector edge={selectedEdges[0]} />;
  }
  return (
    <div className={styles.section}>
      <p>{total} 件を選択中</p>
      <button
        type='button'
        className={styles.danger}
        onClick={() =>
          removeElements(
            selectedNodes.map((n) => n.id),
            selectedEdges.map((e) => e.id),
          )
        }
      >
        選択をすべて削除
      </button>
    </div>
  );
}

type Tab = 'props' | 'sg';

export function Inspector() {
  const [tab, setTab] = useState<Tab>('props');
  const sgCount = useCanvasStore((s) => s.securityGroups.length);
  return (
    <div className={styles.inspector}>
      <div className={styles.tabs} role='tablist'>
        <button
          type='button'
          role='tab'
          aria-selected={tab === 'props'}
          className={tab === 'props' ? styles.tabActive : styles.tab}
          onClick={() => setTab('props')}
        >
          プロパティ
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={tab === 'sg'}
          className={tab === 'sg' ? styles.tabActive : styles.tab}
          onClick={() => setTab('sg')}
        >
          セキュリティグループ ({sgCount})
        </button>
      </div>
      {tab === 'props' ? <SelectionInspector /> : <SecurityGroupPanel />}
    </div>
  );
}
