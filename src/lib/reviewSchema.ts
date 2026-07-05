import { z } from 'zod';
import { StructureType } from '@/generated/prisma/enums';
import { RATING_ITEMS } from '@/lib/reviewRating';

function ratingField(label: string) {
  return z
    .unknown()
    .transform((val) => Number(val))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 5, {
      message: `「${label}」の評価（★）を選択してください`,
    });
}

const ratingShape = Object.fromEntries(
  RATING_ITEMS.map((item) => [item.name, ratingField(item.label)]),
) as { [K in (typeof RATING_ITEMS)[number]['name']]: ReturnType<typeof ratingField> };

export const reviewSchema = z.object({
  ...ratingShape,
  structureType: z.enum(StructureType, { message: '解体した建物の構造を選択してください' }),
  authorName: z
    .unknown()
    .transform((val) => (typeof val === 'string' ? val.trim() : ''))
    .pipe(z.string().max(50, { message: '表示名は50文字以内で入力してください' })),
  workYear: z
    .unknown()
    .transform((val) => {
      const str = typeof val === 'string' ? val.trim() : '';
      return str === '' ? null : Number(str);
    })
    .refine((v) => v === null || Number.isInteger(v), { message: '施工年が正しくありません' }),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
