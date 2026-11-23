import { CATEGORIES, SERVICES, type ServiceKind } from '../engine/catalog';
import styles from './ServiceIcon.module.css';

/** 公式アイコン取り込み前の代替表示。カテゴリ色の角丸に略称を出す */
export function ServiceIcon({ kind, size = 40 }: { kind: ServiceKind; size?: number }) {
  const def = SERVICES[kind];
  return (
    <span
      className={styles.icon}
      style={{
        width: size,
        height: size,
        background: CATEGORIES[def.category].color,
        fontSize: def.short.length > 4 ? size * 0.24 : size * 0.3,
      }}
      aria-hidden
    >
      {def.short}
    </span>
  );
}
