import { describe, expect, it } from 'vitest';
import { resolvePage } from './pagination';

describe('resolvePage', () => {
  it('総ページ数を切り上げで計算する', () => {
    expect(resolvePage('1', 41, 20)).toEqual({ page: 1, totalPages: 3 });
  });

  it('0件でも1ページとして扱う', () => {
    expect(resolvePage(undefined, 0, 20)).toEqual({ page: 1, totalPages: 1 });
  });

  it('不正値・範囲外の値は1〜総ページ数に丸める', () => {
    expect(resolvePage('abc', 100, 20).page).toBe(1);
    expect(resolvePage('-3', 100, 20).page).toBe(1);
    expect(resolvePage('99', 100, 20).page).toBe(5);
  });
});
