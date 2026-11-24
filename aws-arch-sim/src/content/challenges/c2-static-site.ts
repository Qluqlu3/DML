import type { Challenge } from '../../challenges/types';
import { configIs, connected, noDirect, reachable } from '../../engine/rules/predicates';
import { ACM, CF, R53, S3, USER, userOnly, WAF } from '../courses/shared';

export const c2: Challenge = {
  id: 'c2-static-site',
  title: '静的サイト配信',
  difficulty: 1,
  summary: 'キャンペーンサイトを、サーバーを持たずに安く・速く・安全に公開する。',
  brief: `来月から始まるキャンペーンの特設サイトを公開します。HTML・画像・JavaScript だけでできた**静的なサイト**で、テレビ CM の直後にアクセスが一気に集まる見込みです。

**要件**

- 独自ドメイン（campaign.example.com）でアクセスできる
- 世界中から速く表示できるよう、CDN から配信する
- ファイルの保存先は**一般公開しない**。CDN 経由でしか読めないようにする
- 攻撃的なアクセスをブロックできるようにする

**できれば**

- HTTPS 用の証明書を用意する
- 誤って上書き・削除したファイルを戻せるようにする
- 月額 $50 以内に収める`,
  initial: userOnly(),
  rules: [
    {
      id: 'dns',
      label: 'ユーザーが Route 53 を通って CloudFront に届く',
      severity: 'required',
      rule: reachable(USER, CF, { via: R53 }),
    },
    {
      id: 'waf',
      label: 'WAF を通って CloudFront に届く',
      severity: 'required',
      rule: reachable(USER, CF, { via: WAF }),
    },
    {
      id: 'origin',
      label: 'CloudFront から S3 への接続がある',
      severity: 'required',
      rule: connected(CF, S3),
    },
    {
      id: 'oac',
      label: 'CloudFront の OAC が有効',
      severity: 'required',
      rule: configIs(CF, 'oac', '==', true),
    },
    {
      id: 'bpa',
      label: 'S3 のブロックパブリックアクセスが有効',
      severity: 'required',
      rule: configIs(S3, 'blockPublicAccess', '==', true),
    },
    {
      id: 'no-direct',
      label: 'ユーザーが S3 に直接アクセスしていない',
      severity: 'required',
      rule: noDirect(USER, S3),
    },
    {
      id: 'acm',
      label: 'ACM の証明書を CloudFront で使っている',
      severity: 'recommended',
      rule: connected(ACM, CF),
    },
    {
      id: 'versioning',
      label: 'S3 のバージョニングが有効',
      severity: 'recommended',
      rule: configIs(S3, 'versioning', '==', true),
    },
  ],
  budgetUsd: 50,
  hints: [
    'サーバーは不要です。保存先は S3、配信は CloudFront に任せます',
    'リクエストの順番は ユーザー → Route 53 → WAF → CloudFront → S3 です',
    'CloudFront の OAC を有効にすると、S3 を非公開のまま CloudFront だけが読めます',
  ],
  explanation: `静的サイトは **S3 + CloudFront** が定番です。サーバーがないので、CM 直後のアクセス集中でも落ちる心配がほとんどなく、料金も使った分だけです。

- **OAC（Origin Access Control）** を有効にすると、S3 は非公開のまま CloudFront だけが読めます。S3 の静的ウェブサイトホスティングで直接公開する方法もありますが、HTTPS や WAF が使えず、URL を知られると CDN を迂回されます
- **WAF** は CloudFront に付けて、エッジで攻撃を止めます
- **ACM** の証明書は無料で、CloudFront に付けると独自ドメインで HTTPS が使えます（CloudFront 用の証明書はバージニア北部リージョンで作る点に注意）
- **バージョニング** を有効にしておくと、上書きや削除をしても前の版に戻せます

月額の目安は Route 53・CloudFront・WAF・S3 を合わせて $40 前後です。`,
  modelAnswer: [
    { op: 'add', kind: 'route53', name: 'campaign.example.com' },
    { op: 'add', kind: 'waf', name: 'WAF' },
    { op: 'add', kind: 'cloudfront', name: 'CDN', config: { oac: true } },
    { op: 'add', kind: 's3', name: 'サイト', config: { versioning: true } },
    { op: 'add', kind: 'acm', name: '証明書' },
    { op: 'connect', from: USER, to: R53 },
    { op: 'connect', from: R53, to: WAF },
    { op: 'connect', from: WAF, to: CF },
    { op: 'connect', from: CF, to: S3 },
    { op: 'connect', from: ACM, to: CF },
  ],
  topics: ['route53', 'waf', 'cloudfront', 's3', 'acm'],
};
