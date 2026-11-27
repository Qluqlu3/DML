import { describe, expect, it } from 'vitest';
import { ALL_TOPICS } from '../learning/topics';
import { COMPARISONS } from './comparisons';
import { GLOSSARY, GLOSSARY_CATEGORIES } from './glossary';
import { GUIDES } from './guides';

describe('図鑑の内容', () => {
  it('すべてのトピックに解説がある', () => {
    expect(ALL_TOPICS.filter((t) => !GUIDES[t])).toEqual([]);
  });
});

describe('比べて覚える', () => {
  it('id が重複しない', () => {
    const ids = COMPARISONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(COMPARISONS)('$id: 各行のセル数が列の数と同じ', (c) => {
    for (const row of c.rows)
      expect([row.label, row.cells.length]).toEqual([row.label, c.columns.length]);
  });

  it.each(COMPARISONS)('$id: 比べる対象が図鑑のトピック', (c) => {
    expect(c.topics.length).toBeGreaterThan(0);
    for (const t of c.topics) expect(ALL_TOPICS).toContain(t);
  });
});

describe('用語集', () => {
  it('id が重複しない', () => {
    const ids = GLOSSARY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('関係するトピックとカテゴリが存在する', () => {
    const categories = GLOSSARY_CATEGORIES.map((c) => c.id);
    for (const term of GLOSSARY) {
      expect(categories).toContain(term.category);
      for (const t of term.topics ?? []) expect(ALL_TOPICS).toContain(t);
    }
  });
});
