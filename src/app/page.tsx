import type { Metadata } from 'next';
import { Box, Button, Container, Grid, GridItem, Heading, Text, VStack } from '@chakra-ui/react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { groupByRegion } from '@/lib/prefecture';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: '信頼できる解体業者を探す | DML',
  description:
    '全国1,000社以上の解体業者を口コミで比較・検索。解体工事の業者選びなら DML にお任せください。',
  openGraph: {
    title: '信頼できる解体業者を探す | DML',
    description:
      '全国1,000社以上の解体業者を口コミで比較・検索。解体工事の業者選びなら DML にお任せください。',
  },
};

export default async function Home() {
  const prefList = await prisma.company.findMany({
    select: { prefectureName: true },
    distinct: ['prefectureName'],
    where: { prefectureName: { not: null } },
  });
  const prefNames = prefList.map((p) => p.prefectureName).filter(Boolean) as string[];
  const prefRegions = groupByRegion(prefNames);

  return (
    <Box minH='100vh' bg='gray.50'>
      <Header />

      <Box as='main'>
        {/* ヒーローバナー */}
        <Box bg='blue.900' py={20} textAlign='center'>
          <Container maxW='3xl'>
            <VStack gap={8}>
              <VStack gap={3}>
                <Heading size='2xl' color='white'>
                  信頼できる解体業者を探す
                </Heading>
                <Text fontSize='lg' color='blue.200'>
                  全国 1,000社以上の解体業者を口コミで比較・検索
                </Text>
              </VStack>

              {/* 検索フォーム */}
              <form
                action='/companies'
                method='GET'
                style={{
                  width: '100%',
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                }}
              >
                <VStack gap={3}>
                  <input
                    name='q'
                    type='text'
                    placeholder='業者名で検索'
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <Box w='100%' display='flex' gap='12px' flexWrap='wrap' justifyContent='center'>
                    <select
                      name='pref'
                      style={{
                        flex: '1',
                        minWidth: '160px',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '1rem',
                        background: 'white',
                      }}
                    >
                      <option value=''>都道府県（全て）</option>
                      {prefRegions.map((region) => (
                        <optgroup key={region.name} label={region.name}>
                          {region.prefectures.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <Button type='submit' colorPalette='orange' size='lg' px={10}>
                      検索する
                    </Button>
                  </Box>
                </VStack>
              </form>
            </VStack>
          </Container>
        </Box>

        {/* 都道府県から探す */}
        {prefRegions.length > 0 && (
          <Box py={12}>
            <Container maxW='5xl'>
              <Heading size='lg' mb={6} textAlign='center'>
                都道府県から探す
              </Heading>
              <VStack gap={6} align='stretch'>
                {prefRegions.map((region) => (
                  <Box key={region.name}>
                    <Text fontSize='sm' fontWeight='bold' color='gray.500' mb={2}>
                      {region.name}
                    </Text>
                    <Grid
                      templateColumns={{
                        base: 'repeat(3, 1fr)',
                        sm: 'repeat(4, 1fr)',
                        md: 'repeat(6, 1fr)',
                        lg: 'repeat(8, 1fr)',
                      }}
                      gap={2}
                    >
                      {region.prefectures.map((pref) => (
                        <GridItem key={pref}>
                          <Link href={`/companies?pref=${encodeURIComponent(pref)}`}>
                            <Box
                              textAlign='center'
                              py={2}
                              px={1}
                              borderRadius='md'
                              borderWidth='1px'
                              borderColor='gray.200'
                              bg='white'
                              fontSize='sm'
                              _hover={{ borderColor: 'blue.400', bg: 'blue.50', color: 'blue.700' }}
                              transition='all 0.15s'
                            >
                              {pref}
                            </Box>
                          </Link>
                        </GridItem>
                      ))}
                    </Grid>
                  </Box>
                ))}
              </VStack>
            </Container>
          </Box>
        )}
      </Box>
    </Box>
  );
}
