import { Box, Container } from '@chakra-ui/react';
import { Header } from '@/components/Header';
import { prisma } from '@/lib/prisma';
import { CompanyGrid } from './_components/CompanyGrid';
import { SearchForm } from './_components/SearchForm';

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
