import { useEffect, useState } from 'react';
import type { ArchDocument } from '../engine/document';
import { toDocument, useCanvasStore } from '../store/canvasStore';

/** キャンバスの構成を、変更のたびではなく ms ごとに間引いて返す（判定の再計算用） */
export function useThrottledDocument(ms = 250): ArchDocument {
  const [doc, setDoc] = useState(() => toDocument(useCanvasStore.getState()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;
    const flush = () => setDoc(toDocument(useCanvasStore.getState()));
    const tick = () => {
      timer = undefined;
      if (pending) {
        pending = false;
        flush();
        timer = setTimeout(tick, ms);
      }
    };
    const unsubscribe = useCanvasStore.subscribe((s, p) => {
      if (s.nodes === p.nodes && s.edges === p.edges && s.securityGroups === p.securityGroups) {
        return;
      }
      if (timer) {
        pending = true;
        return;
      }
      flush();
      timer = setTimeout(tick, ms);
    });
    // 購読前に置き換わった構成も拾う
    flush();
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [ms]);

  return doc;
}
