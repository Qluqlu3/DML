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

export function overallRating({ priceRating, serviceRating, qualityRating }: RatingValues) {
  return (priceRating + serviceRating + qualityRating) / 3;
}
