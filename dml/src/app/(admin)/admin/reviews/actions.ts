'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentAdmin } from '@/lib/adminSession';
import { prisma } from '@/lib/prisma';

export type ReviewActionState = {
  error?: string;
};

// 管理者セッションは8時間で切れるため、画面を開いたまま放置してからの操作は日常的に起こる。
// throwするとエラーバウンダリまで飛んで画面全体が落ちてしまうので、
// 呼び出し側で表示できるエラーとして返す。
const SESSION_EXPIRED_ERROR = 'セッションの有効期限が切れました。再度ログインしてください';

export async function approveReview(reviewId: number): Promise<ReviewActionState> {
  if (!(await getCurrentAdmin())) {
    return { error: SESSION_EXPIRED_ERROR };
  }

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: { isPublished: true, rejectedAt: null, rejectionReason: null },
  });
  revalidatePath('/admin/reviews');
  // 公開状態が変わるので業者詳細ページ側のキャッシュも捨てる
  revalidatePath(`/companies/${review.companyId}`);
  return {};
}

// 却下は削除ではなく非表示のまま却下情報を記録する(誤操作からの復元・監査のため)。
// 投稿者が編集して再投稿すると、submitReview側で却下情報はクリアされ再度承認待ちに戻る。
export async function rejectReview(reviewId: number, reason: string): Promise<ReviewActionState> {
  if (!(await getCurrentAdmin())) {
    return { error: SESSION_EXPIRED_ERROR };
  }

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: { isPublished: false, rejectedAt: new Date(), rejectionReason: reason || null },
  });
  revalidatePath('/admin/reviews');
  revalidatePath(`/companies/${review.companyId}`);
  return {};
}
