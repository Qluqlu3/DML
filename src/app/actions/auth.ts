'use server';

import { loginSchema, registerSchema } from '@/lib/authSchema';
import { hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { createUserSession, destroyUserSession } from '@/lib/userSession';

export type AuthState = {
  error?: string;
  success?: boolean;
};

// ユーザーが存在しない場合もこのダミーハッシュで検証し、
// 応答時間の差からメールアドレスの存在有無が推測されないようにする
const DUMMY_HASH = hashPassword('dummy-password-for-constant-time-check');

export async function registerAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, name, password } = parsed.data;

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
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  const { email, password } = parsed.success ? parsed.data : { email: '', password: '' };

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
