import { getViewportForBounds, useReactFlow } from '@xyflow/react';
import { toPng } from 'html-to-image';

const PADDING = 48;
const MAX_SIZE = 4000;

/** キャンバス全体（表示範囲ではなく全ノード）を PNG にして保存する */
export function useExportPng() {
  const { getNodes, getNodesBounds } = useReactFlow();

  return async (fileName: string) => {
    const nodes = getNodes();
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
    if (!nodes.length || !viewport) return;
    const bounds = getNodesBounds(nodes);
    const width = Math.min(MAX_SIZE, Math.ceil(bounds.width + PADDING * 2));
    const height = Math.min(MAX_SIZE, Math.ceil(bounds.height + PADDING * 2));
    const { x, y, zoom } = getViewportForBounds(bounds, width, height, 0.1, 1, `${PADDING}px`);
    const background = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#f5f7fa';
    // 判定やシミュレーションの色・接続点は図に含めない
    const root = viewport.closest('.react-flow');
    root?.classList.add('is-exporting');
    const dataUrl = await toPng(viewport, {
      backgroundColor: background,
      width,
      height,
      pixelRatio: 2,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
      },
    }).finally(() => root?.classList.remove('is-exporting'));
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
  };
}
