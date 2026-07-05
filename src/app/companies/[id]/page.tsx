import type { Metadata } from 'next';
import {
  Badge,
  Box,
  Container,
  Grid,
  GridItem,
  HStack,
  Heading,
  Separator,
  Text,
  VStack,
} from '@chakra-ui/react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { ReviewForm } from '@/components/ReviewForm';
import { prisma } from '@/lib/prisma';
import { RATING_ITEMS, overallRating } from '@/lib/reviewRating';
import { STRUCTURE_TYPE_LABELS, STRUCTURE_TYPE_OPTIONS } from '@/lib/structureType';
import type { StructureType } from '@/generated/prisma/client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const companyId = parseInt(id, 10);
  if (isNaN(companyId)) return {};

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, prefectureName: true },
  });
  if (!company) return {};

  const pref = company.prefectureName ? `${company.prefectureName}の` : '';
  const title = `${company.name}の口コミ・評判 | DML`;
  const description = `${pref}解体業者「${company.name}」の口コミ・評判を確認。実際に依頼した方の評価や施工内容をチェックして業者選びにお役立てください。`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ structureType?: string }>;
}) {
  const [{ id }, { structureType: activeStructureType }] = await Promise.all([
    params,
    searchParams,
  ]);
  const companyId = parseInt(id, 10);
  if (isNaN(companyId)) notFound();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      reviews: {
        where: { isPublished: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!company) notFound();

  const reviewsWithOverall = company.reviews.map((review) => ({
    ...review,
    overall: overallRating(review),
  }));

  const avgRating =
    reviewsWithOverall.length > 0
      ? reviewsWithOverall.reduce((sum, r) => sum + r.overall, 0) / reviewsWithOverall.length
      : null;

  const ratingCounts = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: reviewsWithOverall.filter((rev) => Math.round(rev.overall) === r).length,
  }));

  // 解体した建物の構造でフィルター
  const filteredReviews = activeStructureType
    ? reviewsWithOverall.filter((r) => r.structureType === activeStructureType)
    : reviewsWithOverall;

  const structureTypeCounts = STRUCTURE_TYPE_OPTIONS.flatMap(({ value, label }) => {
    const count = company.reviews.filter((r) => r.structureType === value).length;
    return count > 0 ? [{ type: value, label, count }] : [];
  });

  return (
    <Box minH='100vh' bg='gray.50'>
      <Header />

      {/* パンくず */}
      <Box bg='white' borderBottomWidth='1px' borderColor='gray.200' py={3}>
        <Container maxW='5xl'>
          <HStack gap={2} fontSize='sm' color='gray.500'>
            <Link href='/'>
              <Text _hover={{ color: 'blue.700' }}>ホーム</Text>
            </Link>
            <Text>›</Text>
            <Link href='/companies'>
              <Text _hover={{ color: 'blue.700' }}>業者一覧</Text>
            </Link>
            <Text>›</Text>
            <Text color='gray.700' fontWeight='medium'>
              {company.name}
            </Text>
          </HStack>
        </Container>
      </Box>

      <Box as='main' py={8}>
        <Container maxW='5xl'>
          <Grid templateColumns={{ base: '1fr', lg: '1fr 320px' }} gap={8} alignItems='start'>
            {/* ─── メイン ─── */}
            <GridItem>
              {/* 会社名ブロック */}
              <Box
                bg='white'
                p={6}
                borderRadius='lg'
                shadow='sm'
                borderWidth='1px'
                borderColor='gray.200'
                mb={6}
              >
                <VStack align='stretch' gap={3}>
                  {company.prefectureName && (
                    <Badge colorPalette='orange' w='fit-content'>
                      {company.prefectureName}
                    </Badge>
                  )}
                  <Heading size='xl'>{company.name}</Heading>
                  {company.furigana && (
                    <Text fontSize='sm' color='gray.400'>
                      {company.furigana}
                    </Text>
                  )}
                  {avgRating !== null ? (
                    <Box pt={1}>
                      {/* 総合評価 */}
                      <HStack gap={3} mb={3} align='baseline'>
                        <Text fontSize='3xl' fontWeight='bold' color='orange.500' lineHeight='1'>
                          {avgRating.toFixed(1)}
                        </Text>
                        <VStack gap={0} align='start'>
                          <Text color='orange.400' fontSize='lg' lineHeight='1'>
                            {'★'.repeat(Math.round(avgRating))}
                            {'☆'.repeat(5 - Math.round(avgRating))}
                          </Text>
                          <Text fontSize='xs' color='gray.400'>
                            {company.reviews.length} 件の口コミ
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
                            <Box
                              flex='1'
                              bg='gray.100'
                              borderRadius='full'
                              h='8px'
                              overflow='hidden'
                            >
                              <Box
                                bg='orange.400'
                                h='100%'
                                borderRadius='full'
                                style={{
                                  width:
                                    company.reviews.length > 0
                                      ? `${(count / company.reviews.length) * 100}%`
                                      : '0%',
                                }}
                              />
                            </Box>
                            <Text color='gray.400' w='24px'>
                              {count}
                            </Text>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  ) : (
                    <Text fontSize='sm' color='gray.400' pt={1}>
                      まだ評価がありません
                    </Text>
                  )}
                </VStack>
              </Box>

              {/* 口コミセクション */}
              <Box
                bg='white'
                p={6}
                borderRadius='lg'
                shadow='sm'
                borderWidth='1px'
                borderColor='gray.200'
              >
                <HStack justify='space-between' mb={4}>
                  <Heading size='md'>
                    口コミ ({activeStructureType ? `${filteredReviews.length}/` : ''}
                    {company.reviews.length}件)
                  </Heading>
                  <ReviewForm companyId={company.id} />
                </HStack>

                {/* 解体した建物の構造フィルター */}
                {structureTypeCounts.length > 0 && (
                  <HStack gap={2} flexWrap='wrap' mb={4}>
                    <Link href={`/companies/${company.id}`}>
                      <Box
                        as='span'
                        px={3}
                        py={1}
                        borderRadius='full'
                        fontSize='sm'
                        cursor='pointer'
                        bg={!activeStructureType ? 'orange.500' : 'gray.100'}
                        color={!activeStructureType ? 'white' : 'gray.600'}
                        _hover={{ opacity: 0.8 }}
                        transition='opacity 0.15s'
                      >
                        全て ({company.reviews.length})
                      </Box>
                    </Link>
                    {structureTypeCounts.map(({ type, label, count }) => (
                      <Link
                        key={type}
                        href={`/companies/${company.id}?structureType=${encodeURIComponent(type)}`}
                      >
                        <Box
                          as='span'
                          px={3}
                          py={1}
                          borderRadius='full'
                          fontSize='sm'
                          cursor='pointer'
                          bg={activeStructureType === type ? 'blue.500' : 'gray.100'}
                          color={activeStructureType === type ? 'white' : 'gray.600'}
                          _hover={{ opacity: 0.8 }}
                          transition='opacity 0.15s'
                        >
                          {label} ({count})
                        </Box>
                      </Link>
                    ))}
                  </HStack>
                )}

                <Separator mb={4} />

                {filteredReviews.length === 0 ? (
                  <Box py={10} textAlign='center' color='gray.400'>
                    {activeStructureType ? (
                      <Text>
                        「{STRUCTURE_TYPE_LABELS[activeStructureType as StructureType]}」の口コミはまだありません
                      </Text>
                    ) : (
                      <>
                        <Text>まだ口コミがありません</Text>
                        <Text fontSize='sm' mt={1}>
                          最初の口コミを投稿してみましょう
                        </Text>
                      </>
                    )}
                  </Box>
                ) : (
                  <VStack gap={4} align='stretch'>
                    {filteredReviews.map((review) => (
                      <Box
                        key={review.id}
                        p={4}
                        borderWidth='1px'
                        borderColor='gray.100'
                        borderRadius='md'
                      >
                        <HStack justify='space-between' mb={2}>
                          <HStack gap={2}>
                            <Text color='orange.500' fontWeight='bold'>
                              {'★'.repeat(Math.round(review.overall))}
                              {'☆'.repeat(5 - Math.round(review.overall))}
                            </Text>
                            <Text fontSize='xs' color='gray.500'>
                              {review.authorName ?? '匿名'}
                            </Text>
                          </HStack>
                          <Text fontSize='xs' color='gray.400'>
                            {review.createdAt.toLocaleDateString('ja-JP')}
                          </Text>
                        </HStack>
                        <HStack gap={4} flexWrap='wrap' mb={2}>
                          {RATING_ITEMS.map((item) => (
                            <HStack key={item.name} gap={1}>
                              <Text fontSize='xs' color='gray.400'>
                                {item.label}
                              </Text>
                              <Text fontSize='xs' color='orange.500'>
                                {'★'.repeat(review[item.name])}
                                {'☆'.repeat(5 - review[item.name])}
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
                    ))}
                  </VStack>
                )}
              </Box>
            </GridItem>

            {/* ─── サイドバー ─── */}
            <GridItem>
              <Box
                bg='white'
                p={6}
                borderRadius='lg'
                shadow='sm'
                borderWidth='1px'
                borderColor='gray.200'
              >
                <Heading size='sm' mb={4} color='gray.700'>
                  基本情報
                </Heading>
                <VStack align='stretch' gap={3} fontSize='sm'>
                  {company.permitType && (
                    <Box>
                      <Text color='gray.400' fontSize='xs' mb={0.5}>
                        建設業許可種別
                      </Text>
                      <Badge
                        colorPalette={company.permitType === '特定建設業' ? 'blue' : 'gray'}
                        size='sm'
                      >
                        {company.permitType}
                      </Badge>
                    </Box>
                  )}
                  {company.addressFull && (
                    <Box>
                      <Text color='gray.400' fontSize='xs' mb={0.5}>
                        住所
                      </Text>
                      <Text>{company.addressFull}</Text>
                    </Box>
                  )}
                  {company.phoneNumber && (
                    <Box>
                      <Text color='gray.400' fontSize='xs' mb={0.5}>
                        電話番号
                      </Text>
                      <a
                        href={`tel:${company.phoneNumber}`}
                        style={{ color: '#2b6cb0', fontSize: '0.875rem' }}
                      >
                        {company.phoneNumber}
                      </a>
                    </Box>
                  )}
                  {company.postCode && (
                    <Box>
                      <Text color='gray.400' fontSize='xs' mb={0.5}>
                        郵便番号
                      </Text>
                      <Text>〒{company.postCode}</Text>
                    </Box>
                  )}
                  {company.websiteUrl && (
                    <Box>
                      <Text color='gray.400' fontSize='xs' mb={0.5}>
                        WEBサイト
                      </Text>
                      <a
                        href={company.websiteUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        style={{ color: '#2b6cb0', wordBreak: 'break-all', fontSize: '0.875rem' }}
                      >
                        {company.websiteUrl}
                      </a>
                    </Box>
                  )}
                  {company.corporateNumber && (
                    <Box>
                      <Text color='gray.400' fontSize='xs' mb={0.5}>
                        法人番号
                      </Text>
                      <Text color='gray.500'>{company.corporateNumber}</Text>
                    </Box>
                  )}
                </VStack>
              </Box>
            </GridItem>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
