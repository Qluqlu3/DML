import { prisma } from '@/lib/prisma';
import {
  Badge,
  Box,
  Button,
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

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const avgRating =
    company.reviews.length > 0
      ? company.reviews.reduce((sum, r) => sum + r.rating, 0) / company.reviews.length
      : null;

  return (
    <Box minH='100vh' bg='gray.50'>
      {/* ヘッダー */}
      <Box as='header' bg='blue.900' py={4}>
        <Container maxW='5xl'>
          <HStack justify='space-between'>
            <Link href='/'>
              <Heading size='md' color='orange.400'>
                DML
              </Heading>
            </Link>
            <HStack gap={4}>
              <Button variant='ghost' size='sm' color='white' _hover={{ bg: 'blue.800' }}>
                ログイン
              </Button>
              <Button colorPalette='orange' size='sm'>
                会員登録
              </Button>
            </HStack>
          </HStack>
        </Container>
      </Box>

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
              <Box bg='white' p={6} borderRadius='lg' shadow='sm' borderWidth='1px' borderColor='gray.200' mb={6}>
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
                  <HStack gap={4} pt={1}>
                    <Text fontSize='sm' color='gray.500'>
                      口コミ {company.reviews.length} 件
                    </Text>
                    {avgRating !== null && (
                      <HStack gap={1}>
                        <Text fontSize='sm' color='orange.500' fontWeight='bold'>
                          ★ {avgRating.toFixed(1)}
                        </Text>
                      </HStack>
                    )}
                  </HStack>
                </VStack>
              </Box>

              {/* 口コミセクション */}
              <Box bg='white' p={6} borderRadius='lg' shadow='sm' borderWidth='1px' borderColor='gray.200'>
                <HStack justify='space-between' mb={4}>
                  <Heading size='md'>口コミ ({company.reviews.length}件)</Heading>
                  <Button colorPalette='orange' size='sm'>
                    口コミを書く
                  </Button>
                </HStack>
                <Separator mb={4} />

                {company.reviews.length === 0 ? (
                  <Box py={10} textAlign='center' color='gray.400'>
                    <Text>まだ口コミがありません</Text>
                    <Text fontSize='sm' mt={1}>
                      最初の口コミを投稿してみましょう
                    </Text>
                  </Box>
                ) : (
                  <VStack gap={4} align='stretch'>
                    {company.reviews.map((review) => (
                      <Box key={review.id} p={4} borderWidth='1px' borderColor='gray.100' borderRadius='md'>
                        <HStack justify='space-between' mb={2}>
                          <Text color='orange.500' fontWeight='bold'>
                            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                          </Text>
                          <Text fontSize='xs' color='gray.400'>
                            {review.workYear ? `${review.workYear}年施工` : ''}
                          </Text>
                        </HStack>
                        {review.title && (
                          <Text fontWeight='bold' mb={1}>
                            {review.title}
                          </Text>
                        )}
                        <Text fontSize='sm' color='gray.700'>
                          {review.body}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                )}
              </Box>
            </GridItem>

            {/* ─── サイドバー ─── */}
            <GridItem>
              <Box bg='white' p={6} borderRadius='lg' shadow='sm' borderWidth='1px' borderColor='gray.200'>
                <Heading size='sm' mb={4} color='gray.700'>
                  基本情報
                </Heading>
                <VStack align='stretch' gap={3} fontSize='sm'>
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
                      <Text>{company.phoneNumber}</Text>
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
                      <Text
                        as='a'
                        href={company.websiteUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        color='blue.600'
                        _hover={{ textDecoration: 'underline' }}
                        wordBreak='break-all'
                      >
                        {company.websiteUrl}
                      </Text>
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
