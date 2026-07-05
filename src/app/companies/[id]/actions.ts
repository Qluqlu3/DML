'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { reviewSchema } from '@/lib/reviewSchema';
import { getCurrentUser } from '@/lib/userSession';

export type SubmitReviewState = {
  success: boolean;
  error?: string;
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1時間
const RATE_LIMIT_MAX_REVIEWS = 3; // 1時間あたりの投稿上限

export async function submitReview(
  companyId: number,
  _prevState: SubmitReviewState,
  formData: FormData,
): Promise<SubmitReviewState> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: '口コミの投稿にはログインが必要です' };
  }

  const recentReviewCount = await prisma.review.count({
    where: {
      userId: currentUser.id,
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    },
  });
  if (recentReviewCount >= RATE_LIMIT_MAX_REVIEWS) {
    return {
      success: false,
      error: '投稿が多すぎます。しばらく時間をおいてから再度お試しください',
    };
  }

  const parsed = reviewSchema.safeParse({
    priceRating: formData.get('priceRating'),
    serviceRating: formData.get('serviceRating'),
    qualityRating: formData.get('qualityRating'),
    structureType: formData.get('structureType'),
    authorName: formData.get('authorName'),
    workYear: formData.get('workYear'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { priceRating, serviceRating, qualityRating, structureType, workYear } = parsed.data;
  const authorName = parsed.data.authorName || currentUser.name || null;

  try {
    await prisma.review.create({
      data: {
        companyId,
        userId: currentUser.id,
        priceRating,
        serviceRating,
        qualityRating,
        structureType,
        authorName,
        workYear,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { success: false, error: 'この業者への口コミは既に投稿済みです' };
    }
    throw e;
  }

  revalidatePath(`/companies/${companyId}`);
  return { success: true };
}
