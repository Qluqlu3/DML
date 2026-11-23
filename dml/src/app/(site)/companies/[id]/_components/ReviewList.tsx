import { Badge, Box, HStack, Text, VStack } from '@chakra-ui/react';
import type { ReviewModel } from '@/generated/prisma/models/Review';
import { RATING_ITEMS, starString } from '@/lib/reviewRating';
import { STRUCTURE_TYPE_LABELS } from '@/lib/structureType';

type ReviewWithOverall = ReviewModel & { overall: number };

type Props = {
  reviews: ReviewWithOverall[];
  // 構造で絞り込み中の場合、そのラベル（空表示の文言に使う）
  activeStructureLabel: string | undefined;
};

function formatDate(date: Date) {
  return date.toLocaleDateString('ja-JP');
}

function ReviewCard({ review }: { review: ReviewWithOverall }) {
  return (
    <Box p={4} borderWidth='1px' borderColor='gray.100' borderRadius='md'>
      <HStack justify='space-between' mb={2}>
        <HStack gap={2}>
          <Text color='orange.500' fontWeight='bold'>
            {starString(review.overall)}
          </Text>
          <Text fontSize='xs' color='gray.500'>
            {review.authorName ?? '匿名'}
          </Text>
        </HStack>
        <Text fontSize='xs' color='gray.400'>
          {formatDate(review.createdAt)}投稿
          {review.editedAt && `（${formatDate(review.editedAt)}更新）`}
        </Text>
      </HStack>
      <HStack gap={4} flexWrap='wrap' mb={2}>
        {RATING_ITEMS.map((item) => (
          <HStack key={item.name} gap={1}>
            <Text fontSize='xs' color='gray.400'>
              {item.label}
            </Text>
            <Text fontSize='xs' color='orange.500'>
              {starString(review[item.name])}
            </Text>
          </HStack>
        ))}
      </HStack>
      <HStack gap={2} flexWrap='wrap'>
        <Badge colorPalette='blue' size='sm' variant='subtle'>
          {STRUCTURE_TYPE_LABELS[review.structureType]}
        </Badge>
        {review.workYear && (
          <Badge colorPalette='gray' size='sm' variant='subtle'>
            {review.workYear}年施工
          </Badge>
        )}
      </HStack>
    </Box>
  );
}

export function ReviewList({ reviews, activeStructureLabel }: Props) {
  if (reviews.length === 0) {
    return (
      <Box py={10} textAlign='center' color='gray.400'>
        {activeStructureLabel !== undefined ? (
          <Text>「{activeStructureLabel}」の口コミはまだありません</Text>
        ) : (
          <>
            <Text>まだ口コミがありません</Text>
            <Text fontSize='sm' mt={1}>
              最初の口コミを投稿してみましょう
            </Text>
          </>
        )}
      </Box>
    );
  }

  return (
    <VStack gap={4} align='stretch'>
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </VStack>
  );
}
