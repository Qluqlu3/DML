import { ChakraProvider } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { system } from './system';

export function UiProvider({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}
