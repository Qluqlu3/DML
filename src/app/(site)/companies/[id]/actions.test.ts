import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/userSession';
import { submitReview } from './actions';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/userSession', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

type FakeTx = {
  review: {
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

function makeFormData(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    priceRating: '5',
    serviceRating: '4',
    qualityRating: '3',
    structureType: 'WOODEN',
    authorName: '',
    workYear: '2024',
  };
  const data = { ...defaults, ...overrides };
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.set(key, value);
  }
  return formData;
}

function mockTransaction(tx: FakeTx) {
  vi.mocked(prisma.$transaction).mockImplementation(
    // biome-ignore lint/suspicious/noExplicitAny: テスト用の簡略化されたtxで十分
    (cb: any) => cb(tx),
  );
}

const CURRENT_USER = { id: 1, name: 'Taro', email: 'taro@example.com' };

describe('submitReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ログインしていない場合はエラーを返し、DBにアクセスしない', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await submitReview(1, { success: false }, makeFormData());

    expect(result).toEqual({ success: false, error: '口コミの投稿にはログインが必要です' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('バリデーションエラーの場合はメッセージを返し、DBにアクセスしない', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: セッションのモック用
    vi.mocked(getCurrentUser).mockResolvedValue(CURRENT_USER as any);

    const result = await submitReview(1, { success: false }, makeFormData({ structureType: '' }));

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('初回投稿時はcreateされ、updated: falseを返す', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: セッションのモック用
    vi.mocked(getCurrentUser).mockResolvedValue(CURRENT_USER as any);
    const upsert = vi.fn().mockResolvedValue({});
    mockTransaction({
      review: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        upsert,
      },
    });

    const result = await submitReview(1, { success: false }, makeFormData());

    expect(result).toEqual({ success: true, updated: false });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_userId: { companyId: 1, userId: 1 } },
        create: expect.objectContaining({ companyId: 1, userId: 1, priceRating: 5 }),
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/companies/1');
  });

  it('既に口コミがある場合はupdateされ、updated: trueを返し再承認待ちに戻る', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: セッションのモック用
    vi.mocked(getCurrentUser).mockResolvedValue(CURRENT_USER as any);
    const upsert = vi.fn().mockResolvedValue({});
    mockTransaction({
      review: {
        findUnique: vi.fn().mockResolvedValue({ id: 99 }),
        count: vi.fn().mockResolvedValue(0),
        upsert,
      },
    });

    const result = await submitReview(1, { success: false }, makeFormData());

    expect(result).toEqual({ success: true, updated: true });
    const updateData = upsert.mock.calls[0][0].update;
    expect(updateData.isPublished).toBe(false);
    expect(updateData.editedAt).toBeInstanceOf(Date);
  });

  it('直近の投稿・編集件数が上限に達している場合はレート制限エラーを返す', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: セッションのモック用
    vi.mocked(getCurrentUser).mockResolvedValue(CURRENT_USER as any);
    const upsert = vi.fn();
    mockTransaction({
      review: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(3),
        upsert,
      },
    });

    const result = await submitReview(1, { success: false }, makeFormData());

    expect(result).toEqual({
      success: false,
      error: '投稿が多すぎます。しばらく時間をおいてから再度お試しください',
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('トランザクションが書き込み競合(TransactionWriteConflict)で失敗した場合は再試行を促す', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: セッションのモック用
    vi.mocked(getCurrentUser).mockResolvedValue(CURRENT_USER as any);
    vi.mocked(prisma.$transaction).mockImplementation(async () => {
      const err = new Error('could not serialize access');
      Object.assign(err, { cause: { kind: 'TransactionWriteConflict', originalCode: '40001' } });
      throw err;
    });

    const result = await submitReview(1, { success: false }, makeFormData());

    expect(result).toEqual({
      success: false,
      error: '一時的にアクセスが集中しています。もう一度お試しください',
    });
  });

  it('P2034のPrismaClientKnownRequestErrorでも再試行を促す', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: セッションのモック用
    vi.mocked(getCurrentUser).mockResolvedValue(CURRENT_USER as any);
    vi.mocked(prisma.$transaction).mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: '7.8.0',
      });
    });

    const result = await submitReview(1, { success: false }, makeFormData());

    expect(result).toEqual({
      success: false,
      error: '一時的にアクセスが集中しています。もう一度お試しください',
    });
  });

  it('想定外のエラーはそのまま投げる', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: セッションのモック用
    vi.mocked(getCurrentUser).mockResolvedValue(CURRENT_USER as any);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('unexpected db error'));

    await expect(submitReview(1, { success: false }, makeFormData())).rejects.toThrow(
      'unexpected db error',
    );
  });
});
