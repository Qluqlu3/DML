import { Box, Button, Container, HStack } from '@chakra-ui/react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

export function Header() {
  return (
    <Box as='header' bg='blue.900' py={4}>
      <Container maxW='5xl'>
        <HStack justify='space-between'>
          <Link href='/'>
            <Logo />
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
  );
}
