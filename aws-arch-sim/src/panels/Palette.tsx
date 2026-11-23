import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DND_MIME } from '../canvas/Canvas';
import { ServiceIcon } from '../canvas/ServiceIcon';
import {
  CATEGORIES,
  CATEGORY_ORDER,
  CONTAINERS,
  type ContainerKind,
  type NodeKind,
  SERVICE_KINDS,
  SERVICES,
} from '../engine/catalog';
import styles from './Palette.module.css';

const CONTAINER_ORDER: ContainerKind[] = ['vpc', 'az', 'subnet'];

function onDragStart(e: DragEvent, kind: NodeKind) {
  e.dataTransfer.setData(DND_MIME, kind);
  e.dataTransfer.effectAllowed = 'copy';
}

type PaletteProps = {
  onAdd: (kind: NodeKind) => void;
  /** 光らせる項目（学習モード） */
  highlightKinds?: NodeKind[];
};

export function Palette({ onAdd, highlightKinds }: PaletteProps) {
  const listRef = useRef<HTMLElement>(null);
  const highlightKey = highlightKinds?.join(',') ?? '';
  // 光らせる項目が見えるようにスクロールする
  useEffect(() => {
    if (!highlightKey) return;
    listRef.current
      ?.querySelector(`.${styles.highlight}`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightKey]);
  const itemClass = (kind: NodeKind) =>
    `${styles.item} ${highlightKinds?.includes(kind) ? styles.highlight : ''}`;

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        kinds: SERVICE_KINDS.filter((k) => SERVICES[k].category === category).filter(
          (k) =>
            !q ||
            SERVICES[k].label.toLowerCase().includes(q) ||
            SERVICES[k].short.toLowerCase().includes(q),
        ),
      })).filter((g) => g.kinds.length),
    [q],
  );
  const containers = CONTAINER_ORDER.filter(
    (k) => !q || CONTAINERS[k].label.toLowerCase().includes(q),
  );

  return (
    <aside className={styles.palette} ref={listRef}>
      <input
        className={styles.search}
        type='search'
        placeholder='サービスを検索'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className={styles.tip}>ドラッグで配置（クリックで画面中央に追加）</p>

      {containers.length > 0 && (
        <section>
          <h3 className={styles.heading}>ネットワーク枠</h3>
          {containers.map((kind) => (
            <button
              type='button'
              key={kind}
              className={itemClass(kind)}
              draggable
              onDragStart={(e) => onDragStart(e, kind)}
              onClick={() => onAdd(kind)}
              title={CONTAINERS[kind].description}
            >
              <span className={`${styles.frame} ${styles[kind]}`} aria-hidden />
              <span>{CONTAINERS[kind].label}</span>
            </button>
          ))}
        </section>
      )}

      {groups.map((g) => (
        <section key={g.category}>
          <h3 className={styles.heading}>{CATEGORIES[g.category].label}</h3>
          {g.kinds.map((kind) => (
            <button
              type='button'
              key={kind}
              className={itemClass(kind)}
              draggable
              onDragStart={(e) => onDragStart(e, kind)}
              onClick={() => onAdd(kind)}
              title={SERVICES[kind].description}
            >
              <ServiceIcon kind={kind} size={28} />
              <span>{SERVICES[kind].label}</span>
            </button>
          ))}
        </section>
      ))}
    </aside>
  );
}
