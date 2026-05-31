'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const ADMIN_SESSION_COOKIE = 'admin_session';
const SESSION_VALUE = 'authenticated';

export async function loginAction(formData: FormData) {
  const password = formData.get('password') as string;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return { error: '管理者パスワードが設定されていません' };
  }

  if (password !== adminPassword) {
    return { error: 'パスワードが違います' };
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
