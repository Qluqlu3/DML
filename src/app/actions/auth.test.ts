import { headers } from 'next/headers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createUserSession } from '@/lib/userSession';
import { loginAction, registerAction } from './auth';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    authAttempt: { create: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/userSession', () => ({
  createUserSession: vi.fn(),
  destroyUserSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

function mockIp(ip: string | null) {
  vi.mocked(headers).mockResolvedValue({
    get: (key: string) => (key === 'x-forwarded-for' ? ip : null),
  } as unknown as Awaited<ReturnType<typeof headers>>);
}

function makeFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

const RATE_LIMIT_ERROR = 'しばらく時間をおいてから再度お試しください';

describe('registerAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.authAttempt.create).mockResolvedValue({} as never);
  });

  it('同一IPからの登録試行が上限に達している場合はレート制限エラーを返し、DBにアクセスしない', async () => {
    mockIp('1.2.3.4');
    vi.mocked(prisma.authAttempt.count).mockResolvedValueOnce(6).mockResolvedValueOnce(0);

    const result = await registerAction(
      { success: false },
      makeFormData({ email: 'new@example.com', name: '', password: 'password123' }),
    );

    expect(result).toEqual({ error: RATE_LIMIT_ERROR });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('上限未満なら通常通り登録でき、セッションが作成される', async () => {
    mockIp('1.2.3.4');
    vi.mocked(prisma.authAttempt.count).mockResolvedValue(1);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 1 } as never);

    const result = await registerAction(
      { success: false },
      makeFormData({ email: 'new@example.com', name: '', password: 'password123' }),
    );

    expect(result).toEqual({ success: true });
    expect(createUserSession).toHaveBeenCalledWith(1);
  });

  it('バリデーションエラーの場合は試行を記録せず、レート制限判定より前にエラーを返す', async () => {
    mockIp('1.2.3.4');

    const result = await registerAction(
      { success: false },
      makeFormData({ email: 'not-an-email', name: '', password: 'short' }),
    );

    expect(result.success).toBeFalsy();
    expect(prisma.authAttempt.create).not.toHaveBeenCalled();
  });
});

describe('loginAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.authAttempt.create).mockResolvedValue({} as never);
  });

  it('同一メールアドレスへのログイン試行が上限に達している場合はレート制限エラーを返し、DBにアクセスしない', async () => {
    mockIp('1.2.3.4');
    vi.mocked(prisma.authAttempt.count).mockResolvedValueOnce(0).mockResolvedValueOnce(6);

    const result = await loginAction(
      { success: false },
      makeFormData({ email: 'victim@example.com', password: 'wrong-password' }),
    );

    expect(result).toEqual({ error: RATE_LIMIT_ERROR });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('同一IPからのログイン試行が上限に達している場合はレート制限エラーを返す', async () => {
    mockIp('9.9.9.9');
    vi.mocked(prisma.authAttempt.count).mockResolvedValueOnce(21).mockResolvedValueOnce(0);

    const result = await loginAction(
      { success: false },
      makeFormData({ email: 'someone@example.com', password: 'wrong-password' }),
    );

    expect(result).toEqual({ error: RATE_LIMIT_ERROR });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('上限未満ならメールアドレスまたはパスワードが違う旨のエラーを通常通り返す', async () => {
    mockIp('1.2.3.4');
    vi.mocked(prisma.authAttempt.count).mockResolvedValue(1);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await loginAction(
      { success: false },
      makeFormData({ email: 'someone@example.com', password: 'wrong-password' }),
    );

    expect(result).toEqual({ error: 'メールアドレスまたはパスワードが違います' });
  });
});
