import { Box, Heading, Text, Button, VStack, Container } from '@chakra-ui/react';
import Link from 'next/link';
import { Header } from '@/components/Header';

export default function Home() {
  return (
    <Box minH='100vh' bg='gray.50'>
      <Header />

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
