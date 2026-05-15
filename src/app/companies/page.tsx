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
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';
import Link from 'next/link';

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
  const hasFilter = !!(q || pref || phone || hasWebsite);

  return (
    <Box minH='100vh' bg='gray.50'>
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

      <Box as='main' py={8}>
        <Container maxW='5xl'>
          <form
            method='GET'
            style={{
              marginBottom: '2rem',
              background: 'white',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
            }}
          >
            <VStack gap={4} align='stretch'>
              <Heading size='md'>業者を検索</Heading>
              <HStack gap={3} flexWrap='wrap'>
                <Input
                  name='q'
                  defaultValue={q ?? ''}
                  placeholder='業者名で検索'
                  flex='1'
                  minW='200px'
                  bg='white'
                />
                <select
                  name='pref'
                  defaultValue={pref ?? ''}
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    background: 'white',
                    minWidth: '160px',
                  }}
                >
                  <option value=''>都道府県（全て）</option>
                  {prefNames.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </HStack>
              <HStack gap={3} flexWrap='wrap'>
                <Input
                  name='phone'
                  defaultValue={phone ?? ''}
                  placeholder='電話番号で検索'
                  maxW='220px'
                  bg='white'
                />
                <HStack
                  as='label'
                  gap={2}
                  cursor='pointer'
                  px={3}
                  py={2}
                  borderWidth='1px'
                  borderColor={hasWebsite === '1' ? 'blue.400' : 'gray.200'}
                  borderRadius='md'
                  bg={hasWebsite === '1' ? 'blue.50' : 'white'}
                  userSelect='none'
                >
                  <input
                    type='checkbox'
                    name='hasWebsite'
                    value='1'
                    defaultChecked={hasWebsite === '1'}
                  />
                  <Text fontSize='sm'>Webサイトあり</Text>
                </HStack>
                <Button type='submit' colorPalette='orange'>
                  検索
                </Button>
                {hasFilter && (
                  <Link href='/companies'>
                    <Button variant='ghost' size='md'>
                      クリア
                    </Button>
                  </Link>
                )}
              </HStack>
            </VStack>
          </form>

          <Text mb={4} color='gray.600' fontSize='sm'>
            {companies.length.toLocaleString()} 件
          </Text>

          <Grid
            templateColumns={{
              base: '1fr',
              md: 'repeat(2, 1fr)',
              lg: 'repeat(3, 1fr)',
            }}
            gap={4}
          >
            {companies.map((c) => (
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
            ))}
          </Grid>

          {companies.length === 0 && (
            <Box textAlign='center' py={20} color='gray.500'>
              <Text>該当する業者が見つかりませんでした</Text>
            </Box>
          )}
        </Container>
      </Box>
    </Box>
  );
}
