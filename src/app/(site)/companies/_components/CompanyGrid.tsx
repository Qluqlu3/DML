import { Badge, Box, Grid, GridItem, HStack, Text, VStack } from '@chakra-ui/react';
import Link from 'next/link';
import type { CompanyModel } from '@/generated/prisma/models/Company';
import type { ReviewModel } from '@/generated/prisma/models/Review';
import { overallRating } from '@/lib/reviewRating';

type CompanyWithReviews = CompanyModel & {
  reviews: Pick<ReviewModel, 'priceRating' | 'serviceRating' | 'qualityRating'>[];
};

type Props = {
  companies: CompanyWithReviews[];
  totalCount: number;
};

export function CompanyGrid({ companies, totalCount }: Props) {
  if (companies.length === 0) {
    return (
      <Box textAlign='center' py={20} color='gray.500'>
        <Text>該当する業者が見つかりませんでした</Text>
      </Box>
    );
  }

  return (
    <>
      <Text mb={4} color='gray.600' fontSize='sm'>
        {totalCount.toLocaleString()} 件
      </Text>

      <Grid
        templateColumns={{
          base: '1fr',
          md: 'repeat(2, 1fr)',
          lg: 'repeat(3, 1fr)',
          xl: 'repeat(4, 1fr)',
        }}
        gap={4}
      >
        {companies.map((c) => {
          const reviewCount = c.reviews.length;
          const avgRating =
            reviewCount > 0
              ? c.reviews.reduce((sum, r) => sum + overallRating(r), 0) / reviewCount
              : null;

          return (
            <GridItem key={c.id}>
              <Link href={`/companies/${c.id}`} style={{ display: 'block', height: '100%' }}>
                <Box
                  bg='white'
                  p={5}
                  borderRadius='lg'
                  shadow='sm'
                  borderWidth='1px'
                  borderColor='gray.200'
                  h='100%'
                  _hover={{ borderColor: 'blue.300', shadow: 'md' }}
                  transition='all 0.15s'
                >
                  <VStack align='stretch' gap={2}>
                    <Text fontWeight='bold' fontSize='md' lineClamp={2}>
                      {c.name}
                    </Text>
                    {c.furigana && (
                      <Text fontSize='xs' color='gray.400'>
                        {c.furigana}
                      </Text>
                    )}
                    <HStack gap={1.5}>
                      {avgRating !== null ? (
                        <>
                          <Text fontSize='sm' fontWeight='bold' color='orange.500'>
                            ★ {avgRating.toFixed(1)}
                          </Text>
                          <Text fontSize='xs' color='gray.400'>
                            ({reviewCount.toLocaleString()}件)
                          </Text>
                        </>
                      ) : (
                        <Text fontSize='xs' color='gray.400'>
                          口コミなし
                        </Text>
                      )}
                    </HStack>
                    {c.prefectureName && (
                      <Badge colorPalette='orange' w='fit-content' size='sm'>
                        {c.prefectureName}
                      </Badge>
                    )}
                    {c.addressFull && (
                      <Text fontSize='sm' color='gray.600' lineClamp={2}>
                        {c.addressFull}
                      </Text>
                    )}
                    {c.phoneNumber && (
                      <Text fontSize='sm' color='gray.600'>
                        ☎ {c.phoneNumber}
                      </Text>
                    )}
                  </VStack>
                </Box>
              </Link>
            </GridItem>
          );
        })}
      </Grid>
    </>
  );
}
