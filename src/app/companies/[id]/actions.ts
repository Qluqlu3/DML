'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { RATING_ITEMS } from '@/lib/reviewRating';
import { isStructureType } from '@/lib/structureType';
import { getCurrentUser } from '@/lib/userSession';

export type SubmitReviewState = {
  success: boolean;
  error?: string;
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1時間
const RATE_LIMIT_MAX_REVIEWS = 3; // 1時間あたりの投稿上限

function parseRating(formData: FormData, name: string): number | null {
  const value = parseInt(formData.get(name) as string, 10);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

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

  const ratings = Object.fromEntries(
    RATING_ITEMS.map((item) => [item.name, parseRating(formData, item.name)]),
  ) as Record<(typeof RATING_ITEMS)[number]['name'], number | null>;
  const rawAuthorName = ((formData.get('authorName') as string) || '').trim();
  const authorName = rawAuthorName || currentUser.name || null;
  const structureType = (formData.get('structureType') as string) || '';
  const workYearRaw = (formData.get('workYear') as string) || '';
  const workYear = workYearRaw ? parseInt(workYearRaw, 10) : null;

  // バリデーション
  for (const item of RATING_ITEMS) {
    if (!ratings[item.name]) {
      return { success: false, error: `「${item.label}」の評価（★）を選択してください` };
    }
  }
  if (!isStructureType(structureType)) {
    return { success: false, error: '解体した建物の構造を選択してください' };
  }

  try {
    await prisma.review.create({
      data: {
        companyId,
        userId: currentUser.id,
        priceRating: ratings.priceRating as number,
        serviceRating: ratings.serviceRating as number,
        qualityRating: ratings.qualityRating as number,
        structureType,
        authorName,
        workYear: workYear && !Number.isNaN(workYear) ? workYear : null,
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
