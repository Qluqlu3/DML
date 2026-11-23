'use client';

import { Box, Button, chakra, Dialog, HStack, Input, Portal, Text, VStack } from '@chakra-ui/react';
import { useActionState, useEffect, useState } from 'react';
import { type AuthState, loginAction, registerAction } from '@/app/actions/auth';

type Mode = 'login' | 'register';

type Props = {
  mode: Mode | null;
  onClose: () => void;
  onSuccess: () => void;
};

const initialState: AuthState = {};

export function AuthModal({ mode, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<Mode>(mode ?? 'login');
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, initialState);
  const [registerState, registerFormAction, registerPending] = useActionState(
    registerAction,
    initialState,
  );

  useEffect(() => {
    if (mode) setActiveTab(mode);
  }, [mode]);

  useEffect(() => {
    if (loginState.success) onSuccess();
  }, [loginState.success, onSuccess]);

  useEffect(() => {
    if (registerState.success) onSuccess();
  }, [registerState.success, onSuccess]);

  const open = mode !== null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      placement='center'
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW='sm'>
            <Dialog.Header>
              <HStack gap={0} borderBottomWidth='1px' borderColor='gray.200' w='100%'>
                <chakra.button
                  type='button'
                  flex='1'
                  py={2}
                  textAlign='center'
                  fontWeight='bold'
                  fontSize='sm'
                  color={activeTab === 'login' ? 'orange.500' : 'gray.400'}
                  borderBottomWidth='2px'
                  borderColor={activeTab === 'login' ? 'orange.500' : 'transparent'}
                  onClick={() => setActiveTab('login')}
                >
                  ログイン
                </chakra.button>
                <chakra.button
                  type='button'
                  flex='1'
                  py={2}
                  textAlign='center'
                  fontWeight='bold'
                  fontSize='sm'
                  color={activeTab === 'register' ? 'orange.500' : 'gray.400'}
                  borderBottomWidth='2px'
                  borderColor={activeTab === 'register' ? 'orange.500' : 'transparent'}
                  onClick={() => setActiveTab('register')}
                >
                  会員登録
                </chakra.button>
              </HStack>
            </Dialog.Header>

            <Dialog.Body>
              {activeTab === 'login' ? (
                <form action={loginFormAction}>
                  <VStack gap={3} align='stretch'>
                    <Box>
                      <Text fontSize='sm' color='gray.600' mb={1}>
                        メールアドレス
                      </Text>
                      <Input name='email' type='email' required autoComplete='email' />
                    </Box>
                    <Box>
                      <Text fontSize='sm' color='gray.600' mb={1}>
                        パスワード
                      </Text>
                      <Input
                        name='password'
                        type='password'
                        required
                        autoComplete='current-password'
                      />
                    </Box>
                    {loginState.error && (
                      <Text fontSize='sm' color='red.500'>
                        {loginState.error}
                      </Text>
                    )}
                    <Button type='submit' colorPalette='orange' loading={loginPending} mt={1}>
                      ログイン
                    </Button>
                  </VStack>
                </form>
              ) : (
                <form action={registerFormAction}>
                  <VStack gap={3} align='stretch'>
                    <Box>
                      <Text fontSize='sm' color='gray.600' mb={1}>
                        表示名
                        <Text as='span' color='gray.400' ml={1}>
                          （任意）
                        </Text>
                      </Text>
                      <Input name='name' type='text' autoComplete='nickname' maxLength={50} />
                    </Box>
                    <Box>
                      <Text fontSize='sm' color='gray.600' mb={1}>
                        メールアドレス
                      </Text>
                      <Input name='email' type='email' required autoComplete='email' />
                    </Box>
                    <Box>
                      <Text fontSize='sm' color='gray.600' mb={1}>
                        パスワード
                        <Text as='span' color='gray.400' ml={1}>
                          （8文字以上）
                        </Text>
                      </Text>
                      <Input
                        name='password'
                        type='password'
                        required
                        minLength={8}
                        autoComplete='new-password'
                      />
                    </Box>
                    {registerState.error && (
                      <Text fontSize='sm' color='red.500'>
                        {registerState.error}
                      </Text>
                    )}
                    <Button type='submit' colorPalette='orange' loading={registerPending} mt={1}>
                      登録する
                    </Button>
                  </VStack>
                </form>
              )}
            </Dialog.Body>

            <Dialog.CloseTrigger asChild>
              <Button variant='ghost' size='sm' position='absolute' top={2} right={2}>
                ✕
              </Button>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
