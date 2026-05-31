'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export async function approveReview(reviewId: number) {
  await prisma.review.update({
    where: { id: reviewId },
    data: { isPublished: true },
  });
  revalidatePath('/admin/reviews');
}

export async function rejectReview(reviewId: number) {
  await prisma.review.delete({
    where: { id: reviewId },
  });
  revalidatePath('/admin/reviews');
}
