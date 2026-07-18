'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export async function approveReview(reviewId: number) {
  await prisma.review.update({
    where: { id: reviewId },
    data: { isPublished: true, rejectedAt: null, rejectionReason: null },
  });
  revalidatePath('/admin/reviews');
}

// 却下は削除ではなく非表示のまま却下情報を記録する(誤操作からの復元・監査のため)。
// 投稿者が編集して再投稿すると、submitReview側で却下情報はクリアされ再度承認待ちに戻る。
export async function rejectReview(reviewId: number, reason: string) {
  await prisma.review.update({
    where: { id: reviewId },
    data: { isPublished: false, rejectedAt: new Date(), rejectionReason: reason || null },
  });
  revalidatePath('/admin/reviews');
}
