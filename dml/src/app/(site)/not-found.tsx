import { Box, Button, Container, Heading, Text, VStack } from '@chakra-ui/react';
import Link from 'next/link';

// 存在しない業者ID（/companies/[id] の notFound()）や未定義URL向けの404。
export default function SiteNotFound() {
  return (
    <Box minH='100vh' bg='gray.100'>
      <Box as='main' py={20}>
        <Container maxW='lg'>
          <Box
            bg='white'
            p={8}
            borderRadius='lg'
            shadow='sm'
            borderWidth='1px'
            borderColor='gray.200'
            textAlign='center'
          >
            <VStack gap={4}>
              <Text fontSize='4xl' fontWeight='bold' color='orange.500' lineHeight='1'>
                404
              </Text>
              <Heading size='md' color='gray.700'>
                ページが見つかりません
              </Heading>
              <Text fontSize='sm' color='gray.600'>
                お探しのページは削除されたか、URLが変更された可能性があります。
              </Text>
              <Link href='/companies'>
                <Button colorPalette='orange' mt={2}>
                  解体業者を探す
                </Button>
              </Link>
            </VStack>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
