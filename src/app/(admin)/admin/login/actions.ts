'use server';

import { redirect } from 'next/navigation';
import { createAdminSession, destroyAdminSession } from '@/lib/adminSession';
import { getFormString } from '@/lib/formData';
import { dummyPasswordHash, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';

const GENERIC_ERROR = 'IDまたはパスワードが違います';

export async function loginAction(formData: FormData) {
  const username = getFormString(formData, 'username').trim();
  const password = getFormString(formData, 'password');

  const user = username ? await prisma.adminUser.findUnique({ where: { username } }) : null;
  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash());
  const isValid = (await verifyPassword(password, passwordHash)) && user !== null;

  if (!isValid) {
    return { error: GENERIC_ERROR };
  }

  await createAdminSession(user.id);

  redirect('/admin/reviews');
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect('/admin/login');
}
