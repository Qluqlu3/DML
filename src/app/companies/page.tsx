import type { Metadata } from 'next';
import { Box, Container } from '@chakra-ui/react';
import { Header } from '@/components/Header';
import { prisma } from '@/lib/prisma';
import { CompanyGrid } from './_components/CompanyGrid';
import { SearchForm } from './_components/SearchForm';

export const metadata: Metadata = {
  title: '解体業者を探す | DML',
  description:
    '全国の解体業者を都道府県・業者名・電話番号で検索。口コミや評判も確認しながら比較検討できます。',
  openGraph: {
    title: '解体業者を探す | DML',
    description:
      '全国の解体業者を都道府県・業者名・電話番号で検索。口コミや評判も確認しながら比較検討できます。',
  },
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pref?: string; phone?: string; hasWebsite?: string }>;
}) {
  const { q, pref, phone, hasWebsite } = await searchParams;

  const [prefList, companies] = await Promise.all([
    prisma.company.findMany({
      select: { prefectureName: true },
      distinct: ['prefectureName'],
      where: { prefectureName: { not: null } },
      orderBy: { prefectureName: 'asc' },
    }),
    prisma.company.findMany({
      where: {
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
        ],
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const prefNames = prefList.map((p) => p.prefectureName).filter(Boolean) as string[];

  return (
    <Box minH='100vh' bg='gray.50'>
      <Header />
      <Box as='main' py={8}>
        <Container maxW='5xl'>
          <SearchForm
            prefNames={prefNames}
            q={q}
            pref={pref}
            phone={phone}
            hasWebsite={hasWebsite}
          />
          <CompanyGrid companies={companies} />
        </Container>
      </Box>
    </Box>
  );
}
