import { Box, Container, HStack } from '@chakra-ui/react';
import Link from 'next/link';
import { HeaderAuthButtons } from '@/components/HeaderAuthButtons';
import { Logo } from '@/components/Logo';
import { getCurrentUser } from '@/lib/userSession';

export async function Header() {
  const user = await getCurrentUser();

  return (
    <Box as='header' bg='blue.900' py={4}>
      <Container maxW='5xl'>
        <HStack justify='space-between'>
          <Link href='/'>
            <Logo />
          </Link>
          <HeaderAuthButtons currentUser={user ? { name: user.name, email: user.email } : null} />
        </HStack>
      </Container>
    </Box>
  );
}
