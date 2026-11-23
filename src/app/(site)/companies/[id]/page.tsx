import {
  Badge,
  Box,
  Container,
  Grid,
  GridItem,
  Heading,
  HStack,
  Separator,
  Text,
  VStack,
} from '@chakra-ui/react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { ReviewForm } from '@/components/ReviewForm';
import type { StructureType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { averageOverallRating, overallRating } from '@/lib/reviewRating';
import { STRUCTURE_TYPE_LABELS, STRUCTURE_TYPE_OPTIONS } from '@/lib/structureType';
import { getCurrentUser } from '@/lib/userSession';
import { CompanyInfoCard } from './_components/CompanyInfoCard';
import { RatingSummary } from './_components/RatingSummary';
import { ReviewList } from './_components/ReviewList';
import { StructureTypeFilter } from './_components/StructureTypeFilter';
import { buildCompanyJsonLd, serializeJsonLd } from './companyJsonLd';

type Params = Promise<{ id: string }>;

function parseCompanyId(id: string): number | null {
  const companyId = Number.parseInt(id, 10);
  return Number.isNaN(companyId) ? null : companyId;
}

const CARD_PROPS = {
  bg: 'white',
  p: 6,
  borderRadius: 'lg',
  shadow: 'sm',
  borderWidth: '1px',
  borderColor: 'gray.200',
} as const;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const companyId = parseCompanyId((await params).id);
  if (companyId === null) return {};

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
  params: Params;
  searchParams: Promise<{ structureType?: string }>;
}) {
  const [{ id }, { structureType: activeStructureType }] = await Promise.all([
    params,
    searchParams,
  ]);
  const companyId = parseCompanyId(id);
  if (companyId === null) notFound();

  const currentUser = await getCurrentUser();
  const [company, myReview] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: {
        reviews: {
          where: { isPublished: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    currentUser
      ? prisma.review.findUnique({
          where: { companyId_userId: { companyId, userId: currentUser.id } },
          select: {
            priceRating: true,
            serviceRating: true,
            qualityRating: true,
            structureType: true,
            workYear: true,
            authorName: true,
            isPublished: true,
            rejectedAt: true,
            rejectionReason: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!company) notFound();

  const reviews = company.reviews.map((review) => ({
    ...review,
    overall: overallRating(review),
  }));
  const avgRating = averageOverallRating(company.reviews);

  // 解体した建物の構造でフィルター
  const filteredReviews = activeStructureType
    ? reviews.filter((r) => r.structureType === activeStructureType)
    : reviews;

  const structureTypeCounts = STRUCTURE_TYPE_OPTIONS.flatMap(({ value, label }) => {
    const count = reviews.filter((r) => r.structureType === value).length;
    return count > 0 ? [{ type: value, label, count }] : [];
  });

  const jsonLd = buildCompanyJsonLd(company, reviews, avgRating);

  return (
    <Box minH='100vh' bg='gray.100'>
      <script
        type='application/ld+json'
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD埋め込みの定石(`<`はエスケープ済み)
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Header />

      {/* パンくず */}
      <Box bg='white' borderBottomWidth='1px' borderColor='gray.200' py={3}>
        <Container maxW='7xl'>
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
        <Container maxW='7xl'>
          <Grid templateColumns={{ base: '1fr', lg: '1fr 320px' }} gap={8} alignItems='start'>
            {/* ─── メイン ─── */}
            <GridItem>
              {/* 会社名ブロック */}
              <Box {...CARD_PROPS} mb={6}>
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
                  <RatingSummary
                    avgRating={avgRating}
                    reviewOveralls={reviews.map((r) => r.overall)}
                  />
                </VStack>
              </Box>

              {/* 口コミセクション */}
              <Box {...CARD_PROPS}>
                <HStack justify='space-between' mb={4}>
                  <Heading size='md'>
                    口コミ ({activeStructureType ? `${filteredReviews.length}/` : ''}
                    {reviews.length}件)
                  </Heading>
                  <ReviewForm
                    companyId={company.id}
                    currentUser={
                      currentUser ? { name: currentUser.name, email: currentUser.email } : null
                    }
                    myReview={myReview}
                  />
                </HStack>

                <StructureTypeFilter
                  companyId={company.id}
                  activeStructureType={activeStructureType}
                  totalCount={reviews.length}
                  options={structureTypeCounts}
                />

                <Separator mb={4} />

                <ReviewList
                  reviews={filteredReviews}
                  activeStructureLabel={
                    activeStructureType
                      ? (STRUCTURE_TYPE_LABELS[activeStructureType as StructureType] ?? '')
                      : undefined
                  }
                />
              </Box>
            </GridItem>

            {/* ─── サイドバー ─── */}
            <GridItem>
              <CompanyInfoCard company={company} />
            </GridItem>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
