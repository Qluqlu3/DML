import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/siteUrl';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const companies = await prisma.company.findMany({
    select: { id: true, updatedAt: true },
    orderBy: { id: 'asc' },
  });

  return [
    {
      url: SITE_URL,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/companies`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...companies.map((company) => ({
      url: `${SITE_URL}/companies/${company.id}`,
      lastModified: company.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
