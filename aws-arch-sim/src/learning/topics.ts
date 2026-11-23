import { GUIDES } from '../content/guides';
import { CATEGORIES, CONTAINERS, isContainerKind, kindLabel, SERVICES } from '../engine/catalog';
import { ALL_LESSONS } from './lessons';
import type { GuideTopic, Lesson } from './types';

export function topicTitle(topic: GuideTopic): string {
  return GUIDES[topic]?.title ?? (topic === 'sg' ? 'セキュリティグループ' : kindLabel(topic));
}

/** 解説がまだないトピック向けの一言説明 */
export function topicDescription(topic: GuideTopic): string {
  if (topic === 'sg') return 'サーバーごとに付ける、通信の許可リスト。';
  return isContainerKind(topic) ? CONTAINERS[topic].description : SERVICES[topic].description;
}

export function topicColor(topic: GuideTopic): string {
  if (topic === 'sg') return CATEGORIES.security.color;
  if (topic === 'vpc' || topic === 'az' || topic === 'subnet') return CATEGORIES.network.color;
  return CATEGORIES[SERVICES[topic].category].color;
}

/** そのトピックを紹介するレッスン */
export function lessonsFor(topic: GuideTopic): Lesson[] {
  return ALL_LESSONS.filter((l) => l.steps.some((s) => s.introduces?.includes(topic)));
}

/** 図鑑に並べる順（枠 → サービス（カテゴリ順）→ 概念） */
export const ALL_TOPICS: GuideTopic[] = [
  'vpc',
  'az',
  'subnet',
  ...(Object.keys(SERVICES) as GuideTopic[]),
  'sg',
];
