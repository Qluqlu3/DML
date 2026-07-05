'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';

const ADMIN_SESSION_COOKIE = 'admin_session';
const SESSION_VALUE = 'authenticated';
const GENERIC_ERROR = 'IDまたはパスワードが違います';

// ユーザーが存在しない場合もこのダミーハッシュで検証し、
// 応答時間の差からIDの存在有無が推測されないようにする
const DUMMY_HASH = hashPassword('dummy-password-for-constant-time-check');

export async function loginAction(formData: FormData) {
  const username = ((formData.get('username') as string) || '').trim();
  const password = (formData.get('password') as string) || '';

  const user = username ? await prisma.adminUser.findUnique({ where: { username } }) : null;
  const passwordHash = user?.passwordHash ?? DUMMY_HASH;
  const isValid = verifyPassword(password, passwordHash) && user !== null;

  if (!isValid) {
    return { error: GENERIC_ERROR };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8時間
  });

  redirect('/admin/reviews');
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect('/admin/login');
}
