'use client';

import { Box, chakra, HStack, Text } from '@chakra-ui/react';
import { useState } from 'react';

const STARS = [1, 2, 3, 4, 5] as const;

type Props = {
  name: string;
  label: string;
  defaultValue?: number;
};

export function StarRatingInput({ name, label, defaultValue = 0 }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = hoverValue || value;

  return (
    <Box>
      <input type='hidden' name={name} value={value} />
      <HStack
        gap={1}
        role='radiogroup'
        aria-label={label}
        onMouseLeave={() => setHoverValue(0)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            setValue((v) => Math.min(5, (v || 0) + 1));
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            setValue((v) => Math.max(1, v - 1));
          }
        }}
      >
        {STARS.map((star) => {
          const filled = star <= displayValue;
          return (
            <chakra.button
              key={star}
              type='button'
              role='radio'
              aria-checked={value === star}
              aria-label={`${star}点`}
              tabIndex={star === (value || 1) ? 0 : -1}
              onClick={() => setValue(star)}
              onMouseEnter={() => setHoverValue(star)}
              display='flex'
              alignItems='center'
              justifyContent='center'
              boxSize='44px'
              fontSize='32px'
              lineHeight={1}
              color={filled ? 'orange.400' : 'gray.300'}
              bg='transparent'
              border='none'
              cursor='pointer'
              borderRadius='md'
              transformOrigin='center'
              transform={hoverValue === star ? 'scale(1.15)' : 'scale(1)'}
              transition='color 0.12s ease, transform 0.12s ease'
              _focusVisible={{
                outline: '2px solid',
                outlineColor: 'orange.400',
                outlineOffset: '2px',
              }}
            >
              ★
            </chakra.button>
          );
        })}
        <Text fontSize='sm' color='gray.500' ml={1} minW='2.5em' aria-live='polite'>
          {value > 0 ? `${value}点` : ''}
        </Text>
      </HStack>
    </Box>
  );
}
