import { type FitViewOptions, useReactFlow } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import type { ArchDocument } from '../engine/document';
import { toDocument, useCanvasStore } from '../store/canvasStore';
import { saveStored } from '../store/persistence';

const AUTOSAVE_DELAY_MS = 500;

const DEFAULT_FIT: FitViewOptions = { padding: 0.12 };

/**
 * 画面を開いたときに load() の構成でキャンバスを置き換え、以降の変更を key に自動保存する。
 * key が null のときは保存しない。paused.current が true の間は保存しない（模範解答の表示中など）。
 */
export function useDocumentAutosave(
  key: string | null,
  load: () => ArchDocument,
  fitOptions: FitViewOptions = DEFAULT_FIT,
  paused?: { readonly current: boolean },
) {
  const replaceDocument = useCanvasStore((s) => s.replaceDocument);
  const { fitView } = useReactFlow();
  const loadRef = useRef(load);
  loadRef.current = load;
  const fitRef = useRef(fitOptions);
  fitRef.current = fitOptions;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const isPaused = () => pausedRef.current?.current === true;
    const doc = loadRef.current();
    replaceDocument(doc);
    if (doc.nodes.length) requestAnimationFrame(() => fitView(fitRef.current));
    if (!key) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useCanvasStore.subscribe((state, prev) => {
      if (
        state.nodes === prev.nodes &&
        state.edges === prev.edges &&
        state.securityGroups === prev.securityGroups
      ) {
        return;
      }
      clearTimeout(timer);
      if (isPaused()) return;
      timer = setTimeout(() => saveStored(key, toDocument(state)), AUTOSAVE_DELAY_MS);
    });
    return () => {
      // 画面を離れるときは保留中の保存をすぐ行う
      clearTimeout(timer);
      if (!isPaused()) saveStored(key, toDocument(useCanvasStore.getState()));
      unsubscribe();
    };
  }, [key, replaceDocument, fitView]);
}
