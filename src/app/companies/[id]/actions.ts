'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export type SubmitReviewState = {
  success: boolean;
  error?: string;
};

export async function submitReview(
  companyId: number,
  _prevState: SubmitReviewState,
  formData: FormData,
): Promise<SubmitReviewState> {
  const rating = parseInt(formData.get('rating') as string, 10);
  const body = (formData.get('body') as string).trim();
  const title = ((formData.get('title') as string) || '').trim() || null;
  const authorName = ((formData.get('authorName') as string) || '').trim() || null;
  const workType = ((formData.get('workType') as string) || '').trim() || null;
  const workYearRaw = (formData.get('workYear') as string) || '';
  const workYear = workYearRaw ? parseInt(workYearRaw, 10) : null;

  // バリデーション
  if (!rating || rating < 1 || rating > 5) {
    return { success: false, error: '評価（★）を選択してください' };
  }
  if (!body || body.length < 10) {
    return { success: false, error: '口コミ本文は10文字以上入力してください' };
  }

  await prisma.review.create({
    data: {
      companyId,
      rating,
      body,
      title,
      authorName,
      workType,
      workYear: workYear && !isNaN(workYear) ? workYear : null,
    },
  });

  revalidatePath(`/companies/${companyId}`);
  return { success: true };
}
