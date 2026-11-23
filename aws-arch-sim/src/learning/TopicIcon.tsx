import { ServiceIcon } from '../canvas/ServiceIcon';
import { iconUrl, isServiceKind } from '../engine/catalog';
import type { GuideTopic } from './types';

const IMAGE: Partial<Record<GuideTopic, string>> = {
  vpc: 'group-vpc',
  subnet: 'group-public-subnet',
  sg: 'topic-sg',
};

/** 解説トピックのアイコン（サービスは公式アイコン、枠・概念はグループアイコン等） */
export function TopicIcon({ topic, size = 32 }: { topic: GuideTopic; size?: number }) {
  if (isServiceKind(topic)) return <ServiceIcon kind={topic} size={size} />;
  const image = IMAGE[topic];
  if (image) {
    return (
      <img src={iconUrl(image)} alt='' width={size} height={size} style={{ borderRadius: 4 }} />
    );
  }
  // AZ は図でも点線の枠なので、同じ見た目で表す
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px dashed #0972d3',
        borderRadius: 6,
      }}
    />
  );
}
