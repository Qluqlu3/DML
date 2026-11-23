import { useMemo } from 'react';
import type { ConfigField, ConfigValue } from '../engine/catalog';
import { indexById } from '../engine/placement';
import { routeOptions, type ScopedNode, scopeVpcId, subnetOptions } from '../engine/scope';
import { useCanvasStore } from '../store/canvasStore';
import styles from './Inspector.module.css';

type FieldProps = {
  field: ConfigField;
  value: ConfigValue | undefined;
  node: ScopedNode;
  nodes: ScopedNode[];
  onChange: (value: ConfigValue) => void;
};

const asList = (v: ConfigValue | undefined): string[] => (Array.isArray(v) ? v : []);

function toggle(list: string[], id: string, on: boolean): string[] {
  return on ? [...list, id] : list.filter((x) => x !== id);
}

function SubnetsField({ field, value, node, nodes, onChange }: FieldProps) {
  if (field.type !== 'subnets') return null;
  const byId = indexById(nodes);
  // Lambda はまだサブネットを選んでいなければ全 VPC から選べる
  const vpcId = scopeVpcId(node, byId);
  const options = subnetOptions(nodes, vpcId, field.subnetType);
  const selected = asList(value);
  const azCount = new Set(options.filter((o) => selected.includes(o.id)).map((o) => o.azId)).size;

  if (!options.length) {
    return (
      <p className={styles.empty}>
        {field.subnetType === 'private' ? 'Private ' : ''}サブネットがありません
      </p>
    );
  }
  return (
    <div className={styles.checkList}>
      {options.map((o) => (
        <label key={o.id} className={styles.check}>
          <input
            type='checkbox'
            checked={selected.includes(o.id)}
            onChange={(e) => onChange(toggle(selected, o.id, e.target.checked))}
          />
          <span className={o.subnetType === 'private' ? styles.tagPrivate : styles.tagPublic}>
            {o.subnetType === 'private' ? 'Pri' : 'Pub'}
          </span>
          {o.label}
        </label>
      ))}
      <p className={selected.length < field.min ? styles.warn : styles.note}>
        {selected.length < field.min
          ? `${field.min} つ以上選んでください`
          : selected.length
            ? `${azCount} AZ にまたがる`
            : '未指定'}
      </p>
    </div>
  );
}

function SecurityGroupsField({ value, node, nodes, onChange }: FieldProps) {
  const securityGroups = useCanvasStore((s) => s.securityGroups);
  const addSecurityGroup = useCanvasStore((s) => s.addSecurityGroup);
  const vpcId = scopeVpcId(node, indexById(nodes));
  const selected = asList(value);
  if (!vpcId) return <p className={styles.empty}>VPC に接続すると指定できます</p>;
  const options = securityGroups.filter((g) => g.vpcId === vpcId);
  return (
    <div className={styles.checkList}>
      {options.map((g) => (
        <label key={g.id} className={styles.check}>
          <input
            type='checkbox'
            checked={selected.includes(g.id)}
            onChange={(e) => onChange(toggle(selected, g.id, e.target.checked))}
          />
          {g.name}
        </label>
      ))}
      <button
        type='button'
        className={styles.linkButton}
        onClick={() => {
          const id = addSecurityGroup(vpcId, `${node.name.toLowerCase().replace(/\s+/g, '-')}-sg`);
          onChange([...selected, id]);
        }}
      >
        + 新しい SG を作成して割り当て
      </button>
    </div>
  );
}

function RouteField({ value, node, nodes, onChange }: FieldProps) {
  const options = useMemo(() => routeOptions(node.id, nodes), [node.id, nodes]);
  return (
    <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ConfigFieldInput(props: FieldProps) {
  const { field, value, onChange } = props;
  switch (field.type) {
    case 'select':
      return (
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'number':
      return (
        <div className={styles.numberRow}>
          <input
            type='number'
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={Number(value)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(Math.min(field.max, Math.max(field.min, n)));
            }}
          />
          {field.unit && <span className={styles.unit}>{field.unit}</span>}
        </div>
      );
    case 'boolean':
      return (
        <label className={styles.check}>
          <input
            type='checkbox'
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          有効
        </label>
      );
    case 'text':
      return (
        <input type='text' value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      );
    case 'subnets':
      return <SubnetsField {...props} />;
    case 'securityGroups':
      return <SecurityGroupsField {...props} />;
    case 'route':
      return <RouteField {...props} />;
  }
}
