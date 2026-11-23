import { useState } from 'react';
import {
  CATEGORIES,
  iconUrl,
  SERVICE_ICON_STYLE,
  SERVICES,
  type ServiceKind,
} from '../engine/catalog';
import styles from './ServiceIcon.module.css';

/**
 * AWS 公式アイコン。読み込めない場合はカテゴリ色の角丸に略称を出す。
 * resource 種のアイコン（背景なしの線画）は白い台座の上に描く。
 */
export function ServiceIcon({ kind, size = 40 }: { kind: ServiceKind; size?: number }) {
  const [failed, setFailed] = useState(false);
  const def = SERVICES[kind];

  if (failed) {
    return (
      <span
        className={styles.fallback}
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

  const resource = SERVICE_ICON_STYLE[kind] === 'resource';
  return (
    <span
      className={resource ? styles.plate : styles.service}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img
        src={iconUrl(kind)}
        alt=''
        width={resource ? size * 0.82 : size}
        height={resource ? size * 0.82 : size}
        draggable={false}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
