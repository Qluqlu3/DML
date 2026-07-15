import { Box, Container } from '@chakra-ui/react';
import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { CompanyGrid } from './_components/CompanyGrid';
import { Pagination } from './_components/Pagination';
import { SearchForm } from './_components/SearchForm';

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: '解体業者を探す | DML',
  description:
    '全国の解体業者を都道府県・業者名・住所・電話番号・許可種別・保有する建設業許可で検索。口コミや評判も確認しながら比較検討できます。',
  openGraph: {
    title: '解体業者を探す | DML',
    description:
      '全国の解体業者を都道府県・業者名・住所・電話番号・許可種別・保有する建設業許可で検索。口コミや評判も確認しながら比較検討できます。',
  },
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    pref?: string;
    phone?: string;
    hasWebsite?: string;
    address?: string;
    permitType?: string;
    trade?: string;
    page?: string;
  }>;
}) {
  const {
    q,
    pref,
    phone,
    hasWebsite,
    address,
    permitType,
    trade,
    page: pageParam,
  } = await searchParams;

  const where: Prisma.CompanyWhereInput = {
    AND: [
      pref ? { prefectureName: pref } : {},
      q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { furigana: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      phone ? { phoneNumber: { contains: phone, mode: 'insensitive' } } : {},
      hasWebsite === '1' ? { websiteUrl: { not: null } } : {},
      address ? { addressFull: { contains: address, mode: 'insensitive' } } : {},
      permitType ? { permitType } : {},
      trade ? { licensedTrades: { array_contains: [{ trade }] } } : {},
    ],
  };

  const [prefList, totalCount] = await Promise.all([
    prisma.company.findMany({
      select: { prefectureName: true },
      distinct: ['prefectureName'],
      where: { prefectureName: { not: null } },
      orderBy: { prefectureName: 'asc' },
    }),
    prisma.company.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1), totalPages);

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      reviews: {
        where: { isPublished: true },
        select: { priceRating: true, serviceRating: true, qualityRating: true },
      },
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const prefNames = prefList.map((p) => p.prefectureName).filter(Boolean) as string[];

  return (
    <Box minH='100vh' bg='gray.100'>
      <Header />
      <Box as='main' py={8}>
        <Container maxW='7xl'>
          <SearchForm
            prefNames={prefNames}
            q={q}
            pref={pref}
            phone={phone}
            hasWebsite={hasWebsite}
            address={address}
            permitType={permitType}
            trade={trade}
          />
          <CompanyGrid companies={companies} totalCount={totalCount} />
          <Pagination
            page={page}
            totalPages={totalPages}
            searchParams={{ q, pref, phone, hasWebsite, address, permitType, trade }}
          />
        </Container>
      </Box>
    </Box>
  );
}
