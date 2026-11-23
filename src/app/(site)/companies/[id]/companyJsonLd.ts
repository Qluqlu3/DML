import type { CompanyModel } from '@/generated/prisma/models/Company';
import { SITE_URL } from '@/lib/siteUrl';

type ReviewForJsonLd = { authorName: string | null; createdAt: Date; overall: number };

const RATING_RANGE = { bestRating: 5, worstRating: 1 } as const;

function roundRating(value: number) {
  return Number(value.toFixed(1));
}

// 検索結果でのリッチスニペット表示のためのJSON-LD構造化データ
// https://schema.org/LocalBusiness / https://schema.org/AggregateRating
export function buildCompanyJsonLd(
  company: CompanyModel,
  reviews: ReviewForJsonLd[],
  avgRating: number | null,
) {
  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'GeneralContractor'],
    name: company.name,
    url: `${SITE_URL}/companies/${company.id}`,
    telephone: company.phoneNumber ?? undefined,
    sameAs: company.websiteUrl ?? undefined,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'JP',
      addressRegion: company.prefectureName ?? undefined,
      postalCode: company.postCode ?? undefined,
      streetAddress: company.addressFull ?? undefined,
    },
    aggregateRating:
      avgRating !== null
        ? {
            '@type': 'AggregateRating',
            ratingValue: roundRating(avgRating),
            reviewCount: reviews.length,
            ...RATING_RANGE,
          }
        : undefined,
    review:
      reviews.length > 0
        ? reviews.map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.authorName ?? '匿名' },
            datePublished: r.createdAt.toISOString(),
            reviewRating: {
              '@type': 'Rating',
              ratingValue: roundRating(r.overall),
              ...RATING_RANGE,
            },
          }))
        : undefined,
  };
}

// <script> 内に埋め込むため `<` をエスケープして </script> による脱出を防ぐ
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
