'use server';

import { redirect } from 'next/navigation';
import { createAdminSession, destroyAdminSession } from '@/lib/adminSession';
import { hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';

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

  if (!isValid || !user) {
    return { error: GENERIC_ERROR };
  }

  await createAdminSession(user.id);

  redirect('/admin/reviews');
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect('/admin/login');
}
