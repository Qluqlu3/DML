import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentAdmin } from '@/lib/adminSession';
import { prisma } from '@/lib/prisma';
import { approveReview, rejectReview } from './actions';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: { update: vi.fn() },
  },
}));

vi.mock('@/lib/adminSession', () => ({
  getCurrentAdmin: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const SESSION_EXPIRED_ERROR = 'セッションの有効期限が切れました。再度ログインしてください';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.review.update).mockResolvedValue({ id: 7, companyId: 123 } as never);
});

describe('approveReview', () => {
  it('管理者セッションが無い場合はthrowせずエラーを返し、DBを更新しない', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(null);

    await expect(approveReview(7)).resolves.toEqual({ error: SESSION_EXPIRED_ERROR });
    expect(prisma.review.update).not.toHaveBeenCalled();
  });

  it('公開状態にした上で管理画面と業者詳細ページの両方を再検証する', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ id: 1, username: 'admin' } as never);

    await expect(approveReview(7)).resolves.toEqual({});
    expect(prisma.review.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { isPublished: true, rejectedAt: null, rejectionReason: null },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/reviews');
    expect(revalidatePath).toHaveBeenCalledWith('/companies/123');
  });
});

describe('rejectReview', () => {
  it('管理者セッションが無い場合はthrowせずエラーを返し、DBを更新しない', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(null);

    await expect(rejectReview(7, '不適切な内容')).resolves.toEqual({
      error: SESSION_EXPIRED_ERROR,
    });
    expect(prisma.review.update).not.toHaveBeenCalled();
  });

  it('却下理由を記録し、業者詳細ページも再検証する', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ id: 1, username: 'admin' } as never);

    await expect(rejectReview(7, '不適切な内容')).resolves.toEqual({});
    const call = vi.mocked(prisma.review.update).mock.calls[0][0];
    expect(call.where).toEqual({ id: 7 });
    expect(call.data).toMatchObject({ isPublished: false, rejectionReason: '不適切な内容' });
    expect(call.data?.rejectedAt).toBeInstanceOf(Date);
    expect(revalidatePath).toHaveBeenCalledWith('/companies/123');
  });

  it('却下理由が空文字ならnullとして保存する', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ id: 1, username: 'admin' } as never);

    await rejectReview(7, '');
    const call = vi.mocked(prisma.review.update).mock.calls[0][0];
    expect(call.data).toMatchObject({ rejectionReason: null });
  });
});
