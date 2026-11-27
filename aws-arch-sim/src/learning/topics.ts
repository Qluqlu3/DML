import { GUIDES } from '../content/guides';
import {
  CATEGORIES,
  CONTAINERS,
  isContainerKind,
  kindLabel,
  SERVICE_KINDS,
  SERVICES,
  type ServiceKind,
} from '../engine/catalog';
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

/** キャンバスのどこに置くか（概念の SG は null） */
export function placementText(topic: GuideTopic): string | null {
  if (topic === 'sg') return null;
  if (topic === 'vpc')
    return 'キャンバスに直接置く（VPC の外側がインターネット・AWS のサービス側）';
  if (topic === 'az') return 'VPC の中に置く';
  if (topic === 'subnet') return 'AZ の中に置く（1 つのサブネットは 1 つの AZ にだけ属する）';
  switch (SERVICES[topic].placement) {
    case 'global':
      return 'VPC の外に置く（AWS が管理する場所で動く）';
    case 'vpc':
      return 'VPC の中・サブネットの外に置き、使うサブネットを設定で選ぶ';
    case 'subnet':
      return 'サブネットの中に置く';
  }
}

/** そのサービスから線でつなげる先 / そのサービスへつながってくる元 */
export function connectionsOf(topic: GuideTopic): { to: ServiceKind[]; from: ServiceKind[] } {
  if (topic === 'sg' || isContainerKind(topic)) return { to: [], from: [] };
  return {
    to: SERVICES[topic].canConnectTo,
    from: SERVICE_KINDS.filter((k) => SERVICES[k].canConnectTo.includes(topic)),
  };
}
