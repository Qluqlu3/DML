'use server';

import { hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { createUserSession, destroyUserSession } from '@/lib/userSession';

export type AuthState = {
  error?: string;
  success?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// ユーザーが存在しない場合もこのダミーハッシュで検証し、
// 応答時間の差からメールアドレスの存在有無が推測されないようにする
const DUMMY_HASH = hashPassword('dummy-password-for-constant-time-check');

export async function registerAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const name = ((formData.get('name') as string) || '').trim();
  const password = (formData.get('password') as string) || '';

  if (!EMAIL_RE.test(email)) {
    return { error: 'メールアドレスの形式が正しくありません' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'このメールアドレスは既に登録されています' };
  }

  const user = await prisma.user.create({
    data: { email, name: name || null, passwordHash: hashPassword(password) },
  });

  await createUserSession(user.id);
  return { success: true };
}

export async function loginAction(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const password = (formData.get('password') as string) || '';

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const passwordHash = user?.passwordHash ?? DUMMY_HASH;
  const isValid = verifyPassword(password, passwordHash) && user !== null;

  if (!isValid) {
    return { error: 'メールアドレスまたはパスワードが違います' };
  }

  await createUserSession(user.id);
  return { success: true };
}

export async function logoutAction() {
  await destroyUserSession();
}
