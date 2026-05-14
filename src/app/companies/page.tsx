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
  searchParams: Promise<{ q?: string; pref?: string }>;
}) {
  const { q, pref } = await searchParams;

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
        ],
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const prefNames = prefList.map((p) => p.prefectureName).filter(Boolean) as string[];

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
          <Box
            as='form'
            method='GET'
            mb={8}
            bg='white'
            p={6}
            borderRadius='lg'
            shadow='sm'
            borderWidth='1px'
            borderColor='gray.200'
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
                <Box
                  as='select'
                  name='pref'
                  defaultValue={pref ?? ''}
                  px={3}
                  py={2}
                  borderWidth='1px'
                  borderColor='gray.200'
                  borderRadius='md'
                  bg='white'
                  minW='160px'
                >
                  <option value=''>都道府県（全て）</option>
                  {prefNames.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Box>
                <Button type='submit' colorPalette='orange'>
                  検索
                </Button>
                {(q || pref) && (
                  <Link href='/companies'>
                    <Button variant='ghost' size='md'>
                      クリア
                    </Button>
                  </Link>
                )}
              </HStack>
            </VStack>
          </Box>

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
                <Box
                  bg='white'
                  p={5}
                  borderRadius='lg'
                  shadow='sm'
                  borderWidth='1px'
                  borderColor='gray.200'
                  h='100%'
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
