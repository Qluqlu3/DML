import { describe, expect, it } from 'vitest';
import { averageOverallRating, overallRating, starString } from './reviewRating';

describe('starString', () => {
  it('四捨五入した数だけ★を並べ、残りを☆で埋める', () => {
    expect(starString(3)).toBe('★★★☆☆');
    expect(starString(3.5)).toBe('★★★★☆');
    expect(starString(3.49)).toBe('★★★☆☆');
  });

  it('範囲外の値は0〜5に丸める', () => {
    expect(starString(0)).toBe('☆☆☆☆☆');
    expect(starString(-1)).toBe('☆☆☆☆☆');
    expect(starString(9)).toBe('★★★★★');
  });
});

describe('averageOverallRating', () => {
  it('口コミが無ければ null', () => {
    expect(averageOverallRating([])).toBeNull();
  });

  it('各口コミの総合評価の平均を返す', () => {
    const a = { priceRating: 5, serviceRating: 5, qualityRating: 5 };
    const b = { priceRating: 1, serviceRating: 2, qualityRating: 3 };
    expect(averageOverallRating([a, b])).toBe((overallRating(a) + overallRating(b)) / 2);
  });
});
