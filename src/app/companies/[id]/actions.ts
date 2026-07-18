'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { reviewSchema } from '@/lib/reviewSchema';
import { getCurrentUser } from '@/lib/userSession';

export type SubmitReviewState = {
  success: boolean;
  updated?: boolean;
  error?: string;
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1時間
const RATE_LIMIT_MAX_REVIEWS = 3; // 1時間あたりの投稿上限
const RATE_LIMIT_ERROR = '投稿が多すぎます。しばらく時間をおいてから再度お試しください';

class RateLimitExceededError extends Error {}

// Serializable分離レベルでの書き込み競合(同時送信同士がお互いを検知できなかった場合)。
// pg driver adapter経由だとPrismaClientKnownRequestError(P2034)ではなく
// DriverAdapterError(cause.kind === 'TransactionWriteConflict')として投げられるため、
// 内部エラークラスに依存しない形でSQLSTATE 40001 (serialization_failure)相当を判定する。
function isSerializationConflict(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
    return true;
  }
  const cause = e instanceof Error ? (e.cause as { kind?: string } | undefined) : undefined;
  return cause?.kind === 'TransactionWriteConflict';
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

  let updated: boolean;
  try {
    // 件数チェックとupsertを同一トランザクション(Serializable)で行い、
    // 連打や複数タブからの同時送信でレート制限をすり抜けられないようにする。
    updated = await prisma.$transaction(
      async (tx) => {
        const existingReview = await tx.review.findUnique({
          where: { companyId_userId: { companyId, userId: currentUser.id } },
          select: { id: true },
        });

        const rateLimitWindowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
        const recentReviewCount = await tx.review.count({
          where: {
            userId: currentUser.id,
            OR: [
              { createdAt: { gte: rateLimitWindowStart } },
              { editedAt: { gte: rateLimitWindowStart } },
            ],
          },
        });
        if (recentReviewCount >= RATE_LIMIT_MAX_REVIEWS) {
          throw new RateLimitExceededError();
        }

        await tx.review.upsert({
          where: { companyId_userId: { companyId, userId: currentUser.id } },
          create: {
            companyId,
            userId: currentUser.id,
            priceRating,
            serviceRating,
            qualityRating,
            structureType,
            authorName,
            workYear,
          },
          update: {
            priceRating,
            serviceRating,
            qualityRating,
            structureType,
            authorName,
            workYear,
            isPublished: false,
            rejectedAt: null,
            rejectionReason: null,
            editedAt: new Date(),
          },
        });

        return existingReview !== null;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return { success: false, error: RATE_LIMIT_ERROR };
    }
    if (isSerializationConflict(e)) {
      return {
        success: false,
        error: '一時的にアクセスが集中しています。もう一度お試しください',
      };
    }
    throw e;
  }

  revalidatePath(`/companies/${companyId}`);
  return { success: true, updated };
}
