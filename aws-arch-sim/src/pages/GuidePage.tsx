import { Input } from '@chakra-ui/react';
import { useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { CHALLENGES } from '../content/challenges';
import { COMPARISON_BY_ID, COMPARISONS } from '../content/comparisons';
import { GUIDES } from '../content/guides';
import { INCIDENTS } from '../content/incidents';
import { CATEGORIES, CATEGORY_ORDER, SERVICE_KINDS, SERVICES } from '../engine/catalog';
import { ComparisonView } from '../learning/ComparisonView';
import { GlossaryView, matchTerms } from '../learning/GlossaryView';
import { GuideView } from '../learning/GuideView';
import { useProgressStore } from '../learning/progressStore';
import { TopicIcon } from '../learning/TopicIcon';
import { ALL_TOPICS, topicTitle } from '../learning/topics';
import type { GuideTopic } from '../learning/types';
import styles from './GuidePage.module.css';

/** ノードではない概念のうち、セキュリティに並べるもの */
const SECURITY_CONCEPTS: GuideTopic[] = ['sg'];

/** 一覧の並び（枠 → カテゴリ順のサービス。SG はセキュリティに入れる） */
type TopicGroup = { label: string; topics: GuideTopic[] };
const FRAME_GROUP: TopicGroup = { label: 'ネットワーク枠', topics: ['vpc', 'az', 'subnet'] };
const TOPIC_GROUPS: TopicGroup[] = [
  FRAME_GROUP,
  ...CATEGORY_ORDER.map(
    (category): TopicGroup => ({
      label: CATEGORIES[category].label,
      topics: [
        ...SERVICE_KINDS.filter((k) => SERVICES[k].category === category),
        ...(category === 'security' ? SECURITY_CONCEPTS : []),
      ],
    }),
  ),
].filter((g) => g.topics.length > 0);

function matchesTopic(topic: GuideTopic, q: string): boolean {
  if (!q) return true;
  const guide = GUIDES[topic];
  return [topicTitle(topic), guide?.tagline ?? '', topic].some((s) => s.toLowerCase().includes(q));
}

/** そのトピックが出てくる問題・インシデント（番号は一覧画面と同じ） */
function Appearances({ topic }: { topic: GuideTopic }) {
  const challenges = CHALLENGES.map((c, i) => ({ c, n: i + 1 })).filter(({ c }) =>
    c.topics.includes(topic),
  );
  const incidents = INCIDENTS.map((inc, i) => ({ inc, n: i + 1 })).filter(({ inc }) =>
    inc.topics.includes(topic),
  );
  if (!challenges.length && !incidents.length) return null;
  return (
    <section className={styles.appearances}>
      <h4 className={styles.appearancesTitle}>学んだことを試す</h4>
      <ul>
        {challenges.map(({ c, n }) => (
          <li key={c.id}>
            <span className={styles.kind}>問題 {n}</span>
            <Link to={`/challenges/${c.id}`}>{c.title}</Link>
          </li>
        ))}
        {incidents.map(({ inc, n }) => (
          <li key={inc.id}>
            <span className={`${styles.kind} ${styles.kindIncident}`}>インシデント {n}</span>
            <Link to={`/incidents/${inc.id}`}>{inc.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GuidePage() {
  const { topic, compareId } = useParams();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const learned = useProgressStore((s) => s.learned);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const isTerms = pathname === '/guide/terms';
  const comparison = compareId ? COMPARISON_BY_ID[compareId] : undefined;
  const selected = ALL_TOPICS.includes(topic as GuideTopic) ? (topic as GuideTopic) : null;

  const groups = TOPIC_GROUPS.map((g) => ({
    ...g,
    topics: g.topics.filter((t) => matchesTopic(t, q)),
  })).filter((g) => g.topics.length > 0);
  const comparisons = COMPARISONS.filter(
    (c) => !q || [c.title, c.summary].some((s) => s.toLowerCase().includes(q)),
  );
  const termCount = matchTerms(query).length;
  const nothing = !groups.length && !comparisons.length && !termCount;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.nav}>
          <Link to='/'>← トップ</Link>
          <Link to='/learn'>学習モード</Link>
        </div>
        <h1 className={styles.title}>サービス図鑑</h1>
        <p className={styles.lead}>
          {ALL_TOPICS.length}{' '}
          件のサービス・概念の解説に加えて、迷いやすいサービスを表で比べる「比べて覚える」と、用語集があります。学習モードで出てきたものには「学習済み」の印が付きます。
        </p>
      </header>
      <div className={styles.columns}>
        <nav className={styles.list} aria-label='図鑑の目次'>
          <Input
            size='sm'
            placeholder='サービス・用語を検索'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            mb='2'
            flexShrink='0'
          />
          {nothing && <p className={styles.noMatch}>当てはまるものがありません。</p>}

          {comparisons.length > 0 && (
            <div className={styles.group}>
              <h2 className={styles.groupTitle}>比べて覚える</h2>
              {comparisons.map((c) => (
                <Link
                  key={c.id}
                  to={`/guide/compare/${c.id}`}
                  className={`${styles.item} ${c.id === comparison?.id ? styles.active : ''}`}
                >
                  <span className={styles.vs} aria-hidden>
                    VS
                  </span>
                  <span className={styles.itemTitle}>{c.title}</span>
                </Link>
              ))}
            </div>
          )}

          {termCount > 0 && (
            <div className={styles.group}>
              <h2 className={styles.groupTitle}>用語</h2>
              <Link to='/guide/terms' className={`${styles.item} ${isTerms ? styles.active : ''}`}>
                <span className={styles.vs} aria-hidden>
                  Aa
                </span>
                <span className={styles.itemTitle}>用語集</span>
                <span className={styles.count}>{termCount} 語</span>
              </Link>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.label} className={styles.group}>
              <h2 className={styles.groupTitle}>{g.label}</h2>
              {g.topics.map((t) => (
                <Link
                  key={t}
                  to={`/guide/${t}`}
                  className={`${styles.item} ${t === selected ? styles.active : ''}`}
                >
                  <TopicIcon topic={t} size={24} />
                  <span className={styles.itemTitle}>{topicTitle(t)}</span>
                  {learned.includes(t) && <span className={styles.learned}>学習済み</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <section className={styles.detail}>
          {isTerms ? (
            <GlossaryView query={query} focusId={searchParams.get('term')} />
          ) : comparison ? (
            <ComparisonView comparison={comparison} />
          ) : selected ? (
            <>
              <GuideView topic={selected} variant='full' />
              <Appearances topic={selected} />
            </>
          ) : (
            <div className={styles.placeholder}>
              <p>左の一覧からサービスを選んでください。</p>
              <p>
                「ALB と NLB はどう違う？」のように迷ったときは
                <Link to={`/guide/compare/${'alb-nlb'}`}>比べて覚える</Link>
                、言葉の意味が分からないときは <Link to='/guide/terms'>用語集</Link>{' '}
                を見てください。
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
