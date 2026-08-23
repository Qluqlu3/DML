'use client';

import { Box, Button, Container, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import Link from 'next/link';
import { useEffect } from 'react';

// 公開サイト側のエラーバウンダリ。DB接続エラーなど想定外の例外が発生したとき、
// Next.jsの汎用エラー画面ではなく再試行できるUIを出す。
// 本番ではerror.messageが伏せられるため、利用者向けの文言は固定にしてdigestのみ表示する。
export default function SiteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
              <Heading size='lg' color='gray.700'>
                エラーが発生しました
              </Heading>
              <Text fontSize='sm' color='gray.600'>
                一時的な問題の可能性があります。少し待ってから再試行してください。
              </Text>
              <HStack gap={3} pt={2}>
                <Button colorPalette='orange' onClick={() => unstable_retry()}>
                  再試行する
                </Button>
                <Link href='/'>
                  <Button variant='outline'>ホームへ戻る</Button>
                </Link>
              </HStack>
              {error.digest && (
                <Text fontSize='xs' color='gray.400' pt={2}>
                  エラーID: {error.digest}
                </Text>
              )}
            </VStack>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
