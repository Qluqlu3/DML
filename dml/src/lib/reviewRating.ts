export const RATING_ITEMS = [
  { key: 'priceRating', name: 'priceRating', label: '価格' },
  { key: 'serviceRating', name: 'serviceRating', label: '対応' },
  { key: 'qualityRating', name: 'qualityRating', label: '仕上がり' },
] as const;

export type RatingValues = {
  priceRating: number;
  serviceRating: number;
  qualityRating: number;
};

const MAX_RATING = 5;

export function overallRating({ priceRating, serviceRating, qualityRating }: RatingValues) {
  return (priceRating + serviceRating + qualityRating) / 3;
}

// 口コミが無い場合は null
export function averageOverallRating(reviews: RatingValues[]): number | null {
  if (reviews.length === 0) return null;
  return reviews.reduce((sum, r) => sum + overallRating(r), 0) / reviews.length;
}

// 評価値を四捨五入して「★★★☆☆」形式にする
export function starString(rating: number): string {
  const filled = Math.min(MAX_RATING, Math.max(0, Math.round(rating)));
  return '★'.repeat(filled) + '☆'.repeat(MAX_RATING - filled);
}
