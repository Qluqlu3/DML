'use client';

import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useActionState, useState } from 'react';
import { submitReview, type SubmitReviewState } from '@/app/companies/[id]/actions';

const WORK_TYPES = ['木造住宅', 'RC造（鉄筋コンクリート）', '鉄骨造', '解体＋廃材処理', 'その他'];

const currentYear = new Date().getFullYear();
const WORK_YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);

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
        {/* 評価 */}
        <Box>
          <label htmlFor='rating' style={{ fontSize: '0.875rem', color: '#4a5568', display: 'block', marginBottom: '4px' }}>
            評価 <span style={{ color: '#e53e3e' }}>*</span>
          </label>
          <select
            id='rating'
            name='rating'
            required
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e0',
              background: 'white',
              fontSize: '0.875rem',
            }}
          >
            <option value=''>選択してください</option>
            <option value='5'>★★★★★（5 / 大変満足）</option>
            <option value='4'>★★★★☆（4 / 満足）</option>
            <option value='3'>★★★☆☆（3 / 普通）</option>
            <option value='2'>★★☆☆☆（2 / 不満）</option>
            <option value='1'>★☆☆☆☆（1 / 大変不満）</option>
          </select>
        </Box>

        {/* タイトル */}
        <Box>
          <label htmlFor='title' style={{ fontSize: '0.875rem', color: '#4a5568', display: 'block', marginBottom: '4px' }}>
            タイトル
          </label>
          <input
            id='title'
            name='title'
            type='text'
            placeholder='例：丁寧な対応で満足でした'
            maxLength={100}
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

        {/* 本文 */}
        <Box>
          <label htmlFor='body' style={{ fontSize: '0.875rem', color: '#4a5568', display: 'block', marginBottom: '4px' }}>
            口コミ本文 <span style={{ color: '#e53e3e' }}>*</span>
            <span style={{ color: '#a0aec0', fontWeight: 'normal', marginLeft: '4px' }}>（10文字以上）</span>
          </label>
          <textarea
            id='body'
            name='body'
            required
            rows={5}
            placeholder='実際の施工内容、対応の良し悪し、価格の妥当性などをお書きください'
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e0',
              background: 'white',
              fontSize: '0.875rem',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </Box>

        {/* 工事種別・施工年（横並び） */}
        <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Box>
            <label htmlFor='workType' style={{ fontSize: '0.875rem', color: '#4a5568', display: 'block', marginBottom: '4px' }}>
              工事種別
            </label>
            <select
              id='workType'
              name='workType'
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
              {WORK_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Box>

          <Box>
            <label htmlFor='workYear' style={{ fontSize: '0.875rem', color: '#4a5568', display: 'block', marginBottom: '4px' }}>
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
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </Box>
        </Box>

        {/* 投稿者名 */}
        <Box>
          <label htmlFor='authorName' style={{ fontSize: '0.875rem', color: '#4a5568', display: 'block', marginBottom: '4px' }}>
            お名前
            <span style={{ color: '#a0aec0', fontWeight: 'normal', marginLeft: '4px' }}>（未入力の場合「匿名」で表示）</span>
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
            <Text fontSize='sm' color='red.600'>{state.error}</Text>
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
          <Button
            type='submit'
            colorPalette='orange'
            size='sm'
            loading={isPending}
          >
            投稿する
          </Button>
        </Box>
      </VStack>
    </form>
  );
}
