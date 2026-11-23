import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { starString } from '@/lib/reviewRating';

type Props = {
  avgRating: number | null;
  reviewOveralls: number[];
};

const RATING_STEPS = [5, 4, 3, 2, 1];

export function RatingSummary({ avgRating, reviewOveralls }: Props) {
  if (avgRating === null) {
    return (
      <Text fontSize='sm' color='gray.400' pt={1}>
        まだ評価がありません
      </Text>
    );
  }

  const total = reviewOveralls.length;
  const ratingCounts = RATING_STEPS.map((rating) => ({
    rating,
    count: reviewOveralls.filter((overall) => Math.round(overall) === rating).length,
  }));

  return (
    <Box pt={1}>
      {/* 総合評価 */}
      <HStack gap={3} mb={3} align='baseline'>
        <Text fontSize='3xl' fontWeight='bold' color='orange.500' lineHeight='1'>
          {avgRating.toFixed(1)}
        </Text>
        <VStack gap={0} align='start'>
          <Text color='orange.400' fontSize='lg' lineHeight='1'>
            {starString(avgRating)}
          </Text>
          <Text fontSize='xs' color='gray.400'>
            {total} 件の口コミ
          </Text>
        </VStack>
      </HStack>
      {/* 評価分布バー */}
      <VStack gap={1} align='stretch'>
        {ratingCounts.map(({ rating, count }) => (
          <HStack key={rating} gap={2} fontSize='xs'>
            <Text color='gray.500' w='20px' textAlign='right'>
              {rating}★
            </Text>
            <Box flex='1' bg='gray.100' borderRadius='full' h='8px' overflow='hidden'>
              <Box
                bg='orange.400'
                h='100%'
                borderRadius='full'
                style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
              />
            </Box>
            <Text color='gray.400' w='24px'>
              {count}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}
