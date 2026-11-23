import {
  configIs,
  connected,
  distinctValues,
  exists,
  hasSg,
  not,
  placedIn,
  reachable,
  sgHasRule,
  spansAzs,
  subnetRoute,
} from '../../engine/rules/predicates';
import type { Selector } from '../../engine/rules/selector';
import type { Course } from '../../learning/types';

const USER: Selector = { kind: 'client' };
const VPC: Selector = { kind: 'vpc' };
const AZ: Selector = { kind: 'az' };
const IGW: Selector = { kind: 'igw' };
const EC2: Selector = { kind: 'ec2' };
const S3: Selector = { kind: 's3' };
const PUBLIC: Selector = { kind: 'subnet', where: { subnetType: 'public' } };
const PRIVATE: Selector = { kind: 'subnet', where: { subnetType: 'private' } };
const azAt = (az: 'first' | 'second'): Selector => ({ kind: 'az', where: { az } });

export const course0: Course = {
  id: 'basics',
  title: 'はじめての AWS',
  description:
    'キャンバスの使い方から始めて、VPC・サブネット・インターネットへの出入口・サーバー・セキュリティグループという、AWS の土台を順に組み立てます。',
  lessons: [
    // ------------------------------------------------------------------
    {
      id: 'basics-1-canvas',
      title: 'キャンバスの使い方と AWS の全体像',
      level: 1,
      summary:
        'ユーザー・VPC・S3 を置いて線でつなぎ、操作に慣れながら「VPC の中に置くもの」と「外に置くもの」の違いを知ります。',
      goals: [
        'パレットからドラッグして配置し、線で接続できる',
        'VPC が「自分専用のネットワーク」であることが分かる',
        'S3 のように VPC の外で動くサービスがあることが分かる',
      ],
      start: { from: 'empty' },
      steps: [
        {
          id: 'user',
          title: 'ユーザーを置こう',
          instruction:
            '左のパレットにある **ユーザー** を、キャンバスの好きな場所へドラッグしてください。\n\nクリックすると画面の中央に置くこともできます。',
          introduces: ['client'],
          highlight: { palette: ['client'] },
          checkpoints: [{ id: 'user', label: 'ユーザーがある', rule: exists(USER) }],
          hints: ['パレットの一番上の「ユーザー・外部」グループにあります'],
          answer: [{ op: 'add', kind: 'client', name: 'ユーザー' }],
          why: '構成図は「誰が、どこから、何にアクセスするか」を表すもの。まず通信の出発点になるユーザーを置くと、入口から順に考えられます。',
        },
        {
          id: 'vpc',
          title: 'VPC を置こう',
          instruction:
            'パレットの「ネットワーク枠」にある **VPC** を、ユーザーと重ならない場所へドラッグしてください。\n\nVPC は大きな枠です。見出し部分を掴むと動かせ、選択して四隅を引っぱるとサイズを変えられます。',
          introduces: ['vpc'],
          highlight: { palette: ['vpc'] },
          checkpoints: [{ id: 'vpc', label: 'VPC がある', rule: exists(VPC) }],
          hints: ['パレットの一番上「ネットワーク枠」の紫の枠が VPC です'],
          answer: [{ op: 'add', kind: 'vpc', name: 'VPC' }],
          why: 'VPC は AWS の中に作る自分専用のネットワーク。サーバーやデータベースはこの中に置き、外からの出入りを自分で管理します。',
        },
        {
          id: 's3',
          title: 'S3 を VPC の外に置こう',
          instruction:
            'パレットの「ストレージ」にある **S3** を、**VPC の外**へドラッグしてください。\n\n試しに VPC の中へ落としてみると、置けない理由が表示されます。',
          introduces: ['s3'],
          highlight: { palette: ['s3'] },
          checkpoints: [{ id: 's3', label: 'S3 がある', rule: exists(S3) }],
          hints: ['S3 は VPC の中には置けません。VPC の枠の外の空いている場所に落としてください'],
          answer: [{ op: 'add', kind: 's3', name: 'S3' }],
          why: 'S3 は AWS が管理する場所で動くサービスで、VPC の中には入りません。インターネットや VPC から API で呼び出して使います。',
          badExample:
            '「全部 VPC の中に入れれば安全」と考えがちですが、S3 や Lambda などは VPC の外で動くのが基本です。置き場所の違いを知っておくと構成図が読みやすくなります。',
        },
        {
          id: 'connect',
          title: 'ユーザーから S3 へ線でつなごう',
          instruction:
            '**ユーザー** にマウスを乗せると、四辺に点が出ます。点からドラッグを始めて、**S3** の上で離してください。\n\n矢印の向きは「リクエストを送る方向」です。',
          highlight: { nodes: [USER, S3] },
          checkpoints: [
            { id: 'connect', label: 'ユーザーから S3 への接続がある', rule: connected(USER, S3) },
          ],
          hints: [
            'ノードの縁に出る小さな点からドラッグします。ノードの真ん中を掴むと移動になります',
            '線を消したいときは、線をクリックして Delete キーを押します',
          ],
          answer: [{ op: 'connect', from: USER, to: S3 }],
          why: '線は通信の流れを表します。どこからどこへリクエストが流れるかを図にすると、入口や守るべき場所が見えてきます。',
        },
      ],
      quiz: [
        {
          question: 'VPC について正しいものはどれ？',
          choices: [
            {
              text: 'AWS の中に作る、自分専用のネットワーク',
              correct: true,
              explanation:
                'そのとおり。IP アドレスの範囲を決めて、論理的に分離したネットワークを作ります。',
            },
            {
              text: 'ファイルを保存するためのストレージ',
              correct: false,
              explanation: 'ファイルの保存は S3 の役割です。',
            },
            {
              text: 'AWS のすべてのサービスは VPC の中に置かなければならない',
              correct: false,
              explanation: 'S3 のように VPC の外で動くサービスもあります。',
            },
          ],
        },
        {
          question: '構成図の矢印（接続線）の向きが表すものは？',
          choices: [
            {
              text: 'リクエストを送る方向',
              correct: true,
              explanation:
                'このアプリでは、矢印の向きを「どちらからリクエストを送るか」で統一しています。',
            },
            {
              text: '料金が高い順',
              correct: false,
              explanation: '線は通信の流れを表し、料金とは関係ありません。',
            },
          ],
        },
      ],
      wrapUp:
        'パレットからの配置・線での接続・VPC の内と外という、構成図づくりの基本を体験しました。次のレッスンでは、VPC の中を AZ とサブネットで区切っていきます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'basics-2-subnets',
      title: 'VPC を AZ とサブネットで区切る',
      level: 1,
      summary:
        'VPC の中に 2 つの AZ を置き、それぞれに Public / Private サブネットを作ります。本番環境でよく使う「2 AZ × 2 種類」の土台です。',
      goals: [
        'AZ に分けて置く理由（障害への備え）が分かる',
        'サブネットは 1 つの AZ に属することが分かる',
        'Public と Private の 2 種類のサブネットを作れる',
      ],
      start: {
        from: 'document',
        doc: {
          version: 1,
          nodes: [
            {
              id: 'vpc-main',
              kind: 'vpc',
              name: 'VPC',
              config: { cidr: '10.0.0.0/16' },
              position: { x: 0, y: 0 },
              width: 880,
              height: 700,
            },
          ],
          edges: [],
          securityGroups: [],
        },
      },
      steps: [
        {
          id: 'azs',
          title: 'AZ を 2 つ置こう',
          instruction:
            'パレットの **Availability Zone** を、光っている **VPC の中** に 2 回ドラッグして、左右に並べてください。\n\n2 つ目を置くと、AZ 名が自動で別のもの（1a と 1c など）になります。',
          introduces: ['az'],
          highlight: { palette: ['az'], nodes: [VPC] },
          checkpoints: [
            { id: 'two-azs', label: 'AZ が 2 つある', rule: exists(AZ, 2) },
            {
              id: 'distinct',
              label: '2 つの AZ が別々の AZ 名になっている',
              rule: distinctValues(AZ, 'azName', 2, 'AZ 名'),
            },
          ],
          hints: [
            'AZ は VPC の中にしか置けません',
            'AZ 名が同じになったら、AZ を選んで右のプロパティで変更できます',
          ],
          answer: [
            { op: 'add', kind: 'az', in: VPC, name: 'AZ a', config: { azName: 'ap-northeast-1a' } },
            { op: 'add', kind: 'az', in: VPC, name: 'AZ c', config: { azName: 'ap-northeast-1c' } },
          ],
          why: 'AZ は電源やネットワークが独立したデータセンターのまとまり。2 つの AZ に分けておけば、片方で障害が起きても、もう片方でサービスを続けられます。',
          badExample:
            'AZ が 1 つだけだと、その AZ で停電や障害が起きたときにサービス全体が止まります。',
        },
        {
          id: 'public',
          title: '各 AZ に Public サブネットを作ろう',
          instruction:
            'パレットの **Subnet** を、**それぞれの AZ の上半分** にドラッグしてください。\n\nAZ の上半分に落とすと Public、下半分に落とすと Private になります（あとからプロパティでも変えられます）。',
          introduces: ['subnet'],
          highlight: { palette: ['subnet'], nodes: [AZ] },
          checkpoints: [
            { id: 'two-public', label: 'Public サブネットが 2 つある', rule: exists(PUBLIC, 2) },
            {
              id: 'public-azs',
              label: 'Public サブネットが 2 つの AZ に分かれている',
              rule: spansAzs(PUBLIC, 2),
            },
          ],
          hints: [
            'サブネットは AZ の中にしか置けません',
            '種別を間違えたら、サブネットの見出しをクリックして、プロパティの「種別」を Public にします',
          ],
          answer: [
            {
              op: 'add',
              kind: 'subnet',
              in: azAt('first'),
              name: 'Public a',
              config: { subnetType: 'public', cidr: '10.0.1.0/24' },
            },
            {
              op: 'add',
              kind: 'subnet',
              in: azAt('second'),
              name: 'Public c',
              config: { subnetType: 'public', cidr: '10.0.2.0/24' },
            },
          ],
          why: 'サブネットは必ず 1 つの AZ に属します。AZ ごとにサブネットを用意しておくと、あとで置くサーバーも AZ ごとに分けられます。',
        },
        {
          id: 'private',
          title: '各 AZ に Private サブネットを作ろう',
          instruction:
            '同じように **Subnet** を、**それぞれの AZ の下半分** にドラッグして、Private サブネットを 2 つ作ってください。',
          highlight: { palette: ['subnet'], nodes: [AZ] },
          checkpoints: [
            { id: 'two-private', label: 'Private サブネットが 2 つある', rule: exists(PRIVATE, 2) },
            {
              id: 'private-azs',
              label: 'Private サブネットが 2 つの AZ に分かれている',
              rule: spansAzs(PRIVATE, 2),
            },
          ],
          hints: ['AZ の下半分に落とすと、最初から Private になります'],
          answer: [
            {
              op: 'add',
              kind: 'subnet',
              in: azAt('first'),
              name: 'Private a',
              config: { subnetType: 'private', cidr: '10.0.11.0/24' },
            },
            {
              op: 'add',
              kind: 'subnet',
              in: azAt('second'),
              name: 'Private c',
              config: { subnetType: 'private', cidr: '10.0.12.0/24' },
            },
          ],
          why: 'Public には外とやり取りするもの（ロードバランサーなど）、Private には外から直接触らせたくないもの（アプリや DB）を置きます。役割で部屋を分けておくと、守る範囲がはっきりします。',
          badExample:
            'すべてを Public サブネットに置くと、DB のように外から直接アクセスされてはいけないものまで攻撃の入口になり得ます。',
        },
      ],
      quiz: [
        {
          question: 'サーバーを 2 つの AZ に分けて置く一番の目的は？',
          choices: [
            {
              text: '片方の AZ で障害が起きてもサービスを続けるため',
              correct: true,
              explanation:
                'AZ は互いに独立しているので、分けておけば 1 つの AZ の障害に耐えられます。',
            },
            {
              text: '料金を安くするため',
              correct: false,
              explanation:
                '台数が増える分、むしろ料金は上がります。目的は可用性（止まりにくさ）です。',
            },
            {
              text: '通信を速くするため',
              correct: false,
              explanation: 'AZ をまたぐ通信はわずかに遅くなることもあります。',
            },
          ],
        },
        {
          question: 'サブネットについて正しいものは？',
          choices: [
            {
              text: '1 つのサブネットは 1 つの AZ に属する',
              correct: true,
              explanation: 'そのとおり。複数の AZ にまたがるサブネットは作れません。',
            },
            {
              text: '1 つのサブネットで複数の AZ をカバーできる',
              correct: false,
              explanation: 'サブネットは AZ ごとに作ります。だから AZ ごとにサブネットが必要です。',
            },
          ],
        },
      ],
      wrapUp:
        '2 つの AZ に Public / Private サブネットを用意できました。ただ、今はまだ「Public」は名前だけです。次のレッスンでインターネットへの出入口を付けて、本当に Public にします。',
    },
    // ------------------------------------------------------------------
    {
      id: 'basics-3-internet',
      title: 'インターネットにつなぐ（IGW とルート）',
      level: 1,
      summary:
        'VPC にインターネットゲートウェイを付け、Public サブネットのルートを向けて、インターネットとつながるサブネットを作ります。',
      goals: [
        'IGW が VPC とインターネットの出入口であることが分かる',
        'Public / Private の違いは「ルート」で決まることが分かる',
      ],
      start: { from: 'lesson', lessonId: 'basics-2-subnets' },
      steps: [
        {
          id: 'igw',
          title: 'インターネットゲートウェイを置こう',
          instruction:
            'パレットの「ネットワーク」にある **Internet Gateway** を、光っている **VPC の中**（AZ の外の空いた場所）にドラッグしてください。',
          introduces: ['igw'],
          highlight: { palette: ['igw'], nodes: [VPC] },
          checkpoints: [{ id: 'igw', label: 'Internet Gateway がある', rule: exists(IGW) }],
          hints: ['IGW は VPC に取り付けるものなので、サブネットではなく VPC の枠の中に置きます'],
          answer: [{ op: 'add', kind: 'igw', in: VPC, name: 'IGW' }],
          why: 'IGW は VPC とインターネットをつなぐ玄関です。これがないと、VPC の中のものはインターネットと一切通信できません。',
        },
        {
          id: 'route',
          title: 'Public サブネットのルートを IGW に向けよう',
          instruction:
            '**Public サブネットの見出し** をクリックして選択し、右のプロパティの **デフォルトルート** を **IGW** にしてください。2 つの Public サブネットの両方で行います。\n\n見出しの「外部ルートなし」が「→ IGW」に変わります。',
          highlight: { nodes: [PUBLIC] },
          checkpoints: [
            {
              id: 'route',
              label: 'Public サブネットのデフォルトルートが IGW',
              rule: subnetRoute('public', 'igw'),
            },
            {
              id: 'private-stays',
              label: 'Private サブネットは外部ルートなしのまま',
              rule: subnetRoute('private', 'none'),
            },
          ],
          hints: [
            'サブネットは見出し部分（Public a などと書かれた帯）をクリックすると選択できます',
            'デフォルトルート（0.0.0.0/0）は「行き先が VPC 外のとき、どこへ送るか」の設定です',
          ],
          answer: [{ op: 'route', subnets: PUBLIC, to: IGW }],
          why: 'サブネットが Public か Private かは、名前ではなく「インターネット宛ての通信を IGW に送るルートがあるか」で決まります。ルートを IGW に向けて、初めて Public サブネットになります。',
          badExample:
            'IGW を置いただけでルートを設定し忘れると、Public のつもりのサブネットからインターネットにつながらず、サイトが表示されない原因になります。',
        },
        {
          id: 'user',
          title: 'ユーザーから IGW へつなごう',
          instruction:
            '**ユーザー** を VPC の外に置き、ユーザーから **IGW** へ線をつないでください。インターネットからの通信が IGW を通って VPC に入ることを表します。',
          introduces: ['client'],
          highlight: { palette: ['client'], nodes: [IGW] },
          checkpoints: [
            { id: 'connect', label: 'ユーザーから IGW への接続がある', rule: connected(USER, IGW) },
          ],
          hints: ['ユーザーの縁の点からドラッグして、IGW の上で離します'],
          answer: [
            { op: 'add', kind: 'client', name: 'ユーザー' },
            { op: 'connect', from: USER, to: IGW },
          ],
          why: 'インターネットからの通信は、必ず IGW を通って VPC に入ります。入口が 1 か所に決まっているので、守る場所もはっきりします。',
        },
      ],
      quiz: [
        {
          question: 'サブネットが「Public サブネット」になる条件は？',
          choices: [
            {
              text: 'デフォルトルートが IGW に向いていること',
              correct: true,
              explanation:
                'インターネット宛ての通信を IGW に送るルートがあるサブネットが Public です。',
            },
            {
              text: '名前に Public と付けること',
              correct: false,
              explanation: '名前は分かりやすさのためのもので、動作には影響しません。',
            },
            {
              text: 'VPC の中にあること',
              correct: false,
              explanation: 'サブネットはすべて VPC の中にあります。違いはルートです。',
            },
          ],
        },
        {
          question:
            'IGW を VPC に付けたのに、サブネットからインターネットにつながりません。まず確認すべきは？',
          choices: [
            {
              text: 'サブネットのルートが IGW に向いているか',
              correct: true,
              explanation: 'IGW は付けるだけでは使われません。ルートの設定が必要です。',
            },
            {
              text: 'AZ の名前',
              correct: false,
              explanation: 'AZ 名はインターネットへの接続とは関係ありません。',
            },
          ],
        },
      ],
      wrapUp:
        'IGW とルートで、インターネットとつながる Public サブネットができました。次のレッスンでは、ここに Web サーバー（EC2）を置きます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'basics-4-ec2',
      title: 'はじめての Web サーバー（EC2）',
      level: 1,
      summary:
        'Public サブネットに EC2 を置き、ユーザー → IGW → EC2 の経路をつないで、インターネットから見える Web サーバーを作ります。',
      goals: [
        'EC2 がどのサブネットに置かれるかで、外から届くかが変わることが分かる',
        'インスタンスタイプで性能と料金を選べることが分かる',
      ],
      start: { from: 'lesson', lessonId: 'basics-3-internet' },
      steps: [
        {
          id: 'ec2',
          title: 'EC2 を Public サブネットに置こう',
          instruction:
            'パレットの「コンピュート」にある **EC2 インスタンス** を、光っている **1 つ目の AZ の Public サブネット** にドラッグしてください。',
          introduces: ['ec2'],
          highlight: {
            palette: ['ec2'],
            nodes: [{ kind: 'subnet', where: { subnetType: 'public', az: 'first' } }],
          },
          checkpoints: [
            { id: 'ec2', label: 'EC2 がある', rule: exists(EC2) },
            {
              id: 'public',
              label: 'EC2 が Public サブネットにある',
              rule: placedIn(EC2, 'public'),
            },
          ],
          hints: ['EC2 はサブネットの中にしか置けません。サブネットの空いている場所に落とします'],
          answer: [
            {
              op: 'add',
              kind: 'ec2',
              in: { kind: 'subnet', where: { subnetType: 'public', az: 'first' } },
              name: 'Web',
            },
          ],
          why: 'インターネットから直接アクセスされるサーバーは、IGW へのルートがある Public サブネットに置く必要があります。',
          badExample:
            'Private サブネットに置くと、インターネットからの通信が届かず、Web サイトが見えません（本格的な構成ではロードバランサーを使い、サーバーは Private に置きます。これはコース 1 で学びます）。',
        },
        {
          id: 'path',
          title: 'IGW から EC2 へつなごう',
          instruction:
            '**IGW** から **EC2** へ線をつないでください。これで「ユーザー → IGW → EC2」とリクエストが流れる経路ができます。',
          highlight: { nodes: [IGW, EC2] },
          checkpoints: [
            { id: 'igw-ec2', label: 'IGW から EC2 への接続がある', rule: connected(IGW, EC2) },
            {
              id: 'reach',
              label: 'ユーザーから IGW を通って EC2 まで届く',
              rule: reachable(USER, EC2, { via: IGW }),
            },
          ],
          hints: ['IGW の縁の点からドラッグして、EC2 の上で離します'],
          answer: [{ op: 'connect', from: IGW, to: EC2 }],
          why: '線をたどると、リクエストがどこを通るかが分かります。入口（IGW）から目的のサーバーまで、経路が途切れていないことを確認しましょう。',
        },
        {
          id: 'type',
          title: 'インスタンスタイプを t3.micro にしよう',
          instruction:
            '**EC2** をクリックして選択し、右のプロパティで **インスタンスタイプ** を **t3.micro** に変えてください。',
          highlight: { nodes: [EC2] },
          checkpoints: [
            {
              id: 'type',
              label: 'インスタンスタイプが t3.micro',
              rule: configIs(EC2, 'instanceType', '==', 't3.micro'),
            },
          ],
          hints: ['プロパティは画面右側に表示されます'],
          answer: [{ op: 'config', target: EC2, set: { instanceType: 't3.micro' } }],
          why: 'インスタンスタイプは CPU とメモリの量を決めます。小さいタイプほど安く、検証や小さなサイトなら t3.micro で十分なこともあります。必要に応じて、あとから大きくできます。',
          badExample:
            '最初から大きすぎるタイプを選ぶと、使っていない性能にも料金を払い続けることになります。',
        },
      ],
      quiz: [
        {
          question: 'EC2 の料金の考え方として正しいものは？',
          choices: [
            {
              text: '起動している時間 × インスタンスタイプの単価',
              correct: true,
              explanation: '止めている間はコンピュートの料金はかからず、ディスク代だけになります。',
            },
            {
              text: '作成した台数だけで決まり、起動時間は関係ない',
              correct: false,
              explanation: 'EC2 は時間（秒）単位の課金です。',
            },
          ],
        },
        {
          question: 'インターネットから EC2 にアクセスできないとき、構成図で確かめることは？',
          choices: [
            {
              text: 'EC2 が IGW へのルートがあるサブネットにあり、経路がつながっているか',
              correct: true,
              explanation: 'サブネットのルートと、入口から EC2 までの経路の両方が必要です。',
            },
            {
              text: 'EC2 の名前',
              correct: false,
              explanation: '名前は通信には影響しません。',
            },
          ],
        },
      ],
      wrapUp:
        'インターネットから届く Web サーバーができました。ただ、今のままでは「どんな通信を受け付けるか」が決まっていません。次のレッスンで、セキュリティグループを使って通信を絞ります。',
    },
    // ------------------------------------------------------------------
    {
      id: 'basics-5-sg',
      title: 'セキュリティグループで通信を絞る',
      level: 1,
      summary:
        'EC2 にセキュリティグループを付け、Web の通信（80 / 443）だけを全体に許可し、管理用の SSH は会社の IP からだけに絞ります。',
      goals: [
        'セキュリティグループが「許可リスト」であることが分かる',
        'ポートと送信元（CIDR）でルールを書ける',
        '管理用のポートを全開放してはいけない理由が分かる',
      ],
      start: { from: 'lesson', lessonId: 'basics-4-ec2' },
      steps: [
        {
          id: 'sg',
          title: 'EC2 にセキュリティグループを付けよう',
          instruction:
            '**EC2** を選択し、プロパティの「セキュリティグループ」で **+ 新しい SG を作成して割り当て** を押してください。',
          introduces: ['sg'],
          highlight: { nodes: [EC2] },
          checkpoints: [{ id: 'sg', label: 'EC2 にセキュリティグループがある', rule: hasSg(EC2) }],
          hints: ['作った SG は、右側の「セキュリティグループ」タブで中身を編集できます'],
          answer: [{ op: 'createSg', for: EC2, name: 'web-sg' }],
          why: 'セキュリティグループは、サーバーごとの通信の許可リストです。ルールが 1 つもない SG は、すべての受信を拒否します。',
        },
        {
          id: 'web',
          title: 'Web の通信（80 と 443）を許可しよう',
          instruction:
            '右側の **セキュリティグループ** タブを開き、EC2 の SG に次の 2 つのルールを追加してください。\n\n- ポート **80**（HTTP）、送信元 CIDR **0.0.0.0/0**\n- ポート **443**（HTTPS）、送信元 CIDR **0.0.0.0/0**',
          checkpoints: [
            {
              id: 'http',
              label: 'インターネットからの 80 を許可',
              rule: sgHasRule(EC2, 80, 'internet'),
            },
            {
              id: 'https',
              label: 'インターネットからの 443 を許可',
              rule: sgHasRule(EC2, 443, 'internet'),
            },
          ],
          hints: [
            '「+ ルールを追加」で行が増えます。ポートの欄に 80 や 443 を入力します',
            '0.0.0.0/0 は「インターネット上のすべての IP アドレス」という意味です',
          ],
          answer: [
            { op: 'allow', to: EC2, from: { cidr: '0.0.0.0/0' }, port: 80 },
            { op: 'allow', to: EC2, from: { cidr: '0.0.0.0/0' }, port: 443 },
          ],
          why: 'Web サイトは誰でも見られる必要があるので、Web のポート（80 / 443）はインターネット全体から許可します。許可するのは必要なポートだけです。',
        },
        {
          id: 'ssh',
          title: '管理用の SSH は会社の IP からだけ許可しよう',
          instruction:
            'サーバーにログインするための **SSH（ポート 22）** を、会社のネットワーク **203.0.113.0/24** からだけ許可するルールを追加してください。\n\n**0.0.0.0/0 からの 22 は許可しない** ことがポイントです。',
          checkpoints: [
            {
              id: 'ssh',
              label: '限定した送信元からの 22 を許可',
              rule: sgHasRule(EC2, 22, 'restricted'),
            },
            {
              id: 'no-open-ssh',
              label: 'インターネット全体からの 22 は許可していない',
              rule: not(
                sgHasRule(EC2, 22, 'internet'),
                'SSH(22) がインターネット全体（0.0.0.0/0）に開いています',
              ),
            },
          ],
          hints: [
            '送信元は CIDR のまま、値を 203.0.113.0/24 に書き換えます',
            '203.0.113.0/24 は説明用に予約された IP アドレスの範囲です',
          ],
          answer: [{ op: 'allow', to: EC2, from: { cidr: '203.0.113.0/24' }, port: 22 }],
          why: 'SSH はサーバーを操作できる強力な入口です。決まった場所（会社など）からだけに絞ることで、世界中からのパスワード総当たり攻撃を受けなくなります。',
          badExample:
            'SSH を 0.0.0.0/0 に開けると、公開から数分で世界中から自動的にログインを試みられます。実際の情報漏えいでもよくある原因です。',
        },
      ],
      quiz: [
        {
          question: 'ルールが 1 つもないセキュリティグループを付けた EC2 は？',
          choices: [
            {
              text: 'どこからの通信も受け付けない',
              correct: true,
              explanation: 'SG は許可リストなので、許可がなければすべて拒否されます。',
            },
            {
              text: 'すべての通信を受け付ける',
              correct: false,
              explanation: '逆です。許可したものだけが通ります。',
            },
          ],
        },
        {
          question: 'SSH(22) のルールとして最も適切なものは？',
          choices: [
            {
              text: '会社など、決まった IP の範囲からだけ許可する',
              correct: true,
              explanation: '管理用の入口は、必要な場所からだけに絞るのが基本です。',
            },
            {
              text: 'いつでもどこからでも使えるよう 0.0.0.0/0 から許可する',
              correct: false,
              explanation: '世界中から攻撃を受ける入口になります。',
            },
            {
              text: 'Web と同じなので 80 番ポートで許可すれば十分',
              correct: false,
              explanation: 'SSH は 22 番ポートです。ポートは用途ごとに決まっています。',
            },
          ],
        },
        {
          question: '0.0.0.0/0 が表すものは？',
          choices: [
            {
              text: 'インターネット上のすべての IP アドレス',
              correct: true,
              explanation: '「どこからでも」という意味になります。',
            },
            {
              text: '自分の VPC の中だけ',
              correct: false,
              explanation: 'VPC の中だけなら、VPC の CIDR（10.0.0.0/16 など）を指定します。',
            },
          ],
        },
      ],
      wrapUp:
        'これでコース 0 は完了です。VPC・AZ・サブネット・IGW・EC2・セキュリティグループという AWS の土台がそろいました。次のコースでは、ロードバランサーと複数台のサーバーで、止まりにくい Web アプリの定番構成を作ります。',
    },
  ],
};
