'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { RATING_ITEMS } from '@/lib/reviewRating';
import { isStructureType } from '@/lib/structureType';

export type SubmitReviewState = {
  success: boolean;
  error?: string;
};

function parseRating(formData: FormData, name: string): number | null {
  const value = parseInt(formData.get(name) as string, 10);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

export async function submitReview(
  companyId: number,
  _prevState: SubmitReviewState,
  formData: FormData,
): Promise<SubmitReviewState> {
  const ratings = Object.fromEntries(
    RATING_ITEMS.map((item) => [item.name, parseRating(formData, item.name)]),
  ) as Record<(typeof RATING_ITEMS)[number]['name'], number | null>;
  const authorName = ((formData.get('authorName') as string) || '').trim() || null;
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

  await prisma.review.create({
    data: {
      companyId,
      priceRating: ratings.priceRating as number,
      serviceRating: ratings.serviceRating as number,
      qualityRating: ratings.qualityRating as number,
      structureType,
      authorName,
      workYear: workYear && !isNaN(workYear) ? workYear : null,
    },
  });

  revalidatePath(`/companies/${companyId}`);
  return { success: true };
}
