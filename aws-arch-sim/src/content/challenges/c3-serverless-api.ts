import type { Challenge } from '../../challenges/types';
import { configIs, connected, none, reachable } from '../../engine/rules/predicates';
import { APIGW, COGNITO, DDB, LAMBDA, USER, userOnly } from '../courses/shared';

export const c3: Challenge = {
  id: 'c3-serverless-api',
  title: 'サーバーレス API',
  difficulty: 1,
  summary: '利用者がどれだけ増えるか読めないアプリのバックエンドを、サーバーなしで作る。',
  brief: `スマートフォン向けの「家計簿アプリ」のバックエンド API を作ります。リリース直後は利用者が少なく、伸びるかどうかはまだ分かりません。開発者は 2 人だけなので、**サーバーの管理（OS の更新や台数の調整）はしたくありません**。

この問題では、使えるサービスをサーバーレス向けのものに絞っています。

**要件**

- アプリは HTTPS の API を呼ぶ
- API の処理はサーバーを持たずに動かす
- 家計簿のデータ（ユーザー ID と日付で引く）を保存する

**できれば**

- ログインしたユーザーだけが API を呼べるようにする
- 使った分だけ課金され、アクセスが読めなくても設定を変えずに済むデータベースにする`,
  initial: userOnly(),
  palette: [
    'apigw',
    'lambda',
    'dynamodb',
    'cognito',
    's3',
    'sqs',
    'sns',
    'eventbridge',
    'cloudwatch',
    'route53',
    'cloudfront',
    'waf',
    'acm',
    'secrets',
  ],
  rules: [
    {
      id: 'reach',
      label: 'ユーザーから API Gateway を通ってデータベースまで届く',
      severity: 'required',
      rule: reachable(USER, DDB, { via: APIGW }),
    },
    {
      id: 'lambda',
      label: 'API Gateway から Lambda を呼び出している',
      severity: 'required',
      rule: connected(APIGW, LAMBDA),
    },
    {
      id: 'ddb',
      label: 'Lambda から DynamoDB への接続がある',
      severity: 'required',
      rule: connected(LAMBDA, DDB),
    },
    {
      id: 'no-server',
      label: 'サーバー（VPC・EC2 など）を使っていない',
      severity: 'required',
      rule: none({ kind: ['vpc', 'ec2', 'asg', 'ecs', 'rds', 'aurora'] }),
    },
    {
      id: 'auth',
      label: 'API Gateway の認可に Cognito を使っている',
      severity: 'recommended',
      rule: configIs(APIGW, 'authorizer', '==', 'cognito'),
    },
    {
      id: 'signin',
      label: 'ユーザーが Cognito でサインインできる',
      severity: 'recommended',
      rule: connected(USER, COGNITO),
    },
    {
      id: 'on-demand',
      label: 'DynamoDB がオンデマンドモード',
      severity: 'recommended',
      rule: configIs(DDB, 'capacityMode', '==', 'on-demand'),
    },
  ],
  budgetUsd: 30,
  hints: [
    'API の入口は API Gateway、処理は Lambda に任せます',
    'キーで引くデータはサーバーレスな NoSQL の DynamoDB が向いています',
    'API Gateway の「認可」を Cognito にすると、ログインしていないリクエストを API の手前で断れます',
  ],
  explanation: `**API Gateway → Lambda → DynamoDB** はサーバーレス API の基本形です。どれもリクエストが来たときだけ動き、使った分だけ課金されるので、利用者が少ないうちはほぼ無料で、増えても自動で追従します。

- DynamoDB の **オンデマンドモード** は、読み書きの量を事前に決めずに使えます。アクセスが読めないうちに向いており、安定してから「プロビジョンド」に切り替えると安くなる場合があります
- 認証は **Cognito** に任せ、API Gateway の認可で Cognito のトークンを確かめます。Lambda で自前のログイン処理を書く必要がありません
- VPC を作らないので、サブネットや NAT Gateway の設計・料金も不要です

**よくある勘違い**: Lambda から RDS を使うと、接続数が急増して DB が詰まりやすくなります（RDS Proxy で緩和できます）。キーで引くデータなら DynamoDB の方が相性が良いです。`,
  modelAnswer: [
    { op: 'add', kind: 'cognito', name: 'ユーザープール' },
    { op: 'add', kind: 'apigw', name: '家計簿 API', config: { authorizer: 'cognito' } },
    { op: 'add', kind: 'lambda', name: 'API 処理' },
    { op: 'add', kind: 'dynamodb', name: '家計簿' },
    { op: 'connect', from: USER, to: COGNITO },
    { op: 'connect', from: USER, to: APIGW },
    { op: 'connect', from: APIGW, to: LAMBDA },
    { op: 'connect', from: LAMBDA, to: DDB },
  ],
  topics: ['apigw', 'lambda', 'dynamodb', 'cognito'],
};
