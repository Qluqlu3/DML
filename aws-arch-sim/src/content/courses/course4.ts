import type { ArchDocument } from '../../engine/document';
import { configIs, connected, exists, noDirect, reachable } from '../../engine/rules/predicates';
import type { Course } from '../../learning/types';
import { CW, named, SNS, SQS, userOnly } from './shared';

const RECEIVE = named('lambda', '受付');
const PROCESS = named('lambda', '注文処理');
const ORDER_Q = named('sqs', '注文');
const MAIL_Q = named('sqs', 'メール');
const MAIL_SENDER = named('lambda', 'メール送信');
const OPS = named('sns', '運用');

/** ユーザー → API Gateway → 受付 Lambda */
function orderApi(): ArchDocument {
  const base = userOnly();
  return {
    ...base,
    nodes: [
      ...base.nodes,
      {
        id: 'apigw-base',
        kind: 'apigw',
        name: '注文 API',
        config: { apiType: 'http', throttleRps: 1000, authorizer: 'none' },
        position: { x: 0, y: 220 },
      },
      {
        id: 'lambda-base',
        kind: 'lambda',
        name: '注文受付',
        config: { memory: '512', reservedConcurrency: 0, subnetIds: [], securityGroupIds: [] },
        position: { x: 0, y: 440 },
      },
    ],
    edges: [
      {
        id: 'edge-base-1',
        source: 'client-base',
        target: 'apigw-base',
        sourceHandle: 'b',
        targetHandle: 't',
        port: 443,
      },
      {
        id: 'edge-base-2',
        source: 'apigw-base',
        target: 'lambda-base',
        sourceHandle: 'b',
        targetHandle: 't',
        port: 443,
      },
    ],
  };
}

