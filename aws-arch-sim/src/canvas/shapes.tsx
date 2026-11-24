import type { ReactNode } from 'react';
import type { Shape } from '../engine/catalog';

/** シェイプ描画領域（ノード上部）の大きさ。座標はすべてこの viewBox 基準 */
export const SHAPE_BOX = { width: 132, height: 104 };

type Tones = { top: string; front: string; side: string; deep: string; stroke: string };

/** ダーク背景になじむ面の下地 */
const DARK_BASE = [0x14, 0x1b, 0x25] as const;

/** hex 色を base 色へ ratio だけ寄せる（0 = 元の色, 1 = base） */
function mix(hex: string, base: readonly [number, number, number], ratio: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift: number, b: number) => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (b - c) * ratio);
  };
  return `rgb(${ch(16, base[0])} ${ch(8, base[1])} ${ch(0, base[2])})`;
}

const WHITE = [0xff, 0xff, 0xff] as const;

/** サービス色から各面の色を作る（上面は明るく、側面は暗く。ダーク背景向けに暗い下地へ寄せる） */
export function tones(color: string): Tones {
  return {
    top: mix(color, DARK_BASE, 0.42),
    front: mix(color, DARK_BASE, 0.6),
    side: mix(color, DARK_BASE, 0.72),
    deep: mix(color, DARK_BASE, 0.82),
    stroke: mix(color, WHITE, 0.15),
  };
}

/** アイコンを置く位置（中心）と大きさ */
export type IconSlot = { cx: number; cy: number; size: number };

type ShapeVariant = {
  /** 重なり数（Auto Scaling の台数表現）1〜3 */
  layers?: number;
  /** 後ろに薄い複製を描く（Multi-AZ・レプリカの表現） */
  ghost?: boolean;
};

type Drawing = { body: ReactNode; icon: IconSlot };

const STROKE = 1.4;

// ---- 立方体系 ----

function cube(t: Tones, x: number, y: number, w: number, h: number, d: number, rx = 0) {
  const dy = d * 0.75;
  return (
    <g>
      <polygon
        points={`${x},${y} ${x + d},${y - dy} ${x + w + d},${y - dy} ${x + w},${y}`}
        fill={t.top}
        stroke={t.stroke}
        strokeWidth={STROKE}
        strokeLinejoin='round'
      />
      <polygon
        points={`${x + w},${y} ${x + w + d},${y - dy} ${x + w + d},${y + h - dy} ${x + w},${y + h}`}
        fill={t.side}
        stroke={t.stroke}
        strokeWidth={STROKE}
        strokeLinejoin='round'
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        fill={t.front}
        stroke={t.stroke}
        strokeWidth={STROKE}
      />
    </g>
  );
}

// ---- 円柱系 ----

function cylinder(
  t: Tones,
  cx: number,
  top: number,
  bottom: number,
  rx: number,
  ry: number,
  id: string,
) {
  const left = cx - rx;
  const right = cx + rx;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1='0' x2='1' y1='0' y2='0'>
          <stop offset='0' stopColor={t.side} />
          <stop offset='0.35' stopColor={t.front} />
          <stop offset='1' stopColor={t.side} />
        </linearGradient>
      </defs>
      <path
        d={`M${left},${top} V${bottom} A${rx},${ry} 0 0 0 ${right},${bottom} V${top} Z`}
        fill={`url(#${id})`}
        stroke={t.stroke}
        strokeWidth={STROKE}
      />
      {[0.4, 0.7].map((r) => {
        const y = top + (bottom - top) * r;
        return (
          <path
            key={r}
            d={`M${left},${y} A${rx},${ry} 0 0 0 ${right},${y}`}
            fill='none'
            stroke={t.stroke}
            strokeOpacity={0.25}
            strokeWidth={1}
          />
        );
      })}
      <ellipse
        cx={cx}
        cy={top}
        rx={rx}
        ry={ry}
        fill={t.top}
        stroke={t.stroke}
        strokeWidth={STROKE}
      />
    </g>
  );
}

// ---- 平面の輪郭を押し出して厚みを出す ----

function extruded(t: Tones, d: string, decoration?: ReactNode) {
  const depth = { x: 9, y: -7 };
  const steps = 6;
  return (
    <g>
      {Array.from({ length: steps }, (_, i) => {
        const r = (steps - i) / steps;
        return (
          <path
            key={r}
            d={d}
            transform={`translate(${depth.x * r} ${depth.y * r})`}
            fill={t.side}
            stroke={i === 0 ? t.stroke : 'none'}
            strokeWidth={STROKE}
            strokeLinejoin='round'
          />
        );
      })}
      <path d={d} fill={t.front} stroke={t.stroke} strokeWidth={STROKE} strokeLinejoin='round' />
      {decoration}
    </g>
  );
}

