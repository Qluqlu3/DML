import { Badge, type BadgeProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import type { NodeStatus } from '../engine/simulator/types';

/**
 * 進み具合や状態を示す小さなラベル。
 * self: 自力でクリア・点数つき / done: 完了 / doing: 途中、と、シミュレーションのノード状態。
 */
export type StatusTone = 'self' | 'done' | 'doing' | NodeStatus;

const TONES: Record<StatusTone, Pick<BadgeProps, 'colorPalette' | 'variant'>> = {
  self: { colorPalette: 'aws', variant: 'solid' },
  done: { colorPalette: 'green', variant: 'subtle' },
  doing: { colorPalette: 'blue', variant: 'subtle' },
  ok: { colorPalette: 'green', variant: 'subtle' },
  warn: { colorPalette: 'yellow', variant: 'subtle' },
  crit: { colorPalette: 'red', variant: 'subtle' },
  down: { colorPalette: 'gray', variant: 'solid' },
  idle: { colorPalette: 'gray', variant: 'subtle' },
};

export function StatusBadge({
  tone,
  children,
  ...rest
}: { tone: StatusTone; children: ReactNode } & BadgeProps) {
  return (
    <Badge size='sm' rounded='full' fontWeight='bold' ml='auto' {...TONES[tone]} {...rest}>
      {children}
    </Badge>
  );
}
