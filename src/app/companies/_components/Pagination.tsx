import { Box, HStack, Text } from '@chakra-ui/react';
import Link from 'next/link';

type Props = {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
};

function buildHref(searchParams: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value);
  }
  params.set('page', String(page));
  return `/companies?${params.toString()}`;
}

export function Pagination({ page, totalPages, searchParams }: Props) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <HStack justify='center' gap={3} mt={8}>
      <Link
        href={buildHref(searchParams, page - 1)}
        aria-disabled={!hasPrev}
        tabIndex={hasPrev ? undefined : -1}
        style={{ pointerEvents: hasPrev ? 'auto' : 'none' }}
      >
        <Box
          as='span'
          px={4}
          py={2}
          borderRadius='md'
          borderWidth='1px'
          borderColor='gray.200'
          fontSize='sm'
          color={hasPrev ? 'gray.600' : 'gray.300'}
          bg='white'
        >
          ← 前へ
        </Box>
      </Link>
      <Text fontSize='sm' color='gray.500'>
        {page} / {totalPages}
      </Text>
      <Link
        href={buildHref(searchParams, page + 1)}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
        style={{ pointerEvents: hasNext ? 'auto' : 'none' }}
      >
        <Box
          as='span'
          px={4}
          py={2}
          borderRadius='md'
          borderWidth='1px'
          borderColor='gray.200'
          fontSize='sm'
          color={hasNext ? 'gray.600' : 'gray.300'}
          bg='white'
        >
          次へ →
        </Box>
      </Link>
    </HStack>
  );
}
