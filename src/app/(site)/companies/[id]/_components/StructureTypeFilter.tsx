import { Box, HStack } from '@chakra-ui/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { StructureType } from '@/generated/prisma/enums';

type Props = {
  companyId: number;
  activeStructureType: string | undefined;
  totalCount: number;
  options: { type: StructureType; label: string; count: number }[];
};

function FilterChip({
  href,
  active,
  activeBg,
  children,
}: {
  href: string;
  active: boolean;
  activeBg: string;
  children: ReactNode;
}) {
  return (
    <Link href={href}>
      <Box
        as='span'
        px={3}
        py={1}
        borderRadius='full'
        fontSize='sm'
        cursor='pointer'
        bg={active ? activeBg : 'gray.100'}
        color={active ? 'white' : 'gray.600'}
        _hover={{ opacity: 0.8 }}
        transition='opacity 0.15s'
      >
        {children}
      </Box>
    </Link>
  );
}

// 解体した建物の構造で口コミを絞り込む
export function StructureTypeFilter({
  companyId,
  activeStructureType,
  totalCount,
  options,
}: Props) {
  if (options.length === 0) return null;

  const basePath = `/companies/${companyId}`;
  return (
    <HStack gap={2} flexWrap='wrap' mb={4}>
      <FilterChip href={basePath} active={!activeStructureType} activeBg='orange.500'>
        全て ({totalCount})
      </FilterChip>
      {options.map(({ type, label, count }) => (
        <FilterChip
          key={type}
          href={`${basePath}?structureType=${encodeURIComponent(type)}`}
          active={activeStructureType === type}
          activeBg='blue.500'
        >
          {label} ({count})
        </FilterChip>
      ))}
    </HStack>
  );
}
