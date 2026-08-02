import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSession, destroyAdminSession } from '@/lib/adminSession';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { loginAction, logoutAction } from './actions';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/adminSession', () => ({
  createAdminSession: vi.fn(),
  destroyAdminSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

function makeFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

describe('loginAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正しい認証情報の場合、DB管理のセッションを作成してリダイレクトする', async () => {
    const passwordHash = hashPassword('correct-password');
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
      id: 42,
      username: 'admin',
      passwordHash,
    } as never);

    await expect(
      loginAction(makeFormData({ username: 'admin', password: 'correct-password' })),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(createAdminSession).toHaveBeenCalledWith(42);
    expect(redirect).toHaveBeenCalledWith('/admin/reviews');
  });

  it('パスワードが違う場合はセッションを作成せずエラーを返す', async () => {
    const passwordHash = hashPassword('correct-password');
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
      id: 42,
      username: 'admin',
      passwordHash,
    } as never);

    const result = await loginAction(
      makeFormData({ username: 'admin', password: 'wrong-password' }),
    );

    expect(result).toEqual({ error: 'IDまたはパスワードが違います' });
    expect(createAdminSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('存在しないユーザー名の場合もダミーハッシュで検証し、同じ汎用エラーを返す', async () => {
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);

    const result = await loginAction(
      makeFormData({ username: 'no-such-user', password: 'whatever' }),
    );

    expect(result).toEqual({ error: 'IDまたはパスワードが違います' });
    expect(createAdminSession).not.toHaveBeenCalled();
  });
});

describe('logoutAction', () => {
  it('セッションを破棄してログイン画面へリダイレクトする', async () => {
    vi.clearAllMocks();

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

    expect(destroyAdminSession).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/admin/login');
  });
});
