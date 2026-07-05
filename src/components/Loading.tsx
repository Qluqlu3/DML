import { Center, Spinner } from '@chakra-ui/react';

export function Loading() {
  return (
    <Center minH='60vh'>
      <Spinner size='xl' color='orange.500' borderWidth='3px' />
    </Center>
  );
}
