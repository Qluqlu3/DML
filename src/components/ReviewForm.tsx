'use client';

import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { type SubmitReviewState, submitReview } from '@/app/companies/[id]/actions';
import { AuthModal } from '@/components/AuthModal';
import { StarRatingInput } from '@/components/StarRatingInput';
import type { StructureType } from '@/generated/prisma/client';
import { RATING_ITEMS } from '@/lib/reviewRating';
import { STRUCTURE_TYPE_OPTIONS } from '@/lib/structureType';

const currentYear = new Date().getFullYear();
const WORK_YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);

type MyReview = {
  priceRating: number;
  serviceRating: number;
  qualityRating: number;
  structureType: StructureType;
  workYear: number | null;
  authorName: string | null;
  isPublished: boolean;
  rejectedAt: Date | null;
  rejectionReason: string | null;
};

type Props = {
  companyId: number;
  currentUser: { name: string | null; email: string } | null;
  myReview: MyReview | null;
};

const initialState: SubmitReviewState = { success: false };

export function ReviewForm({ companyId, currentUser, myReview }: Props) {
  const isEdit = myReview !== null;
  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const router = useRouter();

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
          {state.updated ? '口コミを更新しました！' : '口コミを投稿しました！'}
        </Text>
        <Text fontSize='sm' color='green.600' mt={1}>
          {state.updated ? '運営の再承認後に公開されます' : 'ご協力ありがとうございます'}
        </Text>
      </Box>
    );
  }

  if (!currentUser) {
    return (
      <>
        <Button colorPalette='orange' size='sm' onClick={() => setAuthMode('login')}>
          ログインして口コミを書く
        </Button>
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSuccess={() => {
            setAuthMode(null);
            router.refresh();
          }}
        />
      </>
    );
  }

  const rejectionBanner = myReview?.rejectedAt ? (
    <Box p={3} borderRadius='md' bg='red.50' borderWidth='1px' borderColor='red.200' maxW='sm'>
      <Text fontSize='sm' color='red.700' fontWeight='bold'>
        口コミが非公開になりました
      </Text>
      {myReview.rejectionReason && (
        <Text fontSize='sm' color='red.600' mt={1}>
          理由: {myReview.rejectionReason}
        </Text>
      )}
      <Text fontSize='xs' color='red.500' mt={1}>
        内容を編集して再度投稿すると、運営が再度確認します
      </Text>
    </Box>
  ) : null;

  if (!open) {
    return (
      <VStack align='end' gap={2}>
        {rejectionBanner}
        <Button colorPalette='orange' size='sm' onClick={() => setOpen(true)}>
          {isEdit ? '自分の口コミを編集する' : '口コミを書く'}
        </Button>
      </VStack>
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
        {isEdit ? '口コミを編集する' : '口コミを投稿する'}
      </Heading>

      <VStack gap={4} align='stretch'>
        {rejectionBanner}
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
            <StarRatingInput
              name={item.name}
              label={item.label}
              defaultValue={myReview?.[item.name]}
            />
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
              defaultValue={myReview?.structureType ?? ''}
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
              defaultValue={myReview?.workYear ?? ''}
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
            表示名
            <span style={{ color: '#a0aec0', fontWeight: 'normal', marginLeft: '4px' }}>
              （未入力の場合「{currentUser.name || '匿名'}」で表示）
            </span>
          </label>
          <input
            id='authorName'
            name='authorName'
            type='text'
            autoComplete='nickname'
            defaultValue={myReview?.authorName ?? ''}
            placeholder={currentUser.name || '匿名'}
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

        {isEdit && (
          <Text fontSize='xs' color='gray.500'>
            更新した内容は運営の再承認後に公開されます。承認までは一覧に表示されません。
          </Text>
        )}

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
            {isEdit ? '更新する' : '投稿する'}
          </Button>
        </Box>
      </VStack>
    </form>
  );
}