export const course4: Course = {
  id: 'async',
  title: '疎結合・非同期',
  description:
    '処理を「受け付ける側」と「こなす側」に分け、キューや通知でつなぐ疎結合な構成を学びます。急なアクセス増や一部の故障に強いシステムの作り方です。',
  lessons: [
    // ------------------------------------------------------------------
    {
      id: 'async-1-sqs',
      title: 'SQS で処理を後回しにする',
      level: 2,
      summary:
        '注文の受付と、時間のかかる注文処理の間に SQS を挟みます。受付はすぐに返事をし、処理は自分のペースで進められるようになります。',
      goals: [
        'キューで処理を分ける（疎結合にする）利点が分かる',
        '可視性タイムアウトの意味が分かる',
      ],
      start: { from: 'document', doc: orderApi() },
      steps: [
        {
          id: 'queue',
          title: '受付 Lambda から SQS へ注文を送ろう',
          instruction:
            '名前が **注文キュー** の SQS を置き、**注文受付 → 注文キュー** とつないでください。',
          introduces: ['sqs'],
          highlight: { palette: ['sqs'] },
          checkpoints: [
            {
              id: 'connect',
              label: '受付から注文キューへの接続がある',
              rule: connected(RECEIVE, ORDER_Q),
            },
          ],
          hints: ['SQS は「アプリケーション統合」グループにあります'],
          answer: [
            { op: 'add', kind: 'sqs', name: '注文キュー' },
            { op: 'connect', from: RECEIVE, to: ORDER_Q },
          ],
          why: '受付の Lambda は注文をキューに入れたらすぐ「受け付けました」と返せます。時間のかかる在庫確認や決済を待たせずに済み、ユーザーの待ち時間が短くなります。',
        },
        {
          id: 'worker',
          title: 'キューから注文を取り出して処理しよう',
          instruction:
            '名前が **注文処理** の Lambda を置き、**注文キュー → 注文処理** とつないでください（矢印はメッセージの流れです）。',
          highlight: { palette: ['lambda'] },
          checkpoints: [
            {
              id: 'connect',
              label: '注文キューから注文処理への接続がある',
              rule: connected(ORDER_Q, PROCESS),
            },
          ],
          hints: ['Lambda は SQS のメッセージを自動で取り出して処理できます'],
          answer: [
            { op: 'add', kind: 'lambda', name: '注文処理' },
            { op: 'connect', from: ORDER_Q, to: PROCESS },
          ],
          why: 'セールで注文が殺到しても、キューにたまるだけで受付は止まりません。処理側は自分のペースで取り出していけます。処理側が一時的に壊れても、メッセージはキューに残るので失われません。',
          badExample:
            '受付から処理を直接呼ぶと、処理側が遅い・止まっているときに受付まで待たされ、注文そのものを受けられなくなります。',
        },
        {
          id: 'visibility',
          title: '可視性タイムアウトを処理時間より長くしよう',
          instruction:
            '注文の処理には最大 40 秒ほどかかります。**注文キュー** の **可視性タイムアウト** を **60 秒** にしてください。',
          checkpoints: [
            {
              id: 'timeout',
              label: '可視性タイムアウトが 60 秒以上',
              rule: configIs(SQS, 'visibilityTimeout', '>=', 60),
            },
          ],
          hints: [
            '可視性タイムアウト = 取り出したメッセージを、ほかの処理役から見えなくしておく時間',
          ],
          answer: [{ op: 'config', target: SQS, set: { visibilityTimeout: 60 } }],
          why: '取り出されたメッセージは、可視性タイムアウトの間だけほかから見えなくなります。処理が終わる前にこの時間が過ぎると、別の処理役が同じ注文をもう一度処理してしまいます。処理時間より長めに設定します。',
          badExample:
            '30 秒のままだと、40 秒かかる注文は処理中に再び見えるようになり、二重に処理（二重決済など）される危険があります。',
        },
      ],
      quiz: [
        {
          question: '受付と処理の間に SQS を挟む利点は？',
          choices: [
            {
              text: 'アクセスが急増しても受付が止まらず、処理側の故障中もメッセージが失われない',
              correct: true,
              explanation: 'キューが「バッファ」になり、両者を独立させます（疎結合）。',
            },
            {
              text: '処理が必ず速くなる',
              correct: false,
              explanation:
                '処理そのものの速さは変わりません。変わるのは、待たされない・止まらないことです。',
            },
          ],
        },
        {
          question: '可視性タイムアウトが処理時間より短いと何が起きる？',
          choices: [
            {
              text: '同じメッセージが二重に処理されることがある',
              correct: true,
              explanation: '処理が終わる前にメッセージが再び見えるようになるためです。',
            },
            {
              text: 'メッセージが消える',
              correct: false,
              explanation: '消えるのではなく、もう一度取り出されます。',
            },
          ],
        },
      ],
      wrapUp:
        'キューで受付と処理を分けられました。次は、1 つの注文を「処理」と「メール送信」など複数の処理に配る方法を学びます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'async-2-fanout',
      title: 'SNS で 1 つの通知を複数に配る',
      level: 3,
      summary:
        '注文イベントを SNS に送り、注文処理用とメール送信用の 2 つのキューに同時に配ります（ファンアウト）。',
      goals: [
        'SNS と SQS を組み合わせたファンアウトが分かる',
        '処理を追加しても受付側を変えずに済む理由が分かる',
      ],
      start: { from: 'lesson', lessonId: 'async-1-sqs' },
      steps: [
        {
          id: 'sns',
          title: '受付から SNS を通して注文キューへ届けよう',
          instruction:
            '名前が **注文イベント** の SNS を置き、**注文受付 → SNS → 注文キュー** となるようにつなぎ替えてください。受付から注文キューへの直接の線は削除します。',
          introduces: ['sns'],
          checkpoints: [
            {
              id: 'path',
              label: '受付から SNS を通って注文キューに届く',
              rule: reachable(RECEIVE, ORDER_Q, { via: SNS }),
            },
            {
              id: 'direct',
              label: '受付から注文キューへ直接の線がない',
              rule: noDirect(RECEIVE, ORDER_Q),
            },
          ],
          hints: ['受付は「注文が来た」ことを SNS に知らせるだけにします'],
          answer: [
            { op: 'add', kind: 'sns', name: '注文イベント' },
            { op: 'connect', from: RECEIVE, to: SNS },
            { op: 'connect', from: SNS, to: ORDER_Q },
            { op: 'disconnect', from: RECEIVE, to: ORDER_Q },
          ],
          why: '受付は SNS に「注文が来た」と知らせるだけで、誰がその知らせを使うかは知りません。こうしておくと、あとから処理を追加しても受付のコードを変えずに済みます。',
        },
        {
          id: 'mail',
          title: 'メール送信用のキューと Lambda を追加しよう',
          instruction:
            '名前が **メール通知キュー** の SQS と、**メール送信** の Lambda を置き、**SNS → メール通知キュー → メール送信** とつないでください。',
          checkpoints: [
            { id: 'two', label: 'SQS が 2 つある', rule: exists(SQS, 2) },
            {
              id: 'fanout',
              label: 'SNS からすべてのキューへ接続がある',
              rule: connected(SNS, SQS, { every: 'to' }),
            },
            {
              id: 'mail',
              label: 'SNS からメール通知キューを通ってメール送信に届く',
              rule: reachable(SNS, MAIL_SENDER, { via: MAIL_Q }),
            },
          ],
          hints: ['SNS の購読先を増やすだけで、同じ通知が両方に届きます'],
          answer: [
            { op: 'add', kind: 'sqs', name: 'メール通知キュー' },
            { op: 'add', kind: 'lambda', name: 'メール送信' },
            { op: 'connect', from: SNS, to: MAIL_Q },
            { op: 'connect', from: MAIL_Q, to: MAIL_SENDER },
          ],
          why: 'SNS から複数のキューに配る形を「ファンアウト」と呼びます。メール送信が遅れたり失敗したりしても、注文処理には影響しません。キューを挟んでいるので、それぞれが自分のペースで処理できます。',
          badExample:
            'SNS から Lambda を直接呼ぶと、Lambda 側で失敗したときに再試行の回数が限られ、通知が失われることがあります。キューを挟むと確実に処理できます。',
        },
      ],
      quiz: [
        {
          question: 'SNS → 複数の SQS という「ファンアウト」の利点は？',
          choices: [
            {
              text: '1 つのイベントを複数の処理に配れて、処理を追加しても送り手を変えずに済む',
              correct: true,
              explanation: '送り手と受け手が互いを知らずに済む、疎結合の代表的な形です。',
            },
            {
              text: 'メッセージの順番が必ず保証される',
              correct: false,
              explanation: '順番の保証には FIFO を使う必要があります。',
            },
          ],
        },
        {
          question: 'SQS と SNS の違いとして正しいものは？',
          choices: [
            {
              text: 'SQS は取りに来るまでためておく、SNS は購読者全員にすぐ配る',
              correct: true,
              explanation: 'SQS はキュー（待ち行列）、SNS は通知の一斉配信（Pub/Sub）です。',
            },
            {
              text: 'どちらも同じで、名前が違うだけ',
              correct: false,
              explanation: '役割が違うので、組み合わせて使うことがよくあります。',
            },
          ],
        },
      ],
      wrapUp:
        '1 つの注文を複数の処理に配れるようになりました。最後に、どうしても処理できないメッセージの扱い方を学びます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'async-3-dlq',
      title: '失敗したメッセージを DLQ へ',
      level: 3,
      summary:
        '何度処理しても失敗するメッセージをデッドレターキュー（DLQ）に移し、キューが詰まるのを防ぎます。たまったら CloudWatch で運用担当に知らせます。',
      goals: ['DLQ の役割が分かる', 'キューの滞留を監視できる'],
      start: { from: 'lesson', lessonId: 'async-2-fanout' },
      steps: [
        {
          id: 'dlq',
          title: 'すべてのキューに DLQ を設定しよう',
          instruction:
            '**注文キュー** と **メール通知キュー** の両方で、**デッドレターキュー** を有効にしてください。',
          checkpoints: [
            {
              id: 'dlq',
              label: 'すべての SQS で DLQ が有効',
              rule: configIs(SQS, 'dlq', '==', true),
            },
          ],
          hints: ['DLQ は「何回まで再試行したら移すか」を決めて使います'],
          answer: [{ op: 'config', target: SQS, set: { dlq: true } }],
          why: 'データの不備などで何度処理しても失敗するメッセージは、そのままだと延々と再試行され、ほかのメッセージの処理を遅らせます。決まった回数失敗したら DLQ に移しておけば、キューは流れ続け、失敗したものは後で調べられます。',
          badExample:
            'DLQ がないと、壊れたメッセージ 1 件が何度も処理され続け、料金も無駄にかかります。',
        },
        {
          id: 'alarm',
          title: 'キューの滞留を監視して運用担当に知らせよう',
          instruction:
            'CloudWatch を置いてアラームを **キューが滞留している** にし、名前が **運用通知** の SNS を置いて **CloudWatch → 運用通知** とつないでください。',
          checkpoints: [
            {
              id: 'alarm',
              label: 'アラームがキューの滞留',
              rule: configIs(CW, 'alarm', '==', 'queue'),
            },
            {
              id: 'notify',
              label: 'CloudWatch から運用通知への接続がある',
              rule: connected(CW, OPS),
            },
          ],
          hints: ['注文イベント用の SNS とは別に、運用担当への通知用の SNS を用意します'],
          answer: [
            { op: 'add', kind: 'cloudwatch', name: '滞留アラーム', config: { alarm: 'queue' } },
            { op: 'add', kind: 'sns', name: '運用通知' },
            { op: 'connect', from: CW, to: OPS },
          ],
          why: 'キューにメッセージがたまり続けるのは、処理側が追いついていないか、止まっているサインです。早めに気づければ、処理役を増やすなどの対応ができます。',
        },
      ],
      quiz: [
        {
          question: 'DLQ（デッドレターキュー）の役割は？',
          choices: [
            {
              text: '何度処理しても失敗するメッセージを移しておき、キューの詰まりを防ぐ',
              correct: true,
              explanation: '移したメッセージは後から原因を調べたり、再処理したりできます。',
            },
            {
              text: '古いメッセージを自動で削除する',
              correct: false,
              explanation: '削除ではなく、別のキューに退避します。',
            },
          ],
        },
        {
          question: 'キューのメッセージ数が増え続けているときに考えられることは？',
          choices: [
            {
              text: '処理側が追いついていない、または止まっている',
              correct: true,
              explanation: '処理役を増やす・エラーを調べるなどの対応が必要です。',
            },
            {
              text: 'システムが順調に動いている',
              correct: false,
              explanation: '増え続けるのは異常のサインです。',
            },
          ],
        },
      ],
      wrapUp:
        'コース 4 は完了です。SQS・SNS・DLQ で、急な負荷や一部の故障に強い疎結合な仕組みを作れるようになりました。次のコースでは、コンテナでアプリを動かします。',
    },
  ],
};
