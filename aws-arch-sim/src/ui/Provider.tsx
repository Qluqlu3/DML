import { ChakraProvider } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { ConfirmDialogHost } from './confirm';
import { system } from './system';
import { Toaster } from './toaster';

export function UiProvider({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider value={system}>
      {children}
      <Toaster />
      <ConfirmDialogHost />
    </ChakraProvider>
  );
}
