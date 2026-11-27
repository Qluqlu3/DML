import { Box } from '@chakra-ui/react';

/** 一覧の見出しに並べる、完了数の細い進み具合バー */
export function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <Box
      role='progressbar'
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      flex='0 1 200px'
      h='6px'
      overflow='hidden'
      rounded='full'
      bg='bg.muted'
    >
      <Box
        h='full'
        rounded='full'
        bg='fg.success'
        transition='width 0.3s'
        style={{ width: `${total ? (done / total) * 100 : 0}%` }}
      />
    </Box>
  );
}
