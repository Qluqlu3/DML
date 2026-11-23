'use client';

import { Button, HStack, Text } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logoutAction } from '@/app/actions/auth';
import { AuthModal } from '@/components/AuthModal';

type Props = {
  currentUser: { name: string | null; email: string } | null;
};

export function HeaderAuthButtons({ currentUser }: Props) {
  const [modalMode, setModalMode] = useState<'login' | 'register' | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  if (currentUser) {
    return (
      <HStack gap={3}>
        <Text color='white' fontSize='sm'>
          {currentUser.name || currentUser.email} さん
        </Text>
        <Button
          variant='ghost'
          size='sm'
          color='white'
          _hover={{ bg: 'blue.800' }}
          loading={isLoggingOut}
          onClick={async () => {
            setIsLoggingOut(true);
            await logoutAction();
            router.refresh();
          }}
        >
          ログアウト
        </Button>
      </HStack>
    );
  }

  return (
    <>
      <HStack gap={4}>
        <Button
          variant='ghost'
          size='sm'
          color='white'
          _hover={{ bg: 'blue.800' }}
          onClick={() => setModalMode('login')}
        >
          ログイン
        </Button>
        <Button colorPalette='orange' size='sm' onClick={() => setModalMode('register')}>
          会員登録
        </Button>
      </HStack>
      <AuthModal
        mode={modalMode}
        onClose={() => setModalMode(null)}
        onSuccess={() => {
          setModalMode(null);
          router.refresh();
        }}
      />
    </>
  );
}
