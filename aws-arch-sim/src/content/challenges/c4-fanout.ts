import type { Challenge } from '../../challenges/types';
import {
  configIs,
  connected,
  exists,
  noDirect,
  reachable,
  withMessage,
} from '../../engine/rules/predicates';
import type { Selector } from '../../engine/rules/selector';
import { APIGW, named, SNS, SQS, USER, userOnly } from '../courses/shared';

const WORKER: Selector = { kind: ['lambda', 'ecs', 'asg', 'ec2'] };
const ORDER = named('lambda', '受付');
const STOCK_Q = named('sqs', '在庫');
const MAIL_Q = named('sqs', 'メール');
const STOCK = named('lambda', '在庫');
const MAIL = named('lambda', 'メール');

export const c4: Challenge = {
  id: 'c4-fanout',
  title: '非同期処理の疎結合化',
  difficulty: 2,
  summary: '注文を受けたら在庫更新とメール送信を並行して行い、どちらかが止まっても注文は失わない。',
  brief: `ネットショップの注文処理を作り直します。今は注文 API の中で「在庫の更新」と「確認メールの送信」を順番に呼んでいるため、メール送信サービスが遅れると注文そのものが失敗していました。

**要件**

- 注文は API で受け付け、受付処理はすぐに応答を返す
- 1 件の注文を、**在庫更新**と**メール送信**の 2 つの処理にそれぞれ届ける
- 処理側が止まったり遅れたりしても、注文のメッセージが失われずに溜まっておくようにする
- 処理側は、溜まったメッセージを自分のペースで取り出して処理する

**できれば**

- 何度処理しても失敗するメッセージを、別の場所に退避させる
- 通知の配信元から処理側を直接呼ばず、必ずメッセージを溜める場所を挟む`,
  initial: userOnly(),
  rules: [
    {
      id: 'api',
      label: 'ユーザーから API Gateway を通って SNS に届く',
      severity: 'required',
      rule: reachable(USER, SNS, { via: APIGW }),
    },
    {
      id: 'queues',
      label: 'SQS キューが 2 つ以上ある',
      severity: 'required',
      rule: exists(SQS, 2),
    },
    {
      id: 'fanout',
      label: 'SNS からすべての SQS キューに届く（ファンアウト）',
      severity: 'required',
      rule: connected(SNS, SQS, { every: 'to' }),
    },
    {
      id: 'workers',
      label: 'すべての SQS キューに、取り出して処理する側がつながっている',
      severity: 'required',
      rule: withMessage(
        connected(SQS, WORKER, { every: 'from' }),
        '処理する側（Lambda など）がつながっていないキューがあります',
      ),
    },
    {
      id: 'dlq',
      label: 'すべての SQS キューでデッドレターキューが有効',
      severity: 'recommended',
      rule: configIs(SQS, 'dlq', '==', true),
    },
    {
      id: 'no-direct',
      label: 'SNS から処理側を直接呼び出していない',
      severity: 'recommended',
      rule: noDirect(SNS, WORKER),
    },
  ],
  hints: [
    '「1 つのメッセージを複数の宛先へ」は SNS、「溜めておいて自分のペースで取り出す」は SQS の役割です',
    'SNS のトピックに、在庫用とメール用の 2 つの SQS キューをつなぎます（SNS → SQS ファンアウト）',
    'SQS の「デッドレターキュー」を有効にすると、失敗し続けるメッセージを退避できます',
  ],
  explanation: `**SNS → SQS のファンアウト**は、1 つのイベントを複数の処理に配る定番の形です。

- 受付の Lambda は SNS に注文イベントを 1 回送るだけで応答を返せます。後ろの処理が増えても、受付側のコードは変わりません
- SNS から Lambda を直接呼ぶこともできますが、処理側が止まっていると再試行が尽きた時点でメッセージが失われます。**SQS を挟む**と、メッセージは処理されるまでキューに残ります（最大 14 日）
- 処理側は SQS から自分のペースで取り出すので、注文が急増してもメール送信サービスに負荷が集中しません
- **デッドレターキュー（DLQ）** は、何度処理しても失敗するメッセージの退避先です。ないと、壊れたメッセージが再試行され続けてほかの処理を詰まらせます

**別解**: 処理側は Lambda の代わりに ECS や Auto Scaling の EC2 でも構いません。SNS の代わりに EventBridge で配る構成もあります。`,
  modelAnswer: [
    { op: 'add', kind: 'apigw', name: '注文 API' },
    { op: 'add', kind: 'lambda', name: '注文受付' },
    { op: 'add', kind: 'sns', name: '注文イベント' },
    { op: 'add', kind: 'sqs', name: '在庫キュー', config: { dlq: true } },
    { op: 'add', kind: 'sqs', name: 'メールキュー', config: { dlq: true } },
    { op: 'add', kind: 'lambda', name: '在庫更新' },
    { op: 'add', kind: 'lambda', name: 'メール送信' },
    { op: 'connect', from: USER, to: APIGW },
    { op: 'connect', from: APIGW, to: ORDER },
    { op: 'connect', from: ORDER, to: SNS },
    { op: 'connect', from: SNS, to: STOCK_Q },
    { op: 'connect', from: SNS, to: MAIL_Q },
    { op: 'connect', from: STOCK_Q, to: STOCK },
    { op: 'connect', from: MAIL_Q, to: MAIL },
  ],
  topics: ['sns', 'sqs', 'lambda', 'apigw'],
};
