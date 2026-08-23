'use server';

import { redirect } from 'next/navigation';
import { createAdminSession, destroyAdminSession } from '@/lib/adminSession';
import { dummyPasswordHash, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';

const GENERIC_ERROR = 'IDまたはパスワードが違います';

export async function loginAction(formData: FormData) {
  const username = ((formData.get('username') as string) || '').trim();
  const password = (formData.get('password') as string) || '';

  const user = username ? await prisma.adminUser.findUnique({ where: { username } }) : null;
  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash());
  const isValid = (await verifyPassword(password, passwordHash)) && user !== null;

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
