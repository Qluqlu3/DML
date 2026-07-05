'use client';

import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useActionState, useState } from 'react';
import { submitReview, type SubmitReviewState } from '@/app/companies/[id]/actions';
import { RATING_ITEMS } from '@/lib/reviewRating';
import { STRUCTURE_TYPE_OPTIONS } from '@/lib/structureType';

const currentYear = new Date().getFullYear();
const WORK_YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);

const STAR_VALUES = [5, 4, 3, 2, 1] as const;

type Props = {
  companyId: number;
};

const initialState: SubmitReviewState = { success: false };

export function ReviewForm({ companyId }: Props) {
  const [open, setOpen] = useState(false);

  const action = submitReview.bind(null, companyId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.success) {
    return (
      <Box
        p={4}
        borderRadius='md'
        bg='green.50'
        borderWidth='1px'
        borderColor='green.200'
        textAlign='center'
      >
        <Text color='green.700' fontWeight='bold'>
          口コミを投稿しました！
        </Text>
        <Text fontSize='sm' color='green.600' mt={1}>
          ご協力ありがとうございます
        </Text>
      </Box>
    );
  }

  if (!open) {
    return (
      <Button colorPalette='orange' size='sm' onClick={() => setOpen(true)}>
        口コミを書く
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      style={{
        border: '1px solid',
        borderColor: '#fed7aa',
        borderRadius: '0.5rem',
        padding: '20px',
        background: '#fff7ed',
      }}
    >
      <Heading size='sm' mb={4} color='gray.700'>
        口コミを投稿する
      </Heading>

      <VStack gap={4} align='stretch'>
        {/* 項目別評価 */}
        {RATING_ITEMS.map((item) => (
          <Box key={item.name}>
            <Text
              as='label'
              style={{
                fontSize: '0.875rem',
                color: '#4a5568',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              {item.label} <span style={{ color: '#e53e3e' }}>*</span>
            </Text>
            <div style={{ display: 'flex', gap: '12px' }} role='radiogroup' aria-label={item.label}>
              {STAR_VALUES.map((value) => (
                <label
                  key={value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.875rem',
                    color: '#4a5568',
                    cursor: 'pointer',
                  }}
                >
                  <input type='radio' name={item.name} value={value} required />
                  <span style={{ color: '#f6ad55' }}>
                    {'★'.repeat(value)}
                    {'☆'.repeat(5 - value)}
                  </span>
                </label>
              ))}
            </div>
          </Box>
        ))}

        {/* 解体した建物の構造・施工年（横並び） */}
        <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Box>
            <label
              htmlFor='structureType'
              style={{
                fontSize: '0.875rem',
                color: '#4a5568',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              解体した建物の構造 <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <select
              id='structureType'
              name='structureType'
              required
              defaultValue=''
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e0',
                background: 'white',
                fontSize: '0.875rem',
              }}
            >
              <option value='' disabled>
                選択してください
              </option>
              {STRUCTURE_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Box>

          <Box>
            <label
              htmlFor='workYear'
              style={{
                fontSize: '0.875rem',
                color: '#4a5568',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              施工年
            </label>
            <select
              id='workYear'
              name='workYear'
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e0',
                background: 'white',
                fontSize: '0.875rem',
              }}
            >
              <option value=''>未選択</option>
              {WORK_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </Box>
        </Box>

        {/* 投稿者名 */}
        <Box>
          <label
            htmlFor='authorName'
            style={{
              fontSize: '0.875rem',
              color: '#4a5568',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            お名前
            <span style={{ color: '#a0aec0', fontWeight: 'normal', marginLeft: '4px' }}>
              （未入力の場合「匿名」で表示）
            </span>
          </label>
          <input
            id='authorName'
            name='authorName'
            type='text'
            placeholder='匿名'
            maxLength={50}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e0',
              background: 'white',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
        </Box>

        {/* エラー表示 */}
        {state.error && (
          <Box p={3} borderRadius='md' bg='red.50' borderWidth='1px' borderColor='red.200'>
            <Text fontSize='sm' color='red.600'>
              {state.error}
            </Text>
          </Box>
        )}

        {/* ボタン */}
        <Box style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            キャンセル
          </Button>
          <Button type='submit' colorPalette='orange' size='sm' loading={isPending}>
            投稿する
          </Button>
        </Box>
      </VStack>
    </form>
  );
}
