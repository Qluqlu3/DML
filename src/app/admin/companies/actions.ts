'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export type UpdateWebsiteState = {
  success: boolean;
  error?: string;
};

export async function updateCompanyWebsite(
  companyId: number,
  _prevState: UpdateWebsiteState,
  formData: FormData,
): Promise<UpdateWebsiteState> {
  const raw = ((formData.get('websiteUrl') as string) || '').trim();

  let websiteUrl: string | null = null;
  if (raw) {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      websiteUrl = new URL(withScheme).toString();
    } catch {
      return { success: false, error: '有効なURLを入力してください' };
    }
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { websiteUrl },
  });

  revalidatePath('/admin/companies');
  revalidatePath(`/companies/${companyId}`);
  return { success: true };
}
