import { Box, Heading, Text, Button, VStack, HStack, Container } from '@chakra-ui/react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function Home() {
  return (
    <Box minH='100vh' bg='gray.50'>
      <Box as='header' bg='blue.900' py={4}>
        <Container maxW='5xl'>
          <HStack justify='space-between'>
            <Logo />
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

      <Box as='main'>
        <Box bg='blue.900' py={20} textAlign='center'>
          <Container maxW='3xl'>
            <VStack gap={6}>
              <Heading size='2xl' color='white'>
                信頼できる解体業者を探す
              </Heading>
              <Text fontSize='lg' color='blue.200'>
                全国 1,000社以上の解体業者を口コミで比較・検索
              </Text>
              <Link href='/companies'>
                <Button size='lg' colorPalette='orange'>
                  業者を探す
                </Button>
              </Link>
            </VStack>
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