function draw(shape: Shape, t: Tones, v: ShapeVariant, uid: string): Drawing {
  switch (shape) {
    case 'cube':
      return { body: cube(t, 16, 32, 82, 64, 20), icon: { cx: 57, cy: 64, size: 46 } };
    case 'stack': {
      const layers = Math.min(3, Math.max(1, v.layers ?? 1));
      return {
        body: (
          <g>
            {Array.from({ length: layers }, (_, i) => layers - 1 - i).map((k) => (
              <g key={k} opacity={k === 0 ? 1 : 0.85}>
                {cube(t, 14 + 12 * k, 42 - 10 * k, 74, 54, 16)}
              </g>
            ))}
          </g>
        ),
        icon: { cx: 51, cy: 69, size: 42 },
      };
    }
    case 'chip':
      return { body: cube(t, 16, 40, 82, 54, 20, 12), icon: { cx: 57, cy: 67, size: 44 } };
    case 'cylinder':
    case 'cylinder-short': {
      const short = shape === 'cylinder-short';
      const top = short ? 38 : 22;
      const bottom = short ? 84 : 88;
      const one = (id: string) => cylinder(t, 62, top, bottom, 42, 11, id);
      return {
        body: (
          <g>
            {v.ghost && (
              <g transform='translate(16 -8)' opacity={0.45}>
                {one(`${uid}-g`)}
              </g>
            )}
            {one(`${uid}-c`)}
          </g>
        ),
        icon: { cx: 62, cy: short ? 64 : 58, size: short ? 38 : 44 },
      };
    }
    case 'bucket':
      return {
        body: (
          <g>
            <path
              d='M20,24 L36,88 A30,8 0 0 0 96,88 L112,24 Z'
              fill={t.front}
              stroke={t.stroke}
              strokeWidth={STROKE}
            />
            <path d='M20,24 L36,88 A30,8 0 0 0 50,93 L32,24 Z' fill={t.side} opacity={0.6} />
            <ellipse
              cx={66}
              cy={24}
              rx={46}
              ry={11}
              fill={t.top}
              stroke={t.stroke}
              strokeWidth={STROKE}
            />
            <ellipse cx={66} cy={25} rx={38} ry={7} fill={t.side} />
          </g>
        ),
        icon: { cx: 66, cy: 58, size: 42 },
      };
    case 'tube':
      return {
        body: (
          <g>
            <path
              d='M24,32 H104 A12,26 0 0 1 104,84 H24 A12,26 0 0 1 24,32 Z'
              fill={t.front}
              stroke={t.stroke}
              strokeWidth={STROKE}
            />
            <path
              d='M24,70 H104 A12,26 0 0 1 104,84 H24 A12,26 0 0 1 14,74 Z'
              fill={t.side}
              opacity={0.5}
            />
            {[44, 84].map((x) => (
              <path
                key={x}
                d={`M${x},32 A12,26 0 0 1 ${x},84`}
                fill='none'
                stroke={t.stroke}
                strokeOpacity={0.3}
              />
            ))}
            <ellipse
              cx={104}
              cy={58}
              rx={12}
              ry={26}
              fill={t.top}
              stroke={t.stroke}
              strokeWidth={STROKE}
            />
          </g>
        ),
        icon: { cx: 62, cy: 58, size: 42 },
      };
    case 'hexagon':
      return {
        body: (
          <g strokeLinejoin='round'>
            <polygon
              points='16,40 36,58 36,82 16,64'
              fill={t.side}
              stroke={t.stroke}
              strokeWidth={STROKE}
            />
            <polygon
              points='96,58 116,40 116,64 96,82'
              fill={t.side}
              stroke={t.stroke}
              strokeWidth={STROKE}
            />
            <polygon
              points='36,58 96,58 96,82 36,82'
              fill={t.front}
              stroke={t.stroke}
              strokeWidth={STROKE}
            />
            <polygon
              points='16,40 36,22 96,22 116,40 96,58 36,58'
              fill={t.top}
              stroke={t.stroke}
              strokeWidth={STROKE}
            />
          </g>
        ),
        icon: { cx: 66, cy: 48, size: 42 },
      };
    case 'globe':
      return {
        body: (
          <g>
            <defs>
              <radialGradient id={`${uid}-r`} cx='0.35' cy='0.3' r='0.75'>
                <stop offset='0' stopColor={t.top} />
                <stop offset='0.35' stopColor={t.front} />
                <stop offset='1' stopColor={t.side} />
              </radialGradient>
            </defs>
            <circle
              cx={62}
              cy={54}
              r={42}
              fill={`url(#${uid}-r)`}
              stroke={t.stroke}
              strokeWidth={STROKE}
            />
            <g fill='none' stroke={t.stroke} strokeOpacity={0.25}>
              <ellipse cx={62} cy={54} rx={18} ry={42} />
              <ellipse cx={62} cy={54} rx={42} ry={14} />
            </g>
          </g>
        ),
        icon: { cx: 62, cy: 54, size: 42 },
      };
    case 'gate':
      return {
        body: extruded(t, 'M18,96 V52 A42,34 0 0 1 102,52 V96 Z'),
        icon: { cx: 60, cy: 64, size: 44 },
      };
    case 'shield':
      return {
        body: extruded(t, 'M58,14 L100,28 V54 C100,76 82,90 58,98 C34,90 16,76 16,54 V28 Z'),
        icon: { cx: 58, cy: 54, size: 42 },
      };
    case 'card':
      return {
        body: extruded(
          t,
          'M22,28 H98 A8,8 0 0 1 106,36 V84 A8,8 0 0 1 98,92 H22 A8,8 0 0 1 14,84 V36 A8,8 0 0 1 22,28 Z',
        ),
        icon: { cx: 60, cy: 60, size: 42 },
      };
    case 'panel':
      return {
        body: (
          <g>
            <path
              d='M50,82 H72 L76,98 H46 Z'
              fill={t.side}
              stroke={t.stroke}
              strokeWidth={STROKE}
            />
            {extruded(
              t,
              'M20,18 H102 A6,6 0 0 1 108,24 V76 A6,6 0 0 1 102,82 H20 A6,6 0 0 1 14,76 V24 A6,6 0 0 1 20,18 Z',
            )}
          </g>
        ),
        icon: { cx: 61, cy: 50, size: 42 },
      };
    case 'safe':
      return {
        body: extruded(
          t,
          'M28,22 H94 A10,10 0 0 1 104,32 V86 A10,10 0 0 1 94,96 H28 A10,10 0 0 1 18,86 V32 A10,10 0 0 1 28,22 Z',
          <g fill='none' stroke={t.stroke} strokeOpacity={0.35}>
            <rect x={24} y={28} width={74} height={62} rx={6} />
          </g>,
        ),
        icon: { cx: 61, cy: 59, size: 42 },
      };
    case 'person':
      return {
        body: extruded(
          t,
          'M60,10 A17,17 0 1 1 59.9,10 Z M24,98 C24,70 40,52 60,52 C80,52 96,70 96,98 Z',
        ),
        icon: { cx: 60, cy: 78, size: 30 },
      };
    case 'cloud':
      return {
        body: extruded(
          t,
          'M34,88 H92 C106,88 114,78 114,66 C114,54 104,46 92,48 C90,32 76,22 62,24 C48,24 38,34 36,46 C24,46 16,56 16,68 C16,80 24,88 34,88 Z',
        ),
        icon: { cx: 64, cy: 64, size: 38 },
      };
    case 'broadcast':
      return {
        body: extruded(t, 'M16,44 H42 L100,16 V98 L42,72 H16 Z'),
        icon: { cx: 62, cy: 57, size: 40 },
      };
  }
}

type ShapeProps = ShapeVariant & {
  shape: Shape;
  color: string;
  uid: string;
  icon: ReactNode;
};

/** 立体シェイプとアイコンを重ねて描く */
export function ServiceShape({ shape, color, uid, icon, ...variant }: ShapeProps) {
  const t = tones(color);
  const { body, icon: slot } = draw(shape, t, variant, uid);
  return (
    <div style={{ position: 'relative', width: SHAPE_BOX.width, height: SHAPE_BOX.height }}>
      <svg
        width={SHAPE_BOX.width}
        height={SHAPE_BOX.height}
        viewBox={`0 0 ${SHAPE_BOX.width} ${SHAPE_BOX.height}`}
        aria-hidden
        style={{ overflow: 'visible' }}
      >
        <ellipse cx={62} cy={101} rx={44} ry={4} fill='#000' opacity={0.35} />
        {body}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: slot.cx - slot.size / 2,
          top: slot.cy - slot.size / 2,
          width: slot.size,
          height: slot.size,
        }}
      >
        {icon}
      </div>
    </div>
  );
}
