import { Progress } from '@chakra-ui/react';

/**
 * 0〜1 の割合を示す横棒。tone で色を変える（ok: 緑 / warn: 黄 / crit: 赤）。
 * 1 を超える値は 100% で止める。
 */
export function Meter({
  ratio,
  tone,
  width,
  label,
}: {
  ratio: number;
  tone: 'ok' | 'warn' | 'crit';
  width?: string;
  label: string;
}) {
  const palette = { ok: 'green', warn: 'yellow', crit: 'red' }[tone];
  return (
    <Progress.Root
      value={Math.round(Math.min(Math.max(ratio, 0), 1) * 100)}
      size='xs'
      colorPalette={palette}
      width={width}
      flexBasis={width ? undefined : '100%'}
      aria-label={label}
    >
      <Progress.Track bg='border' rounded='full'>
        <Progress.Range />
      </Progress.Track>
    </Progress.Root>
  );
}
